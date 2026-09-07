import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const applicationStatusValues = [
  "Saved",
  "Applied",
  "Interview",
  "Won",
  "Rejected",
] as const;

export const applicationStatus = pgEnum("application_status", applicationStatusValues);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedOpportunities = pgTable(
  "saved_opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    source: text("source").notNull(),
    community: text("community").notNull(),
    url: text("url").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    budgetLabel: text("budget_label").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    score: integer("score").notNull(),
    scoreReasons: jsonb("score_reasons").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("saved_opportunities_id_user_uidx").on(table.id, table.userId),
    uniqueIndex("saved_opportunities_user_opportunity_uidx").on(table.userId, table.opportunityId),
    index("saved_opportunities_user_saved_at_idx").on(table.userId, table.savedAt),
  ],
);

export const applicationStatuses = pgTable(
  "application_statuses",
  {
    savedOpportunityId: uuid("saved_opportunity_id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: applicationStatus("status").notNull().default("Saved"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.savedOpportunityId, table.userId],
      foreignColumns: [savedOpportunities.id, savedOpportunities.userId],
      name: "application_statuses_saved_opportunity_user_fk",
    }).onDelete("cascade"),
    index("application_statuses_user_idx").on(table.userId),
  ],
);

export type User = typeof users.$inferSelect;
export type SavedOpportunity = typeof savedOpportunities.$inferSelect;
export type NewSavedOpportunity = typeof savedOpportunities.$inferInsert;
export type ApplicationStatus = (typeof applicationStatusValues)[number];
