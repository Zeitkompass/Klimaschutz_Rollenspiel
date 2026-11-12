import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// One locked row is the atomic boundary for a classroom's simultaneous actions.
// Credentials in state are hashes and never appear in an API response.
export const climateRoomsTable = pgTable("climate_rooms", {
  code: text("code").primaryKey(),
  state: jsonb("state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
