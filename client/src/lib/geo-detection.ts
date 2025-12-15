export interface GeoDetectionResult {
  country: string | null;
  countryCode: string | null;
  region: string | null;
  timezone: string | null;
  confidence: number;
  sources: string[];
}

const EMAIL_TLD_TO_COUNTRY: Record<string, string> = {
  'uk': 'United Kingdom',
  'co.uk': 'United Kingdom',
  'de': 'Germany',
  'fr': 'France',
  'es': 'Spain',
  'it': 'Italy',
  'nl': 'Netherlands',
  'be': 'Belgium',
  'at': 'Austria',
  'ch': 'Switzerland',
  'se': 'Sweden',
  'no': 'Norway',
  'dk': 'Denmark',
  'fi': 'Finland',
  'pl': 'Poland',
  'cz': 'Czech Republic',
  'pt': 'Portugal',
  'ie': 'Ireland',
  'ru': 'Russia',
  'ua': 'Ukraine',
  'jp': 'Japan',
  'cn': 'China',
  'in': 'India',
  'au': 'Australia',
  'nz': 'New Zealand',
  'sg': 'Singapore',
  'hk': 'Hong Kong',
  'tw': 'Taiwan',
  'kr': 'South Korea',
  'my': 'Malaysia',
  'th': 'Thailand',
  'id': 'Indonesia',
  'ph': 'Philippines',
  'vn': 'Vietnam',
  'br': 'Brazil',
  'mx': 'Mexico',
  'ar': 'Argentina',
  'cl': 'Chile',
  'co': 'Colombia',
  'ca': 'Canada',
  'za': 'South Africa',
  'ae': 'United Arab Emirates',
  'sa': 'Saudi Arabia',
  'il': 'Israel',
  'tr': 'Turkey',
  'eg': 'Egypt',
  'ng': 'Nigeria',
  'ke': 'Kenya',
};

const PHONE_PREFIX_TO_COUNTRY: Record<string, { country: string; code: string }> = {
  '1': { country: 'United States', code: '+1' },
  '44': { country: 'United Kingdom', code: '+44' },
  '49': { country: 'Germany', code: '+49' },
  '33': { country: 'France', code: '+33' },
  '34': { country: 'Spain', code: '+34' },
  '39': { country: 'Italy', code: '+39' },
  '31': { country: 'Netherlands', code: '+31' },
  '32': { country: 'Belgium', code: '+32' },
  '43': { country: 'Austria', code: '+43' },
  '41': { country: 'Switzerland', code: '+41' },
  '46': { country: 'Sweden', code: '+46' },
  '47': { country: 'Norway', code: '+47' },
  '45': { country: 'Denmark', code: '+45' },
  '358': { country: 'Finland', code: '+358' },
  '48': { country: 'Poland', code: '+48' },
  '420': { country: 'Czech Republic', code: '+420' },
  '351': { country: 'Portugal', code: '+351' },
  '353': { country: 'Ireland', code: '+353' },
  '7': { country: 'Russia', code: '+7' },
  '380': { country: 'Ukraine', code: '+380' },
  '81': { country: 'Japan', code: '+81' },
  '86': { country: 'China', code: '+86' },
  '91': { country: 'India', code: '+91' },
  '61': { country: 'Australia', code: '+61' },
  '64': { country: 'New Zealand', code: '+64' },
  '65': { country: 'Singapore', code: '+65' },
  '852': { country: 'Hong Kong', code: '+852' },
  '886': { country: 'Taiwan', code: '+886' },
  '82': { country: 'South Korea', code: '+82' },
  '60': { country: 'Malaysia', code: '+60' },
  '66': { country: 'Thailand', code: '+66' },
  '62': { country: 'Indonesia', code: '+62' },
  '63': { country: 'Philippines', code: '+63' },
  '84': { country: 'Vietnam', code: '+84' },
  '55': { country: 'Brazil', code: '+55' },
  '52': { country: 'Mexico', code: '+52' },
  '54': { country: 'Argentina', code: '+54' },
  '56': { country: 'Chile', code: '+56' },
  '57': { country: 'Colombia', code: '+57' },
  '27': { country: 'South Africa', code: '+27' },
  '971': { country: 'United Arab Emirates', code: '+971' },
  '966': { country: 'Saudi Arabia', code: '+966' },
  '972': { country: 'Israel', code: '+972' },
  '90': { country: 'Turkey', code: '+90' },
  '20': { country: 'Egypt', code: '+20' },
  '234': { country: 'Nigeria', code: '+234' },
  '254': { country: 'Kenya', code: '+254' },
};

const COUNTRY_TO_REGION: Record<string, string> = {
  'United States': 'AMER',
  'Canada': 'AMER',
  'Mexico': 'AMER',
  'Brazil': 'AMER',
  'Argentina': 'AMER',
  'Chile': 'AMER',
  'Colombia': 'AMER',
  'United Kingdom': 'EMEA',
  'Germany': 'EMEA',
  'France': 'EMEA',
  'Italy': 'EMEA',
  'Spain': 'EMEA',
  'Netherlands': 'EMEA',
  'Belgium': 'EMEA',
  'Austria': 'EMEA',
  'Switzerland': 'EMEA',
  'Sweden': 'EMEA',
  'Norway': 'EMEA',
  'Denmark': 'EMEA',
  'Finland': 'EMEA',
  'Poland': 'EMEA',
  'Czech Republic': 'EMEA',
  'Portugal': 'EMEA',
  'Ireland': 'EMEA',
  'Russia': 'EMEA',
  'Ukraine': 'EMEA',
  'Turkey': 'EMEA',
  'South Africa': 'EMEA',
  'United Arab Emirates': 'EMEA',
  'Saudi Arabia': 'EMEA',
  'Israel': 'EMEA',
  'Egypt': 'EMEA',
  'Nigeria': 'EMEA',
  'Kenya': 'EMEA',
  'Japan': 'APAC',
  'China': 'APAC',
  'India': 'APAC',
  'Australia': 'APAC',
  'New Zealand': 'APAC',
  'Singapore': 'APAC',
  'Hong Kong': 'APAC',
  'Taiwan': 'APAC',
  'South Korea': 'APAC',
  'Malaysia': 'APAC',
  'Thailand': 'APAC',
  'Indonesia': 'APAC',
  'Philippines': 'APAC',
  'Vietnam': 'APAC',
};

const COUNTRY_TO_TIMEZONE: Record<string, string> = {
  'United States': 'America/New_York',
  'Canada': 'America/Toronto',
  'Mexico': 'America/Mexico_City',
  'Brazil': 'America/Sao_Paulo',
  'Argentina': 'America/Buenos_Aires',
  'Chile': 'America/Santiago',
  'Colombia': 'America/Bogota',
  'United Kingdom': 'Europe/London',
  'Germany': 'Europe/Berlin',
  'France': 'Europe/Paris',
  'Italy': 'Europe/Rome',
  'Spain': 'Europe/Madrid',
  'Netherlands': 'Europe/Amsterdam',
  'Belgium': 'Europe/Brussels',
  'Austria': 'Europe/Vienna',
  'Switzerland': 'Europe/Zurich',
  'Sweden': 'Europe/Stockholm',
  'Norway': 'Europe/Oslo',
  'Denmark': 'Europe/Copenhagen',
  'Finland': 'Europe/Helsinki',
  'Poland': 'Europe/Warsaw',
  'Czech Republic': 'Europe/Prague',
  'Portugal': 'Europe/Lisbon',
  'Ireland': 'Europe/Dublin',
  'Russia': 'Europe/Moscow',
  'Ukraine': 'Europe/Kiev',
  'Turkey': 'Europe/Istanbul',
  'Japan': 'Asia/Tokyo',
  'China': 'Asia/Shanghai',
  'India': 'Asia/Kolkata',
  'Australia': 'Australia/Sydney',
  'New Zealand': 'Pacific/Auckland',
  'Singapore': 'Asia/Singapore',
  'Hong Kong': 'Asia/Hong_Kong',
  'Taiwan': 'Asia/Taipei',
  'South Korea': 'Asia/Seoul',
  'Malaysia': 'Asia/Kuala_Lumpur',
  'Thailand': 'Asia/Bangkok',
  'Indonesia': 'Asia/Jakarta',
  'Philippines': 'Asia/Manila',
  'Vietnam': 'Asia/Ho_Chi_Minh',
  'South Africa': 'Africa/Johannesburg',
  'United Arab Emirates': 'Asia/Dubai',
  'Saudi Arabia': 'Asia/Riyadh',
  'Israel': 'Asia/Jerusalem',
  'Egypt': 'Africa/Cairo',
  'Nigeria': 'Africa/Lagos',
  'Kenya': 'Africa/Nairobi',
};

export function detectGeoFromEmail(email: string | null | undefined): { country: string | null; confidence: number } {
  if (!email) return { country: null, confidence: 0 };
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return { country: null, confidence: 0 };
  
  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  const secondLevel = parts.length >= 2 ? `${parts[parts.length - 2]}.${tld}` : null;
  
  if (secondLevel && EMAIL_TLD_TO_COUNTRY[secondLevel]) {
    return { country: EMAIL_TLD_TO_COUNTRY[secondLevel], confidence: 0.7 };
  }
  
  if (EMAIL_TLD_TO_COUNTRY[tld]) {
    return { country: EMAIL_TLD_TO_COUNTRY[tld], confidence: 0.6 };
  }
  
  return { country: null, confidence: 0 };
}

export function detectGeoFromPhone(phone: string | null | undefined): { country: string | null; countryCode: string | null; confidence: number } {
  if (!phone) return { country: null, countryCode: null, confidence: 0 };
  
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 7) return { country: null, countryCode: null, confidence: 0 };
  
  for (const prefix of ['971', '966', '972', '852', '886', '420', '358', '351', '353', '380', '234', '254']) {
    if (cleaned.startsWith(prefix)) {
      const match = PHONE_PREFIX_TO_COUNTRY[prefix];
      return { country: match.country, countryCode: match.code, confidence: 0.9 };
    }
  }
  
  for (const prefix of ['44', '49', '33', '34', '39', '31', '32', '43', '41', '46', '47', '45', '48', '81', '86', '91', '61', '64', '65', '82', '60', '66', '62', '63', '84', '55', '52', '54', '56', '57', '27', '90', '20']) {
    if (cleaned.startsWith(prefix)) {
      const match = PHONE_PREFIX_TO_COUNTRY[prefix];
      return { country: match.country, countryCode: match.code, confidence: 0.9 };
    }
  }
  
  if (cleaned.startsWith('1') && cleaned.length >= 10) {
    return { country: 'United States', countryCode: '+1', confidence: 0.7 };
  }
  
  if (cleaned.startsWith('7') && cleaned.length >= 10) {
    return { country: 'Russia', countryCode: '+7', confidence: 0.8 };
  }
  
  return { country: null, countryCode: null, confidence: 0 };
}

export function detectGeoFromCompanyAddress(address: string | null | undefined, city: string | null | undefined, state: string | null | undefined, existingCountry: string | null | undefined): { country: string | null; confidence: number } {
  if (existingCountry) {
    return { country: existingCountry, confidence: 1.0 };
  }
  
  const combinedText = [address, city, state].filter(Boolean).join(' ').toLowerCase();
  
  const countryPatterns: Record<string, string[]> = {
    'United States': ['usa', 'u.s.a', 'united states', 'california', 'new york', 'texas', 'florida', 'washington', 'illinois', 'ohio', 'pennsylvania'],
    'United Kingdom': ['uk', 'u.k', 'united kingdom', 'england', 'london', 'manchester', 'birmingham', 'scotland', 'wales'],
    'Germany': ['germany', 'deutschland', 'berlin', 'munich', 'münchen', 'frankfurt', 'hamburg'],
    'France': ['france', 'paris', 'lyon', 'marseille'],
    'Canada': ['canada', 'toronto', 'vancouver', 'montreal', 'ontario', 'british columbia', 'quebec'],
    'Australia': ['australia', 'sydney', 'melbourne', 'brisbane', 'perth'],
    'India': ['india', 'mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai'],
    'Japan': ['japan', 'tokyo', 'osaka', 'kyoto'],
    'China': ['china', 'beijing', 'shanghai', 'shenzhen', 'guangzhou'],
    'Singapore': ['singapore'],
  };
  
  for (const [country, patterns] of Object.entries(countryPatterns)) {
    if (patterns.some(pattern => combinedText.includes(pattern))) {
      return { country, confidence: 0.8 };
    }
  }
  
  return { country: null, confidence: 0 };
}

export function detectGeo(data: {
  email?: string | null;
  mobilePhone?: string | null;
  otherPhone?: string | null;
  companyAddress?: string | null;
  companyCity?: string | null;
  companyState?: string | null;
  companyCountry?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): GeoDetectionResult {
  const sources: string[] = [];
  const candidates: { country: string; confidence: number; source: string }[] = [];
  
  if (data.country) {
    candidates.push({ country: data.country, confidence: 1.0, source: 'explicit_country' });
    sources.push('explicit_country');
  }
  
  if (data.companyCountry) {
    candidates.push({ country: data.companyCountry, confidence: 0.95, source: 'company_country' });
    sources.push('company_country');
  }
  
  const phoneResult = detectGeoFromPhone(data.mobilePhone || data.otherPhone);
  if (phoneResult.country) {
    candidates.push({ country: phoneResult.country, confidence: phoneResult.confidence, source: 'phone' });
    sources.push('phone');
  }
  
  const addressResult = detectGeoFromCompanyAddress(data.companyAddress, data.companyCity || data.city, data.companyState || data.state, null);
  if (addressResult.country) {
    candidates.push({ country: addressResult.country, confidence: addressResult.confidence, source: 'address' });
    sources.push('address');
  }
  
  const emailResult = detectGeoFromEmail(data.email);
  if (emailResult.country) {
    candidates.push({ country: emailResult.country, confidence: emailResult.confidence, source: 'email_tld' });
    sources.push('email_tld');
  }
  
  if (candidates.length === 0) {
    return {
      country: null,
      countryCode: phoneResult.countryCode,
      region: null,
      timezone: null,
      confidence: 0,
      sources: [],
    };
  }
  
  candidates.sort((a, b) => b.confidence - a.confidence);
  const bestMatch = candidates[0];
  
  const agreementBonus = candidates.filter(c => c.country === bestMatch.country).length > 1 ? 0.1 : 0;
  const finalConfidence = Math.min(bestMatch.confidence + agreementBonus, 1.0);
  
  return {
    country: bestMatch.country,
    countryCode: phoneResult.countryCode,
    region: COUNTRY_TO_REGION[bestMatch.country] || null,
    timezone: COUNTRY_TO_TIMEZONE[bestMatch.country] || null,
    confidence: finalConfidence,
    sources,
  };
}

export function getRegionFromCountry(country: string): string | null {
  return COUNTRY_TO_REGION[country] || null;
}

export function getTimezoneFromCountry(country: string): string | null {
  return COUNTRY_TO_TIMEZONE[country] || null;
}
