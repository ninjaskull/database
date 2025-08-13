import { 
  contacts, 
  contactActivities, 
  importJobs,
  users,
  sessions,
  type Contact, 
  type InsertContact,
  type ContactActivity,
  type InsertContactActivity,
  type ImportJob,
  type InsertImportJob,
  type User,
  type InsertUser,
  type Session,
  type InsertSession
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, desc, asc, count, sql, or, isNull, isNotNull, ne } from "drizzle-orm";

export interface IStorage {
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
  
  // Company details auto-fill operations
  getCompanyTemplate(companyName: string): Promise<Partial<Contact> | null>;
  createContactWithAutoFill(contact: InsertContact): Promise<Contact>;
  updateContactWithAutoFill(id: string, updates: Partial<InsertContact>): Promise<Contact | undefined>;
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

export class DatabaseStorage implements IStorage {
  async getContacts(params: {
    page?: number;
    limit?: number;
    search?: string;
    industry?: string;
    employeeSizeBracket?: string;
    country?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{ contacts: Contact[], total: number }> {
    const {
      page = 1,
      limit = 20,
      search = '',
      industry = '',
      employeeSizeBracket = '',
      country = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
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

  // Company details auto-fill functionality
  async getCompanyTemplate(companyName: string): Promise<Partial<Contact> | null> {
    if (!companyName || !companyName.trim()) return null;

    // Find the most complete company record (one with the most filled fields)
    const companyContacts = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.isDeleted, false),
        eq(contacts.company, companyName.trim())
      ))
      .orderBy(desc(contacts.createdAt));

    if (companyContacts.length === 0) return null;

    // Score each contact based on how much company info they have
    const scoredContacts = companyContacts.map(contact => {
      let score = 0;
      const companyFields = [
        'company', 'employees', 'employeeSizeBracket', 'industry', 'website', 
        'companyLinkedIn', 'technologies', 'annualRevenue', 'companyAddress', 
        'companyCity', 'companyState', 'companyCountry', 'companyAge', 
        'technologyCategory', 'businessType'
      ];

      companyFields.forEach(field => {
        const value = contact[field as keyof Contact];
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value) && value.length > 0) score++;
          else if (!Array.isArray(value)) score++;
        }
      });

      return { contact, score };
    });

    // Get the contact with the highest score (most complete company info)
    const bestContact = scoredContacts.reduce((best, current) => 
      current.score > best.score ? current : best
    ).contact;

    // Extract only company-related fields for the template
    const companyTemplate: Partial<Contact> = {};
    const companyFields = [
      'company', 'employees', 'employeeSizeBracket', 'industry', 'website', 
      'companyLinkedIn', 'technologies', 'annualRevenue', 'companyAddress', 
      'companyCity', 'companyState', 'companyCountry', 'companyAge', 
      'technologyCategory', 'businessType'
    ] as const;

    companyFields.forEach(field => {
      const value = bestContact[field];
      if (value !== null && value !== undefined && value !== '') {
        (companyTemplate as any)[field] = value;
      }
    });

    return Object.keys(companyTemplate).length > 1 ? companyTemplate : null; // At least company name + 1 more field
  }

  async createContactWithAutoFill(insertContact: InsertContact): Promise<Contact> {
    let contactData = { ...insertContact };
    let autoFilledFields: string[] = [];

    // If company name is provided, try to auto-fill company details
    if (contactData.company && contactData.company.trim()) {
      const companyTemplate = await this.getCompanyTemplate(contactData.company);
      
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

    // Check if company name is being changed or added, or if company exists but fields are missing
    const newCompany = contactData.company;
    const oldCompany = existingContact.company;
    const companyToCheck = newCompany || oldCompany;
    
    console.log(`Auto-fill check: newCompany="${newCompany}", oldCompany="${oldCompany}", companyToCheck="${companyToCheck}"`);
    
    if (companyToCheck && companyToCheck.trim()) {
      // Company exists - try to auto-fill missing company details
      const companyTemplate = await this.getCompanyTemplate(companyToCheck);
      console.log(`Company template found:`, companyTemplate ? 'Yes' : 'No', companyTemplate ? Object.keys(companyTemplate) : []);
      
      if (companyTemplate) {
        // Merge current contact data with updates to see what fields are empty
        const mergedData = { ...existingContact, ...contactData };
        
        // Only auto-fill fields that are empty/null in the merged contact
        const fieldsToFill = Object.keys(companyTemplate) as Array<keyof Partial<Contact>>;
        
        fieldsToFill.forEach(field => {
          const currentValue = (mergedData as any)[field];
          const templateValue = companyTemplate[field];
          
          console.log(`Field "${field}": current="${currentValue}", template="${templateValue}", isEmpty="${!currentValue || currentValue === ''}"`);
          
          // Only fill if the field is empty and we have template data
          if ((!currentValue || currentValue === '') && templateValue !== null && templateValue !== undefined) {
            (contactData as any)[field] = templateValue;
            autoFilledFields.push(field as string);
            console.log(`Auto-filled field "${field}" with value:`, templateValue);
          }
        });

        console.log(`Auto-fill completed. Fields filled: ${autoFilledFields.length}`, autoFilledFields);
        
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
}

export const storage = new DatabaseStorage();
