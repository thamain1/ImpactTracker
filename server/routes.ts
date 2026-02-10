import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  await setupAuth(app);
  registerAuthRoutes(app);

  // === Organizations ===
  app.get(api.organizations.list.path, isAuthenticated, async (req, res) => {
    const orgs = await storage.getOrganizations();
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
    const org = await storage.getOrganization(Number(req.params.id));
    if (!org) return res.status(404).json({ message: "Organization not found" });
    res.json(org);
  });

  app.put(api.organizations.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.organizations.update.input.parse(req.body);
      const org = await storage.updateOrganization(Number(req.params.id), input);
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
    const roles = await storage.getUserRoles(Number(req.params.orgId));
    res.json(roles);
  });

  app.post(api.userRoles.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.userRoles.create.input.parse(req.body);
      const user = await storage.findUserByEmail(input.email);
      if (!user) {
        return res.status(404).json({ message: "No user found with that email. They must sign up first." });
      }
      const role = await storage.createUserRole(Number(req.params.orgId), user.id, input.role);
      res.status(201).json(role);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.userRoles.delete.path, isAuthenticated, async (req, res) => {
    await storage.deleteUserRole(Number(req.params.id));
    res.status(204).send();
  });

  // === Programs ===
  app.get(api.programs.list.path, isAuthenticated, async (req, res) => {
    const orgId = req.query.orgId ? Number(req.query.orgId) : undefined;
    const progs = await storage.getPrograms(orgId);
    res.json(progs);
  });

  app.post(api.programs.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.programs.create.input.parse(req.body);
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
    const program = await storage.getProgram(Number(req.params.id));
    if (!program) return res.status(404).json({ message: "Program not found" });
    res.json(program);
  });

  app.put(api.programs.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.programs.update.input.parse(req.body);
      const program = await storage.updateProgram(Number(req.params.id), input);
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
    await storage.deleteProgram(Number(req.params.id));
    res.status(204).send();
  });

  // === Impact ===
  app.get(api.impact.list.path, isAuthenticated, async (req, res) => {
    const programId = Number(req.query.programId);
    if (isNaN(programId)) return res.status(400).json({ message: "programId is required" });
    
    const entries = await storage.getImpactEntries(programId, req.query.geographyLevel as string);
    res.json(entries);
  });

  app.post(api.impact.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.impact.create.input.parse(req.body);
      const userId = (req.user as any).claims.sub;
      
      const entry = await storage.createImpactEntry({ ...input, userId });
      res.status(201).json(entry);
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

    const entries = await storage.getImpactEntries(programId);
    
    const aggregation: Record<string, Record<string, Record<string, number>>> = {};
    entries.forEach(entry => {
      const level = entry.geographyLevel;
      const value = entry.geographyValue;
      if (!aggregation[level]) aggregation[level] = {};
      if (!aggregation[level][value]) aggregation[level][value] = {};
      const metrics = entry.metricValues as Record<string, number>;
      Object.entries(metrics).forEach(([metricName, metricVal]) => {
        aggregation[level][value][metricName] = (aggregation[level][value][metricName] || 0) + Number(metricVal);
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

  // === Admin Stats ===
  app.get(api.admin.stats.path, isAuthenticated, async (req, res) => {
    const stats = await storage.getAdminStats();
    res.json(stats);
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
      targetPopulation: "Youth ages 14-21",
      goals: "Match 200 mentees with mentors annually",
      locations: "SPA 6, SPA 8",
    }, [
      { name: "Youth Enrolled", unit: "students", programId: 0 },
      { name: "Mentor Hours", unit: "hours", programId: 0 },
      { name: "Graduations", unit: "students", programId: 0 }
    ]);

    console.log("Database seeded with initial data.");
  }
}
