import type { Contact, Company } from "@shared/schema";

export interface AutoFillResult {
  fieldsUpdated: string[];
  source: 'company_match' | 'same_domain' | 'none';
  companyId?: string;
  companyName?: string;
}

export function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

export function findMatchingCompanyByDomain(
  domain: string,
  companies: Company[]
): Company | null {
  if (!domain || !companies.length) return null;
  
  const normalizedDomain = domain.toLowerCase().trim();
  
  for (const company of companies) {
    if (company.domains && Array.isArray(company.domains)) {
      if (company.domains.some(d => d.toLowerCase().trim() === normalizedDomain)) {
        return company;
      }
    }
    
    if (company.website) {
      const websiteDomain = extractDomainFromUrl(company.website);
      if (websiteDomain === normalizedDomain) {
        return company;
      }
    }
  }
  
  return null;
}

function extractDomainFromUrl(url: string): string | null {
  try {
    const cleaned = url.toLowerCase().trim();
    const withProtocol = cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
    const parsed = new URL(withProtocol);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function autoFillContactFromCompany(
  contact: Partial<Contact>,
  company: Company
): { updatedContact: Partial<Contact>; fieldsUpdated: string[] } {
  const updatedContact = { ...contact };
  const fieldsUpdated: string[] = [];
  
  if (!contact.companyId) {
    updatedContact.companyId = company.id;
    fieldsUpdated.push('companyId');
  }
  
  if (!contact.company && company.name) {
    updatedContact.company = company.name;
    fieldsUpdated.push('company');
  }
  
  if (!contact.industry && company.industry) {
    updatedContact.industry = company.industry;
    fieldsUpdated.push('industry');
  }
  
  if (!contact.employees && company.employees) {
    updatedContact.employees = company.employees;
    fieldsUpdated.push('employees');
  }
  
  if (!contact.employeeSizeBracket && company.employeeSizeBracket) {
    updatedContact.employeeSizeBracket = company.employeeSizeBracket;
    fieldsUpdated.push('employeeSizeBracket');
  }
  
  if (!contact.website && company.website) {
    updatedContact.website = company.website;
    fieldsUpdated.push('website');
  }
  
  if (!contact.companyLinkedIn && company.linkedinUrl) {
    updatedContact.companyLinkedIn = company.linkedinUrl;
    fieldsUpdated.push('companyLinkedIn');
  }
  
  if (!contact.companyAddress && company.address) {
    updatedContact.companyAddress = company.address;
    fieldsUpdated.push('companyAddress');
  }
  
  if (!contact.companyCity && company.city) {
    updatedContact.companyCity = company.city;
    fieldsUpdated.push('companyCity');
  }
  
  if (!contact.companyState && company.state) {
    updatedContact.companyState = company.state;
    fieldsUpdated.push('companyState');
  }
  
  if (!contact.companyCountry && company.country) {
    updatedContact.companyCountry = company.country;
    fieldsUpdated.push('companyCountry');
  }
  
  if (!contact.country && company.country) {
    updatedContact.country = company.country;
    fieldsUpdated.push('country');
  }
  
  return { updatedContact, fieldsUpdated };
}

export function findContactsWithSameCompany(
  targetContact: Partial<Contact>,
  allContacts: Contact[]
): Contact[] {
  if (!targetContact.company && !targetContact.emailDomain && !targetContact.companyId) {
    return [];
  }
  
  return allContacts.filter(c => {
    if (c.id === targetContact.id) return false;
    
    if (targetContact.companyId && c.companyId === targetContact.companyId) {
      return true;
    }
    
    if (targetContact.company && c.company?.toLowerCase() === targetContact.company.toLowerCase()) {
      return true;
    }
    
    if (targetContact.emailDomain && c.emailDomain === targetContact.emailDomain) {
      return true;
    }
    
    return false;
  });
}

export function autoFillFromSiblingContacts(
  contact: Partial<Contact>,
  siblingContacts: Contact[]
): { updatedContact: Partial<Contact>; fieldsUpdated: string[] } {
  if (siblingContacts.length === 0) {
    return { updatedContact: contact, fieldsUpdated: [] };
  }
  
  const bestSibling = siblingContacts.reduce((best, current) => {
    const bestScore = calculateDataCompletenessScore(best);
    const currentScore = calculateDataCompletenessScore(current);
    return currentScore > bestScore ? current : best;
  });
  
  const updatedContact = { ...contact };
  const fieldsUpdated: string[] = [];
  
  const fieldsToFill: (keyof Contact)[] = [
    'company', 'industry', 'employees', 'employeeSizeBracket',
    'website', 'companyLinkedIn', 'companyAddress', 'companyCity',
    'companyState', 'companyCountry', 'companyId'
  ];
  
  for (const field of fieldsToFill) {
    if (!contact[field] && bestSibling[field]) {
      (updatedContact as any)[field] = bestSibling[field];
      fieldsUpdated.push(field);
    }
  }
  
  return { updatedContact, fieldsUpdated };
}

export function calculateDataCompletenessScore(contact: Partial<Contact>): number {
  const criticalFields = ['fullName', 'email', 'mobilePhone', 'company', 'title'];
  const importantFields = ['industry', 'country', 'employeeSizeBracket', 'personLinkedIn'];
  const niceToHaveFields = ['website', 'companyAddress', 'companyCity', 'companyCountry'];
  
  let score = 0;
  
  for (const field of criticalFields) {
    if ((contact as any)[field]) score += 20;
  }
  
  for (const field of importantFields) {
    if ((contact as any)[field]) score += 10;
  }
  
  for (const field of niceToHaveFields) {
    if ((contact as any)[field]) score += 5;
  }
  
  return Math.min(score, 100);
}

export function identifyDataGaps(contact: Partial<Contact>): {
  critical: string[];
  important: string[];
  suggestions: string[];
} {
  const critical: string[] = [];
  const important: string[] = [];
  const suggestions: string[] = [];
  
  if (!contact.email) critical.push('email');
  if (!contact.fullName && !contact.firstName) critical.push('name');
  if (!contact.mobilePhone && !contact.otherPhone) important.push('phone');
  if (!contact.company) important.push('company');
  if (!contact.title) suggestions.push('title');
  if (!contact.industry) suggestions.push('industry');
  if (!contact.country) suggestions.push('country');
  if (!contact.personLinkedIn) suggestions.push('linkedin');
  if (!contact.employeeSizeBracket) suggestions.push('company_size');
  
  return { critical, important, suggestions };
}

export type DataQualityLevel = 'excellent' | 'good' | 'fair' | 'poor';

export function getDataQualityLevel(score: number): DataQualityLevel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export function getDataQualityColor(level: DataQualityLevel): string {
  switch (level) {
    case 'excellent': return 'text-green-600 bg-green-100';
    case 'good': return 'text-blue-600 bg-blue-100';
    case 'fair': return 'text-yellow-600 bg-yellow-100';
    case 'poor': return 'text-red-600 bg-red-100';
  }
}
