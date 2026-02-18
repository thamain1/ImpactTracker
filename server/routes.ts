import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { getCensusComparison, getCensusForGeographies, getCensusAgeGroups } from "./services/census";
import { expandGeographies, getParentGeographies } from "./services/geography";
import OpenAI from "openai";

async function getUserOrgIds(userId: string): Promise<Set<number>> {
  const orgs = await storage.getOrganizationsForUser(userId);
  return new Set(orgs.map(o => o.id));
}

async function userOwnsOrg(userId: string, orgId: number): Promise<boolean> {
  const orgIds = await getUserOrgIds(userId);
  return orgIds.has(orgId);
}

async function userOwnsProgram(userId: string, programId: number): Promise<boolean> {
  const program = await storage.getProgram(programId);
  if (!program) return false;
  return userOwnsOrg(userId, program.orgId);
}

import type { ProgramWithMetrics } from "@shared/schema";

function getParticipantMetricNames(program: ProgramWithMetrics): Set<string> {
  const participantMetrics = program.metrics.filter(m => m.countsAsParticipant !== false);
  if (participantMetrics.length > 0) {
    return new Set(participantMetrics.map(m => m.name));
  }
  return program.metrics.length > 0 ? new Set([program.metrics[0].name]) : new Set();
}

function sumParticipantMetrics(metricValues: Record<string, number>, participantNames: Set<string>): number {
  let total = 0;
  Array.from(participantNames).forEach(name => {
    if (metricValues[name] != null) {
      total += Number(metricValues[name]);
    }
  });
  return total;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  await setupAuth(app);
  registerAuthRoutes(app);

  // === Organizations ===
  app.get(api.organizations.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const orgs = await storage.getOrganizationsForUser(userId);
    res.json(orgs);
  });

  app.post(api.organizations.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.organizations.create.input.parse(req.body);
      const org = await storage.createOrganization(input);
      const userId = (req.user as any).claims.sub;
      await storage.createUserRole(org.id, userId, "admin");
      res.status(201).json(org);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.organizations.get.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const orgId = Number(req.params.id);
    if (!(await userOwnsOrg(userId, orgId))) return res.status(403).json({ message: "Not authorized" });
    const org = await storage.getOrganization(orgId);
    if (!org) return res.status(404).json({ message: "Organization not found" });
    res.json(org);
  });

  app.put(api.organizations.update.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const orgId = Number(req.params.id);
      if (!(await userOwnsOrg(userId, orgId))) return res.status(403).json({ message: "Not authorized" });
      const input = api.organizations.update.input.parse(req.body);
      const org = await storage.updateOrganization(orgId, input);
      if (!org) return res.status(404).json({ message: "Organization not found" });
      res.json(org);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // === User Roles ===
  app.get(api.userRoles.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const orgId = Number(req.params.orgId);
    if (!(await userOwnsOrg(userId, orgId))) return res.status(403).json({ message: "Not authorized" });
    const roles = await storage.getUserRoles(orgId);
    res.json(roles);
  });

  app.post(api.userRoles.create.path, isAuthenticated, async (req, res) => {
    try {
      const currentUserId = (req.user as any).claims.sub;
      const orgId = Number(req.params.orgId);
      if (!(await userOwnsOrg(currentUserId, orgId))) return res.status(403).json({ message: "Not authorized" });
      const input = api.userRoles.create.input.parse(req.body);
      const user = await storage.findUserByEmail(input.email);
      if (!user) {
        return res.status(404).json({ message: "No user found with that email. They must sign up first." });
      }
      const role = await storage.createUserRole(orgId, user.id, input.role);
      res.status(201).json(role);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.userRoles.update.path, isAuthenticated, async (req, res) => {
    try {
      const currentUserId = (req.user as any).claims.sub;
      const orgId = Number(req.params.orgId);
      if (!(await userOwnsOrg(currentUserId, orgId))) return res.status(403).json({ message: "Not authorized" });
      const input = api.userRoles.update.input.parse(req.body);
      const roleId = Number(req.params.id);
      const roles = await storage.getUserRoles(orgId);
      const targetRole = roles.find(r => r.id === roleId);
      if (!targetRole) {
        return res.status(404).json({ message: "Role not found in this organization" });
      }
      const updated = await storage.updateUserRole(roleId, input.role);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.userRoles.delete.path, isAuthenticated, async (req, res) => {
    const currentUserId = (req.user as any).claims.sub;
    const orgId = Number(req.params.orgId);
    if (!(await userOwnsOrg(currentUserId, orgId))) return res.status(403).json({ message: "Not authorized" });
    const roleId = Number(req.params.id);
    const roles = await storage.getUserRoles(orgId);
    const targetRole = roles.find(r => r.id === roleId);
    if (!targetRole) {
      return res.status(404).json({ message: "Role not found in this organization" });
    }
    await storage.deleteUserRole(roleId);
    res.status(204).send();
  });

  // === Programs ===
  app.get(api.programs.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    if (req.query.orgId) {
      const orgId = Number(req.query.orgId);
      const userOrgs = await storage.getOrganizationsForUser(userId);
      if (!userOrgs.some(o => o.id === orgId)) {
        return res.json([]);
      }
      const progs = await storage.getPrograms(orgId);
      return res.json(progs);
    }
    const userOrgs = await storage.getOrganizationsForUser(userId);
    if (userOrgs.length === 0) return res.json([]);
    const allProgs = [];
    for (const org of userOrgs) {
      const progs = await storage.getPrograms(org.id);
      allProgs.push(...progs);
    }
    res.json(allProgs);
  });

  app.post(api.programs.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const input = api.programs.create.input.parse(req.body);
      if (!(await userOwnsOrg(userId, input.orgId))) return res.status(403).json({ message: "Not authorized" });
      const { metrics, ...programData } = input;
      const metricsData = metrics.map(m => ({ ...m, programId: 0 }));
      const program = await storage.createProgram(programData, metricsData);
      res.status(201).json(program);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.programs.get.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const programId = Number(req.params.id);
    if (!(await userOwnsProgram(userId, programId))) return res.status(403).json({ message: "Not authorized" });
    const program = await storage.getProgram(programId);
    if (!program) return res.status(404).json({ message: "Program not found" });
    res.json(program);
  });

  app.put(api.programs.update.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const programId = Number(req.params.id);
      if (!(await userOwnsProgram(userId, programId))) return res.status(403).json({ message: "Not authorized" });
      const input = api.programs.update.input.parse(req.body);
      const program = await storage.updateProgram(programId, input);
      if (!program) return res.status(404).json({ message: "Program not found" });
      res.json(program);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.programs.delete.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const programId = Number(req.params.id);
    if (!(await userOwnsProgram(userId, programId))) return res.status(403).json({ message: "Not authorized" });
    await storage.deleteProgram(programId);
    res.status(204).send();
  });

  // === Metrics ===
  app.post("/api/programs/:programId/metrics", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const programId = Number(req.params.programId);
    if (!(await userOwnsProgram(userId, programId))) return res.status(403).json({ message: "Not authorized" });
    try {
      const input = api.metrics.create.input.parse(req.body);
      const metric = await storage.createImpactMetric({ ...input, programId });
      res.status(201).json(metric);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch("/api/programs/:programId/metrics/:id", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const programId = Number(req.params.programId);
    if (!(await userOwnsProgram(userId, programId))) return res.status(403).json({ message: "Not authorized" });
    try {
      const input = api.metrics.update.input.parse(req.body);
      const metricId = Number(req.params.id);
      const program = await storage.getProgram(programId);
      if (!program) return res.status(404).json({ message: "Program not found" });
      const metricBelongs = program.metrics.some(m => m.id === metricId);
      if (!metricBelongs) return res.status(404).json({ message: "Metric not found in this program" });
      const updated = await storage.updateImpactMetric(metricId, { countsAsParticipant: input.countsAsParticipant });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/programs/:programId/metrics/:id", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const programId = Number(req.params.programId);
    if (!(await userOwnsProgram(userId, programId))) return res.status(403).json({ message: "Not authorized" });
    await storage.deleteImpactMetric(Number(req.params.id));
    res.status(204).send();
  });

  // === Impact ===
  app.get(api.impact.list.path, isAuthenticated, async (req, res) => {
    const programId = Number(req.query.programId);
    if (isNaN(programId)) return res.status(400).json({ message: "programId is required" });
    const userId = (req.user as any).claims.sub;
    if (!(await userOwnsProgram(userId, programId))) return res.status(403).json({ message: "Not authorized" });
    const entries = await storage.getImpactEntries(programId, req.query.geographyLevel as string);
    res.json(entries);
  });

  app.post(api.impact.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.impact.create.input.parse(req.body);
      const userId = (req.user as any).claims.sub;
      if (!(await userOwnsProgram(userId, input.programId))) return res.status(403).json({ message: "Not authorized" });
      const entry = await storage.createImpactEntry({ ...input, userId });
      res.status(201).json(entry);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/impact/:id", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const userId = String((req.user as any)?.claims?.sub);
      const allEntries = await storage.getAllImpactEntries();
      const existing = allEntries.find(e => e.id === id);
      if (!existing) return res.status(404).json({ message: "Impact entry not found" });
      if (String(existing.userId) !== userId) {
        const program = await storage.getProgram(existing.programId);
        if (!program) return res.status(404).json({ message: "Program not found" });
        const roles = await storage.getUserRoles(program.orgId);
        const hasRoleAccess = roles.some(r => r.userId === userId);
        if (!hasRoleAccess) return res.status(403).json({ message: "Not authorized to edit this entry" });
      }
      const input = api.impact.update.input.parse(req.body);
      const cleanInput = Object.fromEntries(
        Object.entries(input).filter(([_, v]) => v !== undefined)
      );
      const updated = await storage.updateImpactEntry(id, cleanInput);
      if (!updated) return res.status(404).json({ message: "Impact entry not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.impact.stats.path, isAuthenticated, async (req, res) => {
    const programId = Number(req.query.programId);
    if (isNaN(programId)) return res.status(400).json({ message: "programId is required" });
    const userId = (req.user as any).claims.sub;
    if (!(await userOwnsProgram(userId, programId))) return res.status(403).json({ message: "Not authorized" });

    const entries = await storage.getImpactEntries(programId);
    
    const aggregation: Record<string, Record<string, Record<string, number>>> = {};
    
    function addToAggregation(level: string, value: string, metrics: Record<string, number>) {
      if (!value) return;
      if (!aggregation[level]) aggregation[level] = {};
      if (!aggregation[level][value]) aggregation[level][value] = {};
      Object.entries(metrics).forEach(([metricName, metricVal]) => {
        aggregation[level][value][metricName] = (aggregation[level][value][metricName] || 0) + Number(metricVal);
      });
    }

    entries.forEach(entry => {
      const level = entry.geographyLevel;
      const value = entry.geographyValue;
      const metrics = entry.metricValues as Record<string, number>;
      
      addToAggregation(level, value, metrics);
      
      const parents = getParentGeographies(level, value);
      parents.forEach(parent => {
        addToAggregation(parent.level, parent.value, metrics);
      });
    });

    const stats: any[] = [];
    Object.entries(aggregation).forEach(([level, values]) => {
      Object.entries(values).forEach(([geoVal, metrics]) => {
        stats.push({ geographyLevel: level, geographyValue: geoVal, metrics });
      });
    });

    res.json(stats);
  });

  // === CSV Export ===
  app.get(api.impact.exportCsv.path, isAuthenticated, async (req, res) => {
    const programId = Number(req.query.programId);
    if (isNaN(programId)) return res.status(400).json({ message: "programId is required" });
    const userId = (req.user as any).claims.sub;
    if (!(await userOwnsProgram(userId, programId))) return res.status(403).json({ message: "Not authorized" });

    const program = await storage.getProgram(programId);
    if (!program) return res.status(404).json({ message: "Program not found" });

    const entries = await storage.getImpactEntries(programId);
    const metricNames = program.metrics.map(m => m.name);
    
    const header = ["Date", "Geography Level", "Geography Value", "ZIP Code", "Demographics", "Outcomes", ...metricNames].join(",");
    const rows = entries.map(entry => {
      const mv = entry.metricValues as Record<string, number>;
      const metricCols = metricNames.map(n => mv[n] || 0);
      return [
        entry.date,
        entry.geographyLevel,
        `"${entry.geographyValue}"`,
        entry.zipCode || "",
        `"${entry.demographics || ""}"`,
        `"${entry.outcomes || ""}"`,
        ...metricCols,
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${program.name.replace(/\s+/g, '_')}_impact_report.csv"`);
    res.send(csv);
  });

  // === Census ===
  app.get(api.census.comparison.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userOrgs = await storage.getOrganizationsForUser(userId);
      const userOrgIds = new Set(userOrgs.map(o => o.id));
      const orgId = req.query.orgId ? Number(req.query.orgId) : undefined;

      if (orgId && !userOrgIds.has(orgId)) {
        return res.json([]);
      }

      const scopedOrgIds = orgId ? [orgId] : userOrgs.map(o => o.id);
      const allPrograms = (await Promise.all(scopedOrgIds.map(id => storage.getPrograms(id)))).flat();
      const participantNamesByProgram: Record<number, Set<string>> = {};
      allPrograms.forEach(p => {
        participantNamesByProgram[p.id] = getParticipantMetricNames(p);
      });

      const orgProgramIds = new Set(allPrograms.map(p => p.id));
      let allEntries = (await storage.getAllImpactEntries()).filter(e => orgProgramIds.has(e.programId));

      const rawGeographies: { level: string; value: string }[] = [];
      const seen = new Set<string>();
      allEntries.forEach(entry => {
        if (!entry.geographyValue) return;
        const key = `${entry.geographyLevel}:${entry.geographyValue}`;
        if (!seen.has(key)) {
          seen.add(key);
          rawGeographies.push({ level: entry.geographyLevel, value: entry.geographyValue });
        }
      });

      const { expanded: geographies } = expandGeographies(rawGeographies);

      const impactCounts: Record<string, number> = {};
      allEntries.forEach(entry => {
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

      const censusResults = await getCensusForGeographies(geographies);

      const comparison = censusResults.map(census => {
        const key = `${census.geographyLevel}:${census.geographyValue}`;
        const impact = impactCounts[key] || 0;
        const reachPercent = census.totalPopulation && impact > 0
          ? Math.round((impact / census.totalPopulation) * 10000) / 100
          : null;

        return {
          ...census,
          impactCount: impact,
          reachPercent,
        };
      });

      res.json(comparison);
    } catch (err) {
      console.error("Census comparison error:", err);
      res.status(500).json({ message: "Failed to fetch census comparison" });
    }
  });

  app.get(api.census.lookup.path, isAuthenticated, async (req, res) => {
    const level = req.query.level as string;
    const value = req.query.value as string;
    if (!level || !value) return res.status(400).json({ message: "level and value are required" });

    const result = await getCensusComparison(level, value);
    res.json(result);
  });

  app.post(api.census.batch.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.census.batch.input.parse(req.body);
      const results = await getCensusForGeographies(input.geographies);
      res.json(results);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post(api.census.ageGroups.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.census.ageGroups.input.parse(req.body);
      const results = await getCensusAgeGroups(input.geographies, input.ageMin, input.ageMax);
      res.json(results);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // === Dashboard Charts ===
  app.get(api.dashboard.charts.path, isAuthenticated, async (req, res) => {
    try {
      const currentYear = new Date().getFullYear();
      const userId = (req.user as any).claims.sub;
      const userOrgs = await storage.getOrganizationsForUser(userId);
      const userOrgIds = new Set(userOrgs.map(o => o.id));
      const orgId = req.query.orgId ? Number(req.query.orgId) : undefined;

      if (orgId && !userOrgIds.has(orgId)) {
        return res.json({ participantsByMonth: [], participantsByProgram: [], resourcesByProgram: [], goalVsActual: [] });
      }

      const orgPrograms = orgId
        ? await storage.getPrograms(orgId)
        : (await Promise.all(userOrgs.map(o => storage.getPrograms(o.id)))).flat();
      const orgProgramIds = new Set(orgPrograms.map(p => p.id));

      const allEntries = await storage.getAllImpactEntries();
      const orgEntries = allEntries.filter(e => orgProgramIds.has(e.programId));

      const programMap = new Map(orgPrograms.map(p => [p.id, p]));
      const participantNamesByProg: Record<number, Set<string>> = {};
      orgPrograms.forEach(p => {
        participantNamesByProg[p.id] = getParticipantMetricNames(p);
      });

      const ytdEntries = orgEntries.filter(e => {
        const entryYear = new Date(e.date).getFullYear();
        return entryYear === currentYear;
      });

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlyCountsMap: Record<number, number> = {};
      ytdEntries.forEach(entry => {
        const month = new Date(entry.date).getMonth();
        const mv = entry.metricValues as Record<string, number>;
        const participantNames = participantNamesByProg[entry.programId] || new Set();
        const total = sumParticipantMetrics(mv, participantNames);
        monthlyCountsMap[month] = (monthlyCountsMap[month] || 0) + total;
      });
      const participantsByMonth = monthNames.map((name, i) => ({
        month: name,
        count: monthlyCountsMap[i] || 0,
      }));

      const programCounts: Record<number, number> = {};
      ytdEntries.forEach(entry => {
        const mv = entry.metricValues as Record<string, number>;
        const participantNames = participantNamesByProg[entry.programId] || new Set();
        const total = sumParticipantMetrics(mv, participantNames);
        programCounts[entry.programId] = (programCounts[entry.programId] || 0) + total;
      });
      const participantsByProgram = Object.entries(programCounts).map(([pid, count]) => ({
        programId: Number(pid),
        programName: programMap.get(Number(pid))?.name || "Unknown",
        count,
      })).sort((a, b) => b.count - a.count);

      const programMetrics: Record<number, Record<string, number>> = {};
      ytdEntries.forEach(entry => {
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
        programId: Number(pid),
        programName: programMap.get(Number(pid))?.name || "Unknown",
        metrics,
      }));

      const goalVsActual = orgPrograms.map(prog => {
        const progEntries = ytdEntries.filter(e => e.programId === prog.id);
        const participantNames = getParticipantMetricNames(prog);
        const actual = progEntries.reduce((sum, entry) => {
          const mv = entry.metricValues as Record<string, number>;
          return sum + sumParticipantMetrics(mv, participantNames);
        }, 0);

        let goalTarget: number | null = null;
        if (prog.goals) {
          const match = prog.goals.match(/(\d[\d,]*)/);
          if (match) {
            goalTarget = parseInt(match[1].replace(/,/g, ''), 10);
          }
        }

        return {
          programId: prog.id,
          programName: prog.name,
          targetPopulation: prog.targetPopulation || null,
          goals: prog.goals || null,
          goalTarget,
          actual,
        };
      });

      res.json({
        participantsByMonth,
        participantsByProgram,
        resourcesByProgram,
        goalVsActual,
      });
    } catch (err) {
      console.error("Dashboard charts error:", err);
      res.status(500).json({ message: "Failed to fetch dashboard chart data" });
    }
  });

  // === Admin Stats ===
  app.get(api.admin.stats.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const userOrgs = await storage.getOrganizationsForUser(userId);
    if (userOrgs.length === 0) {
      return res.json({ totalOrganizations: 0, totalPrograms: 0, totalEntries: 0, byGeography: [], recentPrograms: [] });
    }
    const userOrgIds = new Set(userOrgs.map(o => o.id));
    const allPrograms = (await Promise.all(userOrgs.map(o => storage.getPrograms(o.id)))).flat();
    const programIds = new Set(allPrograms.map(p => p.id));
    const allEntries = (await storage.getAllImpactEntries()).filter(e => programIds.has(e.programId));

    const geoAgg: Record<string, { count: number; metrics: Record<string, number> }> = {};
    allEntries.forEach(entry => {
      const level = entry.geographyLevel;
      if (!geoAgg[level]) geoAgg[level] = { count: 0, metrics: {} };
      geoAgg[level].count++;
      const mv = entry.metricValues as Record<string, number>;
      Object.entries(mv).forEach(([k, v]) => {
        geoAgg[level].metrics[k] = (geoAgg[level].metrics[k] || 0) + Number(v);
      });
    });
    const byGeography = Object.entries(geoAgg).map(([level, data]) => ({
      geographyLevel: level,
      count: data.count,
      totalMetrics: data.metrics,
    }));
    const recentPrograms = allPrograms.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 5);
    res.json({
      totalOrganizations: userOrgs.length,
      totalPrograms: allPrograms.length,
      totalEntries: allEntries.length,
      byGeography,
      recentPrograms,
    });
  });

  // === AI Report Generation ===
  app.post("/api/report/ai-narrative", isAuthenticated, async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(400).json({ message: "OpenAI API key not configured" });
      }

      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const body = req.body;
      const programName = body.programName || body.program?.name || "";
      const programDescription = body.programDescription || body.program?.description || "";
      const programType = body.programType || body.program?.type || "General";
      const orgName = body.orgName || body.org?.name || "";
      const orgMission = body.orgMission || body.org?.mission || "";
      const orgVision = body.orgVision || body.org?.vision || "";
      const targetPopulation = body.targetPopulation || body.program?.targetPopulation || "";
      const goals = body.goals || body.program?.goals || "";
      const totalParticipants = body.totalParticipants || body.totalPrimary || 0;
      const participantMetrics = (body.program?.metrics || []).filter((m: any) => m.countsAsParticipant !== false);
      const primaryMetricName = body.primaryMetricName || (participantMetrics.length > 0 ? participantMetrics.map((m: any) => m.name).join(", ") : body.program?.metrics?.[0]?.name || "Participants");
      const geographies = body.geographies || (body.stats || []).map((s: any) => `${s.geographyValue} (${s.geographyLevel})`).join(", ");
      const totalCost = body.totalCost || body.program?.totalCost || 0;
      const costPerParticipant = body.program?.costPerParticipant || (totalParticipants > 0 && totalCost > 0 ? (totalCost / totalParticipants).toFixed(2) : null);

      const prompt = `You are an expert nonprofit impact report writer. Generate narrative content for an Impact Study Report for a nonprofit program. Use a professional, compelling, data-driven tone similar to published nonprofit impact studies. Do NOT use any emojis.

PROGRAM INFORMATION:
- Organization: ${orgName}
- Program Name: ${programName}
- Program Type: ${programType}
- Description: ${programDescription || "Not provided"}
- Target Population: ${targetPopulation || "General community"}
- Goals: ${goals || "Not specified"}

IMPACT DATA:
- Primary Metric (${primaryMetricName}): ${totalParticipants}
- Geographies Served: ${geographies || "Not specified"}
- Total Cost: ${totalCost ? "$" + Number(totalCost).toLocaleString() : "Not tracked"}
- Cost Per Participant: ${costPerParticipant ? "$" + costPerParticipant : "Not tracked"}

${orgMission ? `ORGANIZATION MISSION: ${orgMission}` : ""}
${orgVision ? `ORGANIZATION VISION: ${orgVision}` : ""}

Generate a JSON response with these sections (each should be 2-4 paragraphs of rich, professional narrative text). Reference specific data points from above. Do not invent data - only reference what was provided:

{
  "executiveSummary": "A compelling executive summary highlighting key achievements, scope, and significance of the program",
  "communityNeed": "Analysis of the community need this program addresses based on the target population and program context",
  "programDesign": "Description of the program design, approach, and methodology",
  "outcomesImpact": "Discussion of outcomes and community impact, both immediate and longer-term contributions",
  "lessonsLearned": "Key lessons learned, what worked well, challenges faced, and future opportunities",
  "callToAction": "A compelling call to action for donors, partners, and community members with specific giving levels based on the cost per participant data"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return res.status(500).json({ message: "No response from AI" });
      }

      const narrative = JSON.parse(content);
      res.json(narrative);
    } catch (error: any) {
      console.error("AI report generation error:", error.message);
      res.status(500).json({ message: "Failed to generate AI narrative: " + error.message });
    }
  });

  // Seed
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingOrgs = await storage.getOrganizations();
  if (existingOrgs.length === 0) {
    console.log("Seeding database...");
    const org = await storage.createOrganization({ 
      name: "Demo Nonprofit", 
      slug: "demo-nonprofit",
      address: "123 Main St, Los Angeles, CA 90012",
      phone: "(213) 555-0100",
      website: "https://demo-nonprofit.org",
      contactEmail: "info@demo-nonprofit.org",
    });
    
    await storage.createProgram({
      orgId: org.id,
      name: "Community Food Bank",
      description: "Providing meals to families in need across LA County.",
      type: "Food Security",
      status: "active",
      startDate: "2024-01-01",
      endDate: null,
      targetPopulation: "Low-income families",
      goals: "Serve 10,000 meals per quarter across all SPAs",
      locations: "Los Angeles County",
    }, [
      { name: "Meals Served", unit: "meals", programId: 0 },
      { name: "Families Assisted", unit: "families", programId: 0 }
    ]);

    await storage.createProgram({
      orgId: org.id,
      name: "Youth Mentorship Program",
      description: "Connecting at-risk youth with professional mentors for career guidance.",
      type: "Education",
      status: "active",
      startDate: "2024-03-15",
      endDate: null,
      targetPopulation: "Youth ages 14-21",
      targetAgeMin: 14,
      targetAgeMax: 21,
      goals: "Match 200 mentees with mentors annually",
      locations: "SPA 6, SPA 8",
    }, [
      { name: "Youth Enrolled", unit: "students", programId: 0 },
      { name: "Mentor Hours", unit: "hours", programId: 0 },
      { name: "Graduations", unit: "students", programId: 0 }
    ]);

    const allPrograms = await storage.getPrograms(org.id);
    const foodBankId = allPrograms.find(p => p.name === "Community Food Bank")?.id;
    const youthId = allPrograms.find(p => p.name === "Youth Mentorship Program")?.id;

    if (foodBankId) {
      const seedUserId = "seed-demo-user";
      await storage.upsertUser({ id: seedUserId, email: "demo@demo-nonprofit.org", firstName: "Demo", lastName: "User" });

      await storage.createImpactEntry({
        programId: foodBankId, userId: seedUserId, date: "2025-01-15",
        geographyLevel: "County", geographyValue: "Los Angeles County",
        zipCode: "90012", demographics: "Low-income families", outcomes: "Meals distributed",
        metricValues: { "Meals Served": 2500, "Families Assisted": 400 },
      });
      await storage.createImpactEntry({
        programId: foodBankId, userId: seedUserId, date: "2025-02-01",
        geographyLevel: "SPA", geographyValue: "SPA 6",
        zipCode: "90003", demographics: "Underserved communities", outcomes: "Food access improved",
        metricValues: { "Meals Served": 1800, "Families Assisted": 280 },
      });
      await storage.createImpactEntry({
        programId: foodBankId, userId: seedUserId, date: "2025-01-20",
        geographyLevel: "City", geographyValue: "Los Angeles",
        zipCode: "90015", demographics: "Urban residents", outcomes: "Nutritional support",
        metricValues: { "Meals Served": 3200, "Families Assisted": 520 },
      });
      await storage.createImpactEntry({
        programId: foodBankId, userId: seedUserId, date: "2025-01-25",
        geographyLevel: "State", geographyValue: "California",
        zipCode: "90001", demographics: "Statewide", outcomes: "Food security initiative",
        metricValues: { "Meals Served": 8500, "Families Assisted": 1200 },
      });
    }

    if (youthId) {
      const seedUserId = "seed-demo-user";
      await storage.createImpactEntry({
        programId: youthId, userId: seedUserId, date: "2025-01-10",
        geographyLevel: "SPA", geographyValue: "SPA 8",
        zipCode: "90802", demographics: "Youth 14-21", outcomes: "Career guidance sessions",
        metricValues: { "Youth Enrolled": 45, "Mentor Hours": 180, "Graduations": 12 },
      });
    }

    console.log("Database seeded with initial data and sample impact entries.");
  }
}
