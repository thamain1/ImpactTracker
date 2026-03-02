/**
 * Gemini 2.5 Flash AI report generator — Workers-compatible (uses fetch directly).
 * Supports 4 audience personas: general, grantmaker, stakeholder, sponsor.
 */

import { systemPrompt as generalPrompt }     from "./personas/general";
import { systemPrompt as grantmakerPrompt }  from "./personas/grantmaker";
import { systemPrompt as stakeholderPrompt } from "./personas/stakeholder";
import { systemPrompt as sponsorPrompt }     from "./personas/sponsor";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// ─── Persona system prompts ───────────────────────────────────────────────────

const PERSONA_SYSTEM_PROMPTS: Record<PersonaKey, string> = {
  general:     generalPrompt,
  grantmaker:  grantmakerPrompt,
  stakeholder: stakeholderPrompt,
  sponsor:     sponsorPrompt,
};

// ─── Persona response schema (nested report + qa) ────────────────────────────

const PERSONA_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    report: {
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
    },
    qa: {
      type: "object",
      properties: {
        programStatusUsed: { type: "string" },
        numbersReferenced: { type: "array", items: { type: "object" } },
        derivedNumbers:    { type: "array", items: { type: "object" } },
        factsUsed:         { type: "array", items: { type: "object" } },
        missingOrEmptyFields: { type: "array", items: { type: "string" } },
        complianceChecklist: { type: "object" },
        redFlags:          { type: "array", items: { type: "string" } },
      },
      required: ["programStatusUsed", "numbersReferenced", "derivedNumbers", "factsUsed", "missingOrEmptyFields", "complianceChecklist", "redFlags"],
    },
  },
  required: ["report", "qa"],
};

// ─── Legacy flat response schema (original behavior) ─────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

export type PersonaKey = "general" | "grantmaker" | "stakeholder" | "sponsor";

export interface NarrativeInput {
  programName: string;
  programDescription: string;
  programType: string;
  programStatus?: "active" | "completed" | "mixed" | "unknown";
  startDate?: string | null;
  endDate?: string | null;
  orgName: string;
  orgMission: string;
  orgVision: string;
  targetPopulation: string;
  goals: string;
  goalTarget?: number | null;
  totalParticipants: number;
  primaryMetricName: string;
  geographies: string;
  geographyList?: string[];
  statsByGeo?: { geography: string; value: number }[] | null;
  reachPercent?: number | null;
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

// ─── Build structured persona input JSON ─────────────────────────────────────

function buildPersonaInputJson(input: NarrativeInput): object {
  const validStatuses = ["active", "completed", "mixed", "unknown"] as const;
  const status = validStatuses.includes(input.programStatus as any)
    ? input.programStatus!
    : "unknown";

  const geoList = input.geographyList && input.geographyList.length > 0
    ? input.geographyList
    : (input.geographies ? input.geographies.split(", ").filter(Boolean) : []);

  const participantMetrics = input.metrics.filter(m => m.countsAsParticipant !== false);
  const resourceMetrics    = input.metrics.filter(m => m.countsAsParticipant === false);
  const primaryUnit = participantMetrics[0]?.unit || null;

  const cppRaw = input.costPerParticipant;
  const cppNum = cppRaw ? parseFloat(cppRaw.replace(/[$,\s]/g, "")) : null;

  return {
    org: {
      name: input.orgName || "Not provided",
      mission: input.orgMission || null,
      vision: input.orgVision || null,
    },
    program: {
      name: input.programName,
      type: input.programType || null,
      status,
      description: input.programDescription || null,
      timeframe: {
        startDate: input.startDate || null,
        endDate: input.endDate || null,
      },
      serviceGeographies: geoList,
      targetPopulation: input.targetPopulation || null,
    },
    participants: {
      totalParticipants: input.totalParticipants || null,
      reachPercent: input.reachPercent || null,
    },
    financials: {
      totalCost: input.totalCost > 0 ? input.totalCost : null,
      costPerParticipant: cppNum && !isNaN(cppNum) ? cppNum : null,
      givingTiers: null,
    },
    metrics: {
      primary: {
        name: input.primaryMetricName,
        unit: primaryUnit,
        total: input.totalParticipants || null,
        target: input.goalTarget || null,
        byGeography: input.statsByGeo && input.statsByGeo.length > 0 ? input.statsByGeo : null,
      },
      secondary: resourceMetrics.length > 0
        ? resourceMetrics.map(m => ({ name: m.name, unit: m.unit || null, value: null, notes: null }))
        : null,
    },
    allowedMath: { enableDerivedNumbers: false },
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateNarrative(
  apiKey: string,
  input: NarrativeInput,
  persona?: PersonaKey,
): Promise<AiNarrative> {
  // ── Persona path (structured JSON input + persona system prompt) ──────────
  if (persona && PERSONA_SYSTEM_PROMPTS[persona]) {
    const structuredInput = buildPersonaInputJson(input);
    const userPrompt = `INPUT_JSON:\n${JSON.stringify(structuredInput, null, 2)}\n\nINSTRUCTIONS:\n- Use only the data in INPUT_JSON.\n- If a value is missing or empty, write around it naturally — do not mention it is missing.\n- Return JSON only with the six narrative fields.`;

    const body = {
      system_instruction: { parts: [{ text: PERSONA_SYSTEM_PROMPTS[persona] }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.2,
        topK: 20,
        maxOutputTokens: 16384,
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

  // ── Legacy path (flat text prompt, original behavior) ────────────────────
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

  const LEGACY_SYSTEM_PROMPT = `You are an expert nonprofit impact report writer with deep experience producing
grant-ready Impact Study Reports for community organizations. Your writing is professional,
compelling, and grounded in data. You never fabricate statistics — you only reference
numbers explicitly provided to you.

WRITING STANDARDS
- Tone: authoritative, warm, data-driven; avoid jargon and clichés
- Length per section: 2–4 paragraphs (150–250 words each)
- No emojis, no bullet points inside narrative sections
- Consistent tense: past tense for completed programs, present tense for active ones
- Spell out numbers under ten; use numerals with commas for 10 and above
- If a field is empty or "Not provided," write around it naturally — do not note its absence`;

  const body = {
    system_instruction: { parts: [{ text: LEGACY_SYSTEM_PROMPT }] },
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
