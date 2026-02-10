import { db } from "./db";
import { 
  organizations, programs, impactMetrics, impactEntries, userRoles,
  type Organization, type Program, type ImpactMetric, type ImpactEntry,
  type InsertOrganization, type InsertProgram, type InsertImpactMetric, type InsertImpactEntry,
  type ProgramWithMetrics
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { authStorage, type IAuthStorage } from "./replit_integrations/auth/storage"; // Import from auth storage

export interface IStorage extends IAuthStorage {
  // Organizations
  getOrganizations(): Promise<Organization[]>;
  getOrganization(id: number): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;

  // Programs
  getPrograms(orgId?: number): Promise<ProgramWithMetrics[]>;
  getProgram(id: number): Promise<ProgramWithMetrics | undefined>;
  createProgram(program: InsertProgram, metrics: InsertImpactMetric[]): Promise<ProgramWithMetrics>;

  // Impact
  getImpactEntries(programId: number, geographyLevel?: string): Promise<ImpactEntry[]>;
  createImpactEntry(entry: InsertImpactEntry & { userId: string }): Promise<ImpactEntry>;
}

export class DatabaseStorage extends (authStorage.constructor as { new (): IAuthStorage }) implements IStorage {
  // Organizations
  async getOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations);
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [newOrg] = await db.insert(organizations).values(org).returning();
    return newOrg;
  }

  // Programs
  async getPrograms(orgId?: number): Promise<ProgramWithMetrics[]> {
    let query = db.select().from(programs);
    if (orgId) {
      query = query.where(eq(programs.orgId, orgId)) as any;
    }
    const programList = await query;
    
    // Fetch metrics for each program (N+1 but simpler for MVP, or could join)
    const results = await Promise.all(programList.map(async (p) => {
      const metrics = await db.select().from(impactMetrics).where(eq(impactMetrics.programId, p.id));
      return { ...p, metrics };
    }));
    
    return results;
  }

  async getProgram(id: number): Promise<ProgramWithMetrics | undefined> {
    const [program] = await db.select().from(programs).where(eq(programs.id, id));
    if (!program) return undefined;

    const metrics = await db.select().from(impactMetrics).where(eq(impactMetrics.programId, id));
    return { ...program, metrics };
  }

  async createProgram(programData: InsertProgram, metricsData: InsertImpactMetric[]): Promise<ProgramWithMetrics> {
    const [program] = await db.insert(programs).values(programData).returning();
    
    const metrics = await Promise.all(metricsData.map(async (m) => {
      const [metric] = await db.insert(impactMetrics).values({ ...m, programId: program.id }).returning();
      return metric;
    }));

    return { ...program, metrics };
  }

  // Impact
  async getImpactEntries(programId: number, geographyLevel?: string): Promise<ImpactEntry[]> {
    let query = db.select().from(impactEntries).where(eq(impactEntries.programId, programId));
    if (geographyLevel) {
      query = query.where(eq(impactEntries.geographyLevel, geographyLevel)) as any;
    }
    return await query;
  }

  async createImpactEntry(entry: InsertImpactEntry & { userId: string }): Promise<ImpactEntry> {
    const [newEntry] = await db.insert(impactEntries).values(entry).returning();
    return newEntry;
  }
}

export const storage = new DatabaseStorage();
