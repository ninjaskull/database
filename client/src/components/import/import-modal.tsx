import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { FieldMapping } from "./field-mapping";
import { AutoMapping } from "./auto-mapping";
import { AdvancedUploader } from "./advanced-uploader";
import { PerformanceMetrics } from "./performance-metrics";
import { apiRequest } from "@/lib/queryClient";
import type { ImportJob } from "@shared/schema";

type ImportStep = 'upload' | 'auto-mapping' | 'mapping' | 'progress' | 'complete';

export function ImportModal() {
  const [step, setStep] = useState<ImportStep>('upload');
  // Removed csvData state - now using direct file processing with temp files
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [autoMappingData, setAutoMappingData] = useState<any>(null);
  const [importOptions, setImportOptions] = useState({
    skipDuplicates: true,
    updateExisting: true,
    autoEnrich: true,
  });
  const [jobId, setJobId] = useState<string | null>(null);
  // Removed fileInputRef - now handled by AdvancedUploader component
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: importJob } = useQuery<ImportJob>({
    queryKey: ['import', jobId],
    queryFn: async () => {
      const response = await fetch(`/api/import/${jobId}`);
      if (!response.ok) throw new Error('Failed to fetch import status');
      return response.json();
    },
    enabled: !!jobId && step === 'progress',
    refetchInterval: 1000,
  });

  // Auto-mapping now handled by AdvancedUploader component

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }
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

  // File handling now managed by AdvancedUploader component

  const startImport = () => {
    if (!autoMappingData) return;

    // Use the temp file from auto-mapping for ultra-fast processing
    const formData = new FormData();
    
    // Create a reference to the already uploaded file
    const tempFileRef = new Blob([autoMappingData.tempFile], { type: 'text/plain' });
    formData.append('csv', tempFileRef, autoMappingData.tempFile);
    formData.append('fieldMapping', JSON.stringify(fieldMapping));
    formData.append('options', JSON.stringify(importOptions));

    uploadMutation.mutate(formData);
  };

  const resetImport = () => {
    setStep('upload');
    setFieldMapping({});
    setAutoMappingData(null);
    setJobId(null);
  };

  // Check if import is complete
  if (importJob?.status === 'completed' && step === 'progress') {
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
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
          <AdvancedUploader
            onFileAnalyzed={(data) => {
              setAutoMappingData(data);
              setFieldMapping(data.autoMapping);
              setStep('auto-mapping');
            }}
            maxSize={100 * 1024 * 1024} // 100MB for ultra-fast processing
            acceptedTypes={['.csv']}
          />
        )}

        {step === 'auto-mapping' && autoMappingData && (
          <AutoMapping
            headers={autoMappingData.headers}
            autoMapping={autoMappingData.autoMapping}
            confidence={autoMappingData.confidence}
            suggestions={autoMappingData.suggestions}
            preview={autoMappingData.preview}
            onMappingChange={setFieldMapping}
            onConfirm={() => setStep('mapping')}
          />
        )}

        {step === 'mapping' && autoMappingData && (
          <div>
            <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
              Map CSV Columns to Database Fields
            </h4>
            <FieldMapping
              headers={autoMappingData.headers}
              mapping={fieldMapping}
              onChange={setFieldMapping}
              data={autoMappingData.preview}
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
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-lg font-medium text-gray-800 dark:text-gray-200">
                {importJob?.status === 'completed' ? '🚀 Ultra-Fast Import Completed' : '⚡ Advanced Processing...'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {importJob?.filename}
              </div>
            </div>

            <PerformanceMetrics 
              importJob={importJob}
              estimatedTime={autoMappingData?.estimatedProcessingTime}
              actualTime={importJob?.completedAt && importJob?.createdAt ? 
                Math.round((new Date(importJob.completedAt).getTime() - new Date(importJob.createdAt).getTime()) / 1000) : undefined
              }
            />
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
