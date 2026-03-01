import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// User storage table — id mirrors Supabase auth.users UUID
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
