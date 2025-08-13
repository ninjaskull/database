import type { InsertContact } from "@shared/schema";

export async function enrichContactData(contact: Partial<InsertContact>): Promise<Partial<InsertContact>> {
  const enriched = { ...contact };
  
  // Extract email domain
  if (contact.email && !contact.emailDomain) {
    enriched.emailDomain = contact.email.split('@')[1];
  }
  
  // Extract country code and country from phone number
  if (contact.mobilePhone && !contact.countryCode) {
    enriched.countryCode = extractCountryCode(contact.mobilePhone);
  }
  
  // Determine country from phone if not already set
  if (contact.mobilePhone && !contact.country) {
    const phoneCountry = getCountryFromPhone(contact.mobilePhone);
    if (phoneCountry !== 'Unknown') {
      enriched.country = phoneCountry;
    }
  }
  
  // Determine timezone from country
  if (enriched.country && !contact.timezone) {
    enriched.timezone = getTimezoneFromCountry(enriched.country);
  }
  
  // Determine region from country
  if (enriched.country && !contact.region) {
    enriched.region = getRegionFromCountry(enriched.country);
  }
  
  // Determine business type from industry
  if (contact.industry && !contact.businessType) {
    enriched.businessType = getBusinessTypeFromIndustry(contact.industry);
  }
  
  // Categorize technologies
  if (contact.technologies && !contact.technologyCategory) {
    enriched.technologyCategory = categorizeTechnologies(contact.technologies);
  }
  
  // Calculate lead score (always recalculate to ensure dynamic scoring)
  enriched.leadScore = String(calculateLeadScore(enriched));
  
  return enriched;
}

function extractCountryCode(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return '+1'; // US/Canada
  } else if (cleaned.startsWith('44')) {
    return '+44'; // UK
  } else if (cleaned.startsWith('49')) {
    return '+49'; // Germany
  } else if (cleaned.startsWith('33')) {
    return '+33'; // France
  } else if (cleaned.startsWith('81')) {
    return '+81'; // Japan
  } else if (cleaned.startsWith('91')) {
    return '+91'; // India
  } else if (cleaned.startsWith('61')) {
    return '+61'; // Australia
  } else if (cleaned.startsWith('86')) {
    return '+86'; // China
  } else if (cleaned.startsWith('65')) {
    return '+65'; // Singapore
  }
  
  return 'Unknown';
}

function getCountryFromPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return 'United States'; // Default to US for +1
  } else if (cleaned.startsWith('44')) {
    return 'United Kingdom';
  } else if (cleaned.startsWith('49')) {
    return 'Germany';
  } else if (cleaned.startsWith('33')) {
    return 'France';
  } else if (cleaned.startsWith('81')) {
    return 'Japan';
  } else if (cleaned.startsWith('91')) {
    return 'India';
  } else if (cleaned.startsWith('61')) {
    return 'Australia';
  } else if (cleaned.startsWith('86')) {
    return 'China';
  } else if (cleaned.startsWith('65')) {
    return 'Singapore';
  }
  
  return 'Unknown';
}

function getTimezoneFromCountry(country: string): string {
  const timezones: Record<string, string> = {
    'United States': 'America/New_York',
    'Canada': 'America/Toronto',
    'United Kingdom': 'Europe/London',
    'Germany': 'Europe/Berlin',
    'France': 'Europe/Paris',
    'Japan': 'Asia/Tokyo',
    'Australia': 'Australia/Sydney',
  };
  
  return timezones[country] || 'UTC';
}

function getRegionFromCountry(country: string): string {
  const regions: Record<string, string> = {
    'United States': 'AMER',
    'Canada': 'AMER',
    'Mexico': 'AMER',
    'Brazil': 'AMER',
    'United Kingdom': 'EMEA',
    'Germany': 'EMEA',
    'France': 'EMEA',
    'Italy': 'EMEA',
    'Spain': 'EMEA',
    'South Africa': 'EMEA',
    'Japan': 'APAC',
    'China': 'APAC',
    'India': 'APAC',
    'Australia': 'APAC',
    'Singapore': 'APAC',
  };
  
  return regions[country] || 'Other';
}

function getBusinessTypeFromIndustry(industry: string): string {
  const b2bIndustries = [
    'Technology', 'Manufacturing', 'Consulting', 'Financial Services',
    'Healthcare', 'Education', 'Government', 'Energy'
  ];
  
  const b2cIndustries = [
    'Retail', 'Entertainment', 'Food & Beverage', 'Travel',
    'Consumer Products', 'Real Estate'
  ];
  
  if (b2bIndustries.some(b2b => industry.toLowerCase().includes(b2b.toLowerCase()))) {
    return 'B2B';
  } else if (b2cIndustries.some(b2c => industry.toLowerCase().includes(b2c.toLowerCase()))) {
    return 'B2C';
  }
  
  return 'Unknown';
}

function categorizeTechnologies(technologies: string[]): string {
  const categories: Record<string, string[]> = {
    'Web Development': ['React', 'Angular', 'Vue', 'JavaScript', 'HTML', 'CSS', 'Node.js'],
    'Mobile Development': ['iOS', 'Android', 'React Native', 'Flutter', 'Swift', 'Kotlin'],
    'Cloud & DevOps': ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins'],
    'Data & Analytics': ['Python', 'R', 'SQL', 'Tableau', 'Power BI', 'Spark'],
    'Enterprise': ['Salesforce', 'SAP', 'Oracle', 'Microsoft', '.NET', 'Java'],
  };
  
  for (const [category, techs] of Object.entries(categories)) {
    if (technologies.some(tech => 
      techs.some(categoryTech => 
        tech.toLowerCase().includes(categoryTech.toLowerCase())
      )
    )) {
      return category;
    }
  }
  
  return 'Other';
}

function calculateLeadScore(contact: Partial<InsertContact>): number {
  let score = 5.0; // Base score
  
  // Email presence
  if (contact.email) score += 1.0;
  
  // Company information
  if (contact.company) score += 0.5;
  if (contact.website) score += 0.5;
  
  // Employee size (larger companies = higher score)
  if (contact.employeeSizeBracket) {
    const bracket = contact.employeeSizeBracket.toLowerCase();
    if (bracket.includes('200+') || bracket.includes('500+')) score += 2.0;
    else if (bracket.includes('50-200') || bracket.includes('51-200')) score += 1.5;
    else if (bracket.includes('11-50')) score += 1.0;
    else score += 0.5;
  }
  
  // Industry scoring
  if (contact.industry) {
    const highValueIndustries = ['Technology', 'Finance', 'Healthcare'];
    if (highValueIndustries.includes(contact.industry)) {
      score += 1.0;
    } else {
      score += 0.5;
    }
  }
  
  // Technologies
  if (contact.technologies && contact.technologies.length > 0) {
    score += Math.min(contact.technologies.length * 0.1, 0.5);
  }
  
  // Contact completeness
  const fields = [
    contact.fullName, contact.title, contact.email, contact.company,
    contact.mobilePhone, contact.industry, contact.country
  ];
  const completeness = fields.filter(Boolean).length / fields.length;
  score += completeness * 0.5;
  
  // Cap at 10.0
  return Math.min(Math.round(score * 10) / 10, 10.0);
}
