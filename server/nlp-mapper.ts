/**
 * Custom NLP Model for Automatic CSV Field Mapping
 * Uses pattern recognition, semantic similarity, and linguistic analysis
 * No third-party AI dependencies - fully custom implementation
 */

interface FieldPattern {
  dbField: string;
  patterns: string[];
  synonyms: string[];
  keywords: string[];
  weight: number;
}

interface MappingScore {
  field: string;
  score: number;
  confidence: number;
}

// Company-specific field patterns for company CSV imports
const companyFieldPatterns: FieldPattern[] = [
  // Company Identity
  {
    dbField: 'name',
    patterns: ['company.*name', '^name$', 'organization.*name', 'org.*name', 'business.*name', 'company_name', 'companyname'],
    synonyms: ['company name', 'name', 'organization name', 'org name', 'business name', 'company_name', 'companyname', 'firm name'],
    keywords: ['company', 'name', 'organization', 'org', 'business', 'firm'],
    weight: 1.0
  },
  {
    dbField: 'nameForEmails',
    patterns: ['name.*for.*emails', 'email.*name', 'company.*name.*emails', 'display.*name', 'name_for_emails'],
    synonyms: ['company name for emails', 'name for emails', 'email name', 'display name', 'name_for_emails'],
    keywords: ['email', 'name', 'display', 'emails'],
    weight: 0.95
  },
  {
    dbField: 'website',
    patterns: ['^website$', 'web.*site', 'company.*website', 'homepage', 'web.*address', 'site.*url', '^url$', 'domain'],
    synonyms: ['website', 'web site', 'company website', 'homepage', 'web address', 'site url', 'url', 'domain'],
    keywords: ['website', 'web', 'url', 'homepage', 'site', 'domain'],
    weight: 1.0
  },
  {
    dbField: 'linkedinUrl',
    patterns: ['company.*linkedin.*url', 'linkedin.*url', 'linkedin', 'company.*linkedin', 'linkedin.*company', 'linkedin_url'],
    synonyms: ['company linkedin url', 'linkedin url', 'linkedin', 'company linkedin', 'linkedin company', 'linkedin_url'],
    keywords: ['linkedin', 'url', 'company', 'social'],
    weight: 0.95
  },
  {
    dbField: 'logoUrl',
    patterns: ['logo.*url', 'logo', 'company.*logo', 'image.*url', 'logo_url', 'logourl'],
    synonyms: ['logo url', 'logo', 'company logo', 'image url', 'logo_url', 'logourl', 'brand logo'],
    keywords: ['logo', 'image', 'url', 'brand'],
    weight: 0.9
  },
  
  // Employee Information
  {
    dbField: 'employees',
    patterns: ['employee.*size', 'employees', 'employee.*count', 'staff.*count', 'headcount', 'team.*size', 'workforce', 'num.*employees', 'number.*employees'],
    synonyms: ['employee size', 'employees', 'employee count', 'staff count', 'headcount', 'team size', 'workforce', 'number of employees'],
    keywords: ['employees', 'employee', 'staff', 'headcount', 'team', 'workforce', 'count', 'size'],
    weight: 0.95
  },
  {
    dbField: 'employeeSizeBracket',
    patterns: ['employee.*size.*bracket', 'size.*bracket', 'employee.*bracket', 'employee.*range', 'company.*size'],
    synonyms: ['employee size bracket', 'size bracket', 'employee bracket', 'employee range', 'company size', 'size range'],
    keywords: ['size', 'bracket', 'range', 'category', 'employee'],
    weight: 0.9
  },
  
  // Industry & Business Type
  {
    dbField: 'industry',
    patterns: ['^industry$', 'sector', 'business.*type', 'vertical', 'market.*segment'],
    synonyms: ['industry', 'sector', 'business type', 'vertical', 'market segment', 'field'],
    keywords: ['industry', 'sector', 'business', 'vertical', 'market'],
    weight: 1.0
  },
  {
    dbField: 'keywords',
    patterns: ['^keywords$', 'tags', 'categories', 'labels', 'key.*words'],
    synonyms: ['keywords', 'tags', 'categories', 'labels', 'key words'],
    keywords: ['keywords', 'tags', 'categories', 'labels'],
    weight: 0.85
  },
  
  // Contact Information
  {
    dbField: 'phone',
    patterns: ['company.*phone', '^phone$', 'phone.*number', 'telephone', 'tel', 'contact.*number', 'main.*phone'],
    synonyms: ['company phone', 'phone', 'phone number', 'telephone', 'tel', 'contact number', 'main phone'],
    keywords: ['phone', 'tel', 'telephone', 'number', 'contact'],
    weight: 0.95
  },
  
  // Location - Street Level
  {
    dbField: 'street',
    patterns: ['company.*street', '^street$', 'street.*address', 'address.*line.*1', 'street.*name'],
    synonyms: ['company street', 'street', 'street address', 'address line 1', 'street name'],
    keywords: ['street', 'address', 'line'],
    weight: 0.9
  },
  {
    dbField: 'city',
    patterns: ['company.*city', '^city$', 'town', 'locality', 'municipality'],
    synonyms: ['company city', 'city', 'town', 'locality', 'municipality'],
    keywords: ['city', 'town', 'locality'],
    weight: 0.95
  },
  {
    dbField: 'state',
    patterns: ['company.*state', '^state$', 'province', 'region', 'territory'],
    synonyms: ['company state', 'state', 'province', 'region', 'territory'],
    keywords: ['state', 'province', 'region'],
    weight: 0.9
  },
  {
    dbField: 'country',
    patterns: ['company.*country', '^country$', 'nation'],
    synonyms: ['company country', 'country', 'nation'],
    keywords: ['country', 'nation'],
    weight: 0.95
  },
  {
    dbField: 'postalCode',
    patterns: ['postal.*code', 'zip.*code', 'zip', 'postcode', 'company.*postal'],
    synonyms: ['postal code', 'zip code', 'zip', 'postcode', 'company postal code'],
    keywords: ['postal', 'zip', 'code', 'postcode'],
    weight: 0.9
  },
  {
    dbField: 'address',
    patterns: ['company.*address', '^address$', 'full.*address', 'hq.*address', 'headquarters.*address'],
    synonyms: ['company address', 'address', 'full address', 'hq address', 'headquarters address'],
    keywords: ['address', 'headquarters', 'hq', 'location'],
    weight: 0.85
  },
  
  // Technology & Industry Codes
  {
    dbField: 'technologies',
    patterns: ['technologies', 'tech.*stack', 'tools', 'software', 'platforms', 'tech'],
    synonyms: ['technologies', 'tech stack', 'tools', 'software', 'platforms', 'tech', 'technology'],
    keywords: ['technologies', 'tech', 'tools', 'software', 'platforms', 'stack'],
    weight: 0.9
  },
  {
    dbField: 'sicCodes',
    patterns: ['sic.*codes', 'sic', 'sic.*code', 'standard.*industrial.*classification'],
    synonyms: ['sic codes', 'sic', 'sic code', 'standard industrial classification'],
    keywords: ['sic', 'codes', 'industrial', 'classification'],
    weight: 0.95
  },
  {
    dbField: 'naicsCodes',
    patterns: ['naics.*codes', 'naics', 'naics.*code', 'north.*american.*industry'],
    synonyms: ['naics codes', 'naics', 'naics code', 'north american industry classification'],
    keywords: ['naics', 'codes', 'industry', 'classification'],
    weight: 0.95
  },
  
  // Financial Information
  {
    dbField: 'annualRevenue',
    patterns: ['annual.*revenue', '^revenue$', 'turnover', 'sales', 'yearly.*revenue'],
    synonyms: ['annual revenue', 'revenue', 'turnover', 'sales', 'yearly revenue'],
    keywords: ['revenue', 'turnover', 'sales', 'annual', 'yearly'],
    weight: 0.95
  },
  {
    dbField: 'totalFunding',
    patterns: ['total.*funding', '^funding$', 'total.*raised', 'investment.*total'],
    synonyms: ['total funding', 'funding', 'total raised', 'investment total', 'funds raised'],
    keywords: ['funding', 'total', 'raised', 'investment'],
    weight: 0.95
  },
  {
    dbField: 'latestFunding',
    patterns: ['latest.*funding', 'last.*funding', 'recent.*funding', 'funding.*round'],
    synonyms: ['latest funding', 'last funding', 'recent funding', 'funding round', 'latest round'],
    keywords: ['latest', 'funding', 'round', 'recent'],
    weight: 0.9
  },
  {
    dbField: 'latestFundingAmount',
    patterns: ['latest.*funding.*amount', 'last.*raised.*amount', 'funding.*amount', 'round.*amount'],
    synonyms: ['latest funding amount', 'last raised amount', 'funding amount', 'round amount'],
    keywords: ['amount', 'funding', 'raised', 'round'],
    weight: 0.9
  },
  {
    dbField: 'lastRaisedAt',
    patterns: ['last.*raised.*at', 'funding.*date', 'raised.*date', 'last.*raised'],
    synonyms: ['last raised at', 'funding date', 'raised date', 'last raised', 'funding time'],
    keywords: ['raised', 'date', 'at', 'time', 'last'],
    weight: 0.85
  },
  
  // Business Metrics
  {
    dbField: 'retailLocations',
    patterns: ['retail.*locations', 'number.*of.*retail.*locations', 'stores', 'locations.*count', 'outlets'],
    synonyms: ['retail locations', 'number of retail locations', 'stores', 'locations count', 'outlets', 'branches'],
    keywords: ['retail', 'locations', 'stores', 'outlets', 'branches'],
    weight: 0.9
  },
  {
    dbField: 'foundedYear',
    patterns: ['founded.*year', 'year.*founded', 'established', 'inception', 'founded'],
    synonyms: ['founded year', 'year founded', 'established', 'inception', 'founded', 'founding year'],
    keywords: ['founded', 'year', 'established', 'inception'],
    weight: 0.95
  },
  
  // Corporate Structure
  {
    dbField: 'subsidiaryOf',
    patterns: ['subsidiary.*of', 'parent.*company', 'owned.*by', 'part.*of', 'division.*of'],
    synonyms: ['subsidiary of', 'parent company', 'owned by', 'part of', 'division of', 'belongs to'],
    keywords: ['subsidiary', 'parent', 'owned', 'division', 'belongs'],
    weight: 0.9
  },
  {
    dbField: 'shortDescription',
    patterns: ['short.*description', 'description', 'summary', 'about', 'overview', 'company.*description'],
    synonyms: ['short description', 'description', 'summary', 'about', 'overview', 'company description'],
    keywords: ['description', 'summary', 'about', 'overview'],
    weight: 0.85
  },
];

class CSVFieldMapper {
  private fieldPatterns: FieldPattern[] = [
    // Personal Information
    {
      dbField: 'fullName',
      patterns: ['full.*name', 'complete.*name', '^name$', 'contact.*name', 'person.*name', 'full_name', 'fullname'],
      synonyms: ['full name', 'complete name', 'name', 'contact name', 'person name', 'full_name', 'fullname', 'display name'],
      keywords: ['full', 'complete', 'name', 'contact', 'person', 'display'],
      weight: 1.0
    },
    {
      dbField: 'firstName',
      patterns: ['first.*name', 'given.*name', 'fname', 'f_name', 'firstname'],
      synonyms: ['first name', 'given name', 'fname', 'forename', 'f_name', 'firstname', 'christian name'],
      keywords: ['first', 'given', 'fname', 'forename', 'christian'],
      weight: 0.9
    },
    {
      dbField: 'lastName',
      patterns: ['last.*name', 'family.*name', 'surname', 'lname', 'l_name', 'lastname'],
      synonyms: ['last name', 'family name', 'surname', 'lname', 'l_name', 'lastname'],
      keywords: ['last', 'family', 'surname', 'lname'],
      weight: 0.9
    },
    {
      dbField: 'title',
      patterns: ['job.*title', 'job.*position', '^title$', '^position$', 'role', 'designation', 'job_title', 'jobtitle'],
      synonyms: ['job title', 'title', 'position', 'role', 'designation', 'job_title', 'jobtitle', 'job position', 'work title'],
      keywords: ['job', 'title', 'position', 'role', 'designation', 'work'],
      weight: 0.95
    },
    
    // Contact Information
    {
      dbField: 'email',
      patterns: ['email.*address', '^email$', 'e.mail', 'e_mail', 'mail', 'email_address', 'emailaddress'],
      synonyms: ['email address', 'email', 'e-mail', 'mail', 'electronic mail', 'e_mail', 'email_address', 'emailaddress'],
      keywords: ['email', 'mail', 'e-mail', '@', 'electronic'],
      weight: 1.0
    },
    
    // Phone Numbers with Enhanced Detection
    {
      dbField: 'mobilePhone',
      patterns: ['mobile.*phone', 'mobile.*number', 'cell.*phone', 'cell.*number', '^mobile$', '^cell$', '^phone$', 'phone.*number', 'tel', 'telephone'],
      synonyms: ['mobile phone', 'mobile', 'cell phone', 'cell', 'phone', 'telephone', 'tel', 'mobile number', 'cell number', 'phone number'],
      keywords: ['mobile', 'cell', 'phone', 'tel', 'telephone', 'number'],
      weight: 0.9
    },
    {
      dbField: 'corporatePhone',
      patterns: ['corporate.*phone', 'corp.*phone', 'work.*phone', 'office.*phone', 'business.*phone', 'company.*phone'],
      synonyms: ['corporate phone', 'corp phone', 'work phone', 'office phone', 'business phone', 'company phone', 'work number', 'office number'],
      keywords: ['corporate', 'corp', 'work', 'office', 'business', 'company'],
      weight: 0.85
    },
    {
      dbField: 'homePhone',
      patterns: ['home.*phone', 'home.*tel', 'home.*number', 'landline', 'house.*phone'],
      synonyms: ['home phone', 'home telephone', 'landline', 'home tel', 'house phone', 'home number'],
      keywords: ['home', 'landline', 'house', 'personal'],
      weight: 0.8
    },
    {
      dbField: 'otherPhone',
      patterns: ['other.*phone', 'alt.*phone', 'alternate.*phone', 'additional.*phone', 'secondary.*phone'],
      synonyms: ['other phone', 'alt phone', 'alternate phone', 'additional phone', 'secondary phone', 'backup phone'],
      keywords: ['other', 'alt', 'alternate', 'additional', 'secondary', 'backup'],
      weight: 0.7
    },
    
    // Company Information
    {
      dbField: 'company',
      patterns: ['company.*name', '^company$', 'organization', 'org', 'employer', 'business.*name', 'firm', 'corp', 'corporation'],
      synonyms: ['company name', 'company', 'organization', 'org', 'employer', 'business', 'firm', 'corp', 'corporation', 'enterprise'],
      keywords: ['company', 'organization', 'org', 'employer', 'business', 'firm', 'corp', 'enterprise'],
      weight: 0.95
    },
    {
      dbField: 'industry',
      patterns: ['^industry$', 'sector', 'business.*type', 'vertical', 'field', 'domain'],
      synonyms: ['industry', 'sector', 'business type', 'field', 'vertical', 'domain', 'market'],
      keywords: ['industry', 'sector', 'business', 'field', 'vertical', 'domain', 'market'],
      weight: 0.9
    },
    {
      dbField: 'employees',
      patterns: ['employees', 'employee.*count', 'staff.*count', 'headcount', 'team.*size', 'workforce'],
      synonyms: ['employees', 'employee count', 'staff count', 'headcount', 'team size', 'workforce', 'number of employees'],
      keywords: ['employees', 'employee', 'staff', 'headcount', 'team', 'workforce', 'count'],
      weight: 0.8
    },
    {
      dbField: 'employeeSizeBracket',
      patterns: ['employee.*size', 'company.*size', 'size.*bracket', 'employee.*bracket'],
      synonyms: ['employee size bracket', 'company size', 'size bracket', 'employee bracket', 'company size bracket'],
      keywords: ['size', 'bracket', 'range', 'category'],
      weight: 0.75
    },
    {
      dbField: 'annualRevenue',
      patterns: ['annual.*revenue', 'revenue', 'turnover', 'sales', 'income'],
      synonyms: ['annual revenue', 'revenue', 'turnover', 'sales', 'income', 'yearly revenue'],
      keywords: ['revenue', 'turnover', 'sales', 'income', 'annual', 'yearly'],
      weight: 0.8
    },
    {
      dbField: 'website',
      patterns: ['^website$', 'web.*site', 'company.*website', 'homepage', 'web.*address', 'site.*url', 'url'],
      synonyms: ['website', 'web site', 'company website', 'homepage', 'web address', 'site url', 'url'],
      keywords: ['website', 'web', 'company', 'homepage', 'site'],
      weight: 0.95
    },
    {
      dbField: 'technologies',
      patterns: ['technologies', 'tech.*stack', 'tools', 'software', 'platforms'],
      synonyms: ['technologies', 'tech stack', 'tools', 'software', 'platforms', 'tech', 'technology'],
      keywords: ['technologies', 'tech', 'tools', 'software', 'platforms', 'stack'],
      weight: 0.8
    },
    
    // Social Media
    {
      dbField: 'personLinkedIn',
      patterns: ['person.*linkedin.*url', 'personal.*linkedin.*url', 'linkedin.*url', 'person.*linkedin', 'personal.*linkedin', '^linkedin$', 'profile.*url'],
      synonyms: ['person linkedin url', 'personal linkedin url', 'linkedin url', 'person linkedin', 'personal linkedin', 'linkedin', 'profile url'],
      keywords: ['person', 'personal', 'linkedin', 'profile', 'url'],
      weight: 0.95
    },
    {
      dbField: 'companyLinkedIn',
      patterns: ['company.*linkedin.*url', 'business.*linkedin.*url', 'corp.*linkedin.*url', 'organization.*linkedin.*url', 'company.*linkedin'],
      synonyms: ['company linkedin url', 'business linkedin url', 'corp linkedin url', 'organization linkedin url', 'company linkedin'],
      keywords: ['company', 'business', 'corp', 'organization', 'linkedin', 'url'],
      weight: 0.9
    },
    
    // Location Information
    {
      dbField: 'city',
      patterns: ['^city$', 'town', 'locality', 'municipality'],
      synonyms: ['city', 'town', 'locality', 'municipality', 'place'],
      keywords: ['city', 'town', 'locality', 'place', 'location'],
      weight: 0.85
    },
    {
      dbField: 'state',
      patterns: ['^state$', 'province', 'region', 'territory'],
      synonyms: ['state', 'province', 'region', 'territory', 'administrative region'],
      keywords: ['state', 'province', 'region', 'territory', 'admin'],
      weight: 0.8
    },
    {
      dbField: 'country',
      patterns: ['^country$', 'nation', 'nationality'],
      synonyms: ['country', 'nation', 'nationality'],
      keywords: ['country', 'nation', 'nationality', 'national'],
      weight: 0.9
    },
    
    // Company Location
    {
      dbField: 'companyAddress',
      patterns: ['company.*address', 'business.*address', 'office.*address', 'work.*address'],
      synonyms: ['company address', 'business address', 'office address', 'work address', 'corporate address'],
      keywords: ['company', 'business', 'office', 'work', 'corporate', 'address'],
      weight: 0.8
    },
    {
      dbField: 'companyCity',
      patterns: ['company.*city', 'business.*city', 'office.*city', 'work.*city'],
      synonyms: ['company city', 'business city', 'office city', 'work city', 'corporate city'],
      keywords: ['company', 'business', 'office', 'work', 'corporate', 'city'],
      weight: 0.75
    },
    {
      dbField: 'companyState',
      patterns: ['company.*state', 'business.*state', 'office.*state', 'work.*state'],
      synonyms: ['company state', 'business state', 'office state', 'work state', 'corporate state'],
      keywords: ['company', 'business', 'office', 'work', 'corporate', 'state'],
      weight: 0.75
    },
    {
      dbField: 'companyCountry',
      patterns: ['company.*country', 'business.*country', 'office.*country', 'work.*country'],
      synonyms: ['company country', 'business country', 'office country', 'work country', 'corporate country'],
      keywords: ['company', 'business', 'office', 'work', 'corporate', 'country'],
      weight: 0.75
    }
  ];

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate semantic similarity score
   */
  private calculateSemanticSimilarity(header: string, target: string): number {
    const normalizedHeader = this.normalizeText(header);
    const normalizedTarget = this.normalizeText(target);

    // Exact match
    if (normalizedHeader === normalizedTarget) {
      return 1.0;
    }

    // Contains match
    if (normalizedHeader.includes(normalizedTarget) || normalizedTarget.includes(normalizedHeader)) {
      return 0.8;
    }

    // Levenshtein distance similarity
    const distance = this.levenshteinDistance(normalizedHeader, normalizedTarget);
    const maxLength = Math.max(normalizedHeader.length, normalizedTarget.length);
    const similarity = 1 - (distance / maxLength);

    return similarity > 0.6 ? similarity : 0;
  }

  /**
   * Calculate pattern match score
   */
  private calculatePatternScore(header: string, pattern: FieldPattern): number {
    const normalizedHeader = this.normalizeText(header);
    let bestScore = 0;

    // Check regex patterns
    for (const regexPattern of pattern.patterns) {
      const regex = new RegExp(regexPattern, 'i');
      if (regex.test(normalizedHeader)) {
        bestScore = Math.max(bestScore, 0.9);
      }
    }

    // Check synonyms
    for (const synonym of pattern.synonyms) {
      const similarity = this.calculateSemanticSimilarity(normalizedHeader, synonym);
      bestScore = Math.max(bestScore, similarity * 0.8);
    }

    // Check keywords
    const headerWords = normalizedHeader.split(' ');
    for (const keyword of pattern.keywords) {
      for (const word of headerWords) {
        const similarity = this.calculateSemanticSimilarity(word, keyword);
        if (similarity > 0.7) {
          bestScore = Math.max(bestScore, similarity * 0.6);
        }
      }
    }

    return bestScore * pattern.weight;
  }

  /**
   * Calculate contextual score based on surrounding headers
   */
  private calculateContextualScore(header: string, allHeaders: string[], fieldPattern: FieldPattern): number {
    let contextScore = 0;

    // Check for related fields that often appear together
    const relatedFields = {
      'firstName': ['lastName', 'fullName'],
      'lastName': ['firstName', 'fullName'],
      'city': ['country', 'state'],
      'company': ['title', 'industry'],
      'email': ['firstName', 'lastName', 'company']
    };

    const related = relatedFields[fieldPattern.dbField as keyof typeof relatedFields];
    if (related) {
      for (const relatedField of related) {
        const relatedPattern = this.fieldPatterns.find(p => p.dbField === relatedField);
        if (relatedPattern) {
          for (const otherHeader of allHeaders) {
            if (otherHeader !== header && this.calculatePatternScore(otherHeader, relatedPattern) > 0.5) {
              contextScore += 0.1;
            }
          }
        }
      }
    }

    return Math.min(contextScore, 0.3); // Cap at 0.3
  }

  /**
   * Map CSV headers to database fields automatically
   */
  public mapHeaders(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    const usedFields = new Set<string>();

    // Calculate scores for each header-field combination
    const scores: Array<{ header: string; field: string; score: number; confidence: number }> = [];

    for (const header of headers) {
      for (const pattern of this.fieldPatterns) {
        const patternScore = this.calculatePatternScore(header, pattern);
        const contextScore = this.calculateContextualScore(header, headers, pattern);
        const totalScore = patternScore + contextScore;
        
        if (totalScore > 0.3) { // Minimum threshold
          const confidence = Math.min(totalScore, 1.0);
          scores.push({
            header,
            field: pattern.dbField,
            score: totalScore,
            confidence
          });
        }
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Assign mappings, ensuring no field is used twice
    for (const score of scores) {
      if (!usedFields.has(score.field) && !mapping[score.header]) {
        // Only assign if confidence is high enough and field hasn't been used
        if (score.confidence >= 0.4) {
          mapping[score.header] = score.field;
          usedFields.add(score.field);
        }
      }
    }

    console.log(`🧠 NLP Auto-mapping results for ${headers.length} headers:`, mapping);
    console.log(`📊 Mapped ${Object.keys(mapping).length} fields with enhanced patterns`);
    
    return mapping;
  }

  /**
   * Get mapping confidence scores for each header
   */
  public getMappingConfidence(headers: string[], mapping: Record<string, string>): Record<string, number> {
    const confidence: Record<string, number> = {};

    for (const header of headers) {
      const mappedField = mapping[header];
      if (mappedField) {
        const pattern = this.fieldPatterns.find(p => p.dbField === mappedField);
        if (pattern) {
          const score = this.calculatePatternScore(header, pattern);
          const contextScore = this.calculateContextualScore(header, headers, pattern);
          confidence[header] = Math.min(score + contextScore, 1.0);
        } else {
          confidence[header] = 0.3;
        }
      } else {
        confidence[header] = 0;
      }
    }

    return confidence;
  }

  /**
   * Suggest alternative mappings for low-confidence fields
   */
  public suggestAlternatives(header: string, currentMapping?: string): Array<{ field: string; confidence: number }> {
    const alternatives: Array<{ field: string; confidence: number }> = [];

    for (const pattern of this.fieldPatterns) {
      if (pattern.dbField !== currentMapping) {
        const score = this.calculatePatternScore(header, pattern);
        if (score > 0.2) {
          alternatives.push({
            field: pattern.dbField,
            confidence: Math.min(score, 1.0)
          });
        }
      }
    }

    // Sort by confidence descending
    return alternatives.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }
}

/**
 * Company-specific CSV Field Mapper for company imports
 * Uses company field patterns for automatic mapping
 */
class CompanyCSVFieldMapper {
  private fieldPatterns: FieldPattern[] = companyFieldPatterns;

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculateSemanticSimilarity(header: string, target: string): number {
    const normalizedHeader = this.normalizeText(header);
    const normalizedTarget = this.normalizeText(target);

    if (normalizedHeader === normalizedTarget) {
      return 1.0;
    }

    if (normalizedHeader.includes(normalizedTarget) || normalizedTarget.includes(normalizedHeader)) {
      return 0.8;
    }

    const distance = this.levenshteinDistance(normalizedHeader, normalizedTarget);
    const maxLength = Math.max(normalizedHeader.length, normalizedTarget.length);
    const similarity = 1 - (distance / maxLength);

    return similarity > 0.6 ? similarity : 0;
  }

  private calculatePatternScore(header: string, pattern: FieldPattern): number {
    const normalizedHeader = this.normalizeText(header);
    let bestScore = 0;

    for (const regexPattern of pattern.patterns) {
      const regex = new RegExp(regexPattern, 'i');
      if (regex.test(normalizedHeader)) {
        bestScore = Math.max(bestScore, 0.9);
      }
    }

    for (const synonym of pattern.synonyms) {
      const similarity = this.calculateSemanticSimilarity(normalizedHeader, synonym);
      bestScore = Math.max(bestScore, similarity * 0.8);
    }

    const headerWords = normalizedHeader.split(' ');
    for (const keyword of pattern.keywords) {
      for (const word of headerWords) {
        const similarity = this.calculateSemanticSimilarity(word, keyword);
        if (similarity > 0.7) {
          bestScore = Math.max(bestScore, similarity * 0.6);
        }
      }
    }

    return bestScore * pattern.weight;
  }

  private calculateContextualScore(header: string, allHeaders: string[], fieldPattern: FieldPattern): number {
    let contextScore = 0;

    const relatedFields: Record<string, string[]> = {
      'name': ['website', 'industry'],
      'city': ['country', 'state', 'postalCode'],
      'employees': ['employeeSizeBracket', 'annualRevenue'],
      'totalFunding': ['latestFunding', 'latestFundingAmount'],
      'sicCodes': ['naicsCodes', 'industry']
    };

    const related = relatedFields[fieldPattern.dbField];
    if (related) {
      for (const relatedField of related) {
        const relatedPattern = this.fieldPatterns.find(p => p.dbField === relatedField);
        if (relatedPattern) {
          for (const otherHeader of allHeaders) {
            if (otherHeader !== header && this.calculatePatternScore(otherHeader, relatedPattern) > 0.5) {
              contextScore += 0.1;
            }
          }
        }
      }
    }

    return Math.min(contextScore, 0.3);
  }

  public mapHeaders(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    const usedFields = new Set<string>();

    const scores: Array<{ header: string; field: string; score: number; confidence: number }> = [];

    for (const header of headers) {
      for (const pattern of this.fieldPatterns) {
        const patternScore = this.calculatePatternScore(header, pattern);
        const contextScore = this.calculateContextualScore(header, headers, pattern);
        const totalScore = patternScore + contextScore;
        
        if (totalScore > 0.3) {
          const confidence = Math.min(totalScore, 1.0);
          scores.push({
            header,
            field: pattern.dbField,
            score: totalScore,
            confidence
          });
        }
      }
    }

    scores.sort((a, b) => b.score - a.score);

    for (const score of scores) {
      if (!usedFields.has(score.field) && !mapping[score.header]) {
        if (score.confidence >= 0.4) {
          mapping[score.header] = score.field;
          usedFields.add(score.field);
        }
      }
    }

    console.log(`🏢 Company NLP Auto-mapping results for ${headers.length} headers:`, mapping);
    console.log(`📊 Mapped ${Object.keys(mapping).length} company fields`);
    
    return mapping;
  }

  public getMappingConfidence(headers: string[], mapping: Record<string, string>): Record<string, number> {
    const confidence: Record<string, number> = {};

    for (const header of headers) {
      const mappedField = mapping[header];
      if (mappedField) {
        const pattern = this.fieldPatterns.find(p => p.dbField === mappedField);
        if (pattern) {
          const score = this.calculatePatternScore(header, pattern);
          const contextScore = this.calculateContextualScore(header, headers, pattern);
          confidence[header] = Math.min(score + contextScore, 1.0);
        } else {
          confidence[header] = 0.3;
        }
      } else {
        confidence[header] = 0;
      }
    }

    return confidence;
  }

  public suggestAlternatives(header: string, currentMapping?: string): Array<{ field: string; confidence: number }> {
    const alternatives: Array<{ field: string; confidence: number }> = [];

    for (const pattern of this.fieldPatterns) {
      if (pattern.dbField !== currentMapping) {
        const score = this.calculatePatternScore(header, pattern);
        if (score > 0.2) {
          alternatives.push({
            field: pattern.dbField,
            confidence: Math.min(score, 1.0)
          });
        }
      }
    }

    return alternatives.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  public getAvailableFields(): Array<{ value: string; label: string; category: string }> {
    return [
      { value: 'name', label: 'Company Name', category: 'Identity' },
      { value: 'nameForEmails', label: 'Company Name for Emails', category: 'Identity' },
      { value: 'website', label: 'Website', category: 'Identity' },
      { value: 'linkedinUrl', label: 'LinkedIn URL', category: 'Identity' },
      { value: 'logoUrl', label: 'Logo URL', category: 'Identity' },
      { value: 'employees', label: 'Employee Size', category: 'Size' },
      { value: 'employeeSizeBracket', label: 'Employee Size Bracket', category: 'Size' },
      { value: 'industry', label: 'Industry', category: 'Industry' },
      { value: 'keywords', label: 'Keywords', category: 'Industry' },
      { value: 'phone', label: 'Company Phone', category: 'Contact' },
      { value: 'street', label: 'Street', category: 'Location' },
      { value: 'city', label: 'City', category: 'Location' },
      { value: 'state', label: 'State', category: 'Location' },
      { value: 'country', label: 'Country', category: 'Location' },
      { value: 'postalCode', label: 'Postal Code', category: 'Location' },
      { value: 'address', label: 'Full Address', category: 'Location' },
      { value: 'technologies', label: 'Technologies', category: 'Tech' },
      { value: 'sicCodes', label: 'SIC Codes', category: 'Codes' },
      { value: 'naicsCodes', label: 'NAICS Codes', category: 'Codes' },
      { value: 'annualRevenue', label: 'Annual Revenue', category: 'Financial' },
      { value: 'totalFunding', label: 'Total Funding', category: 'Financial' },
      { value: 'latestFunding', label: 'Latest Funding', category: 'Financial' },
      { value: 'latestFundingAmount', label: 'Latest Funding Amount', category: 'Financial' },
      { value: 'lastRaisedAt', label: 'Last Raised At', category: 'Financial' },
      { value: 'retailLocations', label: 'Number of Retail Locations', category: 'Business' },
      { value: 'foundedYear', label: 'Founded Year', category: 'Business' },
      { value: 'subsidiaryOf', label: 'Subsidiary Of', category: 'Structure' },
      { value: 'shortDescription', label: 'Short Description', category: 'Info' },
    ];
  }
}

export const csvFieldMapper = new CSVFieldMapper();
export const companyFieldMapper = new CompanyCSVFieldMapper();