import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AutoMappingProps {
  headers: string[];
  autoMapping: Record<string, string>;
  confidence: Record<string, number>;
  suggestions: Record<string, Array<{ field: string; confidence: number }>>;
  preview: Record<string, string>[];
  onMappingChange: (mapping: Record<string, string>) => void;
  onConfirm: () => void;
}

const availableFields = [
  { value: 'fullName', label: 'Full Name' },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'mobilePhone', label: 'Mobile Phone' },
  { value: 'homePhone', label: 'Home Phone' },
  { value: 'company', label: 'Company' },
  { value: 'title', label: 'Job Title' },
  { value: 'industry', label: 'Industry' },
  { value: 'city', label: 'City' },
  { value: 'country', label: 'Country' },
  { value: 'website', label: 'Website' },
];

export function AutoMapping({ 
  headers, 
  autoMapping, 
  confidence, 
  suggestions, 
  preview, 
  onMappingChange, 
  onConfirm 
}: AutoMappingProps) {
  const [currentMapping, setCurrentMapping] = useState<Record<string, string>>(autoMapping);

  const handleFieldChange = (header: string, field: string) => {
    const newMapping = { ...currentMapping };
    if (field === 'none') {
      delete newMapping[header];
    } else {
      newMapping[header] = field;
    }
    setCurrentMapping(newMapping);
    onMappingChange(newMapping);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const mappedFieldsCount = Object.keys(currentMapping).length;
  const highConfidenceCount = Object.entries(confidence).filter(([header, conf]) => 
    currentMapping[header] && conf >= 0.8
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            🤖 Automatic Field Mapping
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Our custom NLP model has automatically mapped {mappedFieldsCount} fields with {highConfidenceCount} high-confidence matches
          </p>
        </div>
        <Button 
          onClick={onConfirm}
          disabled={mappedFieldsCount === 0}
          data-testid="button-confirm-mapping"
        >
          Confirm Mapping
        </Button>
      </div>

      <Alert>
        <AlertDescription>
          ✨ <strong>Smart Mapping:</strong> We analyzed your CSV headers using pattern recognition, 
          semantic similarity, and contextual analysis. Review and adjust the mappings below.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {headers.map((header) => {
          const mappedField = currentMapping[header];
          const conf = confidence[header] || 0;
          const headerSuggestions = suggestions[header] || [];

          return (
            <Card key={header} className="border border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  {/* CSV Header */}
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-200">
                      {header}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      CSV Header
                    </div>
                  </div>

                  {/* Field Mapping */}
                  <div>
                    <Select
                      value={mappedField || 'none'}
                      onValueChange={(value) => handleFieldChange(header, value)}
                    >
                      <SelectTrigger data-testid={`select-field-${header}`}>
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Don't import</SelectItem>
                        {availableFields.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Confidence Score */}
                  <div>
                    {mappedField && (
                      <Badge className={getConfidenceColor(conf)}>
                        {getConfidenceLabel(conf)} ({Math.round(conf * 100)}%)
                      </Badge>
                    )}
                  </div>

                  {/* Preview Data */}
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {preview[0]?.[header] || 'No data'}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Sample data
                    </div>
                  </div>
                </div>

                {/* Suggestions for low confidence mappings */}
                {headerSuggestions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-600">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Alternative suggestions:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {headerSuggestions.slice(0, 3).map((suggestion) => (
                        <button
                          key={suggestion.field}
                          onClick={() => handleFieldChange(header, suggestion.field)}
                          className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                          data-testid={`suggestion-${header}-${suggestion.field}`}
                        >
                          {availableFields.find(f => f.value === suggestion.field)?.label} 
                          ({Math.round(suggestion.confidence * 100)}%)
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Preview Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {Object.keys(currentMapping).map((header) => (
                    <th key={header} className="text-left p-2 font-medium text-gray-700 dark:text-gray-300">
                      {availableFields.find(f => f.value === currentMapping[header])?.label || currentMapping[header]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 3).map((row, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                    {Object.keys(currentMapping).map((header) => (
                      <td key={header} className="p-2 text-gray-600 dark:text-gray-400">
                        {row[header] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}