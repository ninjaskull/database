import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { FieldMapping } from "./field-mapping";
import { parseCSV } from "@/lib/csv-parser";
import { apiRequest } from "@/lib/queryClient";

type ImportStep = 'upload' | 'mapping' | 'progress' | 'complete';

export function ImportModal() {
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: any[][] } | null>(null);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importOptions, setImportOptions] = useState({
    skipDuplicates: true,
    updateExisting: true,
    autoEnrich: true,
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: importJob } = useQuery({
    queryKey: ['/api/import', jobId],
    enabled: !!jobId && step === 'progress',
    refetchInterval: 1000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest('POST', '/api/import', formData);
      return await response.json();
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStep('progress');
      toast({
        title: "Import started",
        description: "Your CSV file is being processed.",
      });
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "There was an error uploading your file.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please select a CSV file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast({
        title: "File too large",
        description: "Please select a file smaller than 50MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      const parsed = await parseCSV(file);
      setCsvData(parsed);
      setStep('mapping');
      
      // Auto-map common fields
      const autoMapping: Record<string, string> = {};
      parsed.headers.forEach(header => {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes('name') && !lowerHeader.includes('first') && !lowerHeader.includes('last')) {
          autoMapping[header] = 'fullName';
        } else if (lowerHeader.includes('first') && lowerHeader.includes('name')) {
          autoMapping[header] = 'firstName';
        } else if (lowerHeader.includes('last') && lowerHeader.includes('name')) {
          autoMapping[header] = 'lastName';
        } else if (lowerHeader.includes('email')) {
          autoMapping[header] = 'email';
        } else if (lowerHeader.includes('company')) {
          autoMapping[header] = 'company';
        } else if (lowerHeader.includes('title')) {
          autoMapping[header] = 'title';
        } else if (lowerHeader.includes('phone') || lowerHeader.includes('mobile')) {
          autoMapping[header] = 'mobilePhone';
        } else if (lowerHeader.includes('industry')) {
          autoMapping[header] = 'industry';
        }
      });
      setFieldMapping(autoMapping);
    } catch (error) {
      toast({
        title: "Parse error",
        description: "There was an error reading your CSV file.",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const startImport = () => {
    if (!csvData) return;

    const formData = new FormData();
    const csvContent = [
      csvData.headers.join(','),
      ...csvData.rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    formData.append('csv', blob, 'import.csv');
    formData.append('fieldMapping', JSON.stringify(fieldMapping));
    formData.append('options', JSON.stringify(importOptions));

    uploadMutation.mutate(formData);
  };

  const resetImport = () => {
    setStep('upload');
    setCsvData(null);
    setFieldMapping({});
    setJobId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Check if import is complete
  if (importJob?.status === 'completed' && step === 'progress') {
    queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    setStep('complete');
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800 dark:text-gray-200">
          Import Contacts from CSV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 'upload' && (
          <div>
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 dark:text-gray-500 mb-4"></i>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                <p className="mb-2">Drag and drop your CSV file here, or</p>
                <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                  browse to choose a file
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">Support for CSV files up to 50MB</p>
            </div>
          </div>
        )}

        {step === 'mapping' && csvData && (
          <div>
            <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
              Map CSV Columns to Database Fields
            </h4>
            <FieldMapping
              csvHeaders={csvData.headers}
              csvRows={csvData.rows}
              fieldMapping={fieldMapping}
              onFieldMappingChange={setFieldMapping}
            />
            
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Import Options</h5>
              <div className="space-y-2">
                <label className="flex items-center">
                  <Checkbox
                    checked={importOptions.skipDuplicates}
                    onCheckedChange={(checked) => 
                      setImportOptions(prev => ({ ...prev, skipDuplicates: !!checked }))
                    }
                  />
                  <span className="ml-2 text-sm text-gray-800 dark:text-gray-200">Skip duplicate contacts</span>
                </label>
                <label className="flex items-center">
                  <Checkbox
                    checked={importOptions.updateExisting}
                    onCheckedChange={(checked) => 
                      setImportOptions(prev => ({ ...prev, updateExisting: !!checked }))
                    }
                  />
                  <span className="ml-2 text-sm text-gray-800 dark:text-gray-200">Update existing contacts with new data</span>
                </label>
                <label className="flex items-center">
                  <Checkbox
                    checked={importOptions.autoEnrich}
                    onCheckedChange={(checked) => 
                      setImportOptions(prev => ({ ...prev, autoEnrich: !!checked }))
                    }
                  />
                  <span className="ml-2 text-sm text-gray-800 dark:text-gray-200">Auto-enrich contact data</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {step === 'progress' && (
          <div>
            <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
              Importing Contacts...
            </h4>
            <Progress 
              value={(importJob?.processedRows || 0) / (importJob?.totalRows || 1) * 100} 
              className="w-full mb-4" 
            />
            <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
              <p>Processing {importJob?.processedRows || 0} of {importJob?.totalRows || 0} contacts...</p>
              <p className="mt-2">
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {importJob?.successfulRows || 0} successful
                </span>
                {' | '}
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {importJob?.errorRows || 0} errors
                </span>
                {' | '}
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                  {importJob?.duplicateRows || 0} duplicates
                </span>
              </p>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center">
            <div className="mb-4">
              <i className="fas fa-check-circle text-4xl text-green-500 mb-2"></i>
              <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200">Import Complete!</h4>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p className="mb-2">Successfully processed {importJob?.totalRows || 0} contacts</p>
              <p>
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {importJob?.successfulRows || 0} imported
                </span>
                {' • '}
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {importJob?.errorRows || 0} errors
                </span>
                {' • '}
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                  {importJob?.duplicateRows || 0} duplicates skipped
                </span>
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={startImport} className="bg-blue-600 hover:bg-blue-700 text-white">
                Import Contacts
              </Button>
            </>
          )}
          {(step === 'complete' || step === 'progress') && (
            <Button onClick={resetImport}>
              Import Another File
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
