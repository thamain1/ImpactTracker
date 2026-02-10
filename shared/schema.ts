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
  createdAt: timestamp("created_at").defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: integer("org_id").notNull().references(() => organizations.id),
  role: text("role", { enum: ["admin", "staff"] }).notNull().default("staff"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const programs = pgTable("programs", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const impactMetrics = pgTable("impact_metrics", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").notNull().references(() => programs.id),
  name: text("name").notNull(), // e.g. "Meals Served"
  unit: text("unit").notNull(), // e.g. "meals"
  createdAt: timestamp("created_at").defaultNow(),
});

export const impactEntries = pgTable("impact_entries", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").notNull().references(() => programs.id),
  userId: varchar("user_id").notNull().references(() => users.id), // Who entered it
  date: date("date").notNull(), // Reporting date
  geographyLevel: text("geography_level", { enum: ["SPA", "City", "County", "State"] }).notNull(),
  geographyValue: text("geography_value").notNull(), // e.g. "SPA 6", "Los Angeles"
  metricValues: jsonb("metric_values").notNull(), // { "metric_name": number } or { "metric_id": number }
  createdAt: timestamp("created_at").defaultNow(),
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
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({ id: true, createdAt: true });
export const insertProgramSchema = createInsertSchema(programs).omit({ id: true, createdAt: true });
export const insertImpactMetricSchema = createInsertSchema(impactMetrics).omit({ id: true, createdAt: true });
export const insertImpactEntrySchema = createInsertSchema(impactEntries).omit({ id: true, createdAt: true, userId: true }); // userId set by backend

// === EXPLICIT API CONTRACT TYPES ===

export type Organization = typeof organizations.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type ImpactMetric = typeof impactMetrics.$inferSelect;
export type ImpactEntry = typeof impactEntries.$inferSelect;

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type InsertProgram = z.infer<typeof insertProgramSchema>;
export type InsertImpactMetric = z.infer<typeof insertImpactMetricSchema>;
export type InsertImpactEntry = z.infer<typeof insertImpactEntrySchema>;

// Complex Types
export interface ProgramWithMetrics extends Program {
  metrics: ImpactMetric[];
}

export interface ImpactReportData {
  programId: number;
  programName: string;
  geographyLevel: string;
  geographyValue: string;
  metrics: Record<string, number>; // Aggregated values
}

export type CreateProgramRequest = InsertProgram & {
  metrics: { name: string; unit: string }[];
};
