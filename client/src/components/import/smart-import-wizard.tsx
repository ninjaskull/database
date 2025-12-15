import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Settings, CheckCircle, AlertCircle, MapPin, Zap, Database, Wifi, WifiOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useImportProgress } from "@/lib/ws-import-progress";
import type { ImportJob } from "@shared/schema";

type ImportStep = 'upload' | 'mapping' | 'options' | 'progress' | 'complete';

interface FieldMapping {
  csvHeader: string;
  dbField: string;
  confidence: number;
  sample: string;
  suggestions: Array<{ field: string; confidence: number; label: string }>;
}

const databaseFields = [
  // Personal Information
  { value: 'fullName', label: 'Full Name', category: 'Personal', icon: '👤' },
  { value: 'firstName', label: 'First Name', category: 'Personal', icon: '👤' },
  { value: 'lastName', label: 'Last Name', category: 'Personal', icon: '👤' },
  { value: 'title', label: 'Job Title', category: 'Personal', icon: '💼' },
  { value: 'email', label: 'Email', category: 'Personal', icon: '📧' },
  
  // Phone Numbers
  { value: 'mobilePhone', label: 'Mobile Phone', category: 'Phone', icon: '📱' },
  { value: 'otherPhone', label: 'Other Phone', category: 'Phone', icon: '📞' },
  { value: 'homePhone', label: 'Home Phone', category: 'Phone', icon: '🏠' },
  { value: 'corporatePhone', label: 'Corporate Phone', category: 'Phone', icon: '🏢' },
  
  // Company Information
  { value: 'company', label: 'Company', category: 'Company', icon: '🏢' },
  { value: 'employees', label: 'Number of Employees', category: 'Company', icon: '👥' },
  { value: 'employeeSizeBracket', label: 'Employee Size Bracket', category: 'Company', icon: '📊' },
  { value: 'industry', label: 'Industry', category: 'Company', icon: '🏭' },
  { value: 'website', label: 'Company Website', category: 'Company', icon: '🌐' },
  { value: 'companyLinkedIn', label: 'Company LinkedIn', category: 'Company', icon: '💼' },
  { value: 'technologies', label: 'Technologies', category: 'Company', icon: '⚙️' },
  { value: 'annualRevenue', label: 'Annual Revenue', category: 'Company', icon: '💰' },
  
  // Social Media & URLs
  { value: 'personLinkedIn', label: 'Person LinkedIn', category: 'Social', icon: '💼' },
  
  // Location Information
  { value: 'city', label: 'City', category: 'Location', icon: '🏙️' },
  { value: 'state', label: 'State', category: 'Location', icon: '📍' },
  { value: 'country', label: 'Country', category: 'Location', icon: '🌍' },
  
  // Company Location
  { value: 'companyAddress', label: 'Company Address', category: 'Company Location', icon: '📍' },
  { value: 'companyCity', label: 'Company City', category: 'Company Location', icon: '🏙️' },
  { value: 'companyState', label: 'Company State', category: 'Company Location', icon: '📍' },
  { value: 'companyCountry', label: 'Company Country', category: 'Company Location', icon: '🌍' },
  
  // Auto-enriched Fields
  { value: 'emailDomain', label: 'Email Domain', category: 'Auto-Enriched', icon: '🤖' },
  { value: 'countryCode', label: 'Country Code', category: 'Auto-Enriched', icon: '🤖' },
  { value: 'timezone', label: 'Timezone', category: 'Auto-Enriched', icon: '🤖' },
  { value: 'leadScore', label: 'Lead Score', category: 'Auto-Enriched', icon: '🤖' },
  { value: 'companyAge', label: 'Company Age', category: 'Auto-Enriched', icon: '🤖' },
  { value: 'technologyCategory', label: 'Technology Category', category: 'Auto-Enriched', icon: '🤖' },
  { value: 'region', label: 'Region', category: 'Auto-Enriched', icon: '🤖' },
  { value: 'businessType', label: 'Business Type', category: 'Auto-Enriched', icon: '🤖' },
];

const fieldsByCategory = databaseFields.reduce((acc, field) => {
  if (!acc[field.category]) acc[field.category] = [];
  acc[field.category].push(field);
  return acc;
}, {} as Record<string, typeof databaseFields>);

export function SmartImportWizard() {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [finalMapping, setFinalMapping] = useState<Record<string, string>>({});
  const [importOptions, setImportOptions] = useState({
    skipDuplicates: true,
    updateExisting: true,
    autoEnrich: true,
    batchSize: 100,
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // WebSocket-based real-time progress tracking with polling fallback
  // Subscribe as soon as jobId is available (not waiting for step change)
  const wsProgress = useImportProgress({
    jobId: jobId,
    onComplete: () => {
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({
        title: "Import complete",
        description: `Successfully imported contacts`,
      });
    },
    onError: (event) => {
      toast({
        title: "Import failed",
        description: event.message || "An error occurred during import",
        variant: "destructive",
      });
    },
    fallbackPollingInterval: 1000, // Faster polling for better responsiveness
    startPollingImmediately: true, // Start polling right away
  });

  // Also keep the query for the complete step to show final stats
  const { data: importJob } = useQuery<ImportJob>({
    queryKey: ['import', jobId],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`/api/import/${jobId}`, {
        credentials: 'include',
        headers,
      });
      if (!response.ok) throw new Error('Failed to fetch import status');
      return response.json();
    },
    enabled: !!jobId && (step === 'complete' || (step === 'progress' && !wsProgress.isConnected)),
    refetchInterval: step === 'progress' ? 2000 : false,
  });

  // Transition to complete step when WebSocket reports completion
  useEffect(() => {
    if (wsProgress.isComplete && step === 'progress') {
      setStep('complete');
    }
  }, [wsProgress.isComplete, step]);

  const autoMapMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('csv', file);  // Backend expects 'csv' field name
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch('/api/import/auto-map', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers,
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Auto-mapping failed:', response.status, errorText);
        throw new Error(`Auto-mapping failed: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Auto-mapping response:', data);
      console.log('Current step before processing:', step);
      
      if (!data.headers || !Array.isArray(data.headers)) {
        console.error('Invalid response structure:', data);
        toast({
          title: "Error",
          description: "Invalid response from server",
          variant: "destructive",
        });
        return;
      }
      
      const mappings: FieldMapping[] = data.headers.map((header: string) => {
        const dbField = data.autoMapping?.[header] || data.mapping?.[header];
        const confidence = data.confidence?.[header] || 0;
        const suggestions = data.suggestions?.[header] || [];
        const sample = data.preview?.[0]?.[header] || '';
        
        return {
          csvHeader: header,
          dbField: dbField || 'skip',
          confidence,
          sample,
          suggestions,
        };
      });
      
      console.log('Generated mappings:', mappings);
      console.log('Final mapping object:', data.autoMapping || data.mapping || {});
      
      setFieldMappings(mappings);
      setFinalMapping(data.autoMapping || data.mapping || {});
      
      // Force step change
      console.log('Setting step to mapping...');
      setStep('mapping');
      
      console.log('Step after setting:', step);
      
      toast({
        title: "Smart mapping complete",
        description: `Automatically mapped ${Object.keys(data.autoMapping || data.mapping || {}).length} fields`,
      });
    },
    onError: (error) => {
      console.error('Auto-mapping error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to process file",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected');
      
      const formData = new FormData();
      formData.append('csv', file);  // Backend expects 'csv' field name
      formData.append('fieldMapping', JSON.stringify(finalMapping));
      formData.append('options', JSON.stringify(importOptions));
      
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Import failed:', response.status, errorText);
        throw new Error(`Import failed: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStep('progress');
      toast({
        title: "Import started",
        description: "Processing your contacts...",
      });
    },
  });

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    autoMapMutation.mutate(selectedFile);
  }, [autoMapMutation]);

  const handleMappingChange = (index: number, newField: string) => {
    const updatedMappings = [...fieldMappings];
    updatedMappings[index].dbField = newField;
    setFieldMappings(updatedMappings);
    
    const newFinalMapping = { ...finalMapping };
    if (newField === 'skip') {
      delete newFinalMapping[updatedMappings[index].csvHeader];
    } else {
      newFinalMapping[updatedMappings[index].csvHeader] = newField;
    }
    setFinalMapping(newFinalMapping);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  };

  const startImport = () => {
    setStep('options');
  };

  const executeImport = () => {
    importMutation.mutate();
  };

  const resetWizard = () => {
    setStep('upload');
    setFile(null);
    setFieldMappings([]);
    setFinalMapping({});
    setJobId(null);
  };

  if (step === 'complete') {
    // Prefer WebSocket data if it has any progress, fallback to importJob
    // Use WS data if it has processed any rows OR if WS shows complete status
    const useWsData = wsProgress.processedRows > 0 || wsProgress.status === 'completed';
    const completeData = useWsData ? {
      successfulRows: wsProgress.successfulRows,
      duplicateRows: wsProgress.duplicateRows,
      errorRows: wsProgress.errorRows,
      totalRows: wsProgress.totalRows,
    } : importJob;

    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Import Complete!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {completeData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg" data-testid="complete-imported">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{completeData.successfulRows || 0}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Imported</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg" data-testid="complete-duplicates">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{completeData.duplicateRows || 0}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Duplicates</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg" data-testid="complete-errors">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{completeData.errorRows || 0}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Errors</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg" data-testid="complete-total">
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{completeData.totalRows || 0}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
              </div>
            </div>
          )}
          <Button onClick={resetWizard} size="lg" data-testid="button-import-another">
            Import Another File
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'progress') {
    const hasWsData = wsProgress.totalRows > 0 || wsProgress.processedRows > 0;
    const hasPollingData = importJob && ((importJob.totalRows ?? 0) > 0 || (importJob.processedRows ?? 0) > 0);
    
    const progressData = hasWsData ? {
      totalRows: wsProgress.totalRows,
      processedRows: wsProgress.processedRows,
      successfulRows: wsProgress.successfulRows,
      duplicateRows: wsProgress.duplicateRows,
      errorRows: wsProgress.errorRows,
      message: wsProgress.message,
      status: wsProgress.status,
    } : hasPollingData ? {
      totalRows: importJob.totalRows || 0,
      processedRows: importJob.processedRows || 0,
      successfulRows: importJob.successfulRows || 0,
      duplicateRows: importJob.duplicateRows || 0,
      errorRows: importJob.errorRows || 0,
      message: `Processing ${importJob.processedRows || 0} of ${importJob.totalRows || 0} rows...`,
      status: importJob.status,
    } : {
      totalRows: 0,
      processedRows: 0,
      successfulRows: 0,
      duplicateRows: 0,
      errorRows: 0,
      message: 'Initializing import...',
      status: 'pending',
    };
    
    const progressPercent = progressData.totalRows > 0 
      ? Math.round((progressData.processedRows / progressData.totalRows) * 100) 
      : 0;
    
    const statusMessage = progressData.message || 
      (progressData.processedRows > 0 
        ? `Processing ${progressData.processedRows.toLocaleString()} of ${progressData.totalRows.toLocaleString()} contacts...`
        : 'Starting import...');
    
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4 animate-pulse">
            <Database className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl">Processing Import</CardTitle>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mt-2">
            {wsProgress.isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span>Live updates</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-yellow-500" />
                <span>Updating...</span>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between text-sm font-medium">
              <span>{statusMessage}</span>
              <span className="text-blue-600">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-4" />
            <div className="text-center text-sm text-gray-500">
              {progressData.processedRows > 0 && (
                <span>{progressData.processedRows.toLocaleString()} / {progressData.totalRows.toLocaleString()} rows processed</span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg" data-testid="progress-processed">
              <div className="text-2xl font-bold">{progressData.processedRows.toLocaleString()}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Processed</div>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg" data-testid="progress-success">
              <div className="text-2xl font-bold text-green-600">{progressData.successfulRows.toLocaleString()}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Imported</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg" data-testid="progress-duplicates">
              <div className="text-2xl font-bold text-yellow-600">{progressData.duplicateRows.toLocaleString()}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Duplicates</div>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg" data-testid="progress-errors">
              <div className="text-2xl font-bold text-red-600">{progressData.errorRows.toLocaleString()}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Errors</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Debug Info */}
      <div className="text-xs text-gray-500 text-center">
        Current Step: {step} | Field Mappings: {fieldMappings.length} | Final Mapping Keys: {Object.keys(finalMapping).length}
      </div>
      
      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-8 mb-8">
        {[
          { key: 'upload', label: 'Upload', icon: Upload },
          { key: 'mapping', label: 'Smart Mapping', icon: MapPin },
          { key: 'options', label: 'Options', icon: Settings },
          { key: 'progress', label: 'Import', icon: CheckCircle },
        ].map((stepItem, index) => {
          const Icon = stepItem.icon;
          const isActive = step === stepItem.key;
          const isCompleted = ['upload', 'mapping', 'options'].indexOf(step) > ['upload', 'mapping', 'options'].indexOf(stepItem.key);
          
          return (
            <div key={stepItem.key} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                isActive 
                  ? 'border-blue-500 bg-blue-500 text-white' 
                  : isCompleted 
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-300 text-gray-400'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`ml-2 text-sm ${isActive ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                {stepItem.label}
              </span>
              {index < 3 && (
                <div className={`ml-4 w-8 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload CSV File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = Array.from(e.dataTransfer.files);
                const csvFile = files.find(f => f.name.endsWith('.csv'));
                if (csvFile) handleFileSelect(csvFile);
              }}
            >
              <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Drop your CSV file here
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                or click to browse and select a file
              </p>
              <Button variant="outline" disabled={autoMapMutation.isPending}>
                {autoMapMutation.isPending ? 'Processing...' : 'Select File'}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              data-testid="file-input-csv"
            />
          </CardContent>
        </Card>
      )}

      {/* Mapping Step */}
      {step === 'mapping' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Smart Field Mapping - Adjust Auto-Mapped Fields
                  <Badge variant="secondary">{Object.keys(finalMapping).length} mapped</Badge>
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Review and correct the automatically mapped fields below. High confidence mappings are shown in green.
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {fieldMappings.map((mapping, index) => (
                      <div key={mapping.csvHeader} className="grid grid-cols-3 gap-4 p-4 border rounded-lg items-center">
                        <div className="col-span-1">
                          <div className="font-medium text-sm">{mapping.csvHeader}</div>
                          <div className="text-xs text-gray-500 truncate">{mapping.sample}</div>
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getConfidenceColor(mapping.confidence)}`}
                          >
                            {Math.round(mapping.confidence * 100)}% confidence
                          </Badge>
                        </div>
                        <div className="col-span-1">
                          <Select
                            value={mapping.dbField}
                            onValueChange={(value) => handleMappingChange(index, value)}
                          >
                            <SelectTrigger className="w-full min-w-[200px]">
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-80 overflow-y-auto" position="popper" sideOffset={5}>
                              <SelectItem value="skip">🚫 Skip Column</SelectItem>
                              
                              {/* Personal Information */}
                              <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Personal</div>
                              {databaseFields.filter(f => f.category === 'Personal').map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  <span className="flex items-center gap-2">
                                    <span>{field.icon}</span>
                                    <span>{field.label}</span>
                                  </span>
                                </SelectItem>
                              ))}
                              
                              {/* Phone Numbers */}
                              <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone Numbers</div>
                              {databaseFields.filter(f => f.category === 'Phone').map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  <span className="flex items-center gap-2">
                                    <span>{field.icon}</span>
                                    <span>{field.label}</span>
                                  </span>
                                </SelectItem>
                              ))}
                              
                              {/* Company Information */}
                              <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</div>
                              {databaseFields.filter(f => f.category === 'Company').map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  <span className="flex items-center gap-2">
                                    <span>{field.icon}</span>
                                    <span>{field.label}</span>
                                  </span>
                                </SelectItem>
                              ))}
                              
                              {/* Social Media */}
                              <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Social</div>
                              {databaseFields.filter(f => f.category === 'Social').map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  <span className="flex items-center gap-2">
                                    <span>{field.icon}</span>
                                    <span>{field.label}</span>
                                  </span>
                                </SelectItem>
                              ))}
                              
                              {/* Location */}
                              <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</div>
                              {databaseFields.filter(f => f.category === 'Location').map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  <span className="flex items-center gap-2">
                                    <span>{field.icon}</span>
                                    <span>{field.label}</span>
                                  </span>
                                </SelectItem>
                              ))}
                              
                              {/* Company Location */}
                              <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company Location</div>
                              {databaseFields.filter(f => f.category === 'Company Location').map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  <span className="flex items-center gap-2">
                                    <span>{field.icon}</span>
                                    <span>{field.label}</span>
                                  </span>
                                </SelectItem>
                              ))}
                              
                              {/* Auto-Enriched */}
                              <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Auto-Enriched</div>
                              {databaseFields.filter(f => f.category === 'Auto-Enriched').map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  <span className="flex items-center gap-2">
                                    <span>{field.icon}</span>
                                    <span>{field.label}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex justify-between mt-4">
                  <Button variant="outline" onClick={() => setStep('upload')}>
                    Back
                  </Button>
                  <Button onClick={startImport} disabled={Object.keys(finalMapping).length === 0}>
                    Continue to Options
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Field Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="Personal" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="Personal" className="text-xs">Personal</TabsTrigger>
                    <TabsTrigger value="Company" className="text-xs">Company</TabsTrigger>
                    <TabsTrigger value="Location" className="text-xs">Location</TabsTrigger>
                  </TabsList>
                  {Object.entries(fieldsByCategory).map(([category, fields]) => (
                    <TabsContent key={category} value={category} className="space-y-2 mt-4">
                      {fields.slice(0, 6).map((field) => (
                        <div key={field.value} className="flex items-center gap-2 text-sm">
                          <span>{field.icon}</span>
                          <span>{field.label}</span>
                        </div>
                      ))}
                      {fields.length > 6 && (
                        <div className="text-xs text-gray-500">+{fields.length - 6} more...</div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Options Step */}
      {step === 'options' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Import Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-medium">Data Processing</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="skipDuplicates"
                      checked={importOptions.skipDuplicates}
                      onCheckedChange={(checked) => 
                        setImportOptions(prev => ({ ...prev, skipDuplicates: checked as boolean }))
                      }
                    />
                    <label htmlFor="skipDuplicates" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Skip duplicate contacts
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="updateExisting"
                      checked={importOptions.updateExisting}
                      onCheckedChange={(checked) => 
                        setImportOptions(prev => ({ ...prev, updateExisting: checked as boolean }))
                      }
                    />
                    <label htmlFor="updateExisting" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Update existing contacts
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="autoEnrich"
                      checked={importOptions.autoEnrich}
                      onCheckedChange={(checked) => 
                        setImportOptions(prev => ({ ...prev, autoEnrich: checked as boolean }))
                      }
                    />
                    <label htmlFor="autoEnrich" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Auto-enrich contact data
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-medium">Performance</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Batch Size</label>
                    <Select
                      value={importOptions.batchSize.toString()}
                      onValueChange={(value) => 
                        setImportOptions(prev => ({ ...prev, batchSize: parseInt(value) }))
                      }
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50 contacts</SelectItem>
                        <SelectItem value="100">100 contacts</SelectItem>
                        <SelectItem value="250">250 contacts</SelectItem>
                        <SelectItem value="500">500 contacts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Ready to import {fieldMappings.length} columns with {Object.keys(finalMapping).length} mapped fields.
                {importOptions.autoEnrich && " Auto-enrichment will enhance your data with additional information."}
              </AlertDescription>
            </Alert>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back to Mapping
              </Button>
              <Button onClick={executeImport} disabled={importMutation.isPending}>
                {importMutation.isPending ? 'Starting Import...' : 'Start Import'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}