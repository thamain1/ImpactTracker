/**
 * Gemini 2.5 Flash AI report generator — Workers-compatible (uses fetch directly).
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

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
establish economic urgency. Connect the need directly to why this program was created.

programDesign
Explain how the program works — its activities, delivery approach, and what it measures.
Reference the metrics tracked and why those indicators were chosen. Reference program type
and timeframe when available.

outcomesImpact
Lead with total primary metric achieved. Break down by geography where data exists.
Include population reach percentage when provided. Address secondary metrics and what
they represent for real people in the community.

lessonsLearned
Identify what the data shows worked well. Acknowledge areas for growth without being
negative. End with two or three concrete next-step opportunities grounded in the results.

callToAction
Open with a direct, energizing ask. If cost-per-participant is provided, build two or
three donor giving tiers around it. Name specific ways donors, corporate partners, or
volunteers can engage. Close by restating the organization's mission or vision.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    executiveSummary: { type: "string" },
    communityNeed:    { type: "string" },
    programDesign:    { type: "string" },
    outcomesImpact:   { type: "string" },
    lessonsLearned:   { type: "string" },
    callToAction:     { type: "string" },
  },
  required: ["executiveSummary", "communityNeed", "programDesign", "outcomesImpact", "lessonsLearned", "callToAction"],
};

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

export async function generateNarrative(apiKey: string, input: NarrativeInput): Promise<AiNarrative> {
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
- Participant metrics: ${participantMetrics.map(m => `${m.name} (${m.unit})`).join(", ") || "None specified"}
- Resource/activity metrics: ${resourceMetrics.map(m => `${m.name} (${m.unit})`).join(", ") || "None"}

RESULTS
- Primary metric (${input.primaryMetricName}): ${input.totalParticipants.toLocaleString()} total served
- Geographies served: ${input.geographies || "Not specified"}
- Total program cost: ${input.totalCost > 0 ? "$" + Number(input.totalCost).toLocaleString() : "Not tracked"}
- Cost per participant: ${input.costPerParticipant ? "$" + input.costPerParticipant : "Not tracked"}

Write all six narrative sections now.`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  const res = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json() as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No text in Gemini response");
  return JSON.parse(text) as AiNarrative;
}
