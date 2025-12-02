import { 
  contacts, 
  contactActivities, 
  importJobs,
  users,
  sessions,
  enrichmentJobs,
  apiKeys,
  tags,
  contactTags,
  apiRequestLogs,
  companies,
  type Contact, 
  type InsertContact,
  type ContactActivity,
  type InsertContactActivity,
  type ImportJob,
  type InsertImportJob,
  type User,
  type InsertUser,
  type Session,
  type InsertSession,
  type EnrichmentJob,
  type InsertEnrichmentJob,
  type ApiKey,
  type InsertApiKey,
  type Tag,
  type InsertTag,
  type ContactTag,
  type InsertContactTag,
  type ApiRequestLog,
  type InsertApiRequestLog,
  type Company,
  type InsertCompany,
  type InsertProspect
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, desc, asc, count, sql, or, isNull, isNotNull, ne } from "drizzle-orm";
import { CompanyMatcher } from "./company-matcher";

export interface IStorage {
  // Company operations
  getCompanies(params: {
    page?: number;
    limit?: number;
    search?: string;
    industry?: string;
  }): Promise<{ companies: Company[], total: number }>;
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByDomain(domain: string): Promise<Company | undefined>;
  getCompanyByName(name: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, updates: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;
  bulkImportCompanies(companies: InsertCompany[]): Promise<{ imported: number; duplicates: number }>;
  bulkInsertCompaniesOptimized(companies: InsertCompany[]): Promise<{ inserted: number }>;
  getMissingCompanyDomains(): Promise<{ domain: string; contactCount: number }[]>;
  
  // Prospect operations with company matching
  createProspect(prospect: InsertProspect): Promise<Contact>;
  matchProspectToCompany(contactId: string): Promise<{ matched: boolean; companyId?: string; companyName?: string }>;
  bulkMatchProspectsToCompanies(): Promise<{ matched: number; unmatched: number }>;
  getUnmatchedProspects(): Promise<Contact[]>;
  manuallyAssignCompany(contactId: string, companyId: string): Promise<Contact | undefined>;
  
  // Contact operations
  getContacts(params: {
    page?: number;
    limit?: number;
    search?: string;
    industry?: string;
    employeeSizeBracket?: string;
    country?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    companyMatchStatus?: string;
  }): Promise<{ contacts: Contact[], total: number }>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<boolean>;
  bulkDeleteContacts(ids: string[]): Promise<number>;
  
  // Duplicate detection
  findDuplicateContacts(email: string, company?: string): Promise<Contact[]>;
  findFuzzyDuplicateContacts(email?: string, fullName?: string, company?: string): Promise<Contact[]>;
  
  // Stats
  getContactStats(): Promise<{
    totalContacts: number;
    totalCompanies: number;
    validEmails: number;
    averageLeadScore: number;
  }>;

  // Comprehensive Analytics
  getComprehensiveAnalytics(): Promise<any>;
  getAnalyticsTrends(): Promise<any>;
  getAnalyticsActivities(): Promise<any>;
  getAnalyticsImports(): Promise<any>;
  
  // Activity logging
  createContactActivity(activity: InsertContactActivity): Promise<ContactActivity>;
  getContactActivities(contactId: string): Promise<ContactActivity[]>;
  
  // Import jobs
  createImportJob(job: InsertImportJob): Promise<ImportJob>;
  updateImportJob(id: string, updates: Partial<ImportJob>): Promise<ImportJob | undefined>;
  getImportJob(id: string): Promise<ImportJob | undefined>;
  
  // User authentication
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Session management
  createSession(session: InsertSession): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<boolean>;
  deleteExpiredSessions(): Promise<number>;
  
  // Utility operations
  fixEmptyFullNames(): Promise<number>;
  
  // Company details auto-fill operations (enhanced with email domain matching)
  getCompanyTemplate(companyName?: string, website?: string, companyLinkedIn?: string, email?: string): Promise<Partial<Contact> | null>;
  createContactWithAutoFill(contact: InsertContact): Promise<Contact>;
  updateContactWithAutoFill(id: string, updates: Partial<InsertContact>): Promise<Contact | undefined>;
  bulkAutoFillCompanyDetails(): Promise<{ processed: number; updated: number; companiesProcessed: string[] }>;
  
  // LinkedIn enrichment operations
  createEnrichmentJob(job: InsertEnrichmentJob): Promise<EnrichmentJob>;
  updateEnrichmentJob(id: string, updates: Partial<EnrichmentJob>): Promise<EnrichmentJob | undefined>;
  getEnrichmentJob(id: string): Promise<EnrichmentJob | undefined>;
  getEnrichmentJobsByContact(contactId: string): Promise<EnrichmentJob[]>;
  getRecentEnrichmentJobs(limit?: number): Promise<EnrichmentJob[]>;
  
  // LinkedIn URL search in existing contacts
  findContactsByLinkedInUrl(linkedinUrl: string): Promise<Contact[]>;
  
  // API Key operations
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  getApiKeyByHash(hashedKey: string): Promise<ApiKey | undefined>;
  getUserApiKeys(userId: string): Promise<ApiKey[]>;
  updateApiKeyUsage(id: string): Promise<void>;
  revokeApiKey(id: string): Promise<boolean>;
  
  // Tag operations
  getTags(): Promise<Tag[]>;
  getTag(id: string): Promise<Tag | undefined>;
  createTag(tag: InsertTag): Promise<Tag>;
  deleteTag(id: string): Promise<boolean>;
  getContactTags(contactId: string): Promise<Tag[]>;
  addTagToContact(contactId: string, tagId: string): Promise<ContactTag>;
  removeTagFromContact(contactId: string, tagId: string): Promise<boolean>;
  
  // Activity operations
  getRecentActivities(limit?: number): Promise<ContactActivity[]>;
  
  // API Request Logging
  logApiRequest(log: InsertApiRequestLog): Promise<ApiRequestLog>;
  
  // User operations
  getUserById(id: string): Promise<User | undefined>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
}

// Utility function to generate full name from first and last name
function generateFullName(firstName?: string | null, lastName?: string | null, existingFullName?: string | null): string {
  // If fullName already exists and is not empty, keep it
  if (existingFullName && existingFullName.trim()) {
    return existingFullName.trim();
  }
  
  // Generate from firstName and lastName
  const first = firstName?.trim() || '';
  const last = lastName?.trim() || '';
  
  if (first && last) {
    return `${first} ${last}`;
  } else if (first) {
    return first;
  } else if (last) {
    return last;
  }
  
  // Return existing fullName if no components available
  return existingFullName || '';
}

// Helper function to extract domain from email
function extractDomainFromEmail(email: string): string | null {
  if (!email) return null;
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : null;
}

export class DatabaseStorage implements IStorage {
  // ============ COMPANY OPERATIONS ============
  
  async getCompanies(params: {
    page?: number;
    limit?: number;
    search?: string;
    industry?: string;
  } = {}): Promise<{ companies: Company[], total: number }> {
    const { page = 1, limit = 20, search = '', industry = '' } = params;
    const offset = (page - 1) * limit;
    
    const conditions = [eq(companies.isDeleted, false)];
    
    if (search) {
      conditions.push(
        sql`(${companies.name} ILIKE ${`%${search}%`} OR 
            ${companies.website} ILIKE ${`%${search}%`} OR
            ${search} = ANY(${companies.domains}))`
      );
    }
    
    if (industry) {
      conditions.push(eq(companies.industry, industry));
    }
    
    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
    
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(companies)
      .where(whereClause);
    
    const companiesList = await db
      .select()
      .from(companies)
      .where(whereClause)
      .orderBy(desc(companies.createdAt))
      .limit(limit)
      .offset(offset);
    
    return { companies: companiesList, total };
  }
  
  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, id), eq(companies.isDeleted, false)));
    return company || undefined;
  }
  
  async getCompanyByDomain(domain: string): Promise<Company | undefined> {
    const normalizedDomain = domain.toLowerCase().trim();
    const [company] = await db
      .select()
      .from(companies)
      .where(and(
        sql`${normalizedDomain} = ANY(${companies.domains})`,
        eq(companies.isDeleted, false)
      ));
    return company || undefined;
  }
  
  async getCompanyByName(name: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(and(
        ilike(companies.name, name.trim()),
        eq(companies.isDeleted, false)
      ));
    return company || undefined;
  }
  
  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    // Normalize domains if provided
    const companyData = {
      ...insertCompany,
      domains: insertCompany.domains?.map(d => d.toLowerCase().trim()) || [],
      updatedAt: new Date(),
    };
    
    const [company] = await db
      .insert(companies)
      .values(companyData)
      .returning();
    
    return company;
  }
  
  async updateCompany(id: string, updates: Partial<InsertCompany>): Promise<Company | undefined> {
    // Normalize domains if provided
    const updateData = { ...updates };
    if (updates.domains) {
      updateData.domains = updates.domains.map(d => d.toLowerCase().trim());
    }
    
    const [company] = await db
      .update(companies)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(companies.id, id), eq(companies.isDeleted, false)))
      .returning();
    
    return company || undefined;
  }
  
  async deleteCompany(id: string): Promise<boolean> {
    const [company] = await db
      .update(companies)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(companies.id, id), eq(companies.isDeleted, false)))
      .returning();
    
    return !!company;
  }
  
  async bulkImportCompanies(companyList: InsertCompany[]): Promise<{ imported: number; duplicates: number }> {
    let imported = 0;
    let duplicates = 0;
    
    for (const company of companyList) {
      let existing: Company | undefined;
      
      if (company.domains && company.domains.length > 0) {
        for (const domain of company.domains) {
          existing = await this.getCompanyByDomain(domain);
          if (existing) break;
        }
      }
      
      if (!existing && company.name) {
        existing = await this.getCompanyByName(company.name);
      }
      
      if (existing) {
        duplicates++;
      } else {
        await this.createCompany(company);
        imported++;
      }
    }
    
    return { imported, duplicates };
  }

  async bulkInsertCompaniesOptimized(companyList: InsertCompany[]): Promise<{ inserted: number }> {
    if (companyList.length === 0) return { inserted: 0 };

    try {
      const preparedCompanies = companyList.map(company => ({
        ...company,
        domains: company.domains?.map(d => d.toLowerCase().trim()) || [],
        updatedAt: new Date(),
      }));

      const result = await db
        .insert(companies)
        .values(preparedCompanies)
        .onConflictDoNothing()
        .returning({ id: companies.id });

      return { inserted: result.length };
    } catch (error) {
      console.error('Bulk insert error:', error);
      throw error;
    }
  }

  async getMissingCompanyDomains(): Promise<{ domain: string; contactCount: number }[]> {
    const result = await db.execute(sql`
      WITH contact_domains AS (
        SELECT DISTINCT 
          LOWER(email_domain) as domain,
          COUNT(*) as contact_count
        FROM contacts
        WHERE email_domain IS NOT NULL 
          AND email_domain != ''
          AND is_deleted = false
        GROUP BY LOWER(email_domain)
      ),
      existing_company_domains AS (
        SELECT DISTINCT LOWER(unnest(domains)) as domain
        FROM companies
        WHERE is_deleted = false
          AND domains IS NOT NULL
          AND array_length(domains, 1) > 0
      )
      SELECT cd.domain, cd.contact_count::int as contact_count
      FROM contact_domains cd
      LEFT JOIN existing_company_domains ecd ON cd.domain = ecd.domain
      WHERE ecd.domain IS NULL
        AND cd.domain NOT LIKE '%@%'
        AND cd.domain NOT LIKE '%.%@%'
        AND LENGTH(cd.domain) > 3
        AND cd.domain ~ '^[a-z0-9][a-z0-9.-]+[a-z0-9]\\.[a-z]{2,}$'
      ORDER BY cd.contact_count DESC
      LIMIT 1000
    `);

    return result.rows.map((row: any) => ({
      domain: row.domain,
      contactCount: Number(row.contact_count),
    }));
  }
  
  // ============ PROSPECT OPERATIONS WITH COMPANY MATCHING ============
  
  async createProspect(prospect: InsertProspect): Promise<Contact> {
    // Generate full name from first and last name
    const fullName = `${prospect.firstName} ${prospect.lastName}`.trim();
    
    // Extract domain from email for matching
    const emailDomain = extractDomainFromEmail(prospect.email);
    
    // Try to match to a company
    let companyId: string | null = null;
    let companyMatchStatus = 'unmatched';
    let companyDetails: Partial<Contact> = {};
    
    // First try domain matching
    if (emailDomain) {
      const matchedCompany = await this.getCompanyByDomain(emailDomain);
      if (matchedCompany) {
        companyId = matchedCompany.id;
        companyMatchStatus = 'matched';
        // Auto-fill company details from matched company
        companyDetails = {
          company: matchedCompany.name,
          industry: matchedCompany.industry,
          employees: matchedCompany.employees,
          employeeSizeBracket: matchedCompany.employeeSizeBracket,
          website: matchedCompany.website,
          companyLinkedIn: matchedCompany.linkedinUrl,
          technologies: matchedCompany.technologies ? matchedCompany.technologies.split(',').map(t => t.trim()) : null,
          annualRevenue: matchedCompany.annualRevenue,
          companyCity: matchedCompany.city,
          companyState: matchedCompany.state,
          companyCountry: matchedCompany.country,
          companyAddress: matchedCompany.address,
        };
      }
    }
    
    // If no domain match and company name provided, try name matching
    if (!companyId && prospect.company) {
      const matchedCompany = await this.getCompanyByName(prospect.company);
      if (matchedCompany) {
        companyId = matchedCompany.id;
        companyMatchStatus = 'matched';
        companyDetails = {
          company: matchedCompany.name,
          industry: matchedCompany.industry,
          employees: matchedCompany.employees,
          employeeSizeBracket: matchedCompany.employeeSizeBracket,
          website: matchedCompany.website,
          companyLinkedIn: matchedCompany.linkedinUrl,
          technologies: matchedCompany.technologies ? matchedCompany.technologies.split(',').map(t => t.trim()) : null,
          annualRevenue: matchedCompany.annualRevenue,
          companyCity: matchedCompany.city,
          companyState: matchedCompany.state,
          companyCountry: matchedCompany.country,
          companyAddress: matchedCompany.address,
        };
      } else {
        // Mark for review since company name was provided but not found
        companyMatchStatus = 'pending_review';
      }
    }
    
    // Create the contact with auto-filled company details
    const contactValues = {
      fullName,
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      email: prospect.email,
      mobilePhone: prospect.mobilePhone,
      personLinkedIn: prospect.personLinkedIn,
      title: prospect.title,
      company: prospect.company || companyDetails.company,
      companyId: companyId || undefined,
      companyMatchStatus,
      emailDomain,
      industry: companyDetails.industry,
      employees: companyDetails.employees,
      employeeSizeBracket: companyDetails.employeeSizeBracket,
      website: companyDetails.website,
      companyLinkedIn: companyDetails.companyLinkedIn,
      technologies: companyDetails.technologies,
      annualRevenue: companyDetails.annualRevenue,
      companyCity: companyDetails.companyCity,
      companyState: companyDetails.companyState,
      companyCountry: companyDetails.companyCountry,
      companyAddress: companyDetails.companyAddress,
      updatedAt: new Date(),
    };
    
    const [contact] = await db
      .insert(contacts)
      .values(contactValues)
      .returning();
    
    // Log activity
    await this.createContactActivity({
      contactId: contact.id,
      activityType: 'created',
      description: `Prospect added${companyId ? ' and matched to company' : ''}`,
    });
    
    return contact;
  }
  
  async matchProspectToCompany(contactId: string): Promise<{ matched: boolean; companyId?: string; companyName?: string }> {
    const contact = await this.getContact(contactId);
    if (!contact) return { matched: false };
    
    // Already matched
    if (contact.companyId && contact.companyMatchStatus === 'matched') {
      const company = await this.getCompany(contact.companyId);
      return { matched: true, companyId: contact.companyId, companyName: company?.name };
    }
    
    // Extract domain from email
    const emailDomain = contact.email ? extractDomainFromEmail(contact.email) : null;
    
    // Try domain matching first
    if (emailDomain) {
      const matchedCompany = await this.getCompanyByDomain(emailDomain);
      if (matchedCompany) {
        await this.updateContact(contactId, {
          companyId: matchedCompany.id,
          companyMatchStatus: 'matched',
          company: matchedCompany.name,
          industry: matchedCompany.industry,
          employees: matchedCompany.employees,
          employeeSizeBracket: matchedCompany.employeeSizeBracket,
          website: matchedCompany.website,
          companyLinkedIn: matchedCompany.linkedinUrl,
          technologies: matchedCompany.technologies ? matchedCompany.technologies.split(',').map(t => t.trim()) : null,
          annualRevenue: matchedCompany.annualRevenue,
          companyCity: matchedCompany.city,
          companyState: matchedCompany.state,
          companyCountry: matchedCompany.country,
          companyAddress: matchedCompany.address,
        });
        return { matched: true, companyId: matchedCompany.id, companyName: matchedCompany.name };
      }
    }
    
    // Try company name matching
    if (contact.company) {
      const matchedCompany = await this.getCompanyByName(contact.company);
      if (matchedCompany) {
        await this.updateContact(contactId, {
          companyId: matchedCompany.id,
          companyMatchStatus: 'matched',
          industry: matchedCompany.industry,
          employees: matchedCompany.employees,
          employeeSizeBracket: matchedCompany.employeeSizeBracket,
          website: matchedCompany.website,
          companyLinkedIn: matchedCompany.linkedinUrl,
          technologies: matchedCompany.technologies ? matchedCompany.technologies.split(',').map(t => t.trim()) : null,
          annualRevenue: matchedCompany.annualRevenue,
          companyCity: matchedCompany.city,
          companyState: matchedCompany.state,
          companyCountry: matchedCompany.country,
          companyAddress: matchedCompany.address,
        });
        return { matched: true, companyId: matchedCompany.id, companyName: matchedCompany.name };
      }
    }
    
    return { matched: false };
  }
  
  async bulkMatchProspectsToCompanies(): Promise<{ matched: number; unmatched: number }> {
    let matched = 0;
    let unmatched = 0;
    
    // Get all unmatched contacts
    const unmatchedContacts = await this.getUnmatchedProspects();
    
    for (const contact of unmatchedContacts) {
      const result = await this.matchProspectToCompany(contact.id);
      if (result.matched) {
        matched++;
      } else {
        unmatched++;
      }
    }
    
    return { matched, unmatched };
  }
  
  async getUnmatchedProspects(): Promise<Contact[]> {
    return await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.isDeleted, false),
        or(
          eq(contacts.companyMatchStatus, 'unmatched'),
          eq(contacts.companyMatchStatus, 'pending_review'),
          isNull(contacts.companyMatchStatus)
        )
      ))
      .orderBy(desc(contacts.createdAt));
  }
  
  async manuallyAssignCompany(contactId: string, companyId: string): Promise<Contact | undefined> {
    const company = await this.getCompany(companyId);
    if (!company) return undefined;
    
    const updated = await this.updateContact(contactId, {
      companyId: company.id,
      companyMatchStatus: 'manual',
      company: company.name,
      industry: company.industry,
      employees: company.employees,
      employeeSizeBracket: company.employeeSizeBracket,
      website: company.website,
      companyLinkedIn: company.linkedinUrl,
      technologies: company.technologies ? company.technologies.split(',').map(t => t.trim()) : null,
      annualRevenue: company.annualRevenue,
      companyCity: company.city,
      companyState: company.state,
      companyCountry: company.country,
      companyAddress: company.address,
    });
    
    if (updated) {
      await this.createContactActivity({
        contactId: contactId,
        activityType: 'updated',
        description: `Manually assigned to company: ${company.name}`,
      });
    }
    
    return updated;
  }

  // ============ CONTACT OPERATIONS ============
  
  async getContacts(params: {
    page?: number;
    limit?: number;
    search?: string;
    industry?: string;
    employeeSizeBracket?: string;
    country?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    companyMatchStatus?: string;
  } = {}): Promise<{ contacts: Contact[], total: number }> {
    const {
      page = 1,
      limit = 20,
      search = '',
      industry = '',
      employeeSizeBracket = '',
      country = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      companyMatchStatus = ''
    } = params;
    const offset = (page - 1) * limit;
    
    let query = db.select().from(contacts).where(eq(contacts.isDeleted, false));
    
    // Apply filters
    const conditions = [eq(contacts.isDeleted, false)];
    
    if (search) {
      conditions.push(
        sql`(${contacts.fullName} ILIKE ${`%${search}%`} OR 
            ${contacts.email} ILIKE ${`%${search}%`} OR 
            ${contacts.company} ILIKE ${`%${search}%`})`
      );
    }
    
    if (industry) {
      conditions.push(eq(contacts.industry, industry));
    }
    
    if (employeeSizeBracket) {
      conditions.push(eq(contacts.employeeSizeBracket, employeeSizeBracket));
    }
    
    if (country) {
      conditions.push(eq(contacts.country, country));
    }
    
    if (companyMatchStatus) {
      conditions.push(eq(contacts.companyMatchStatus, companyMatchStatus));
    }
    
    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
    
    // Get total count
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(contacts)
      .where(whereClause);
    
    // Get contacts with pagination and sorting
    let sortColumn: any = contacts.createdAt;
    if (sortBy === 'fullName') sortColumn = contacts.fullName;
    else if (sortBy === 'email') sortColumn = contacts.email;
    else if (sortBy === 'company') sortColumn = contacts.company;
    else if (sortBy === 'industry') sortColumn = contacts.industry;
    else if (sortBy === 'country') sortColumn = contacts.country;
    else if (sortBy === 'createdAt') sortColumn = contacts.createdAt;
    else if (sortBy === 'updatedAt') sortColumn = contacts.updatedAt;
    
    const orderBy = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    
    const contactsList = await db
      .select()
      .from(contacts)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);
    
    return { contacts: contactsList, total };
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.isDeleted, false)));
    return contact || undefined;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    // Auto-generate fullName if not provided
    const contactData = {
      ...insertContact,
      fullName: generateFullName(insertContact.firstName, insertContact.lastName, insertContact.fullName),
      updatedAt: new Date(),
    };
    
    const [contact] = await db
      .insert(contacts)
      .values(contactData)
      .returning();
    
    // Log activity
    await this.createContactActivity({
      contactId: contact.id,
      activityType: 'created',
      description: 'Contact added to database',
    });
    
    return contact;
  }

  async updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    // Get existing contact to check current fullName
    const existingContact = await this.getContact(id);
    if (!existingContact) return undefined;
    
    // Auto-generate fullName if firstName or lastName is being updated
    const updatedData = { ...updates };
    if ('firstName' in updates || 'lastName' in updates || ('fullName' in updates && !updates.fullName)) {
      updatedData.fullName = generateFullName(
        updates.firstName ?? existingContact.firstName,
        updates.lastName ?? existingContact.lastName,
        updates.fullName ?? existingContact.fullName
      );
    }
    
    const [contact] = await db
      .update(contacts)
      .set({
        ...updatedData,
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, id), eq(contacts.isDeleted, false)))
      .returning();
    
    if (contact) {
      await this.createContactActivity({
        contactId: contact.id,
        activityType: 'updated',
        description: 'Contact information updated',
        changes: updates,
      });
    }
    
    return contact || undefined;
  }

  async deleteContact(id: string): Promise<boolean> {
    const [contact] = await db
      .update(contacts)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.isDeleted, false)))
      .returning();
    
    if (contact) {
      await this.createContactActivity({
        contactId: contact.id,
        activityType: 'deleted',
        description: 'Contact deleted',
      });
      return true;
    }
    
    return false;
  }

  async bulkDeleteContacts(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    
    let deletedCount = 0;
    
    // Delete each contact individually to ensure proper logging
    for (const id of ids) {
      const success = await this.deleteContact(id);
      if (success) deletedCount++;
    }
    
    return deletedCount;
  }

  async findDuplicateContacts(email: string, company?: string): Promise<Contact[]> {
    const conditions = [eq(contacts.isDeleted, false)];
    
    if (email) {
      conditions.push(eq(contacts.email, email));
    }
    
    if (company) {
      conditions.push(eq(contacts.company, company));
    }
    
    return await db
      .select()
      .from(contacts)
      .where(and(...conditions));
  }

  async findFuzzyDuplicateContacts(
    email?: string, 
    fullName?: string, 
    company?: string
  ): Promise<Contact[]> {
    const conditions = [eq(contacts.isDeleted, false)];
    
    // Exact email match is highest priority
    if (email) {
      conditions.push(eq(contacts.email, email));
      return await db
        .select()
        .from(contacts)
        .where(and(...conditions));
    }
    
    // If no email, try fuzzy name matching with company
    if (fullName && company) {
      const nameWords = fullName.toLowerCase().split(' ').filter(w => w.length > 1);
      if (nameWords.length >= 2) {
        // Use SQL LIKE for fuzzy matching
        conditions.push(
          sql`LOWER(${contacts.fullName}) LIKE ${`%${nameWords[0]}%`} AND LOWER(${contacts.fullName}) LIKE ${`%${nameWords[nameWords.length - 1]}%`}`
        );
        conditions.push(eq(contacts.company, company));
        
        return await db
          .select()
          .from(contacts)
          .where(and(...conditions));
      }
    }
    
    return [];
  }

  async getContactStats() {
    const [stats] = await db
      .select({
        totalContacts: count(),
        validEmails: sql<number>`COUNT(CASE WHEN ${contacts.email} IS NOT NULL AND ${contacts.email} != '' THEN 1 END)`,
        averageLeadScore: sql<number>`AVG(${contacts.leadScore})`,
        totalCompanies: sql<number>`COUNT(DISTINCT ${contacts.company})`,
      })
      .from(contacts)
      .where(eq(contacts.isDeleted, false));
    
    return {
      totalContacts: Number(stats.totalContacts),
      totalCompanies: Number(stats.totalCompanies),
      validEmails: Number(stats.validEmails),
      averageLeadScore: Number(stats.averageLeadScore) || 0,
    };
  }

  async getComprehensiveAnalytics() {
    const [basicStats] = await db
      .select({
        totalContacts: count(),
        validEmails: sql<number>`COUNT(CASE WHEN ${contacts.email} IS NOT NULL AND ${contacts.email} != '' THEN 1 END)`,
        averageLeadScore: sql<number>`AVG(${contacts.leadScore})`,
        totalCompanies: sql<number>`COUNT(DISTINCT CASE WHEN ${contacts.company} IS NOT NULL AND ${contacts.company} != '' THEN ${contacts.company} END)`,
        uniqueIndustries: sql<number>`COUNT(DISTINCT CASE WHEN ${contacts.industry} IS NOT NULL AND ${contacts.industry} != '' THEN ${contacts.industry} END)`,
      })
      .from(contacts)
      .where(eq(contacts.isDeleted, false));

    // Geographic distribution
    const geographicDistribution = await db
      .select({
        country: contacts.country,
        count: count(),
      })
      .from(contacts)
      .where(and(eq(contacts.isDeleted, false), isNotNull(contacts.country), ne(contacts.country, '')))
      .groupBy(contacts.country)
      .orderBy(desc(count()))
      .limit(10);

    // Industry distribution
    const industryDistribution = await db
      .select({
        industry: contacts.industry,
        count: count(),
      })
      .from(contacts)
      .where(and(eq(contacts.isDeleted, false), isNotNull(contacts.industry), ne(contacts.industry, '')))
      .groupBy(contacts.industry)
      .orderBy(desc(count()))
      .limit(15);

    // Company size distribution
    const companySizeDistribution = await db
      .select({
        size: contacts.employeeSizeBracket,
        count: count(),
      })
      .from(contacts)
      .where(and(eq(contacts.isDeleted, false), isNotNull(contacts.employeeSizeBracket), ne(contacts.employeeSizeBracket, '')))
      .groupBy(contacts.employeeSizeBracket)
      .orderBy(desc(count()));

    // Top companies
    const topCompanies = await db
      .select({
        company: contacts.company,
        industry: contacts.industry,
        count: count(),
      })
      .from(contacts)
      .where(and(eq(contacts.isDeleted, false), isNotNull(contacts.company), ne(contacts.company, '')))
      .groupBy(contacts.company, contacts.industry)
      .orderBy(desc(count()))
      .limit(20);

    // Lead score distribution
    const leadScoreDistribution = await db
      .select({
        range: sql<string>`CASE 
          WHEN ${contacts.leadScore} >= 9 THEN '9-10'
          WHEN ${contacts.leadScore} >= 8 THEN '8-9'
          WHEN ${contacts.leadScore} >= 7 THEN '7-8'
          WHEN ${contacts.leadScore} >= 6 THEN '6-7'
          WHEN ${contacts.leadScore} >= 5 THEN '5-6'
          WHEN ${contacts.leadScore} >= 4 THEN '4-5'
          WHEN ${contacts.leadScore} >= 3 THEN '3-4'
          WHEN ${contacts.leadScore} >= 2 THEN '2-3'
          WHEN ${contacts.leadScore} >= 1 THEN '1-2'
          ELSE '0-1'
        END`,
        count: count(),
      })
      .from(contacts)
      .where(and(eq(contacts.isDeleted, false), isNotNull(contacts.leadScore)))
      .groupBy(sql`CASE 
        WHEN ${contacts.leadScore} >= 9 THEN '9-10'
        WHEN ${contacts.leadScore} >= 8 THEN '8-9'
        WHEN ${contacts.leadScore} >= 7 THEN '7-8'
        WHEN ${contacts.leadScore} >= 6 THEN '6-7'
        WHEN ${contacts.leadScore} >= 5 THEN '5-6'
        WHEN ${contacts.leadScore} >= 4 THEN '4-5'
        WHEN ${contacts.leadScore} >= 3 THEN '3-4'
        WHEN ${contacts.leadScore} >= 2 THEN '2-3'
        WHEN ${contacts.leadScore} >= 1 THEN '1-2'
        ELSE '0-1'
      END`)
      .orderBy(desc(count()));

    // Communication channels
    const [communicationChannels] = await db
      .select({
        email: sql<number>`COUNT(CASE WHEN ${contacts.email} IS NOT NULL AND ${contacts.email} != '' THEN 1 END)`,
        phone: sql<number>`COUNT(CASE WHEN (${contacts.mobilePhone} IS NOT NULL AND ${contacts.mobilePhone} != '') OR (${contacts.corporatePhone} IS NOT NULL AND ${contacts.corporatePhone} != '') THEN 1 END)`,
        linkedin: sql<number>`COUNT(CASE WHEN ${contacts.personLinkedIn} IS NOT NULL AND ${contacts.personLinkedIn} != '' THEN 1 END)`,
      })
      .from(contacts)
      .where(eq(contacts.isDeleted, false));

    // Top technologies
    const topTechnologies = await db
      .select({
        technology: sql<string>`unnest(${contacts.technologies})`,
        count: sql<number>`count(*)`,
      })
      .from(contacts)
      .where(and(eq(contacts.isDeleted, false), isNotNull(contacts.technologies)))
      .groupBy(sql`unnest(${contacts.technologies})`)
      .orderBy(desc(sql`count(*)`))
      .limit(20);

    // Data completeness
    const [dataCompleteness] = await db
      .select({
        email: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.email} IS NOT NULL AND ${contacts.email} != '' THEN 1 END) * 100.0) / COUNT(*), 1)`,
        phone: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.mobilePhone} IS NOT NULL AND ${contacts.mobilePhone} != '' THEN 1 END) * 100.0) / COUNT(*), 1)`,
        company: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.company} IS NOT NULL AND ${contacts.company} != '' THEN 1 END) * 100.0) / COUNT(*), 1)`,
        industry: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.industry} IS NOT NULL AND ${contacts.industry} != '' THEN 1 END) * 100.0) / COUNT(*), 1)`,
        title: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.title} IS NOT NULL AND ${contacts.title} != '' THEN 1 END) * 100.0) / COUNT(*), 1)`,
        location: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.country} IS NOT NULL AND ${contacts.country} != '' THEN 1 END) * 100.0) / COUNT(*), 1)`,
        linkedin: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.personLinkedIn} IS NOT NULL AND ${contacts.personLinkedIn} != '' THEN 1 END) * 100.0) / COUNT(*), 1)`,
        leadScore: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.leadScore} IS NOT NULL THEN 1 END) * 100.0) / COUNT(*), 1)`,
      })
      .from(contacts)
      .where(eq(contacts.isDeleted, false));

    // Regional breakdown with stats
    const regionalBreakdown = await db
      .select({
        region: contacts.region,
        count: count(),
        avgLeadScore: sql<number>`AVG(${contacts.leadScore})`,
        companies: sql<number>`COUNT(DISTINCT ${contacts.company})`,
        industries: sql<number>`COUNT(DISTINCT ${contacts.industry})`,
      })
      .from(contacts)
      .where(and(eq(contacts.isDeleted, false), isNotNull(contacts.region), ne(contacts.region, '')))
      .groupBy(contacts.region)
      .orderBy(desc(count()));

    // Calculate data quality score
    const completenessValues = Object.values(dataCompleteness).map(v => Number(v) || 0);
    const dataQualityScore = completenessValues.reduce((sum, val) => sum + val, 0) / completenessValues.length;

    return {
      totalContacts: Number(basicStats.totalContacts),
      totalCompanies: Number(basicStats.totalCompanies),
      uniqueIndustries: Number(basicStats.uniqueIndustries),
      validEmails: Number(basicStats.validEmails),
      averageLeadScore: Number(basicStats.averageLeadScore) || 0,
      contactGrowth: 12, // Placeholder - would calculate from historical data
      leadQualityDistribution: {
        high: Math.round(((leadScoreDistribution.filter(d => ['9-10', '8-9', '7-8'].includes(d.range)).reduce((sum, d) => sum + Number(d.count), 0)) / Number(basicStats.totalContacts)) * 100)
      },
      geographicDistribution: geographicDistribution.map(g => ({
        name: g.country,
        count: Number(g.count)
      })),
      industryDistribution: industryDistribution.map(i => ({
        industry: i.industry,
        count: Number(i.count)
      })),
      companySizeDistribution: companySizeDistribution.map(c => ({
        name: c.size || 'Unknown',
        count: Number(c.count)
      })),
      topCompanies: topCompanies.map(c => ({
        company: c.company,
        industry: c.industry,
        count: Number(c.count)
      })),
      leadScoreDistribution: leadScoreDistribution.map(l => ({
        range: l.range,
        count: Number(l.count)
      })),
      communicationChannels: {
        email: Number(communicationChannels.email),
        phone: Number(communicationChannels.phone),
        linkedin: Number(communicationChannels.linkedin),
      },
      topTechnologies: topTechnologies.map(t => ({
        technology: t.technology,
        count: Number(t.count)
      })),
      dataCompleteness: {
        email: Number(dataCompleteness.email),
        phone: Number(dataCompleteness.phone),
        company: Number(dataCompleteness.company),
        industry: Number(dataCompleteness.industry),
        title: Number(dataCompleteness.title),
        location: Number(dataCompleteness.location),
        linkedin: Number(dataCompleteness.linkedin),
        leadScore: Number(dataCompleteness.leadScore),
      },
      regionalBreakdown: regionalBreakdown.map(r => ({
        region: r.region,
        count: Number(r.count),
        avgLeadScore: Number(r.avgLeadScore) || 0,
        companies: Number(r.companies),
        industries: Number(r.industries),
      })),
      dataQualityScore,
      completeProfiles: Math.round((dataQualityScore / 100) * Number(basicStats.totalContacts)),
      missingCriticalData: Math.round(((100 - dataQualityScore) / 100) * Number(basicStats.totalContacts)),
      enrichedContacts: Math.round((Number(dataCompleteness.leadScore) / 100) * Number(basicStats.totalContacts)),
      contactSources: [
        { source: 'CSV Import', count: Math.round(Number(basicStats.totalContacts) * 0.75) },
        { source: 'Manual Entry', count: Math.round(Number(basicStats.totalContacts) * 0.15) },
        { source: 'API Integration', count: Math.round(Number(basicStats.totalContacts) * 0.10) },
      ]
    };
  }

  async getAnalyticsTrends() {
    // Generate contact growth trend (last 30 days)
    const contactGrowth = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const [dayStats] = await db
        .select({
          total: sql<number>`COUNT(*)`,
          new: sql<number>`COUNT(CASE WHEN DATE(${contacts.createdAt}) = ${dateStr} THEN 1 END)`,
        })
        .from(contacts)
        .where(and(
          eq(contacts.isDeleted, false),
          sql`${contacts.createdAt} <= ${date.toISOString()}`
        ));
      
      contactGrowth.push({
        date: dateStr,
        total: Number(dayStats.total),
        new: Number(dayStats.new),
      });
    }

    return { contactGrowth };
  }

  async getAnalyticsActivities() {
    // Activity timeline (last 30 days)
    const timeline = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const [dayActivities] = await db
        .select({
          created: sql<number>`COUNT(CASE WHEN ${contactActivities.activityType} = 'created' AND DATE(${contactActivities.createdAt}) = ${dateStr} THEN 1 END)`,
          updated: sql<number>`COUNT(CASE WHEN ${contactActivities.activityType} = 'updated' AND DATE(${contactActivities.createdAt}) = ${dateStr} THEN 1 END)`,
          enriched: sql<number>`COUNT(CASE WHEN ${contactActivities.activityType} = 'enriched' AND DATE(${contactActivities.createdAt}) = ${dateStr} THEN 1 END)`,
        })
        .from(contactActivities)
        .where(sql`DATE(${contactActivities.createdAt}) = ${dateStr}`);
      
      timeline.push({
        date: dateStr,
        created: Number(dayActivities.created),
        updated: Number(dayActivities.updated),
        enriched: Number(dayActivities.enriched),
      });
    }

    // Activity summary (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const summary = await db
      .select({
        type: contactActivities.activityType,
        count: count(),
      })
      .from(contactActivities)
      .where(sql`${contactActivities.createdAt} >= ${thirtyDaysAgo.toISOString()}`)
      .groupBy(contactActivities.activityType)
      .orderBy(desc(count()));

    // Recent activities
    const recent = await db
      .select()
      .from(contactActivities)
      .orderBy(desc(contactActivities.createdAt))
      .limit(20);

    return {
      timeline,
      summary: summary.map(s => ({
        type: s.type,
        count: Number(s.count),
      })),
      recent: recent.map(r => ({
        id: r.id,
        activityType: r.activityType,
        description: r.description,
        createdAt: r.createdAt,
      })),
    };
  }

  async getAnalyticsImports() {
    // Import summary
    const [summary] = await db
      .select({
        totalImports: count(),
        totalRecords: sql<number>`SUM(${importJobs.totalRows})`,
        successfulRecords: sql<number>`SUM(${importJobs.successfulRows})`,
      })
      .from(importJobs);

    const successRate = summary.totalRecords > 0 
      ? Math.round((Number(summary.successfulRecords) / Number(summary.totalRecords)) * 100)
      : 0;

    // Import history
    const history = await db
      .select()
      .from(importJobs)
      .orderBy(desc(importJobs.createdAt))
      .limit(20);

    return {
      summary: {
        totalImports: Number(summary.totalImports),
        totalRecords: Number(summary.totalRecords),
        successRate,
      },
      history: history.map(h => ({
        id: h.id,
        filename: h.filename,
        status: h.status,
        totalRows: h.totalRows,
        successfulRows: h.successfulRows,
        createdAt: h.createdAt,
      })),
    };
  }

  async createContactActivity(activity: InsertContactActivity): Promise<ContactActivity> {
    const [created] = await db
      .insert(contactActivities)
      .values(activity)
      .returning();
    return created;
  }

  async getContactActivities(contactId: string): Promise<ContactActivity[]> {
    return await db
      .select()
      .from(contactActivities)
      .where(eq(contactActivities.contactId, contactId))
      .orderBy(desc(contactActivities.createdAt));
  }

  async createImportJob(job: InsertImportJob): Promise<ImportJob> {
    const [created] = await db
      .insert(importJobs)
      .values(job)
      .returning();
    return created;
  }

  async updateImportJob(id: string, updates: Partial<ImportJob>): Promise<ImportJob | undefined> {
    const [updated] = await db
      .update(importJobs)
      .set(updates)
      .where(eq(importJobs.id, id))
      .returning();
    return updated || undefined;
  }

  async getImportJob(id: string): Promise<ImportJob | undefined> {
    const [job] = await db
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, id));
    return job || undefined;
  }

  // User authentication methods
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  // Session management methods
  async createSession(session: InsertSession): Promise<Session> {
    const [newSession] = await db.insert(sessions).values(session).returning();
    return newSession;
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions)
      .where(and(eq(sessions.token, token), sql`${sessions.expiresAt} > NOW()`));
    return session;
  }

  async deleteSession(token: string): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.token, token));
    return (result.rowCount || 0) > 0;
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await db.delete(sessions).where(sql`${sessions.expiresAt} <= NOW()`);
    return result.rowCount || 0;
  }

  // Fix empty or incorrectly mapped fullNames for existing contacts
  async fixEmptyFullNames(): Promise<number> {
    console.log('🔧 Starting comprehensive full name fix process...');
    
    // Get all contacts with issues in fullName mapping
    const contactsToFix = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.isDeleted, false),
          or(
            // Empty or null fullName
            sql`(${contacts.fullName} IS NULL OR TRIM(${contacts.fullName}) = '')`,
            // Hex ID pattern (MongoDB ObjectId-like strings)
            sql`${contacts.fullName} ~ '^[a-f0-9]{24}$'`,
            // Other ID-like patterns
            sql`${contacts.fullName} ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'`,
            // Incorrect mapping when both names exist
            and(
              isNotNull(contacts.firstName),
              isNotNull(contacts.lastName),
              sql`${contacts.fullName} != TRIM(${contacts.firstName}) || ' ' || TRIM(${contacts.lastName})`
            ),
            // Incorrect mapping when only firstName exists
            and(
              isNotNull(contacts.firstName),
              isNull(contacts.lastName),
              sql`${contacts.fullName} != TRIM(${contacts.firstName})`
            ),
            // Incorrect mapping when only lastName exists  
            and(
              isNull(contacts.firstName),
              isNotNull(contacts.lastName),
              sql`${contacts.fullName} != TRIM(${contacts.lastName})`
            )
          ),
          // Only fix if we have name data to work with
          sql`(${contacts.firstName} IS NOT NULL OR ${contacts.lastName} IS NOT NULL)`
        )
      );

    console.log(`📊 Found ${contactsToFix.length} contacts with missing/incorrect full names`);

    let fixedCount = 0;
    
    for (const contact of contactsToFix) {
      const oldFullName = contact.fullName;
      const newFullName = generateFullName(contact.firstName, contact.lastName, null);
      
      if (newFullName && newFullName.trim() && newFullName !== oldFullName) {
        await db
          .update(contacts)
          .set({ 
            fullName: newFullName,
            updatedAt: new Date()
          })
          .where(eq(contacts.id, contact.id));
          
        console.log(`✅ Fixed: "${oldFullName}" → "${newFullName}" (${contact.email})`);
        
        // Log activity for this fix
        await this.createContactActivity({
          contactId: contact.id,
          activityType: 'updated',
          description: `Fixed full name mapping from "${oldFullName}" to "${newFullName}"`,
          changes: { fullName: newFullName }
        });
        
        fixedCount++;
      }
    }
    
    console.log(`🎉 Fixed ${fixedCount} contact full names`);
    return fixedCount;
  }

  // Enhanced company auto-fill functionality with smart matching
  // Uses email domain extraction, company name normalization, fuzzy matching, and multi-source data merging
  async getCompanyTemplate(
    companyName?: string, 
    website?: string, 
    companyLinkedIn?: string,
    email?: string
  ): Promise<Partial<Contact> | null> {
    // Extract email domain for additional matching
    const emailDomain = CompanyMatcher.extractEmailDomain(email);
    
    // Build comprehensive search conditions
    const searchConditions = [];
    
    // Normalized company name matching
    if (companyName?.trim()) {
      const normalizedName = CompanyMatcher.normalizeCompanyName(companyName);
      if (normalizedName) {
        searchConditions.push(ilike(contacts.company, `%${companyName.trim()}%`));
        // Also search for normalized version if different
        if (normalizedName !== companyName.toLowerCase().trim()) {
          searchConditions.push(ilike(contacts.company, `%${normalizedName}%`));
        }
      }
    }
    
    // Website domain matching
    if (website?.trim()) {
      const cleanWebsite = CompanyMatcher.normalizeWebsite(website);
      if (cleanWebsite) {
        searchConditions.push(ilike(contacts.website, `%${cleanWebsite}%`));
      }
    }
    
    // Company LinkedIn matching
    if (companyLinkedIn?.trim()) {
      const cleanLinkedIn = companyLinkedIn.replace(/^https?:\/\//, '').replace(/^www\./, '');
      searchConditions.push(ilike(contacts.companyLinkedIn, `%${cleanLinkedIn}%`));
    }
    
    // Email domain matching - powerful for finding company contacts
    if (emailDomain) {
      searchConditions.push(ilike(contacts.email, `%@${emailDomain}`));
      searchConditions.push(ilike(contacts.website, `%${emailDomain}%`));
    }

    if (searchConditions.length === 0) return null;

    // Find contacts matching any of the identifiers (limit to 100 for performance)
    const companyContacts = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.isDeleted, false),
        or(...searchConditions)
      ))
      .orderBy(desc(contacts.createdAt))
      .limit(100);

    if (companyContacts.length === 0) return null;

    // Use advanced scoring to find best matches
    const bestMatches = CompanyMatcher.findBestMatches(
      companyContacts,
      companyName,
      website,
      companyLinkedIn,
      email,
      10  // Get top 10 matches
    );

    if (bestMatches.length === 0) return null;

    // Filter to only high-confidence matches (score > 30)
    const highConfidenceMatches = bestMatches.filter(m => m.score > 30);
    
    if (highConfidenceMatches.length === 0) {
      // Fall back to best single match if no high confidence matches
      return CompanyMatcher.extractCompanyFields(bestMatches[0].contact);
    }

    // Merge data from multiple high-quality sources for the most complete template
    const matchedContacts = highConfidenceMatches.map(m => m.contact);
    const mergedTemplate = CompanyMatcher.mergeCompanyData(matchedContacts);

    // Ensure we have meaningful data (at least company name + 1 more field)
    const fieldCount = Object.keys(mergedTemplate).length;
    if (fieldCount < 2) return null;

    return mergedTemplate;
  }

  async createContactWithAutoFill(insertContact: InsertContact): Promise<Contact> {
    let contactData = { ...insertContact };
    let autoFilledFields: string[] = [];

    // Smart company auto-fill: uses company name, website, LinkedIn, AND email domain
    const hasCompanyIdentifier = 
      contactData.company?.trim() || 
      contactData.website?.trim() || 
      contactData.companyLinkedIn?.trim() ||
      contactData.email?.trim();  // Email domain can identify company

    if (hasCompanyIdentifier) {
      const companyTemplate = await this.getCompanyTemplate(
        contactData.company || undefined, 
        contactData.website || undefined, 
        contactData.companyLinkedIn || undefined,
        contactData.email || undefined  // Use email for domain-based matching
      );
      
      if (companyTemplate) {
        // Only auto-fill fields that are empty/null in the new contact
        const fieldsToFill = Object.keys(companyTemplate) as Array<keyof Partial<Contact>>;
        
        fieldsToFill.forEach(field => {
          const existingValue = contactData[field as keyof InsertContact];
          const templateValue = companyTemplate[field];
          
          // Only fill if the field is empty and we have template data
          if ((!existingValue || existingValue === '') && templateValue !== null && templateValue !== undefined) {
            (contactData as any)[field] = templateValue;
            autoFilledFields.push(field as string);
          }
        });
      }
    }

    // Auto-generate fullName if not provided
    const finalContactData = {
      ...contactData,
      fullName: generateFullName(contactData.firstName, contactData.lastName, contactData.fullName),
      updatedAt: new Date(),
    };
    
    const [contact] = await db
      .insert(contacts)
      .values(finalContactData)
      .returning();
    
    // Log activity with auto-fill information
    let activityDescription = 'Contact added to database';
    if (autoFilledFields.length > 0) {
      activityDescription += ` with auto-filled company details: ${autoFilledFields.join(', ')}`;
    }
    
    await this.createContactActivity({
      contactId: contact.id,
      activityType: 'created',
      description: activityDescription,
      changes: autoFilledFields.length > 0 ? { autoFilledFields } : undefined,
    });
    
    return contact;
  }

  async updateContactWithAutoFill(id: string, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    // Get existing contact to check current company
    const existingContact = await this.getContact(id);
    if (!existingContact) return undefined;

    let contactData = { ...updates };
    let autoFilledFields: string[] = [];
    let activityDescription = 'Contact information updated';

    // Smart company auto-fill: uses company name, website, LinkedIn, AND email domain
    const newCompany = contactData.company;
    const oldCompany = existingContact.company;
    const companyToCheck = newCompany || oldCompany;
    const emailToUse = contactData.email || existingContact.email;
    
    const hasCompanyIdentifier = 
      companyToCheck?.trim() || 
      existingContact.website?.trim() || 
      contactData.website?.trim() ||
      existingContact.companyLinkedIn?.trim() || 
      contactData.companyLinkedIn?.trim() ||
      emailToUse?.trim();  // Email domain can identify company

    if (hasCompanyIdentifier) {
      // Company identifiers exist - try to auto-fill missing company details
      const companyTemplate = await this.getCompanyTemplate(
        companyToCheck || undefined, 
        (contactData.website || existingContact.website) || undefined, 
        (contactData.companyLinkedIn || existingContact.companyLinkedIn) || undefined,
        emailToUse || undefined  // Use email for domain-based matching
      );
      
      if (companyTemplate) {
        // Merge current contact data with updates to see what fields are empty
        const mergedData = { ...existingContact, ...contactData };
        
        // Only auto-fill fields that are empty/null in the merged contact
        const fieldsToFill = Object.keys(companyTemplate) as Array<keyof Partial<Contact>>;
        
        fieldsToFill.forEach(field => {
          const currentValue = (mergedData as any)[field];
          const templateValue = companyTemplate[field];
          
          // Only fill if the field is empty and we have template data
          if ((!currentValue || currentValue === '') && templateValue !== null && templateValue !== undefined) {
            (contactData as any)[field] = templateValue;
            autoFilledFields.push(field as string);
          }
        });

        if (autoFilledFields.length > 0) {
          activityDescription += ` with auto-filled company details: ${autoFilledFields.join(', ')}`;
        }
      }
    }

    // Auto-generate fullName if firstName or lastName is being updated
    if ('firstName' in updates || 'lastName' in updates || ('fullName' in updates && !updates.fullName)) {
      contactData.fullName = generateFullName(
        updates.firstName ?? existingContact.firstName,
        updates.lastName ?? existingContact.lastName,
        updates.fullName ?? existingContact.fullName
      );
    }
    
    const [contact] = await db
      .update(contacts)
      .set({
        ...contactData,
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, id), eq(contacts.isDeleted, false)))
      .returning();
    
    if (contact) {
      await this.createContactActivity({
        contactId: contact.id,
        activityType: 'updated',
        description: activityDescription,
        changes: { ...updates, autoFilledFields: autoFilledFields.length > 0 ? autoFilledFields : undefined },
      });
    }
    
    return contact || undefined;
  }

  async bulkAutoFillCompanyDetails(): Promise<{ processed: number; updated: number; companiesProcessed: string[] }> {
    console.log('🔧 Starting smart bulk company auto-fill process...');
    
    // Get all contacts that have any company identifier (name, website, LinkedIn, or email)
    const contactsToProcess = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.isDeleted, false),
        or(
          and(isNotNull(contacts.company), ne(contacts.company, '')),
          and(isNotNull(contacts.website), ne(contacts.website, '')),
          and(isNotNull(contacts.companyLinkedIn), ne(contacts.companyLinkedIn, '')),
          and(isNotNull(contacts.email), ne(contacts.email, ''))  // Include email-based matching
        )
      ));

    console.log(`📊 Found ${contactsToProcess.length} contacts with company identifiers`);

    let processed = 0;
    let updated = 0;
    const companiesProcessed: string[] = [];
    const companyTemplateCache = new Map<string, Partial<Contact> | null>();

    for (const contact of contactsToProcess) {
      // Extract email domain for smarter caching
      const emailDomain = CompanyMatcher.extractEmailDomain(contact.email);
      
      // Skip if no useful identifiers are available
      if (!contact.company?.trim() && !contact.website?.trim() && !contact.companyLinkedIn?.trim() && !emailDomain) continue;
      
      processed++;
      
      // Create cache key from available identifiers including email domain
      const normalizedCompany = CompanyMatcher.normalizeCompanyName(contact.company);
      const normalizedWebsite = CompanyMatcher.normalizeWebsite(contact.website);
      const cacheKey = `${normalizedCompany}|${normalizedWebsite}|${contact.companyLinkedIn || ''}|${emailDomain || ''}`;
      
      // Get or cache company template using any available identifiers
      let companyTemplate = companyTemplateCache.get(cacheKey);
      if (companyTemplate === undefined) {
        companyTemplate = await this.getCompanyTemplate(
          contact.company || undefined, 
          contact.website || undefined, 
          contact.companyLinkedIn || undefined,
          contact.email || undefined  // Use email for domain-based matching
        );
        companyTemplateCache.set(cacheKey, companyTemplate);
      }

      if (!companyTemplate) continue;

      // Check which fields can be auto-filled
      const fieldsToFill = Object.keys(companyTemplate) as Array<keyof Partial<Contact>>;
      const autoFilledFields: string[] = [];
      const updateData: any = {};

      fieldsToFill.forEach(field => {
        const currentValue = (contact as any)[field];
        const templateValue = companyTemplate![field];
        
        // Only fill if the field is empty and we have template data
        if ((!currentValue || currentValue === '') && templateValue !== null && templateValue !== undefined) {
          updateData[field] = templateValue;
          autoFilledFields.push(field as string);
        }
      });

      // Update contact if there are fields to fill
      if (autoFilledFields.length > 0) {
        await db
          .update(contacts)
          .set({
            ...updateData,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, contact.id));

        // Log activity
        await this.createContactActivity({
          contactId: contact.id,
          activityType: 'updated',
          description: `Bulk auto-fill applied company details: ${autoFilledFields.join(', ')}`,
          changes: { autoFilledFields },
        });

        updated++;
        
        const companyIdentifier = contact.company || contact.website || contact.companyLinkedIn || 'Unknown Company';
        if (!companiesProcessed.includes(companyIdentifier)) {
          companiesProcessed.push(companyIdentifier);
        }

        console.log(`✅ Auto-filled ${autoFilledFields.length} fields for ${contact.fullName} at ${companyIdentifier}`);
      }
    }

    console.log(`🎉 Bulk auto-fill completed: ${updated}/${processed} contacts updated across ${companiesProcessed.length} companies`);
    
    return {
      processed,
      updated,
      companiesProcessed
    };
  }

  // LinkedIn Enrichment Job Methods
  async createEnrichmentJob(job: InsertEnrichmentJob): Promise<EnrichmentJob> {
    const [enrichmentJob] = await db
      .insert(enrichmentJobs)
      .values(job)
      .returning();
    return enrichmentJob;
  }

  async updateEnrichmentJob(id: string, updates: Partial<EnrichmentJob>): Promise<EnrichmentJob | undefined> {
    const [enrichmentJob] = await db
      .update(enrichmentJobs)
      .set(updates)
      .where(eq(enrichmentJobs.id, id))
      .returning();
    return enrichmentJob || undefined;
  }

  async getEnrichmentJob(id: string): Promise<EnrichmentJob | undefined> {
    const [enrichmentJob] = await db
      .select()
      .from(enrichmentJobs)
      .where(eq(enrichmentJobs.id, id));
    return enrichmentJob || undefined;
  }

  async getEnrichmentJobsByContact(contactId: string): Promise<EnrichmentJob[]> {
    return await db
      .select()
      .from(enrichmentJobs)
      .where(eq(enrichmentJobs.contactId, contactId))
      .orderBy(desc(enrichmentJobs.createdAt));
  }

  async getRecentEnrichmentJobs(limit: number = 20): Promise<EnrichmentJob[]> {
    return await db
      .select()
      .from(enrichmentJobs)
      .orderBy(desc(enrichmentJobs.createdAt))
      .limit(limit);
  }

  async findContactsByLinkedInUrl(linkedinUrl: string): Promise<Contact[]> {
    // Normalize the LinkedIn URL for flexible matching
    // Handles variations like linkedin.com/in/username, www.linkedin.com/in/username, etc.
    const normalizedUrl = linkedinUrl
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
    
    // Extract the username part if possible
    const usernameMatch = normalizedUrl.match(/linkedin\.com\/in\/([^/?]+)/);
    const username = usernameMatch ? usernameMatch[1] : null;
    
    // Search for contacts with matching LinkedIn URL
    // Use case-insensitive matching and handle URL variations
    const matchingContacts = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.isDeleted, false),
          username 
            ? sql`LOWER(${contacts.personLinkedIn}) LIKE ${`%linkedin.com/in/${username}%`}`
            : ilike(contacts.personLinkedIn, `%${normalizedUrl}%`)
        )
      )
      .orderBy(desc(contacts.createdAt));
    
    return matchingContacts;
  }

  // API Key operations
  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const [newApiKey] = await db
      .insert(apiKeys)
      .values(apiKey)
      .returning();
    return newApiKey;
  }

  async getApiKeyByHash(hashedKey: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.hashedKey, hashedKey),
          isNull(apiKeys.revokedAt)
        )
      );
    return apiKey || undefined;
  }

  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.ownerUserId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async updateApiKeyUsage(id: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ 
        lastUsedAt: new Date(),
        requestCount: sql`${apiKeys.requestCount} + 1`
      })
      .where(eq(apiKeys.id, id));
  }

  async revokeApiKey(id: string): Promise<boolean> {
    const [revoked] = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.id, id))
      .returning();
    return !!revoked;
  }

  // Tag operations
  async getTags(): Promise<Tag[]> {
    return await db
      .select()
      .from(tags)
      .orderBy(asc(tags.name));
  }

  async getTag(id: string): Promise<Tag | undefined> {
    const [tag] = await db
      .select()
      .from(tags)
      .where(eq(tags.id, id));
    return tag || undefined;
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [newTag] = await db
      .insert(tags)
      .values(tag)
      .returning();
    return newTag;
  }

  async deleteTag(id: string): Promise<boolean> {
    await db
      .delete(contactTags)
      .where(eq(contactTags.tagId, id));
    
    const [deleted] = await db
      .delete(tags)
      .where(eq(tags.id, id))
      .returning();
    return !!deleted;
  }

  async getContactTags(contactId: string): Promise<Tag[]> {
    const result = await db
      .select({ tag: tags })
      .from(contactTags)
      .innerJoin(tags, eq(contactTags.tagId, tags.id))
      .where(eq(contactTags.contactId, contactId));
    return result.map(r => r.tag);
  }

  async addTagToContact(contactId: string, tagId: string): Promise<ContactTag> {
    const existing = await db
      .select()
      .from(contactTags)
      .where(and(
        eq(contactTags.contactId, contactId),
        eq(contactTags.tagId, tagId)
      ));
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [contactTag] = await db
      .insert(contactTags)
      .values({ contactId, tagId })
      .returning();
    return contactTag;
  }

  async removeTagFromContact(contactId: string, tagId: string): Promise<boolean> {
    const [deleted] = await db
      .delete(contactTags)
      .where(and(
        eq(contactTags.contactId, contactId),
        eq(contactTags.tagId, tagId)
      ))
      .returning();
    return !!deleted;
  }

  // Activity operations
  async getRecentActivities(limit: number = 100): Promise<ContactActivity[]> {
    return await db
      .select()
      .from(contactActivities)
      .orderBy(desc(contactActivities.createdAt))
      .limit(limit);
  }

  // API Request Logging
  async logApiRequest(log: InsertApiRequestLog): Promise<ApiRequestLog> {
    const [requestLog] = await db
      .insert(apiRequestLogs)
      .values(log)
      .returning();
    return requestLog;
  }
}

export const storage = new DatabaseStorage();
