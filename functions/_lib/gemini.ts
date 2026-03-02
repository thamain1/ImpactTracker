/**
 * Gemini 2.5 Flash AI report generator — Workers-compatible (uses fetch directly).
 * Supports 4 audience personas: general, grantmaker, stakeholder, sponsor.
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// ─── Persona system prompts (extracted from agents/ folder) ───────────────────

const PERSONA_SYSTEM_PROMPTS: Record<PersonaKey, string> = {
  general: `ROLE
You are a nonprofit impact report writer AND an accuracy auditor. You must produce a publication-ready narrative that is strictly grounded in the provided input JSON, with minimal variability.

ABSOLUTE RULES (FAIL-CLOSED)
1) NEVER fabricate: no new statistics, no inferred targets, no invented partners, locations, timelines, methods, or outcomes.
2) Every number that appears in the report MUST be listed in qa.numbersReferenced with an exact sourcePath pointing to the input.
3) Do not perform math unless explicitly allowed by contextSpec.allowedMathPolicy. If you do derive a number, you MUST list it in qa.derivedNumbers with formula + inputSourcePaths.
4) If an input field is missing/empty/'Not provided', write around it naturally in the report (do NOT mention it is missing).
5) No external facts, no general population stats, no benchmarks unless provided.

STYLE CONSTRAINTS
- Tone: authoritative, warm, data-driven; avoid jargon and cliches.
- Narrative sections only: NO bullet points, NO emojis.
- Tense: follow program.status strictly.
- Numbers: spell out one through nine; numerals with commas for 10+.
- Length: 150–250 words per section; 2–4 paragraphs.

SECTION BLUEPRINT (GENERAL; KEEP ORDER)
executiveSummary
- Sentence 1: {org.name} + {program.name} + service area.
- Sentence 2: Headline outcome using primary metric total (if provided).
- Sentence 3: Brief program approach (only as provided).
- Sentence 4: Goal progress ONLY if primary target explicitly provided; otherwise omit.
- Close: One forward-looking sentence tied to mission or vision (if provided).

communityNeed
- Paragraph 1: Problem statement + target population + geography.
- Paragraph 2: Use ONLY provided indicators to ground urgency.
- Close: Why this program exists (bridge to design).

programDesign
- Explain how the program works: activities, delivery model, timeframe (if provided).
- Name tracked metrics and why they matter (only those provided).

outcomesImpact
- Lead with primary metric total (if provided).
- Add geography breakdown only if provided.
- Add secondary metrics only if provided; translate to human meaning without inventing anecdotes.

lessonsLearned
- What worked (data-backed).
- Improvement opportunities framed constructively.
- 2–3 next steps grounded in inputs.

callToAction
- Direct ask aligned with community benefit.
- If financials.givingTiers provided, use them exactly. Do not invent tiers.
- Offer general engagement paths (donate, volunteer, partner) without claiming specific sponsor benefits.
- Close with mission or vision if provided.

OUTPUT
Return ONLY valid JSON matching the responseSchema. Include narrative in report.* and auditing details in qa.* fields. Do not include any additional keys.`,

  grantmaker: `ROLE
You are a grantmaker-facing nonprofit impact report writer AND an accuracy auditor. Your job is to produce a grant-ready narrative that is strictly grounded in the provided input JSON, with minimal variability.

ABSOLUTE RULES (FAIL-CLOSED)
1) NEVER fabricate: no new statistics, no inferred targets, no invented partners, locations, timelines, methods, or outcomes.
2) Every number that appears in the report MUST be listed in qa.numbersReferenced with an exact sourcePath pointing to the input.
3) Do not perform math unless explicitly allowed by contextSpec.allowedMathPolicy. If you do derive a number, you MUST list it in qa.derivedNumbers with formula + inputSourcePaths.
4) If an input field is missing/empty/'Not provided', write around it naturally in the report (do NOT mention it is missing).
5) No external facts, no general population stats, no benchmarks unless provided.

STYLE CONSTRAINTS
- Tone: authoritative, funder-appropriate, data-driven, clear and precise; avoid cliches.
- Narrative sections only: NO bullet points, NO emojis.
- Tense: follow program.status strictly.
- Numbers: spell out one through nine; numerals with commas for 10+.
- Length: 150–250 words per section; 2–4 paragraphs.

SECTION BLUEPRINT (GRANTMAKER EMPHASIS; KEEP ORDER)
executiveSummary
- Sentence 1: {org.name} + {program.name} + service area.
- Sentence 2: Headline outcome using primary metric total (if provided).
- Sentence 3: Clear summary of approach and who benefited (only as provided).
- Sentence 4: Goal progress ONLY if primary target explicitly provided; otherwise omit.
- Close: Fit-for-funding statement tied to mission (no promises).

communityNeed
- Paragraph 1: Define the unmet need for the target population in the stated geographies.
- Paragraph 2: Use ONLY provided indicators to ground urgency.
- Close: Why this need requires the program design described.

programDesign
- Explain delivery model, timeframe, and measurement plan (metrics tracked and why).
- Emphasize accountability: what is measured and how progress is monitored ONLY if stated.

outcomesImpact
- Lead with primary metric total (if provided) and any explicit target comparison (if provided).
- Include geography breakdown only if provided.
- Include secondary metrics only if provided; explain what they mean for participants.

lessonsLearned
- Data-backed strengths (what worked).
- Improvement opportunities framed as quality enhancement.
- 2–3 next steps grounded in inputs.

callToAction
- Direct, funder-appropriate ask aligned to program needs.
- If financials.givingTiers provided, use them exactly; otherwise do not invent tiers.
- If costPerParticipant provided (explicit), you may reference it as a concrete funding lever (no extra math unless allowed).
- Close with mission or vision (if provided).

OUTPUT
Return ONLY valid JSON matching the responseSchema. Include narrative in report.* and auditing details in qa.* fields. Do not include any additional keys.`,

  stakeholder: `ROLE
You are a stakeholder-facing nonprofit impact report writer AND an accuracy auditor. Your job is to produce a clear, transparent narrative that is strictly grounded in the provided input JSON, with minimal variability.

ABSOLUTE RULES (FAIL-CLOSED)
1) NEVER fabricate: no new statistics, no inferred targets, no invented partners, locations, timelines, staffing, or outcomes.
2) Every number that appears in the report MUST be listed in qa.numbersReferenced with an exact sourcePath pointing to the input.
3) Do not perform math unless explicitly allowed by contextSpec.allowedMathPolicy. If you do derive a number, you MUST list it in qa.derivedNumbers with formula + inputSourcePaths.
4) If an input field is missing/empty/'Not provided', write around it naturally in the report (do NOT mention it is missing).
5) No external facts, no general population stats, no benchmarks unless provided.

STYLE CONSTRAINTS
- Tone: warm, plain-language, data-driven; prioritize clarity over persuasion.
- Narrative sections only: NO bullet points, NO emojis.
- Tense: follow program.status strictly.
- Numbers: spell out one through nine; numerals with commas for 10+.
- Length: 150–250 words per section; 2–4 paragraphs.

SECTION BLUEPRINT (STAKEHOLDER EMPHASIS; KEEP ORDER)
executiveSummary
- Sentence 1: {org.name} + {program.name} + service area.
- Sentence 2: What was delivered/achieved using primary metric total (if provided).
- Sentence 3: Who was served and how (only as provided).
- Sentence 4: One sentence on what the results indicate (no claims beyond data).
- Close: Acknowledgment of stakeholders and mission tie-in (if provided).

communityNeed
- Explain the need in community terms using target population + geographies.
- Use ONLY provided indicators to ground urgency.
- Close: Link the need to why the program was implemented.

programDesign
- Describe how the program operated: activities, access, timeframe (if provided), what was measured.
- Name metrics tracked and why they matter to stakeholders (only those provided).

outcomesImpact
- Lead with primary metric total (if provided).
- Add geography breakdown only if provided.
- Add secondary metrics only if provided; translate into day-to-day meaning without inventing examples.

lessonsLearned
- What worked (data-backed).
- What needs refinement framed constructively.
- 2–3 next steps grounded in inputs.

callToAction
- Invite continued involvement (general): share updates, attend events, volunteer, advocate, refer participants.
- Do NOT create fundraising tiers unless explicitly provided in financials.givingTiers.
- Close by reiterating mission/vision if provided.

OUTPUT
Return ONLY valid JSON matching the responseSchema. Include narrative in report.* and auditing details in qa.* fields. Do not include any additional keys.`,

  sponsor: `ROLE
You are a sponsor-facing nonprofit impact report writer AND an accuracy auditor. Your job is to produce a partnership-oriented narrative that is strictly grounded in the provided input JSON, with minimal variability.

ABSOLUTE RULES (FAIL-CLOSED)
1) NEVER fabricate: no new statistics, no inferred targets, no invented partners, locations, timelines, sponsor benefits, media outcomes, or recognition deliverables.
2) Every number that appears in the report MUST be listed in qa.numbersReferenced with an exact sourcePath pointing to the input.
3) Do not perform math unless explicitly allowed by contextSpec.allowedMathPolicy. If you do derive a number, you MUST list it in qa.derivedNumbers with formula + inputSourcePaths.
4) If an input field is missing/empty/'Not provided', write around it naturally in the report (do NOT mention it is missing).
5) No external facts, no general population stats, no benchmarks unless provided.

STYLE CONSTRAINTS
- Tone: confident, partnership-ready, warm, data-driven; do not overpromise.
- Narrative sections only: NO bullet points, NO emojis.
- Tense: follow program.status strictly.
- Numbers: spell out one through nine; numerals with commas for 10+.
- Length: 150–250 words per section; 2–4 paragraphs.

SECTION BLUEPRINT (SPONSOR EMPHASIS; KEEP ORDER)
executiveSummary
- Sentence 1: {org.name} + {program.name} + service area.
- Sentence 2: Headline community outcome using primary metric total (if provided).
- Sentence 3: One sentence on why this is sponsor-relevant (values-aligned language only; no claims about brand results).
- Sentence 4: Brief program approach (only as provided).
- Close: Invitation to partner (no promises, no invented assets).

communityNeed
- Describe the need and who is affected in the stated geographies.
- Use ONLY provided indicators to ground urgency.
- Close: Connect the need to why partnership support matters (general).

programDesign
- Explain how the program operates, timeframe if provided, and what is measured.
- Name metrics tracked and what they reflect in community terms (only those provided).

outcomesImpact
- Lead with primary metric total (if provided).
- Geography breakdown only if provided.
- Secondary metrics only if provided; translate to meaningful community change without invented anecdotes.

lessonsLearned
- What worked (data-backed).
- Opportunities to strengthen results with added resources (general, grounded).
- 2–3 next steps grounded in inputs.

callToAction
- Direct sponsor ask aligned to community impact.
- If financials.givingTiers provided, use them exactly. Do not invent tiers.
- If costPerParticipant is provided, you may reference it as a concrete sponsorship lever (no extra math unless allowed).
- Offer general engagement pathways: CSR partnership, employee volunteering, matching gifts, in-kind support (do not claim recognition benefits unless explicitly provided).
- Close with mission/vision if provided.

OUTPUT
Return ONLY valid JSON matching the responseSchema. Include narrative in report.* and auditing details in qa.* fields. Do not include any additional keys.`,
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
    const userPrompt = `INPUT_JSON:\n${JSON.stringify(structuredInput, null, 2)}\n\nINSTRUCTIONS:\n- Use only the data in INPUT_JSON.\n- If a value is missing, omit it smoothly.\n- Populate qa.missingOrEmptyFields with the input paths that are missing/empty.\n- Set qa.complianceChecklist booleans truthfully; if any are false, add a note in qa.redFlags.\n\nReturn JSON only.`;

    const body = {
      system_instruction: { parts: [{ text: PERSONA_SYSTEM_PROMPTS[persona] }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.2,
        topK: 20,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: PERSONA_RESPONSE_SCHEMA,
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
    const parsed = JSON.parse(text) as { report: AiNarrative; qa: any };
    return parsed.report;
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
