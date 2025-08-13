import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FieldMappingProps {
  headers: string[];
  data: any[];
  mapping: Record<string, string>;
  onChange: (mapping: Record<string, string>) => void;
}

const databaseFields = [
  // Personal Information
  { value: 'fullName', label: 'Full Name', category: 'Personal' },
  { value: 'firstName', label: 'First Name', category: 'Personal' },
  { value: 'lastName', label: 'Last Name', category: 'Personal' },
  { value: 'title', label: 'Job Title', category: 'Personal' },
  { value: 'email', label: 'Email', category: 'Personal' },
  
  // Phone Numbers
  { value: 'mobilePhone', label: 'Mobile Phone', category: 'Phone' },
  { value: 'otherPhone', label: 'Other Phone', category: 'Phone' },
  { value: 'homePhone', label: 'Home Phone', category: 'Phone' },
  { value: 'corporatePhone', label: 'Corporate Phone', category: 'Phone' },
  
  // Company Information
  { value: 'company', label: 'Company', category: 'Company' },
  { value: 'employees', label: 'Number of Employees', category: 'Company' },
  { value: 'employeeSizeBracket', label: 'Employee Size Bracket', category: 'Company' },
  { value: 'industry', label: 'Industry', category: 'Company' },
  { value: 'website', label: 'Company Website', category: 'Company' },
  { value: 'companyLinkedIn', label: 'Company LinkedIn', category: 'Company' },
  { value: 'technologies', label: 'Technologies', category: 'Company' },
  { value: 'annualRevenue', label: 'Annual Revenue', category: 'Company' },
  
  // Social Media & URLs
  { value: 'personLinkedIn', label: 'Person LinkedIn', category: 'Social' },
  
  // Location Information
  { value: 'city', label: 'City', category: 'Location' },
  { value: 'state', label: 'State', category: 'Location' },
  { value: 'country', label: 'Country', category: 'Location' },
  
  // Company Location
  { value: 'companyAddress', label: 'Company Address', category: 'Company Location' },
  { value: 'companyCity', label: 'Company City', category: 'Company Location' },
  { value: 'companyState', label: 'Company State', category: 'Company Location' },
  { value: 'companyCountry', label: 'Company Country', category: 'Company Location' },
  
  // Auto-enriched Fields (optional mapping)
  { value: 'emailDomain', label: 'Email Domain', category: 'Auto-Enriched' },
  { value: 'countryCode', label: 'Country Code', category: 'Auto-Enriched' },
  { value: 'timezone', label: 'Timezone', category: 'Auto-Enriched' },
  { value: 'leadScore', label: 'Lead Score', category: 'Auto-Enriched' },
  { value: 'companyAge', label: 'Company Age', category: 'Auto-Enriched' },
  { value: 'technologyCategory', label: 'Technology Category', category: 'Auto-Enriched' },
  { value: 'region', label: 'Region', category: 'Auto-Enriched' },
  { value: 'businessType', label: 'Business Type', category: 'Auto-Enriched' },
];

export function FieldMapping({ headers, data, mapping, onChange }: FieldMappingProps) {
  const updateMapping = (csvHeader: string, dbField: string) => {
    const newMapping = { ...mapping };
    if (dbField === 'skip') {
      delete newMapping[csvHeader];
    } else {
      newMapping[csvHeader] = dbField;
    }
    onChange(newMapping);
  };

  const getSampleData = (header: string) => {
    const samples = data.slice(0, 3).map(row => row[header]).filter(Boolean);
    return samples.length > 0 ? samples.join(', ') + '...' : 'No data';
  };

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto">
      {headers.map((header) => (
        <div key={header} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-600">
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{header}</span>
            <div className="text-xs text-gray-600 dark:text-gray-400">{getSampleData(header)}</div>
          </div>
          <div className="flex-1 max-w-xs ml-4">
            <Select 
              value={mapping[header] || 'skip'} 
              onValueChange={(value) => updateMapping(header, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="-- Skip Column --" />
              </SelectTrigger>
              <SelectContent className="max-h-96 overflow-y-auto" position="popper" sideOffset={4}>
                <SelectItem value="skip">🚫 Don't Import</SelectItem>
                
                {/* Personal Information */}
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Personal</div>
                {databaseFields.filter(f => f.category === 'Personal').map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                    {mapping[header] === field.value && ' ✅'}
                  </SelectItem>
                ))}
                
                {/* Phone Numbers */}
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone Numbers</div>
                {databaseFields.filter(f => f.category === 'Phone').map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                    {mapping[header] === field.value && ' ✅'}
                  </SelectItem>
                ))}
                
                {/* Company Information */}
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</div>
                {databaseFields.filter(f => f.category === 'Company').map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                    {mapping[header] === field.value && ' ✅'}
                  </SelectItem>
                ))}
                
                {/* Social Media & URLs */}
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Social Media & URLs</div>
                {databaseFields.filter(f => f.category === 'Social').map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                    {mapping[header] === field.value && ' ✅'}
                  </SelectItem>
                ))}
                
                {/* Location */}
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</div>
                {databaseFields.filter(f => f.category === 'Location').map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                    {mapping[header] === field.value && ' ✅'}
                  </SelectItem>
                ))}
                
                {/* Company Location */}
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company Location</div>
                {databaseFields.filter(f => f.category === 'Company Location').map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                    {mapping[header] === field.value && ' ✅'}
                  </SelectItem>
                ))}
                
                {/* Auto-Enriched (Optional) */}
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Auto-Enriched</div>
                {databaseFields.filter(f => f.category === 'Auto-Enriched').map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                    {mapping[header] === field.value && ' ✅'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}