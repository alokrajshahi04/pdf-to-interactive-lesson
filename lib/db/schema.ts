import { pgTable, uuid, text, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  courseData: jsonb("course_data").notNull(),
  createdBy: text("created_by"), // userId (or sessionId for anonymous users)
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

