import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Schema } from "@google/generative-ai";

// ---------------------------------------------------------------------------
// System prompt — injected once per request, guides tone and section quality.
// Kept under ~1,500 tokens so it stays cheap at Gemini Flash rates.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are an expert nonprofit impact report writer with deep experience producing
grant-ready Impact Study Reports for community organizations. Your writing is professional,
compelling, and grounded in data. You never fabricate statistics — you only reference
numbers explicitly provided to you.

WRITING STANDARDS
- Tone: authoritative, warm, data-driven; avoid jargon and clichés
- Length per section: 2–4 paragraphs (150–250 words each)
- No emojis, no bullet points inside narrative sections
- Consistent tense: past tense for completed programs, present tense for active ones
- Spell out numbers under ten; use numerals with commas for 10 and above
- If a field is empty or "Not provided," write around it naturally — do not note its absence

SECTION-BY-SECTION GUIDELINES

executiveSummary
Open with the organization name and program name. Lead with the headline achievement
(primary metric total). Situate the work geographically. State goal progress if a target
was provided. Close with one forward-looking sentence connecting results to mission.

communityNeed
Describe the gap or problem this program addresses. Ground it in the target population
and service geography. When poverty rate or median income data is provided, cite it to
establish economic urgency — e.g., "In this community, X% of residents live below the
poverty line." Connect the need directly to why this program was created.

programDesign
Explain how the program works — its activities, delivery approach, and what it measures.
Reference the metrics tracked (participant counts, resource distributions, etc.) and why
those indicators were chosen. If an age range is specified, note its developmental
significance. Reference program type and timeframe when available.

outcomesImpact
Lead with total primary metric achieved. Break down by geography (SPA → City → County →
State) where data exists. Include population reach percentage when provided — translate
it into plain language (e.g., "reaching 4.2% of county residents"). Address secondary
metrics and what they represent for real people in the community.

lessonsLearned
Identify what the data shows worked well (strong months, high-performing geographies,
efficient cost ratios). Acknowledge areas for growth without being negative. Frame
challenges as opportunities. End with two or three concrete next-step opportunities
grounded in the results.

callToAction
Open with a direct, energizing ask. If cost-per-participant is provided, build two or
three donor giving tiers around it (e.g., "$75 provides full program access for one
participant"). Name specific ways donors, corporate partners, or volunteers can engage.
Close by restating the organization's mission or vision to reinforce impact.`;

// ---------------------------------------------------------------------------
// Response schema — enforces consistent JSON keys and string types
// ---------------------------------------------------------------------------
const NARRATIVE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    executiveSummary: { type: SchemaType.STRING },
    communityNeed:    { type: SchemaType.STRING },
    programDesign:    { type: SchemaType.STRING },
    outcomesImpact:   { type: SchemaType.STRING },
    lessonsLearned:   { type: SchemaType.STRING },
    callToAction:     { type: SchemaType.STRING },
  },
  required: [
    "executiveSummary",
    "communityNeed",
    "programDesign",
    "outcomesImpact",
    "lessonsLearned",
    "callToAction",
  ],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface NarrativeInput {
  programName: string;
  programDescription: string;
  programType: string;
  orgName: string;
  orgMission: string;
  orgVision: string;
  targetPopulation: string;
  goals: string;
  totalParticipants: number;
  primaryMetricName: string;
  geographies: string;
  totalCost: number;
  costPerParticipant: string | null;
  metrics: { name: string; unit: string; countsAsParticipant?: boolean }[];
}

export interface AiNarrative {
  executiveSummary: string;
  communityNeed:    string;
  programDesign:    string;
  outcomesImpact:   string;
  lessonsLearned:   string;
  callToAction:     string;
}

// ---------------------------------------------------------------------------
// Main generation function
// ---------------------------------------------------------------------------
export async function generateNarrative(input: NarrativeInput): Promise<AiNarrative> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
  });

  const participantMetrics = input.metrics.filter(m => m.countsAsParticipant !== false);
  const resourceMetrics   = input.metrics.filter(m => m.countsAsParticipant === false);

  const userPrompt = `Generate an Impact Study Report narrative for the following program.

ORGANIZATION
- Name: ${input.orgName || "Not provided"}
- Mission: ${input.orgMission || "Not provided"}
- Vision: ${input.orgVision || "Not provided"}

PROGRAM
- Name: ${input.programName}
- Type: ${input.programType || "General"}
- Description: ${input.programDescription || "Not provided"}
- Status: Active
- Target Population: ${input.targetPopulation || "General community"}
- Goals: ${input.goals || "Not specified"}

IMPACT METRICS TRACKED
- Participant metrics (count toward total served): ${participantMetrics.map(m => `${m.name} (${m.unit})`).join(", ") || "None specified"}
- Resource/activity metrics: ${resourceMetrics.map(m => `${m.name} (${m.unit})`).join(", ") || "None"}

RESULTS
- Primary metric (${input.primaryMetricName}): ${input.totalParticipants.toLocaleString()} total served
- Geographies served: ${input.geographies || "Not specified"}
- Total program cost: ${input.totalCost > 0 ? "$" + Number(input.totalCost).toLocaleString() : "Not tracked"}
- Cost per participant: ${input.costPerParticipant ? "$" + input.costPerParticipant : "Not tracked"}

Write all six narrative sections now.`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: NARRATIVE_SCHEMA,
    },
  });

  const text = result.response.text();
  return JSON.parse(text) as AiNarrative;
}
