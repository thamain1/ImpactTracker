import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";

// === TABLE DEFINITIONS ===

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  address: text("address"),
  phone: text("phone"),
  website: text("website"),
  contactEmail: text("contact_email"),
  mission: text("mission"),
  vision: text("vision"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: integer("org_id").notNull().references(() => organizations.id),
  role: text("role", { enum: ["admin", "can_edit", "can_view", "can_view_download"] }).notNull().default("can_view"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const programs = pgTable("programs", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type"),
  status: text("status", { enum: ["active", "completed", "draft"] }).notNull().default("active"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  targetPopulation: text("target_population"),
  targetAgeMin: integer("target_age_min"),
  targetAgeMax: integer("target_age_max"),
  goals: text("goals"),
  costPerParticipant: text("cost_per_participant"),
  locations: text("locations"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const impactMetrics = pgTable("impact_metrics", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").notNull().references(() => programs.id),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  countsAsParticipant: boolean("counts_as_participant").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const impactEntries = pgTable("impact_entries", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").notNull().references(() => programs.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  geographyLevel: text("geography_level", { enum: ["SPA", "City", "County", "State"] }).notNull(),
  geographyValue: text("geography_value").notNull(),
  zipCode: text("zip_code"),
  demographics: text("demographics"),
  outcomes: text("outcomes"),
  metricValues: jsonb("metric_values").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const censusCache = pgTable("census_cache", {
  id: serial("id").primaryKey(),
  geographyLevel: text("geography_level").notNull(),
  geographyValue: text("geography_value").notNull(),
  stateCode: text("state_code"),
  totalPopulation: integer("total_population"),
  povertyCount: integer("poverty_count"),
  povertyUniverse: integer("poverty_universe"),
  medianIncome: integer("median_income"),
  dataYear: integer("data_year").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
});

// === RELATIONS ===

export const organizationsRelations = relations(organizations, ({ many }) => ({
  userRoles: many(userRoles),
  programs: many(programs),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  organization: one(organizations, { fields: [userRoles.orgId], references: [organizations.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const programsRelations = relations(programs, ({ one, many }) => ({
  organization: one(organizations, { fields: [programs.orgId], references: [organizations.id] }),
  metrics: many(impactMetrics),
  entries: many(impactEntries),
}));

export const impactMetricsRelations = relations(impactMetrics, ({ one }) => ({
  program: one(programs, { fields: [impactMetrics.programId], references: [programs.id] }),
}));

export const impactEntriesRelations = relations(impactEntries, ({ one }) => ({
  program: one(programs, { fields: [impactEntries.programId], references: [programs.id] }),
  user: one(users, { fields: [impactEntries.userId], references: [users.id] }),
}));

// === BASE SCHEMAS ===

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true });
export const updateOrganizationSchema = insertOrganizationSchema.partial();
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({ id: true, createdAt: true });
export const insertProgramSchema = createInsertSchema(programs, {
  startDate: z.union([z.string().min(1), z.literal("")]).optional().nullable().transform(v => v || null),
  endDate: z.union([z.string().min(1), z.literal("")]).optional().nullable().transform(v => v || null),
}).omit({ id: true, createdAt: true });
export const updateProgramSchema = insertProgramSchema.partial();
export const insertImpactMetricSchema = createInsertSchema(impactMetrics).omit({ id: true, createdAt: true });
export const insertImpactEntrySchema = createInsertSchema(impactEntries).omit({ id: true, createdAt: true, userId: true });

// === EXPLICIT API CONTRACT TYPES ===

export type Organization = typeof organizations.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type ImpactMetric = typeof impactMetrics.$inferSelect;
export type ImpactEntry = typeof impactEntries.$inferSelect;

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type InsertProgram = z.infer<typeof insertProgramSchema>;
export type UpdateProgram = z.infer<typeof updateProgramSchema>;
export type InsertImpactMetric = z.infer<typeof insertImpactMetricSchema>;
export type InsertImpactEntry = z.infer<typeof insertImpactEntrySchema>;
export type CensusCache = typeof censusCache.$inferSelect;

export interface ProgramWithMetrics extends Program {
  metrics: ImpactMetric[];
}

export interface UserRoleWithUser extends UserRole {
  user: { id: string; email: string | null; firstName: string | null; lastName: string | null } | null;
}

export interface ImpactReportData {
  programId: number;
  programName: string;
  geographyLevel: string;
  geographyValue: string;
  metrics: Record<string, number>;
}

export type CreateProgramRequest = InsertProgram & {
  metrics: { name: string; unit: string; countsAsParticipant?: boolean }[];
};
