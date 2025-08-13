import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Personal Information
  fullName: text("full_name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  title: text("title"),
  email: text("email"),
  
  // Phone Numbers
  mobilePhone: text("mobile_phone"),
  otherPhone: text("other_phone"),
  homePhone: text("home_phone"),
  corporatePhone: text("corporate_phone"),
  
  // Company Information
  company: text("company"),
  employees: integer("employees"),
  employeeSizeBracket: text("employee_size_bracket"),
  industry: text("industry"),
  website: text("website"),
  companyLinkedIn: text("company_linkedin"),
  technologies: text("technologies").array(),
  annualRevenue: decimal("annual_revenue"),
  
  // URLs
  personLinkedIn: text("person_linkedin"),
  
  // Location
  city: text("city"),
  state: text("state"),
  country: text("country"),
  companyAddress: text("company_address"),
  companyCity: text("company_city"),
  companyState: text("company_state"),
  companyCountry: text("company_country"),
  
  // Auto-enriched Data
  emailDomain: text("email_domain"),
  countryCode: text("country_code"),
  timezone: text("timezone"),
  leadScore: decimal("lead_score", { precision: 3, scale: 1 }),
  companyAge: integer("company_age"),
  technologyCategory: text("technology_category"),
  region: text("region"),
  businessType: text("business_type"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isDeleted: boolean("is_deleted").default(false),
});

export const contactActivities = pgTable("contact_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => contacts.id),
  activityType: text("activity_type").notNull(), // 'created', 'updated', 'enriched', 'imported'
  description: text("description").notNull(),
  changes: jsonb("changes"), // Store what changed
  createdAt: timestamp("created_at").defaultNow(),
});

export const importJobs = pgTable("import_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  status: text("status").notNull(), // 'processing', 'completed', 'failed'
  totalRows: integer("total_rows"),
  processedRows: integer("processed_rows"),
  successfulRows: integer("successful_rows"),
  errorRows: integer("error_rows"),
  duplicateRows: integer("duplicate_rows"),
  fieldMapping: jsonb("field_mapping"),
  errors: jsonb("errors"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// User authentication table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Session storage table
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const contactsRelations = relations(contacts, ({ many }) => ({
  activities: many(contactActivities),
}));

export const contactActivitiesRelations = relations(contactActivities, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactActivities.contactId],
    references: [contacts.id],
  }),
}));

// Insert schemas
export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactActivitySchema = createInsertSchema(contactActivities).omit({
  id: true,
  createdAt: true,
});

export const insertImportJobSchema = createInsertSchema(importJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Types
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type ContactActivity = typeof contactActivities.$inferSelect;
export type InsertContactActivity = z.infer<typeof insertContactActivitySchema>;
export type ImportJob = typeof importJobs.$inferSelect;
export type InsertImportJob = z.infer<typeof insertImportJobSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
