import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Companies table - stores verified company information
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Company Identity
  name: text("name").notNull(),
  nameForEmails: text("name_for_emails"),
  website: text("website"),
  linkedinUrl: text("linkedin_url"),
  logoUrl: text("logo_url"),
  
  // Domains for matching (e.g., ["acme.com", "acme.io"])
  domains: text("domains").array().default(sql`ARRAY[]::text[]`),
  
  // Company Details
  industry: text("industry"),
  employees: integer("employees"),
  employeeSizeBracket: text("employee_size_bracket"),
  shortDescription: text("short_description"),
  keywords: text("keywords"),
  businessType: text("business_type"),
  
  // Contact Information
  phone: text("phone"),
  
  // Location
  street: text("street"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  postalCode: text("postal_code"),
  address: text("address"),
  
  // Technology & Industry
  technologies: text("technologies"),
  sicCodes: text("sic_codes"),
  naicsCodes: text("naics_codes"),
  
  // Financial Information
  annualRevenue: text("annual_revenue"),
  totalFunding: text("total_funding"),
  latestFunding: text("latest_funding"),
  latestFundingAmount: text("latest_funding_amount"),
  lastRaisedAt: text("last_raised_at"),
  
  // Business Metrics
  retailLocations: integer("retail_locations"),
  foundedYear: integer("founded_year"),
  
  // Corporate Structure
  subsidiaryOf: text("subsidiary_of"),
  
  // Data Quality
  isVerified: boolean("is_verified").default(false),
  dataQualityScore: integer("data_quality_score").default(0),
  lastEnrichedAt: timestamp("last_enriched_at"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isDeleted: boolean("is_deleted").default(false),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Company Reference - links to companies table
  companyId: varchar("company_id").references(() => companies.id),
  companyMatchStatus: text("company_match_status").default("unmatched"), // 'matched', 'unmatched', 'pending_review', 'manual'
  
  // Personal Information (MANDATORY for prospects)
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
  
  // Legacy Company Information (kept for backwards compatibility, but will be auto-filled from companies table)
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

// LinkedIn enrichment jobs table - tracks enrichment requests
export const enrichmentJobs = pgTable("enrichment_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => contacts.id),
  linkedinUrl: text("linkedin_url").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  provider: text("provider").notNull().default("proxycurl"), // API provider used
  
  // Results from enrichment
  enrichedEmail: text("enriched_email"),
  enrichedPhone: text("enriched_phone"),
  enrichedData: jsonb("enriched_data"), // Full response from API
  
  // Error tracking
  errorMessage: text("error_message"),
  
  // Credits/cost tracking
  creditsUsed: integer("credits_used"),
  
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// API Keys table - for public API authentication
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hashedKey: text("hashed_key").unique().notNull(),
  label: text("label").notNull(),
  ownerUserId: varchar("owner_user_id").references(() => users.id).notNull(),
  scopes: text("scopes").array().default(sql`ARRAY['prospects:read']::text[]`),
  rateLimitPerMinute: integer("rate_limit_per_minute").default(60),
  requestCount: integer("request_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

// Tags table - for categorizing contacts
export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").default("#6366f1"),
  description: text("description"),
  ownerUserId: varchar("owner_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contact-Tag junction table for many-to-many relationship
export const contactTags = pgTable("contact_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => contacts.id).notNull(),
  tagId: varchar("tag_id").references(() => tags.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// API request logs for audit trail
export const apiRequestLogs = pgTable("api_request_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id).notNull(),
  traceId: text("trace_id").notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  statusCode: integer("status_code"),
  responseTimeMs: integer("response_time_ms"),
  requestBody: jsonb("request_body"),
  errorMessage: text("error_message"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  contacts: many(contacts),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
  activities: many(contactActivities),
  contactTags: many(contactTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  contactTags: many(contactTags),
}));

export const contactTagsRelations = relations(contactTags, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactTags.contactId],
    references: [contacts.id],
  }),
  tag: one(tags, {
    fields: [contactTags.tagId],
    references: [tags.id],
  }),
}));

export const contactActivitiesRelations = relations(contactActivities, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactActivities.contactId],
    references: [contacts.id],
  }),
}));

// Insert schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Make fullName optional since it can be auto-generated from firstName/lastName
  fullName: z.string().optional(),
}).refine((data) => {
  // Either fullName is provided OR at least firstName/lastName OR email is provided
  return data.fullName || data.firstName || data.lastName || data.email;
}, {
  message: "Either fullName or firstName/lastName or email must be provided",
  path: ["fullName"]
});

// Simplified Prospect Schema - only mandatory fields for prospect upload
export const insertProspectSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  mobilePhone: z.string().min(1, "Phone number is required"),
  personLinkedIn: z.string().url("Valid LinkedIn URL is required").refine(
    (url) => url.includes('linkedin.com/in/'),
    "Must be a valid LinkedIn profile URL"
  ),
  // Optional fields that can help with matching
  company: z.string().optional(),
  title: z.string().optional(),
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

export const insertEnrichmentJobSchema = createInsertSchema(enrichmentJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
  requestCount: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactTagSchema = createInsertSchema(contactTags).omit({
  id: true,
  createdAt: true,
});

export const insertApiRequestLogSchema = createInsertSchema(apiRequestLogs).omit({
  id: true,
  createdAt: true,
});

// LinkedIn enrichment request schema
export const linkedinEnrichmentRequestSchema = z.object({
  linkedinUrl: z.string().url("Invalid LinkedIn URL").refine(
    (url) => url.includes('linkedin.com/in/'),
    "Must be a valid LinkedIn profile URL"
  ),
  contactId: z.string().optional(),
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertProspect = z.infer<typeof insertProspectSchema>;
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
export type EnrichmentJob = typeof enrichmentJobs.$inferSelect;
export type InsertEnrichmentJob = z.infer<typeof insertEnrichmentJobSchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type ContactTag = typeof contactTags.$inferSelect;
export type InsertContactTag = z.infer<typeof insertContactTagSchema>;
export type ApiRequestLog = typeof apiRequestLogs.$inferSelect;
export type InsertApiRequestLog = z.infer<typeof insertApiRequestLogSchema>;
export type LinkedinEnrichmentRequest = z.infer<typeof linkedinEnrichmentRequestSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
