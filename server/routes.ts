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
  
  // Setup Auth First
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

  // === Programs ===
  app.get(api.programs.list.path, isAuthenticated, async (req, res) => {
    const orgId = req.query.orgId ? Number(req.query.orgId) : undefined;
    const programs = await storage.getPrograms(orgId);
    res.json(programs);
  });

  app.post(api.programs.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.programs.create.input.parse(req.body);
      // Split input into program data and metrics data
      const { metrics, ...programData } = input;
      const metricsData = metrics.map(m => ({ ...m, programId: 0 })); // programId will be set in storage
      
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
    
    // Aggregate in memory
    // Group by GeographyLevel -> GeographyValue -> Sum Metrics
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

    // Flatten for response
    const stats: any[] = [];
    Object.entries(aggregation).forEach(([level, values]) => {
      Object.entries(values).forEach(([geoVal, metrics]) => {
        stats.push({
          geographyLevel: level,
          geographyValue: geoVal,
          metrics
        });
      });
    });

    res.json(stats);
  });
  
  // Seed data function
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingOrgs = await storage.getOrganizations();
  if (existingOrgs.length === 0) {
    console.log("Seeding database...");
    const org = await storage.createOrganization({ name: "Demo Nonprofit", slug: "demo-nonprofit" });
    
    const program = await storage.createProgram({
      orgId: org.id,
      name: "Community Food Bank",
      description: "Providing meals to families in need across LA County."
    }, [
      { name: "Meals Served", unit: "meals" },
      { name: "Families Assisted", unit: "families" }
    ]);

    // Add some impact data
    // Assuming we have a user context, but seeding runs on server start. 
    // We'll mock a user ID for seeding or skip user-linked entries if strict FK constraints exist.
    // Our schema has `userId: varchar references users.id`.
    // We can't insert impact entries without a valid user ID. 
    // So we'll skip impact entry seeding until a user exists, OR we create a system user.
    // For now, let's just create Org and Program so the first user has something to see.
    console.log("Database seeded with initial Organization and Program.");
  }
}
