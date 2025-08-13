import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FieldMappingProps {
  csvHeaders: string[];
  csvRows: any[][];
  fieldMapping: Record<string, string>;
  onFieldMappingChange: (mapping: Record<string, string>) => void;
}

const databaseFields = [
  { value: 'fullName', label: 'Full Name' },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'title', label: 'Title' },
  { value: 'company', label: 'Company' },
  { value: 'email', label: 'Email' },
  { value: 'mobilePhone', label: 'Mobile Phone' },
  { value: 'otherPhone', label: 'Other Phone' },
  { value: 'homePhone', label: 'Home Phone' },
  { value: 'corporatePhone', label: 'Corporate Phone' },
  { value: 'employees', label: 'Employees (Number)' },
  { value: 'employeeSizeBracket', label: 'Employee Size Bracket' },
  { value: 'industry', label: 'Industry' },
  { value: 'personLinkedIn', label: 'Person LinkedIn URL' },
  { value: 'website', label: 'Website' },
  { value: 'companyLinkedIn', label: 'Company LinkedIn URL' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'country', label: 'Country' },
  { value: 'companyAddress', label: 'Company Address' },
  { value: 'companyCity', label: 'Company City' },
  { value: 'companyState', label: 'Company State' },
  { value: 'companyCountry', label: 'Company Country' },
  { value: 'technologies', label: 'Technologies' },
  { value: 'annualRevenue', label: 'Annual Revenue' },
];

export function FieldMapping({ csvHeaders, csvRows, fieldMapping, onFieldMappingChange }: FieldMappingProps) {
  const updateMapping = (csvHeader: string, dbField: string) => {
    const newMapping = { ...fieldMapping };
    if (dbField === 'skip') {
      delete newMapping[csvHeader];
    } else {
      newMapping[csvHeader] = dbField;
    }
    onFieldMappingChange(newMapping);
  };

  const getSampleData = (headerIndex: number) => {
    const samples = csvRows.slice(0, 3).map(row => row[headerIndex]).filter(Boolean);
    return samples.length > 0 ? samples.join(', ') + '...' : 'No data';
  };

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {csvHeaders.map((header, index) => (
        <div key={header} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-600">
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{header}</span>
            <div className="text-xs text-gray-600 dark:text-gray-400">{getSampleData(index)}</div>
          </div>
          <div className="flex-1 max-w-xs ml-4">
            <Select 
              value={fieldMapping[header] || 'skip'} 
              onValueChange={(value) => updateMapping(header, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="-- Skip Column --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">-- Skip Column --</SelectItem>
                {databaseFields.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                    {fieldMapping[header] === field.value && ' ✓'}
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