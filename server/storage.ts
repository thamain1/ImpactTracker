import { db } from "./db";
import { 
  organizations, programs, impactMetrics, impactEntries, userRoles, users, censusCache,
  type Organization, type Program, type ImpactMetric, type ImpactEntry, type UserRole,
  type InsertOrganization, type UpdateOrganization, type InsertProgram, type UpdateProgram,
  type InsertImpactMetric, type InsertImpactEntry,
  type ProgramWithMetrics, type UserRoleWithUser, type CensusCache
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<any>;
  upsertUser(user: any): Promise<any>;

  getOrganizations(): Promise<Organization[]>;
  getOrganizationsForUser(userId: string): Promise<Organization[]>;
  getOrganization(id: number): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: number, updates: UpdateOrganization): Promise<Organization | undefined>;

  getUserRoles(orgId: number): Promise<UserRoleWithUser[]>;
  createUserRole(orgId: number, userId: string, role: string): Promise<UserRole>;
  updateUserRole(id: number, role: string): Promise<UserRole>;
  deleteUserRole(id: number): Promise<void>;
  findUserByEmail(email: string): Promise<any>;

  getPrograms(orgId?: number): Promise<ProgramWithMetrics[]>;
  getProgram(id: number): Promise<ProgramWithMetrics | undefined>;
  createProgram(program: InsertProgram, metrics: InsertImpactMetric[]): Promise<ProgramWithMetrics>;
  updateProgram(id: number, updates: UpdateProgram): Promise<Program | undefined>;
  deleteProgram(id: number): Promise<void>;

  createImpactMetric(metric: InsertImpactMetric): Promise<ImpactMetric>;
  updateImpactMetric(id: number, data: Partial<InsertImpactMetric>): Promise<ImpactMetric>;
  deleteImpactMetric(id: number): Promise<void>;

  getImpactEntries(programId: number, geographyLevel?: string): Promise<ImpactEntry[]>;
  createImpactEntry(entry: InsertImpactEntry & { userId: string }): Promise<ImpactEntry>;
  updateImpactEntry(id: number, updates: Partial<InsertImpactEntry>): Promise<ImpactEntry | undefined>;
  getAllImpactEntries(): Promise<ImpactEntry[]>;

  getCensusData(geographyLevel: string, geographyValue: string): Promise<CensusCache | undefined>;
  upsertCensusData(data: Omit<CensusCache, "id" | "fetchedAt">): Promise<CensusCache>;

  getDistinctGeographies(): Promise<{ level: string; value: string }[]>;

  getAdminStats(): Promise<{
    totalOrganizations: number;
    totalPrograms: number;
    totalEntries: number;
    byGeography: { geographyLevel: string; count: number; totalMetrics: Record<string, number> }[];
    recentPrograms: Program[];
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: any) {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: { ...userData, updatedAt: new Date() },
      })
      .returning();
    return user;
  }

  async findUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations);
  }

  async getOrganizationsForUser(userId: string): Promise<Organization[]> {
    const roles = await db.select({ orgId: userRoles.orgId }).from(userRoles).where(eq(userRoles.userId, userId));
    if (roles.length === 0) return [];
    const orgIds = roles.map(r => r.orgId);
    const orgs = await db.select().from(organizations).where(
      sql`${organizations.id} IN (${sql.join(orgIds.map(id => sql`${id}`), sql`, `)})`
    );
    return orgs;
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [newOrg] = await db.insert(organizations).values(org).returning();
    return newOrg;
  }

  async updateOrganization(id: number, updates: UpdateOrganization): Promise<Organization | undefined> {
    const [updated] = await db.update(organizations).set(updates).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async getUserRoles(orgId: number): Promise<UserRoleWithUser[]> {
    const roles = await db.select().from(userRoles).where(eq(userRoles.orgId, orgId));
    const results: UserRoleWithUser[] = [];
    for (const role of roles) {
      const [user] = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(users).where(eq(users.id, role.userId));
      results.push({ ...role, user: user || null });
    }
    return results;
  }

  async createUserRole(orgId: number, userId: string, role: string): Promise<UserRole> {
    const [newRole] = await db.insert(userRoles).values({ orgId, userId, role: role as any }).returning();
    return newRole;
  }

  async updateUserRole(id: number, role: string): Promise<UserRole> {
    const [updated] = await db.update(userRoles).set({ role: role as any }).where(eq(userRoles.id, id)).returning();
    return updated;
  }

  async deleteUserRole(id: number): Promise<void> {
    await db.delete(userRoles).where(eq(userRoles.id, id));
  }

  async getPrograms(orgId?: number): Promise<ProgramWithMetrics[]> {
    let query = db.select().from(programs).orderBy(desc(programs.createdAt));
    if (orgId) {
      query = query.where(eq(programs.orgId, orgId)) as any;
    }
    const programList = await query;
    
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

  async updateProgram(id: number, updates: UpdateProgram): Promise<Program | undefined> {
    const [updated] = await db.update(programs).set(updates).where(eq(programs.id, id)).returning();
    return updated;
  }

  async deleteProgram(id: number): Promise<void> {
    await db.delete(impactEntries).where(eq(impactEntries.programId, id));
    await db.delete(impactMetrics).where(eq(impactMetrics.programId, id));
    await db.delete(programs).where(eq(programs.id, id));
  }

  async createImpactMetric(metric: InsertImpactMetric): Promise<ImpactMetric> {
    const [created] = await db.insert(impactMetrics).values(metric).returning();
    return created;
  }

  async updateImpactMetric(id: number, data: Partial<InsertImpactMetric>): Promise<ImpactMetric> {
    const [updated] = await db.update(impactMetrics).set(data).where(eq(impactMetrics.id, id)).returning();
    return updated;
  }

  async deleteImpactMetric(id: number): Promise<void> {
    await db.delete(impactMetrics).where(eq(impactMetrics.id, id));
  }

  async getImpactEntries(programId: number, geographyLevel?: string): Promise<ImpactEntry[]> {
    if (geographyLevel) {
      return await db.select().from(impactEntries).where(
        and(eq(impactEntries.programId, programId), eq(impactEntries.geographyLevel, geographyLevel as any))
      ).orderBy(desc(impactEntries.createdAt));
    }
    return await db.select().from(impactEntries).where(eq(impactEntries.programId, programId)).orderBy(desc(impactEntries.createdAt));
  }

  async createImpactEntry(entry: InsertImpactEntry & { userId: string }): Promise<ImpactEntry> {
    const [newEntry] = await db.insert(impactEntries).values(entry).returning();
    return newEntry;
  }

  async updateImpactEntry(id: number, updates: Partial<InsertImpactEntry>): Promise<ImpactEntry | undefined> {
    const [updated] = await db.update(impactEntries).set(updates).where(eq(impactEntries.id, id)).returning();
    return updated;
  }

  async getAllImpactEntries(): Promise<ImpactEntry[]> {
    return await db.select().from(impactEntries).orderBy(desc(impactEntries.createdAt));
  }

  async getCensusData(geographyLevel: string, geographyValue: string): Promise<CensusCache | undefined> {
    const [result] = await db.select().from(censusCache)
      .where(and(
        eq(censusCache.geographyLevel, geographyLevel),
        eq(censusCache.geographyValue, geographyValue)
      ));
    return result;
  }

  async upsertCensusData(data: Omit<CensusCache, "id" | "fetchedAt">): Promise<CensusCache> {
    const existing = await this.getCensusData(data.geographyLevel, data.geographyValue);
    if (existing) {
      const [updated] = await db.update(censusCache).set({ ...data, fetchedAt: new Date() })
        .where(eq(censusCache.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(censusCache).values(data).returning();
    return created;
  }

  async getDistinctGeographies(): Promise<{ level: string; value: string }[]> {
    const results = await db.execute(
      sql`SELECT DISTINCT geography_level as level, geography_value as value FROM impact_entries WHERE geography_value IS NOT NULL AND geography_value != ''`
    );
    return (results.rows || []) as { level: string; value: string }[];
  }

  async getAdminStats() {
    const [orgCount] = await db.select({ count: sql<number>`count(*)::int` }).from(organizations);
    const [progCount] = await db.select({ count: sql<number>`count(*)::int` }).from(programs);
    const [entryCount] = await db.select({ count: sql<number>`count(*)::int` }).from(impactEntries);

    const allEntries = await this.getAllImpactEntries();

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

    const recentPrograms = await db.select().from(programs).orderBy(desc(programs.createdAt)).limit(5);

    return {
      totalOrganizations: orgCount.count,
      totalPrograms: progCount.count,
      totalEntries: entryCount.count,
      byGeography,
      recentPrograms,
    };
  }
}

export const storage = new DatabaseStorage();
