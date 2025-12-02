import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
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
}, (table) => [
  index("companies_name_idx").on(table.name),
  index("companies_industry_idx").on(table.industry),
  index("companies_country_idx").on(table.country),
  index("companies_is_deleted_idx").on(table.isDeleted),
  index("companies_created_at_idx").on(table.createdAt),
  index("companies_data_quality_score_idx").on(table.dataQualityScore),
  index("companies_employee_size_bracket_idx").on(table.employeeSizeBracket),
]);

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
}, (table) => [
  index("contacts_email_idx").on(table.email),
  index("contacts_email_domain_idx").on(table.emailDomain),
  index("contacts_company_id_idx").on(table.companyId),
  index("contacts_company_match_status_idx").on(table.companyMatchStatus),
  index("contacts_company_idx").on(table.company),
  index("contacts_industry_idx").on(table.industry),
  index("contacts_country_idx").on(table.country),
  index("contacts_employee_size_bracket_idx").on(table.employeeSizeBracket),
  index("contacts_is_deleted_idx").on(table.isDeleted),
  index("contacts_created_at_idx").on(table.createdAt),
  index("contacts_lead_score_idx").on(table.leadScore),
  index("contacts_full_name_idx").on(table.fullName),
]);

export const contactActivities = pgTable("contact_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => contacts.id),
  activityType: text("activity_type").notNull(), // 'created', 'updated', 'enriched', 'imported'
  description: text("description").notNull(),
  changes: jsonb("changes"), // Store what changed
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("contact_activities_contact_id_idx").on(table.contactId),
  index("contact_activities_activity_type_idx").on(table.activityType),
  index("contact_activities_created_at_idx").on(table.createdAt),
]);

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
}, (table) => [
  index("import_jobs_status_idx").on(table.status),
  index("import_jobs_created_at_idx").on(table.createdAt),
]);

// User authentication table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("users_created_at_idx").on(table.createdAt),
]);

// Session storage table
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("sessions_user_id_idx").on(table.userId),
  index("sessions_expires_at_idx").on(table.expiresAt),
]);

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
}, (table) => [
  index("enrichment_jobs_contact_id_idx").on(table.contactId),
  index("enrichment_jobs_status_idx").on(table.status),
  index("enrichment_jobs_created_at_idx").on(table.createdAt),
]);

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
}, (table) => [
  index("api_keys_owner_user_id_idx").on(table.ownerUserId),
  index("api_keys_created_at_idx").on(table.createdAt),
  index("api_keys_revoked_at_idx").on(table.revokedAt),
]);

// Tags table - for categorizing contacts
export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").default("#6366f1"),
  description: text("description"),
  ownerUserId: varchar("owner_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("tags_owner_user_id_idx").on(table.ownerUserId),
  index("tags_name_idx").on(table.name),
]);

// Contact-Tag junction table for many-to-many relationship
export const contactTags = pgTable("contact_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => contacts.id).notNull(),
  tagId: varchar("tag_id").references(() => tags.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("contact_tags_contact_id_idx").on(table.contactId),
  index("contact_tags_tag_id_idx").on(table.tagId),
  uniqueIndex("contact_tags_unique_idx").on(table.contactId, table.tagId),
]);

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
}, (table) => [
  index("api_request_logs_api_key_id_idx").on(table.apiKeyId),
  index("api_request_logs_created_at_idx").on(table.createdAt),
  index("api_request_logs_status_code_idx").on(table.statusCode),
  index("api_request_logs_trace_id_idx").on(table.traceId),
]);

// ============ ENHANCED AUDIT & DATA QUALITY TABLES ============

// Data change audit log - tracks all changes to critical entities
export const dataChangeAudit = pgTable("data_change_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // 'contact', 'company', 'tag', etc.
  entityId: varchar("entity_id").notNull(),
  operation: text("operation").notNull(), // 'create', 'update', 'delete', 'restore'
  userId: varchar("user_id").references(() => users.id),
  previousData: jsonb("previous_data"), // Snapshot before change
  newData: jsonb("new_data"), // Snapshot after change
  changedFields: text("changed_fields").array(), // List of fields that changed
  changeSource: text("change_source").default("manual"), // 'manual', 'import', 'api', 'enrichment', 'system'
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("data_change_audit_entity_type_idx").on(table.entityType),
  index("data_change_audit_entity_id_idx").on(table.entityId),
  index("data_change_audit_operation_idx").on(table.operation),
  index("data_change_audit_user_id_idx").on(table.userId),
  index("data_change_audit_created_at_idx").on(table.createdAt),
  index("data_change_audit_change_source_idx").on(table.changeSource),
]);

// Data quality issues tracker
export const dataQualityIssues = pgTable("data_quality_issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // 'contact', 'company'
  entityId: varchar("entity_id").notNull(),
  issueType: text("issue_type").notNull(), // 'missing_email', 'invalid_phone', 'duplicate', 'incomplete', 'stale'
  severity: text("severity").notNull().default("medium"), // 'low', 'medium', 'high', 'critical'
  description: text("description").notNull(),
  fieldName: text("field_name"), // Which field has the issue
  suggestedValue: text("suggested_value"), // Auto-suggested fix if available
  status: text("status").notNull().default("open"), // 'open', 'resolved', 'ignored', 'in_progress'
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("data_quality_issues_entity_type_idx").on(table.entityType),
  index("data_quality_issues_entity_id_idx").on(table.entityId),
  index("data_quality_issues_issue_type_idx").on(table.issueType),
  index("data_quality_issues_severity_idx").on(table.severity),
  index("data_quality_issues_status_idx").on(table.status),
  index("data_quality_issues_created_at_idx").on(table.createdAt),
]);

// Database metrics snapshots - for tracking growth and health over time
export const databaseMetrics = pgTable("database_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotDate: timestamp("snapshot_date").notNull(),
  
  // Table counts
  totalContacts: integer("total_contacts").default(0),
  activeContacts: integer("active_contacts").default(0),
  deletedContacts: integer("deleted_contacts").default(0),
  totalCompanies: integer("total_companies").default(0),
  activeCompanies: integer("active_companies").default(0),
  
  // Match statistics
  matchedContacts: integer("matched_contacts").default(0),
  unmatchedContacts: integer("unmatched_contacts").default(0),
  pendingReviewContacts: integer("pending_review_contacts").default(0),
  
  // Data quality metrics
  contactsWithEmail: integer("contacts_with_email").default(0),
  contactsWithPhone: integer("contacts_with_phone").default(0),
  contactsWithLinkedIn: integer("contacts_with_linkedin").default(0),
  companiesWithDomain: integer("companies_with_domain").default(0),
  
  // Activity metrics
  importsToday: integer("imports_today").default(0),
  enrichmentsToday: integer("enrichments_today").default(0),
  apiRequestsToday: integer("api_requests_today").default(0),
  
  // Data quality scores
  avgContactQualityScore: decimal("avg_contact_quality_score", { precision: 5, scale: 2 }),
  avgCompanyQualityScore: decimal("avg_company_quality_score", { precision: 5, scale: 2 }),
  
  // Open issues count
  openDataQualityIssues: integer("open_data_quality_issues").default(0),
  criticalIssues: integer("critical_issues").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("database_metrics_snapshot_date_idx").on(table.snapshotDate),
]);

// Archived records - for storing soft-deleted records before permanent deletion
export const archivedRecords = pgTable("archived_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // 'contact', 'company'
  originalId: varchar("original_id").notNull(),
  data: jsonb("data").notNull(), // Full record snapshot
  deletedBy: varchar("deleted_by").references(() => users.id),
  deletedAt: timestamp("deleted_at").notNull(),
  retentionDays: integer("retention_days").default(90),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("archived_records_entity_type_idx").on(table.entityType),
  index("archived_records_original_id_idx").on(table.originalId),
  index("archived_records_expires_at_idx").on(table.expiresAt),
  index("archived_records_deleted_at_idx").on(table.deletedAt),
]);

// Bulk operation jobs - tracks all bulk actions with real-time progress
export const bulkOperationJobs = pgTable("bulk_operation_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  operationType: text("operation_type").notNull(), // 'bulk-match', 'bulk-autofill', 'bulk-delete', 'bulk-import-companies'
  status: text("status").notNull().default("queued"), // 'queued', 'running', 'completed', 'failed', 'cancelled'
  
  // Progress tracking
  totalItems: integer("total_items").default(0),
  processedItems: integer("processed_items").default(0),
  successCount: integer("success_count").default(0),
  failedCount: integer("failed_count").default(0),
  skippedCount: integer("skipped_count").default(0),
  matchedCount: integer("matched_count").default(0),
  
  // Current item being processed (for real-time display)
  currentItemId: varchar("current_item_id"),
  currentItemName: text("current_item_name"),
  currentStep: text("current_step"),
  
  // Operation parameters
  params: jsonb("params"), // Operation-specific parameters
  
  // Results and details
  results: jsonb("results"), // Detailed operation results
  errors: jsonb("errors").default(sql`'[]'::jsonb`), // Array of error objects
  activityLog: jsonb("activity_log").default(sql`'[]'::jsonb`), // Real-time activity feed
  
  // Timing
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  
  // User tracking
  userId: varchar("user_id").references(() => users.id),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("bulk_operation_jobs_operation_type_idx").on(table.operationType),
  index("bulk_operation_jobs_status_idx").on(table.status),
  index("bulk_operation_jobs_user_id_idx").on(table.userId),
  index("bulk_operation_jobs_created_at_idx").on(table.createdAt),
]);

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

// New audit and data quality schemas
export const insertDataChangeAuditSchema = createInsertSchema(dataChangeAudit).omit({
  id: true,
  createdAt: true,
});

export const insertDataQualityIssueSchema = createInsertSchema(dataQualityIssues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
});

export const insertDatabaseMetricsSchema = createInsertSchema(databaseMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertArchivedRecordSchema = createInsertSchema(archivedRecords).omit({
  id: true,
  createdAt: true,
});

export const insertBulkOperationJobSchema = createInsertSchema(bulkOperationJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  finishedAt: true,
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

// New audit and data quality types
export type DataChangeAudit = typeof dataChangeAudit.$inferSelect;
export type InsertDataChangeAudit = z.infer<typeof insertDataChangeAuditSchema>;
export type DataQualityIssue = typeof dataQualityIssues.$inferSelect;
export type InsertDataQualityIssue = z.infer<typeof insertDataQualityIssueSchema>;
export type DatabaseMetrics = typeof databaseMetrics.$inferSelect;
export type InsertDatabaseMetrics = z.infer<typeof insertDatabaseMetricsSchema>;
export type ArchivedRecord = typeof archivedRecords.$inferSelect;
export type InsertArchivedRecord = z.infer<typeof insertArchivedRecordSchema>;
export type BulkOperationJob = typeof bulkOperationJobs.$inferSelect;
export type InsertBulkOperationJob = z.infer<typeof insertBulkOperationJobSchema>;

// Bulk operation progress event types
export interface BulkProgressEvent {
  type: 'bulk-progress';
  jobId: string;
  operationType: string;
  status: string;
  totals: {
    total: number;
    processed: number;
    success: number;
    failed: number;
    skipped: number;
    matched: number;
  };
  current?: {
    id: string;
    name: string;
    companyMatched?: string;
    fieldsFilled?: string[];
    step?: string;
  };
  message?: string;
  errors?: Array<{ itemId: string; itemName: string; error: string }>;
  activity?: Array<{ timestamp: string; type: string; message: string; details?: any }>;
}
