/**
 * Cloudflare Pages Functions — All /api/* routes via Hono + Supabase JS
 * Replaces Express + Drizzle + pg for production deployment.
 */
import { Hono } from "hono";
import { z } from "zod";
import { makeSupabase, toCamel, toSnake, type Env } from "../_lib/supabase";
import { resolveZipCode } from "../_lib/zipLookup";
import { getCensusForGeographies, getCensusComparison, getCensusAgeGroups } from "../_lib/census";
import { generateNarrative } from "../_lib/gemini";
import { getParentGeographies } from "../../shared/geography";

// ─── Types ────────────────────────────────────────────────────────────────────

type Variables = { user: any };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── Inline Zod schemas ───────────────────────────────────────────────────────

const orgSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  mission: z.string().optional().nullable(),
  vision: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  goals: z.string().optional().nullable(),
  annualBudgetRange: z.string().optional().nullable(),
  targetPopulationFocus: z.string().optional().nullable(),
  primaryFundingType: z.string().optional().nullable(),
});
const orgUpdateSchema = orgSchema.partial();

const programCreateSchema = z.object({
  orgId: z.number(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  targetPopulation: z.string().optional().nullable(),
  goals: z.string().optional().nullable(),
  costPerParticipant: z.string().optional().nullable(),
  budget: z.number().optional().nullable(),
  metrics: z.array(z.object({
    name: z.string().min(1),
    unit: z.string().min(1),
    countsAsParticipant: z.boolean().optional().default(true),
  })).optional().default([]),
});
const programUpdateSchema = programCreateSchema.omit({ metrics: true }).partial();

const metricCreateSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  countsAsParticipant: z.boolean().optional().default(true),
});
const metricUpdateSchema = z.object({ countsAsParticipant: z.boolean() });

const impactCreateSchema = z.object({
  programId: z.number(),
  date: z.string(),
  geographyLevel: z.enum(["SPA", "City", "County", "State"]),
  geographyValue: z.string(),
  zipCode: z.string().optional().nullable(),
  demographics: z.string().optional().nullable(),
  outcomes: z.string().optional().nullable(),
  metricValues: z.record(z.string(), z.number()).default({}),
  pctCompletingProgram: z.number().optional().nullable(),
  pctEmploymentGained: z.number().optional().nullable(),
  pctHousingSecured: z.number().optional().nullable(),
  pctGradeImprovement: z.number().optional().nullable(),
  pctRecidivismReduction: z.number().optional().nullable(),
});
const impactUpdateSchema = impactCreateSchema.partial();

const roleCreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "can_edit", "can_view", "can_view_download"]),
});
const roleUpdateSchema = z.object({
  role: z.enum(["admin", "can_edit", "can_view", "can_view_download"]),
});

// ─── Health check (no auth) ───────────────────────────────────────────────────

app.get("/health", (c) => {
  return c.json({
    ok: true,
    hasSupabaseUrl: !!c.env?.SUPABASE_URL,
    hasServiceKey: !!c.env?.SUPABASE_SERVICE_ROLE_KEY,
  });
});

// ─── Auth middleware ──────────────────────────────────────────────────────────

app.use("/api/*", async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return c.json({ message: "Unauthorized" }, 401);
  try {
    const supabase = makeSupabase(c.env);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return c.json({ message: "Unauthorized" }, 401);
    c.set("user", user);
    await next();
  } catch (err: any) {
    return c.json({ message: err?.message ?? "Internal error in auth" }, 500);
  }
});

// ─── Helper functions ─────────────────────────────────────────────────────────

async function getOrgsForUser(supabase: any, userId: string) {
  const { data: roles } = await supabase
    .from("user_roles").select("org_id").eq("user_id", userId);
  if (!roles || roles.length === 0) return [];
  const orgIds = roles.map((r: any) => r.org_id);
  const { data: orgs } = await supabase
    .from("organizations").select("*").in("id", orgIds);
  return (orgs || []).map((r: any) => toCamel(r));
}

async function getProgramWithMetrics(supabase: any, programId: number) {
  const { data: prog } = await supabase
    .from("programs").select("*").eq("id", programId).maybeSingle();
  if (!prog) return null;
  const { data: metrics } = await supabase
    .from("impact_metrics").select("*").eq("program_id", programId);
  return { ...toCamel(prog), metrics: (metrics || []).map((m: any) => toCamel(m)) };
}

async function getProgramsForOrg(supabase: any, orgId: number) {
  const { data: programs } = await supabase
    .from("programs").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  if (!programs || programs.length === 0) return [];
  const programIds = programs.map((p: any) => p.id);
  const { data: allMetrics } = await supabase
    .from("impact_metrics").select("*").in("program_id", programIds);
  return programs.map((p: any) => ({
    ...toCamel(p),
    metrics: (allMetrics || []).filter((m: any) => m.program_id === p.id).map((m: any) => toCamel(m)),
  }));
}

async function userOwnsOrg(supabase: any, userId: string, orgId: number): Promise<boolean> {
  const orgs = await getOrgsForUser(supabase, userId);
  return orgs.some((o: any) => o.id === orgId);
}

async function userOwnsProgram(supabase: any, userId: string, programId: number): Promise<boolean> {
  const prog = await getProgramWithMetrics(supabase, programId);
  if (!prog) return false;
  return userOwnsOrg(supabase, userId, (prog as any).orgId);
}

function getParticipantMetricNames(program: any): Set<string> {
  const participantMetrics = program.metrics.filter((m: any) => m.countsAsParticipant !== false);
  if (participantMetrics.length > 0) return new Set(participantMetrics.map((m: any) => m.name));
  return program.metrics.length > 0 ? new Set([program.metrics[0].name]) : new Set();
}

function sumParticipantMetrics(metricValues: Record<string, number>, participantNames: Set<string>): number {
  let total = 0;
  participantNames.forEach(name => {
    if (metricValues[name] != null) total += Number(metricValues[name]);
  });
  return total;
}

function expandGeographies(geographies: { level: string; value: string }[]) {
  const seen = new Set<string>();
  const expanded: { level: string; value: string }[] = [];
  for (const geo of geographies) {
    const key = `${geo.level}:${geo.value}`;
    if (!seen.has(key)) { seen.add(key); expanded.push(geo); }
    const parents = getParentGeographies(geo.level, geo.value);
    for (const parent of parents) {
      const parentKey = `${parent.level}:${parent.value}`;
      if (!seen.has(parentKey)) { seen.add(parentKey); expanded.push(parent); }
    }
  }
  return { expanded };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

app.get("/api/auth/user", async (c) => {
  const user = c.get("user");
  const supabase = makeSupabase(c.env);
  const userData = {
    id: user.id,
    email: user.email ?? null,
    first_name: (user.user_metadata?.first_name as string) ?? null,
    last_name: (user.user_metadata?.last_name as string) ?? null,
    profile_image_url: (user.user_metadata?.avatar_url as string) ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data: dbUser } = await supabase
    .from("users")
    .upsert(userData, { onConflict: "id" })
    .select().maybeSingle();
  return c.json(toCamel(dbUser));
});

// ─── Organizations ────────────────────────────────────────────────────────────

app.get("/api/organizations", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const orgs = await getOrgsForUser(supabase, user.id);
  return c.json(orgs);
});

app.post("/api/organizations", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  try {
    const body = await c.req.json();
    const input = orgSchema.parse(body);
    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
    const { data: org, error } = await supabase
      .from("organizations").insert({ ...toSnake(input), slug }).select().single();
    if (error) throw error;
    await supabase.from("user_roles").insert({ org_id: org.id, user_id: user.id, role: "admin" });
    return c.json(toCamel(org), 201);
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ message: err.errors[0].message }, 400);
    throw err;
  }
});

app.get("/api/organizations/:id", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const orgId = Number(c.req.param("id"));
  if (!(await userOwnsOrg(supabase, user.id, orgId))) return c.json({ message: "Not authorized" }, 403);
  const { data: org } = await supabase.from("organizations").select("*").eq("id", orgId).maybeSingle();
  if (!org) return c.json({ message: "Organization not found" }, 404);
  return c.json(toCamel(org));
});

app.put("/api/organizations/:id", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const orgId = Number(c.req.param("id"));
  if (!(await userOwnsOrg(supabase, user.id, orgId))) return c.json({ message: "Not authorized" }, 403);
  try {
    const body = await c.req.json();
    const input = orgUpdateSchema.parse(body);
    const { data: org } = await supabase
      .from("organizations").update(toSnake(input)).eq("id", orgId).select().single();
    if (!org) return c.json({ message: "Organization not found" }, 404);
    return c.json(toCamel(org));
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ message: err.errors[0].message }, 400);
    throw err;
  }
});

// ─── User Roles ───────────────────────────────────────────────────────────────

app.get("/api/organizations/:orgId/roles", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const orgId = Number(c.req.param("orgId"));
  if (!(await userOwnsOrg(supabase, user.id, orgId))) return c.json({ message: "Not authorized" }, 403);

  const { data: roles } = await supabase
    .from("user_roles").select("*").eq("org_id", orgId);
  const result = await Promise.all((roles || []).map(async (role: any) => {
    const { data: u } = await supabase
      .from("users").select("id,email,first_name,last_name").eq("id", role.user_id).maybeSingle();
    return {
      ...toCamel(role),
      user: u ? { id: u.id, email: u.email, firstName: u.first_name, lastName: u.last_name } : null,
    };
  }));
  return c.json(result);
});

app.post("/api/organizations/:orgId/roles", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const orgId = Number(c.req.param("orgId"));
  if (!(await userOwnsOrg(supabase, user.id, orgId))) return c.json({ message: "Not authorized" }, 403);
  try {
    const body = await c.req.json();
    const input = roleCreateSchema.parse(body);
    let { data: targetUser } = await supabase
      .from("users").select("id").eq("email", input.email).maybeSingle();
    let inviteUrl: string | null = null;
    if (!targetUser) {
      // Generate invite link (no email sent — avoids rate limits)
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "invite",
        email: input.email,
      });
      if (linkErr) {
        // User already exists in auth but not our users table — sync them
        const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const existing = (listData?.users ?? []).find((u: any) => u.email === input.email);
        if (!existing) return c.json({ message: linkErr.message }, 400);
        await supabase.from("users").upsert({ id: existing.id, email: existing.email }, { onConflict: "id" });
        targetUser = { id: existing.id };
      } else {
        await supabase.from("users").upsert({ id: linkData.user.id, email: linkData.user.email }, { onConflict: "id" });
        targetUser = { id: linkData.user.id };
        inviteUrl = linkData.properties.action_link;
      }
    }
    const { data: role } = await supabase
      .from("user_roles").insert({ org_id: orgId, user_id: targetUser.id, role: input.role }).select().single();
    return c.json({ ...toCamel(role), inviteUrl }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ message: err.errors[0].message }, 400);
    throw err;
  }
});

app.put("/api/organizations/:orgId/roles/:id", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const orgId = Number(c.req.param("orgId"));
  if (!(await userOwnsOrg(supabase, user.id, orgId))) return c.json({ message: "Not authorized" }, 403);
  try {
    const body = await c.req.json();
    const input = roleUpdateSchema.parse(body);
    const roleId = Number(c.req.param("id"));
    const { data: existing } = await supabase
      .from("user_roles").select("id").eq("id", roleId).eq("org_id", orgId).maybeSingle();
    if (!existing) return c.json({ message: "Role not found in this organization" }, 404);
    const { data: updated } = await supabase
      .from("user_roles").update({ role: input.role }).eq("id", roleId).select().single();
    return c.json(toCamel(updated));
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ message: err.errors[0].message }, 400);
    throw err;
  }
});

app.delete("/api/organizations/:orgId/roles/:id", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const orgId = Number(c.req.param("orgId"));
  if (!(await userOwnsOrg(supabase, user.id, orgId))) return c.json({ message: "Not authorized" }, 403);
  const roleId = Number(c.req.param("id"));
  const { data: existing } = await supabase
    .from("user_roles").select("id").eq("id", roleId).eq("org_id", orgId).maybeSingle();
  if (!existing) return c.json({ message: "Role not found in this organization" }, 404);
  await supabase.from("user_roles").delete().eq("id", roleId);
  return c.body(null, 204);
});

// ─── Programs ─────────────────────────────────────────────────────────────────

app.get("/api/programs", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const orgIdParam = c.req.query("orgId");
  const userOrgs = await getOrgsForUser(supabase, user.id);

  if (orgIdParam) {
    const orgId = Number(orgIdParam);
    if (!userOrgs.some((o: any) => o.id === orgId)) return c.json([]);
    return c.json(await getProgramsForOrg(supabase, orgId));
  }

  if (userOrgs.length === 0) return c.json([]);
  const allProgs = (await Promise.all(userOrgs.map((o: any) => getProgramsForOrg(supabase, o.id)))).flat();
  return c.json(allProgs);
});

app.post("/api/programs", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  try {
    const body = await c.req.json();
    const input = programCreateSchema.parse(body);
    if (!(await userOwnsOrg(supabase, user.id, input.orgId))) return c.json({ message: "Not authorized" }, 403);
    const { metrics, ...programData } = input;
    const { data: prog, error } = await supabase
      .from("programs").insert(toSnake(programData)).select().single();
    if (error) throw error;
    const metricsInsert = (metrics || []).map((m: any) => ({
      program_id: prog.id, name: m.name, unit: m.unit,
      counts_as_participant: m.countsAsParticipant ?? true,
    }));
    let createdMetrics: any[] = [];
    if (metricsInsert.length > 0) {
      const { data: mRows } = await supabase.from("impact_metrics").insert(metricsInsert).select();
      createdMetrics = (mRows || []).map((m: any) => toCamel(m));
    }
    return c.json({ ...toCamel(prog), metrics: createdMetrics }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ message: err.errors[0].message }, 400);
    throw err;
  }
});

app.get("/api/programs/:id", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const programId = Number(c.req.param("id"));
  if (!(await userOwnsProgram(supabase, user.id, programId))) return c.json({ message: "Not authorized" }, 403);
  const prog = await getProgramWithMetrics(supabase, programId);
  if (!prog) return c.json({ message: "Program not found" }, 404);
  return c.json(prog);
});

app.put("/api/programs/:id", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const programId = Number(c.req.param("id"));
  if (!(await userOwnsProgram(supabase, user.id, programId))) return c.json({ message: "Not authorized" }, 403);
  try {
    const body = await c.req.json();
    const input = programUpdateSchema.parse(body);
    const { data: prog } = await supabase
      .from("programs").update(toSnake(input)).eq("id", programId).select().single();
    if (!prog) return c.json({ message: "Program not found" }, 404);
    return c.json(toCamel(prog));
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ message: err.errors[0].message }, 400);
    throw err;
  }
});

app.delete("/api/programs/:id", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const programId = Number(c.req.param("id"));
  if (!(await userOwnsProgram(supabase, user.id, programId))) return c.json({ message: "Not authorized" }, 403);
  await supabase.from("impact_entries").delete().eq("program_id", programId);
  await supabase.from("impact_metrics").delete().eq("program_id", programId);
  await supabase.from("programs").delete().eq("id", programId);
  return c.body(null, 204);
});

// ─── Metrics ──────────────────────────────────────────────────────────────────

app.post("/api/programs/:programId/metrics", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const programId = Number(c.req.param("programId"));
  if (!(await userOwnsProgram(supabase, user.id, programId))) return c.json({ message: "Not authorized" }, 403);
  try {
    const body = await c.req.json();
    const input = metricCreateSchema.parse(body);
    const { data: metric } = await supabase
      .from("impact_metrics")
      .insert({ program_id: programId, name: input.name, unit: input.unit, counts_as_participant: input.countsAsParticipant ?? true })
      .select().single();
    return c.json(toCamel(metric), 201);
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ message: err.errors[0].message }, 400);
    throw err;
  }
});

app.patch("/api/programs/:programId/metrics/:id", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const programId = Number(c.req.param("programId"));
  if (!(await userOwnsProgram(supabase, user.id, programId))) return c.json({ message: "Not authorized" }, 403);
  try {
    const body = await c.req.json();
    const input = metricUpdateSchema.parse(body);
    const metricId = Number(c.req.param("id"));
    const { data: existing } = await supabase
      .from("impact_metrics").select("id").eq("id", metricId).eq("program_id", programId).maybeSingle();
    if (!existing) return c.json({ message: "Metric not found in this program" }, 404);
    const { data: updated } = await supabase
      .from("impact_metrics")
      .update({ counts_as_participant: input.countsAsParticipant })
      .eq("id", metricId).select().single();
    return c.json(toCamel(updated));
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ message: err.errors[0].message }, 400);
    throw err;
  }
});

app.delete("/api/programs/:programId/metrics/:id", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const programId = Number(c.req.param("programId"));
  if (!(await userOwnsProgram(supabase, user.id, programId))) return c.json({ message: "Not authorized" }, 403);
  await supabase.from("impact_metrics").delete().eq("id", Number(c.req.param("id")));
  return c.body(null, 204);
});

// ─── Impact entries ───────────────────────────────────────────────────────────

app.get("/api/impact", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const programId = Number(c.req.query("programId"));
  if (isNaN(programId)) return c.json({ message: "programId is required" }, 400);
  if (!(await userOwnsProgram(supabase, user.id, programId))) return c.json({ message: "Not authorized" }, 403);

  const geoLevel = c.req.query("geographyLevel");
  let query = supabase.from("impact_entries").select("*").eq("program_id", programId).order("created_at", { ascending: false });
  if (geoLevel) query = query.eq("geography_level", geoLevel);
  const { data: entries } = await query;
  return c.json((entries || []).map((e: any) => toCamel(e)));
});

app.get("/api/zipcode/:zip", async (c) => {
  const zip = c.req.param("zip").trim();
  if (!/^\d{5}$/.test(zip)) return c.json({ message: "Invalid ZIP code — must be 5 digits" }, 400);
  const context = await resolveZipCode(zip);
  if (!context) return c.json({ message: "ZIP code not recognized" }, 404);
  return c.json(context);
});

app.post("/api/impact", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  try {
    const body = await c.req.json();
    const input = impactCreateSchema.parse(body);
    if (!(await userOwnsProgram(supabase, user.id, input.programId))) return c.json({ message: "Not authorized" }, 403);
    const geoContext = input.zipCode ? await resolveZipCode(input.zipCode) : null;
    const row = {
      program_id: input.programId,
      user_id: user.id,
      date: input.date,
      geography_level: input.geographyLevel,
      geography_value: input.geographyValue,
      zip_code: input.zipCode ?? null,
      geo_context: geoContext,
      demographics: input.demographics ?? null,
      outcomes: input.outcomes ?? null,
      metric_values: input.metricValues,
      pct_completing_program: input.pctCompletingProgram ?? null,
      pct_employment_gained: input.pctEmploymentGained ?? null,
      pct_housing_secured: input.pctHousingSecured ?? null,
      pct_grade_improvement: input.pctGradeImprovement ?? null,
      pct_recidivism_reduction: input.pctRecidivismReduction ?? null,
    };
    const { data: entry, error } = await supabase.from("impact_entries").insert(row).select().single();
    if (error) throw error;
    return c.json(toCamel(entry), 201);
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ message: err.errors[0].message }, 400);
    throw err;
  }
});

app.put("/api/impact/:id", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  try {
    const { data: existing } = await supabase
      .from("impact_entries").select("*").eq("id", id).maybeSingle();
    if (!existing) return c.json({ message: "Impact entry not found" }, 404);

    if (existing.user_id !== user.id) {
      const { data: progRow } = await supabase.from("programs").select("org_id").eq("id", existing.program_id).maybeSingle();
      if (!progRow) return c.json({ message: "Program not found" }, 404);
      const { data: roleRow } = await supabase
        .from("user_roles").select("id").eq("org_id", progRow.org_id).eq("user_id", user.id).maybeSingle();
      if (!roleRow) return c.json({ message: "Not authorized to edit this entry" }, 403);
    }

    const body = await c.req.json();
    const parsed = impactUpdateSchema.parse(body);
    const cleanInput = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined));

    // Re-resolve zip if changed
    if ("zipCode" in cleanInput) {
      (cleanInput as any).geoContext = cleanInput.zipCode ? await resolveZipCode(cleanInput.zipCode as string) : null;
    }

    // Manually build snake_case update object
    const updateRow: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      date: "date", geographyLevel: "geography_level", geographyValue: "geography_value",
      zipCode: "zip_code", geoContext: "geo_context", demographics: "demographics",
      outcomes: "outcomes", metricValues: "metric_values",
      pctCompletingProgram: "pct_completing_program", pctEmploymentGained: "pct_employment_gained",
      pctHousingSecured: "pct_housing_secured", pctGradeImprovement: "pct_grade_improvement",
      pctRecidivismReduction: "pct_recidivism_reduction",
    };
    for (const [k, v] of Object.entries(cleanInput)) {
      const snakeKey = fieldMap[k] ?? k;
      updateRow[snakeKey] = v;
    }

    const { data: updated } = await supabase
      .from("impact_entries").update(updateRow).eq("id", id).select().single();
    if (!updated) return c.json({ message: "Impact entry not found" }, 404);
    return c.json(toCamel(updated));
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ message: err.errors[0].message }, 400);
    throw err;
  }
});

// ─── Impact Stats ─────────────────────────────────────────────────────────────

app.get("/api/impact/stats", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const programId = Number(c.req.query("programId"));
  if (isNaN(programId)) return c.json({ message: "programId is required" }, 400);
  if (!(await userOwnsProgram(supabase, user.id, programId))) return c.json({ message: "Not authorized" }, 403);

  const { data: entryRows } = await supabase
    .from("impact_entries").select("*").eq("program_id", programId);
  const entries = (entryRows || []).map((e: any) => toCamel(e));

  const aggregation: Record<string, Record<string, Record<string, number>>> = {};
  function addToAggregation(level: string, value: string, metrics: Record<string, number>) {
    if (!value) return;
    if (!aggregation[level]) aggregation[level] = {};
    if (!aggregation[level][value]) aggregation[level][value] = {};
    Object.entries(metrics).forEach(([k, v]) => {
      aggregation[level][value][k] = (aggregation[level][value][k] || 0) + Number(v);
    });
  }

  entries.forEach((entry: any) => {
    const metrics = entry.metricValues as Record<string, number>;
    const ctx = entry.geoContext as { spa?: string; city?: string; county?: string; state?: string } | null;
    if (ctx && Object.keys(ctx).length > 0) {
      if (ctx.spa)    addToAggregation("SPA",    ctx.spa,    metrics);
      if (ctx.city)   addToAggregation("City",   ctx.city,   metrics);
      if (ctx.county) addToAggregation("County", ctx.county, metrics);
      if (ctx.state)  addToAggregation("State",  ctx.state,  metrics);
    } else {
      addToAggregation(entry.geographyLevel, entry.geographyValue, metrics);
    }
  });

  const stats: unknown[] = [];
  Object.entries(aggregation).forEach(([level, values]) => {
    Object.entries(values).forEach(([geoVal, metrics]) => {
      stats.push({ geographyLevel: level, geographyValue: geoVal, metrics });
    });
  });
  return c.json(stats);
});

// ─── CSV Export ───────────────────────────────────────────────────────────────

app.get("/api/impact/export", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const programId = Number(c.req.query("programId"));
  if (isNaN(programId)) return c.json({ message: "programId is required" }, 400);
  if (!(await userOwnsProgram(supabase, user.id, programId))) return c.json({ message: "Not authorized" }, 403);

  const prog = await getProgramWithMetrics(supabase, programId);
  if (!prog) return c.json({ message: "Program not found" }, 404);
  const { data: entryRows } = await supabase
    .from("impact_entries").select("*").eq("program_id", programId).order("created_at", { ascending: false });
  const entries = (entryRows || []).map((e: any) => toCamel(e));
  const metricNames = (prog as any).metrics.map((m: any) => m.name);
  const header = ["Date", "Geography Level", "Geography Value", "ZIP Code", "Demographics", "Outcomes", ...metricNames].join(",");
  const rows = entries.map((entry: any) => {
    const mv = entry.metricValues as Record<string, number>;
    const metricCols = metricNames.map((n: string) => mv[n] || 0);
    return [entry.date, entry.geographyLevel, `"${entry.geographyValue}"`, entry.zipCode || "", `"${entry.demographics || ""}"`, `"${entry.outcomes || ""}"`, ...metricCols].join(",");
  });
  const csv = [header, ...rows].join("\n");
  const fileName = (prog as any).name.replace(/\s+/g, "_");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${fileName}_impact_report.csv"`,
    },
  });
});

// ─── Census ───────────────────────────────────────────────────────────────────

app.get("/api/census/comparison", async (c) => {
  try {
    const supabase = makeSupabase(c.env);
    const user = c.get("user");
    const userOrgs = await getOrgsForUser(supabase, user.id);
    const userOrgIds = new Set(userOrgs.map((o: any) => o.id));
    const orgIdParam = c.req.query("orgId");
    const orgId = orgIdParam ? Number(orgIdParam) : undefined;

    if (orgId && !userOrgIds.has(orgId)) return c.json([]);

    const scopedOrgIds = orgId ? [orgId] : userOrgs.map((o: any) => o.id);
    const allPrograms = (await Promise.all(scopedOrgIds.map((id: number) => getProgramsForOrg(supabase, id)))).flat();
    const participantNamesByProgram: Record<number, Set<string>> = {};
    allPrograms.forEach((p: any) => { participantNamesByProgram[p.id] = getParticipantMetricNames(p); });
    const orgProgramIds = new Set(allPrograms.map((p: any) => p.id));

    const { data: allEntryRows } = await supabase.from("impact_entries").select("*");
    const allEntries = ((allEntryRows || []).map((e: any) => toCamel(e)) as any[]).filter((e: any) => orgProgramIds.has(e.programId));

    const rawGeographies: { level: string; value: string }[] = [];
    const seen = new Set<string>();
    allEntries.forEach((entry: any) => {
      if (!entry.geographyValue) return;
      const key = `${entry.geographyLevel}:${entry.geographyValue}`;
      if (!seen.has(key)) { seen.add(key); rawGeographies.push({ level: entry.geographyLevel, value: entry.geographyValue }); }
    });

    const { expanded: geographies } = expandGeographies(rawGeographies);

    const impactCounts: Record<string, number> = {};
    allEntries.forEach((entry: any) => {
      if (!entry.geographyValue) return;
      const key = `${entry.geographyLevel}:${entry.geographyValue}`;
      const mv = entry.metricValues as Record<string, number>;
      const participantNames = participantNamesByProgram[entry.programId] || new Set();
      const total = sumParticipantMetrics(mv, participantNames);
      impactCounts[key] = (impactCounts[key] || 0) + total;
      const parents = getParentGeographies(entry.geographyLevel, entry.geographyValue);
      parents.forEach(parent => {
        const parentKey = `${parent.level}:${parent.value}`;
        impactCounts[parentKey] = (impactCounts[parentKey] || 0) + total;
      });
    });

    const censusResults = await getCensusForGeographies(supabase, c.env.CENSUS_API_KEY, geographies);
    const comparison = censusResults.map((census: any) => {
      const key = `${census.geographyLevel}:${census.geographyValue}`;
      const impact = impactCounts[key] || 0;
      const reachPercent = census.totalPopulation && impact > 0
        ? Math.round((impact / census.totalPopulation) * 10000) / 100 : null;
      return { ...census, impactCount: impact, reachPercent };
    });
    return c.json(comparison);
  } catch (err) {
    console.error("Census comparison error:", err);
    return c.json({ message: "Failed to fetch census comparison" }, 500);
  }
});

app.get("/api/census", async (c) => {
  const supabase = makeSupabase(c.env);
  const level = c.req.query("level");
  const value = c.req.query("value");
  if (!level || !value) return c.json({ message: "level and value are required" }, 400);
  const result = await getCensusComparison(supabase, c.env.CENSUS_API_KEY, level, value);
  return c.json(result);
});

app.post("/api/census/batch", async (c) => {
  const supabase = makeSupabase(c.env);
  try {
    const body = await c.req.json();
    const input = z.object({ geographies: z.array(z.object({ level: z.string(), value: z.string() })) }).parse(body);
    const results = await getCensusForGeographies(supabase, c.env.CENSUS_API_KEY, input.geographies);
    return c.json(results);
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ message: err.errors[0].message }, 400);
    throw err;
  }
});

app.post("/api/census/age-groups", async (c) => {
  const supabase = makeSupabase(c.env);
  try {
    const body = await c.req.json();
    const input = z.object({
      geographies: z.array(z.object({ level: z.string(), value: z.string() })),
      ageMin: z.number().min(0).optional(),
      ageMax: z.number().max(120).optional(),
    }).parse(body);
    const results = await getCensusAgeGroups(supabase, c.env.CENSUS_API_KEY, input.geographies, input.ageMin, input.ageMax);
    return c.json(results);
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ message: err.errors[0].message }, 400);
    throw err;
  }
});

// ─── Dashboard Charts ─────────────────────────────────────────────────────────

app.get("/api/dashboard/charts", async (c) => {
  try {
    const supabase = makeSupabase(c.env);
    const user = c.get("user");
    const currentYear = new Date().getFullYear();
    const userOrgs = await getOrgsForUser(supabase, user.id);
    const userOrgIds = new Set(userOrgs.map((o: any) => o.id));
    const orgIdParam = c.req.query("orgId");
    const orgId = orgIdParam ? Number(orgIdParam) : undefined;
    const empty = { participantsByMonth: [], participantsByProgram: [], resourcesByProgram: [], goalVsActual: [] };

    if (orgId && !userOrgIds.has(orgId)) return c.json(empty);

    const orgPrograms = orgId
      ? await getProgramsForOrg(supabase, orgId)
      : (await Promise.all(userOrgs.map((o: any) => getProgramsForOrg(supabase, o.id)))).flat();
    const orgProgramIds = new Set(orgPrograms.map((p: any) => p.id));

    const { data: allEntryRows } = await supabase.from("impact_entries").select("*");
    const orgEntries = ((allEntryRows || []).map((e: any) => toCamel(e)) as any[]).filter((e: any) => orgProgramIds.has(e.programId));

    const programMap = new Map(orgPrograms.map((p: any) => [p.id, p]));
    const participantNamesByProg: Record<number, Set<string>> = {};
    orgPrograms.forEach((p: any) => { participantNamesByProg[p.id] = getParticipantMetricNames(p); });

    const ytdEntries = orgEntries.filter((e: any) => new Date(e.date).getFullYear() === currentYear);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyCountsMap: Record<number, number> = {};
    ytdEntries.forEach((entry: any) => {
      const month = new Date(entry.date).getMonth();
      const mv = entry.metricValues as Record<string, number>;
      const participantNames = participantNamesByProg[entry.programId] || new Set();
      const total = sumParticipantMetrics(mv, participantNames);
      monthlyCountsMap[month] = (monthlyCountsMap[month] || 0) + total;
    });
    const participantsByMonth = monthNames.map((name, i) => ({ month: name, count: monthlyCountsMap[i] || 0 }));

    const programCounts: Record<number, number> = {};
    ytdEntries.forEach((entry: any) => {
      const mv = entry.metricValues as Record<string, number>;
      const participantNames = participantNamesByProg[entry.programId] || new Set();
      programCounts[entry.programId] = (programCounts[entry.programId] || 0) + sumParticipantMetrics(mv, participantNames);
    });
    const participantsByProgram = Object.entries(programCounts)
      .map(([pid, count]) => ({ programId: Number(pid), programName: (programMap.get(Number(pid)) as any)?.name || "Unknown", count }))
      .sort((a, b) => b.count - a.count);

    const programMetrics: Record<number, Record<string, number>> = {};
    ytdEntries.forEach((entry: any) => {
      if (!programMetrics[entry.programId]) programMetrics[entry.programId] = {};
      const mv = entry.metricValues as Record<string, number>;
      const participantNames = participantNamesByProg[entry.programId] || new Set();
      Object.entries(mv).forEach(([metric, val]) => {
        if (!participantNames.has(metric)) {
          programMetrics[entry.programId][metric] = (programMetrics[entry.programId][metric] || 0) + Number(val);
        }
      });
    });
    const resourcesByProgram = Object.entries(programMetrics).map(([pid, metrics]) => ({
      programId: Number(pid), programName: (programMap.get(Number(pid)) as any)?.name || "Unknown", metrics,
    }));

    const goalVsActual = orgPrograms.map((prog: any) => {
      const progEntries = ytdEntries.filter((e: any) => e.programId === prog.id);
      const participantNames = getParticipantMetricNames(prog);
      const actual = progEntries.reduce((sum: number, entry: any) => {
        const mv = entry.metricValues as Record<string, number>;
        return sum + sumParticipantMetrics(mv, participantNames);
      }, 0);
      let goalTarget: number | null = null;
      if (prog.goals) {
        const match = prog.goals.match(/(\d[\d,]*)/);
        if (match) goalTarget = parseInt(match[1].replace(/,/g, ""), 10);
      }
      return { programId: prog.id, programName: prog.name, targetPopulation: prog.targetPopulation || null, goals: prog.goals || null, goalTarget, actual };
    });

    return c.json({ participantsByMonth, participantsByProgram, resourcesByProgram, goalVsActual });
  } catch (err) {
    console.error("Dashboard charts error:", err);
    return c.json({ message: "Failed to fetch dashboard chart data" }, 500);
  }
});

// ─── Admin Stats ──────────────────────────────────────────────────────────────

app.get("/api/admin/stats", async (c) => {
  const supabase = makeSupabase(c.env);
  const user = c.get("user");
  const userOrgs = await getOrgsForUser(supabase, user.id);
  if (userOrgs.length === 0) {
    return c.json({ totalOrganizations: 0, totalPrograms: 0, totalEntries: 0, byGeography: [], recentPrograms: [] });
  }
  const allPrograms = (await Promise.all(userOrgs.map((o: any) => getProgramsForOrg(supabase, o.id)))).flat();
  const programIds = new Set(allPrograms.map((p: any) => p.id));
  const { data: allEntryRows } = await supabase.from("impact_entries").select("*");
  const allEntries = ((allEntryRows || []).map((e: any) => toCamel(e)) as any[]).filter((e: any) => programIds.has(e.programId));

  const geoAgg: Record<string, { count: number; metrics: Record<string, number> }> = {};
  allEntries.forEach((entry: any) => {
    const level = entry.geographyLevel;
    if (!geoAgg[level]) geoAgg[level] = { count: 0, metrics: {} };
    geoAgg[level].count++;
    const mv = entry.metricValues as Record<string, number>;
    Object.entries(mv).forEach(([k, v]) => { geoAgg[level].metrics[k] = (geoAgg[level].metrics[k] || 0) + Number(v); });
  });
  const byGeography = Object.entries(geoAgg).map(([level, data]) => ({
    geographyLevel: level, count: data.count, totalMetrics: data.metrics,
  }));
  const recentPrograms = allPrograms
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);
  return c.json({ totalOrganizations: userOrgs.length, totalPrograms: allPrograms.length, totalEntries: allEntries.length, byGeography, recentPrograms });
});

// ─── Service Areas ────────────────────────────────────────────────────────────

app.get("/api/organizations/:orgId/service-areas", async (c) => {
  const supabase = makeSupabase(c.env);
  const orgId = Number(c.req.param("orgId"));
  const { data: areas } = await supabase.from("service_areas").select("*").eq("org_id", orgId);
  return c.json((areas || []).map((a: any) => toCamel(a)));
});

app.post("/api/organizations/:orgId/service-areas", async (c) => {
  const supabase = makeSupabase(c.env);
  const orgId = Number(c.req.param("orgId"));
  try {
    const body = await c.req.json();
    const { data: area, error } = await supabase
      .from("service_areas").insert({ ...toSnake(body), org_id: orgId }).select().single();
    if (error) throw new Error(error.message);
    return c.json(toCamel(area), 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return c.json({ message: msg }, 400);
  }
});

app.put("/api/organizations/:orgId/service-areas/:id", async (c) => {
  const supabase = makeSupabase(c.env);
  const id = Number(c.req.param("id"));
  try {
    const body = await c.req.json();
    const { data: area, error } = await supabase
      .from("service_areas").update(toSnake(body)).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return c.json(toCamel(area));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return c.json({ message: msg }, 400);
  }
});

app.delete("/api/organizations/:orgId/service-areas/:id", async (c) => {
  const supabase = makeSupabase(c.env);
  await supabase.from("service_areas").delete().eq("id", Number(c.req.param("id")));
  return c.body(null, 204);
});

// ─── AI Report ────────────────────────────────────────────────────────────────

app.post("/api/report/ai-narrative", async (c) => {
  try {
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) return c.json({ message: "Gemini API key not configured" }, 400);
    const body = await c.req.json();
    const narrative = await generateNarrative(apiKey, {
      programName:        body.programName        || body.program?.name         || "",
      programDescription: body.programDescription || body.program?.description  || "",
      programType:        body.programType        || body.program?.type         || "General",
      orgName:            body.orgName            || body.org?.name             || "",
      orgMission:         body.orgMission         || body.org?.mission          || "",
      orgVision:          body.orgVision          || body.org?.vision           || "",
      targetPopulation:   body.targetPopulation   || body.program?.targetPopulation || "",
      goals:              body.goals              || body.program?.goals        || "",
      totalParticipants:  body.totalParticipants  || body.totalPrimary          || 0,
      primaryMetricName:  body.primaryMetricName  || "",
      geographies:        body.geographies        || "",
      totalCost:          body.totalCost          || body.program?.totalCost    || 0,
      costPerParticipant: body.program?.costPerParticipant || null,
      metrics:            body.program?.metrics   || [],
    });
    return c.json(narrative);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("AI report generation error:", msg);
    return c.json({ message: "Failed to generate AI narrative: " + msg }, 500);
  }
});

// ─── CSV Import ───────────────────────────────────────────────────────────────

app.post("/api/programs/:id/import-csv", async (c) => {
  try {
    const supabase = makeSupabase(c.env);
    const user = c.get("user");
    const programId = Number(c.req.param("id"));

    if (!(await userOwnsProgram(supabase, user.id, programId)))
      return c.json({ message: "Not authorized" }, 403);

    const prog = await getProgramWithMetrics(supabase, programId);
    if (!prog) return c.json({ message: "Program not found" }, 404);

    const body = await c.req.json();
    const { rows } = body as { rows: Record<string, string>[] };
    if (!Array.isArray(rows) || rows.length === 0)
      return c.json({ message: "No rows provided" }, 400);

    const metricNames = (prog as any).metrics.map((m: any) => m.name);
    const parsePct = (v: string | undefined) =>
      v !== undefined && v !== "" ? parseFloat(v) || null : null;

    let created = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date.trim())) {
        errors.push(`Row ${rowNum}: invalid or missing date (expected YYYY-MM-DD)`);
        continue;
      }

      let geoLevel = (row.geography_level || "").trim() as "SPA" | "City" | "County" | "State";
      let geoValue = (row.geography_value || "").trim();
      let geoContext: Record<string, string> | null = null;
      const zip = (row.zip_code || "").replace(/\D/g, "");

      if (zip.length === 5) {
        const ctx = await resolveZipCode(zip);
        if (ctx) {
          geoContext = ctx as Record<string, string>;
          if ((ctx as any).spa)         { geoLevel = "SPA";    geoValue = (ctx as any).spa; }
          else if ((ctx as any).city)   { geoLevel = "City";   geoValue = (ctx as any).city; }
          else if ((ctx as any).county) { geoLevel = "County"; geoValue = (ctx as any).county; }
          else if ((ctx as any).state)  { geoLevel = "State";  geoValue = (ctx as any).state; }
        }
      }

      if (!geoLevel || !geoValue) {
        errors.push(`Row ${rowNum}: missing geography — provide zip_code or both geography_level and geography_value`);
        continue;
      }

      if (!["SPA", "City", "County", "State"].includes(geoLevel)) {
        errors.push(`Row ${rowNum}: invalid geography_level "${geoLevel}" — must be SPA, City, County, or State`);
        continue;
      }

      const metricValues: Record<string, number> = {};
      metricNames.forEach((name: string) => {
        const v = row[name];
        metricValues[name] = (v !== undefined && v !== "") ? parseFloat(v) || 0 : 0;
      });

      try {
        await supabase.from("impact_entries").insert({
          program_id: programId,
          user_id: user.id,
          date: row.date.trim(),
          geography_level: geoLevel,
          geography_value: geoValue,
          zip_code: zip.length === 5 ? zip : null,
          geo_context: geoContext,
          demographics: row.demographics?.trim() || null,
          outcomes: row.outcomes?.trim() || null,
          metric_values: metricValues,
          pct_completing_program: parsePct(row.pct_completing_program),
          pct_employment_gained:  parsePct(row.pct_employment_gained),
          pct_housing_secured:    parsePct(row.pct_housing_secured),
          pct_grade_improvement:  parsePct(row.pct_grade_improvement),
          pct_recidivism_reduction: parsePct(row.pct_recidivism_reduction),
        });
        created++;
      } catch (e) {
        errors.push(`Row ${rowNum}: ${e instanceof Error ? e.message : "unknown error"}`);
      }
    }

    return c.json({ created, errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return c.json({ message: msg }, 500);
  }
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ message: "Internal server error" }, 500);
});

// ─── CF Pages export ──────────────────────────────────────────────────────────

export const onRequest = (context: any) =>
  app.fetch(context.request, context.env, context.executionCtx);
