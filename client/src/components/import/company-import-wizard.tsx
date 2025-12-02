import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Building2,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type ImportStep = 'upload' | 'mapping' | 'options' | 'progress' | 'complete';

interface FieldMapping {
  csvHeader: string;
  dbField: string;
  confidence: number;
  sample: string;
  suggestions: Array<{ field: string; confidence: number }>;
}

interface AvailableField {
  value: string;
  label: string;
  category: string;
}

interface CompanyImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function CompanyImportWizard({ open, onOpenChange, onImportComplete }: CompanyImportWizardProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [mappingData, setMappingData] = useState<{
    headers: string[];
    autoMapping: Record<string, string>;
    confidence: Record<string, number>;
    suggestions: Record<string, Array<{ field: string; confidence: number }>>;
    preview: Record<string, string>[];
    totalRows: number;
    tempFile: string;
    availableFields: AvailableField[];
  } | null>(null);
  const [currentMapping, setCurrentMapping] = useState<Record<string, string>>({});
  const [importOptions, setImportOptions] = useState({
    skipDuplicates: true,
    updateExisting: false,
  });
  const [importJobId, setImportJobId] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('csv', file);
      const response = await fetch('/api/companies/import/auto-map', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setMappingData(data);
      setCurrentMapping(data.autoMapping);
      setStep('mapping');
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!mappingData) throw new Error('No mapping data');
      return apiRequest('/api/companies/import', {
        method: 'POST',
        body: JSON.stringify({
          tempFile: mappingData.tempFile,
          fieldMapping: currentMapping,
          options: importOptions,
        }),
      });
    },
    onSuccess: (data: any) => {
      setImportJobId(data.jobId);
      setStep('progress');
    },
  });

  const { data: jobStatus, refetch: refetchJobStatus } = useQuery({
    queryKey: ['/api/import', importJobId],
    enabled: !!importJobId && step === 'progress',
    refetchInterval: (query) => {
      const data = query.state.data as any;
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 1000;
    },
  });

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
      uploadMutation.mutate(droppedFile);
    }
  }, [uploadMutation]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      uploadMutation.mutate(selectedFile);
    }
  }, [uploadMutation]);

  const handleFieldChange = (csvHeader: string, dbField: string) => {
    const newMapping = { ...currentMapping };
    if (dbField === 'none') {
      delete newMapping[csvHeader];
    } else {
      newMapping[csvHeader] = dbField;
    }
    setCurrentMapping(newMapping);
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

  const handleComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
    onImportComplete?.();
    onOpenChange(false);
    setStep('upload');
    setFile(null);
    setMappingData(null);
    setCurrentMapping({});
    setImportJobId(null);
  };

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div
        className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => document.getElementById('company-csv-input')?.click()}
        data-testid="dropzone-company-csv"
      >
        <input
          id="company-csv-input"
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileSelect}
          data-testid="input-company-csv"
        />
        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="text-lg font-medium">Analyzing CSV with smart field detection...</p>
            <p className="text-sm text-muted-foreground">Using NLP to auto-map your company fields</p>
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Drop your company CSV file here</p>
            <p className="text-sm text-muted-foreground">or click to browse</p>
          </>
        )}
      </div>

      {uploadMutation.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {uploadMutation.error?.message || 'Failed to analyze CSV file'}
          </AlertDescription>
        </Alert>
      )}

      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Supported Company Fields
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
          <span>Company Name</span>
          <span>Website</span>
          <span>Industry</span>
          <span>Employee Size</span>
          <span>Annual Revenue</span>
          <span>LinkedIn URL</span>
          <span>City, State, Country</span>
          <span>Technologies</span>
          <span>Total Funding</span>
          <span>Founded Year</span>
          <span>SIC/NAICS Codes</span>
          <span>And more...</span>
        </div>
      </div>
    </div>
  );

  const renderMappingStep = () => {
    if (!mappingData) return null;

    const mappedCount = Object.keys(currentMapping).length;
    const highConfidenceCount = Object.entries(mappingData.confidence).filter(
      ([header, conf]) => currentMapping[header] && conf >= 0.8
    ).length;

    const groupedFields = mappingData.availableFields.reduce((acc, field) => {
      if (!acc[field.category]) acc[field.category] = [];
      acc[field.category].push(field);
      return acc;
    }, {} as Record<string, AvailableField[]>);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Smart Field Mapping</h3>
            <p className="text-sm text-muted-foreground">
              {mappedCount} of {mappingData.headers.length} fields mapped automatically
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">{mappingData.totalRows} rows</Badge>
            <Badge className={getConfidenceColor(highConfidenceCount / mappingData.headers.length)}>
              {highConfidenceCount} high confidence
            </Badge>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="max-h-[400px] overflow-auto">
            <table className="w-full">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium">CSV Header</th>
                  <th className="text-left p-3 font-medium">Map to Field</th>
                  <th className="text-left p-3 font-medium">Confidence</th>
                  <th className="text-left p-3 font-medium">Sample</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mappingData.headers.map((header) => (
                  <tr key={header} className="hover:bg-muted/50">
                    <td className="p-3 font-mono text-sm">{header}</td>
                    <td className="p-3">
                      <Select
                        value={currentMapping[header] || 'none'}
                        onValueChange={(value) => handleFieldChange(header, value)}
                      >
                        <SelectTrigger className="w-[200px]" data-testid={`select-mapping-${header}`}>
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Skip this field</SelectItem>
                          {Object.entries(groupedFields).map(([category, fields]) => (
                            <div key={category}>
                              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">
                                {category}
                              </div>
                              {fields.map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      {currentMapping[header] && (
                        <Badge className={getConfidenceColor(mappingData.confidence[header] || 0)}>
                          {getConfidenceLabel(mappingData.confidence[header] || 0)}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground max-w-[200px] truncate">
                      {mappingData.preview[0]?.[header] || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {!Object.values(currentMapping).includes('name') && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Company Name field is required. Please map at least one column to "Company Name".
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep('upload')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={() => setStep('options')} 
            disabled={!Object.values(currentMapping).includes('name')}
            data-testid="button-continue-options"
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  const renderOptionsStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Import Options</h3>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="skip-duplicates"
              checked={importOptions.skipDuplicates}
              onCheckedChange={(checked) => 
                setImportOptions(prev => ({ ...prev, skipDuplicates: !!checked }))
              }
              data-testid="checkbox-skip-duplicates"
            />
            <Label htmlFor="skip-duplicates" className="cursor-pointer">
              <div className="font-medium">Skip duplicate companies</div>
              <div className="text-sm text-muted-foreground">
                Companies with matching names or domains will be skipped
              </div>
            </Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="update-existing"
              checked={importOptions.updateExisting}
              onCheckedChange={(checked) => 
                setImportOptions(prev => ({ ...prev, updateExisting: !!checked }))
              }
              data-testid="checkbox-update-existing"
            />
            <Label htmlFor="update-existing" className="cursor-pointer">
              <div className="font-medium">Update existing companies</div>
              <div className="text-sm text-muted-foreground">
                Merge new data with existing company records
              </div>
            </Label>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Import Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Rows:</span>
              <span className="ml-2 font-medium">{mappingData?.totalRows || 0}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Mapped Fields:</span>
              <span className="ml-2 font-medium">{Object.keys(currentMapping).length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep('mapping')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={() => importMutation.mutate()} 
          disabled={importMutation.isPending}
          data-testid="button-start-import"
        >
          {importMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              Start Import
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderProgressStep = () => {
    const status = jobStatus as any;
    const progress = status?.totalRows ? (status.processedRows / status.totalRows) * 100 : 0;
    const isComplete = status?.status === 'completed';
    const isFailed = status?.status === 'failed';

    if (isComplete || isFailed) {
      return (
        <div className="space-y-6 text-center">
          {isComplete ? (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <h3 className="text-xl font-semibold">Import Complete!</h3>
                <p className="text-muted-foreground mt-2">
                  Successfully imported {status.successfulRows} companies
                </p>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{status.successfulRows}</div>
                  <div className="text-sm text-muted-foreground">Imported</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{status.duplicateRows || 0}</div>
                  <div className="text-sm text-muted-foreground">Duplicates</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{status.updated || 0}</div>
                  <div className="text-sm text-muted-foreground">Updated</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{status.errorRows || 0}</div>
                  <div className="text-sm text-muted-foreground">Errors</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-16 w-16 text-red-500 mx-auto" />
              <div>
                <h3 className="text-xl font-semibold">Import Failed</h3>
                <p className="text-muted-foreground mt-2">
                  {status?.errors?.[0]?.message || 'An error occurred during import'}
                </p>
              </div>
            </>
          )}
          <Button onClick={handleComplete} data-testid="button-close-import">
            Close
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Importing Companies...</h3>
          <p className="text-sm text-muted-foreground">
            Processing row {status?.processedRows || 0} of {status?.totalRows || 0}
          </p>
        </div>

        <Progress value={progress} className="h-2" />

        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-xl font-bold text-green-600">{status?.successfulRows || 0}</div>
            <div className="text-xs text-muted-foreground">Imported</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-xl font-bold text-yellow-600">{status?.duplicateRows || 0}</div>
            <div className="text-xs text-muted-foreground">Duplicates</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-xl font-bold text-blue-600">{status?.updated || 0}</div>
            <div className="text-xs text-muted-foreground">Updated</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-xl font-bold text-red-600">{status?.errorRows || 0}</div>
            <div className="text-xs text-muted-foreground">Errors</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Import Companies
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 mb-6">
          {['upload', 'mapping', 'options', 'progress'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : i < ['upload', 'mapping', 'options', 'progress'].indexOf(step)
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </div>
              {i < 3 && (
                <div
                  className={`w-12 h-0.5 ${
                    i < ['upload', 'mapping', 'options', 'progress'].indexOf(step)
                      ? 'bg-green-500'
                      : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {step === 'upload' && renderUploadStep()}
        {step === 'mapping' && renderMappingStep()}
        {step === 'options' && renderOptionsStep()}
        {step === 'progress' && renderProgressStep()}
      </DialogContent>
    </Dialog>
  );
}
