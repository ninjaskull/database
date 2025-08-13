/**
 * Advanced File Uploader with Drag & Drop, Progress, and Real-time Validation
 */

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, AlertTriangle, CheckCircle, X, Zap } from "lucide-react";

interface UploadValidation {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
}

interface AdvancedUploaderProps {
  onFileAnalyzed: (data: any) => void;
  onUploadProgress?: (progress: number) => void;
  maxSize?: number;
  acceptedTypes?: string[];
}

export function AdvancedUploader({ 
  onFileAnalyzed, 
  onUploadProgress,
  maxSize = 50 * 1024 * 1024, // 50MB default
  acceptedTypes = ['.csv']
}: AdvancedUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<UploadValidation | null>(null);
  const [filePreview, setFilePreview] = useState<{
    size: string;
    rows: number;
    estimatedTime: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = useCallback((file: File): UploadValidation => {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // File type validation
    if (!acceptedTypes.some(type => file.name.toLowerCase().endsWith(type.toLowerCase()))) {
      issues.push(`Invalid file type. Expected: ${acceptedTypes.join(', ')}`);
      recommendations.push('Please select a valid CSV file');
    }

    // File size validation
    if (file.size > maxSize) {
      issues.push(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: ${(maxSize / 1024 / 1024).toFixed(0)}MB`);
      recommendations.push('Try compressing your file or splitting it into smaller chunks');
    }

    // Empty file check
    if (file.size === 0) {
      issues.push('File appears to be empty');
      recommendations.push('Please select a file with data');
    }

    // Performance warnings
    if (file.size > 10 * 1024 * 1024) { // > 10MB
      recommendations.push('Large file detected - processing may take several minutes');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }, [acceptedTypes, maxSize]);

  const handleFileSelect = useCallback(async (file: File) => {
    const validation = validateFile(file);
    setValidation(validation);
    setSelectedFile(file);

    if (!validation.isValid) {
      toast({
        title: "Invalid File",
        description: validation.issues[0],
        variant: "destructive",
      });
      return;
    }

    // Set file preview info
    setFilePreview({
      size: (file.size / 1024 / 1024).toFixed(1) + 'MB',
      rows: Math.floor(file.size / 100), // Rough estimate
      estimatedTime: Math.ceil(file.size / (1024 * 1024) * 2) // 2 seconds per MB estimate
    });

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('csv', file);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const next = prev + Math.random() * 15;
          if (onUploadProgress) onUploadProgress(next);
          return Math.min(next, 90);
        });
      }, 200);

      const response = await fetch('/api/import/auto-map', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      if (onUploadProgress) onUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const data = await response.json();
      
      toast({
        title: "🚀 Ultra-Fast Analysis Complete",
        description: `Advanced NLP mapped ${Object.keys(data.autoMapping).length} fields with streaming parser`,
      });

      onFileAnalyzed(data);

    } catch (error) {
      setUploadProgress(0);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [validateFile, onFileAnalyzed, onUploadProgress, toast]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setValidation(null);
    setFilePreview(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Main Upload Area */}
      <Card className={`transition-all duration-200 ${
        isDragOver 
          ? 'border-blue-500 border-2 shadow-lg bg-blue-50 dark:bg-blue-900/10' 
          : 'border-dashed border-2 border-gray-300 dark:border-gray-600'
      }`}>
        <CardContent 
          className="p-8 text-center cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <div className="space-y-4">
            {isUploading ? (
              <div className="space-y-4">
                <Zap className="h-12 w-12 text-blue-500 mx-auto animate-pulse" />
                <div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                    Ultra-Fast Processing...
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Advanced streaming parser with NLP field mapping
                  </p>
                </div>
                <div className="w-full max-w-md mx-auto space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-gray-500">{Math.round(uploadProgress)}% complete</p>
                </div>
              </div>
            ) : selectedFile ? (
              <div className="space-y-3">
                <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                    File Ready for Processing
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedFile.name}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelection();
                  }}
                  className="mx-auto"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Selection
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className={`h-12 w-12 mx-auto ${
                  isDragOver ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'
                }`} />
                <div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                    Drop your CSV file here, or click to browse
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Supports files up to {Math.round(maxSize / 1024 / 1024)}MB with advanced streaming processing
                  </p>
                </div>
                <Badge variant="secondary" className="mx-auto">
                  <Zap className="h-3 w-3 mr-1" />
                  Ultra-Fast Import Engine
                </Badge>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes.join(',')}
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </CardContent>
      </Card>

      {/* File Preview */}
      {filePreview && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    {selectedFile?.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {filePreview.size} • ~{filePreview.rows.toLocaleString()} rows
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Est. {filePreview.estimatedTime}s
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Processing time
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Messages */}
      {validation && (
        <div className="space-y-3">
          {validation.issues.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {validation.issues.map((issue, index) => (
                    <p key={index}>• {issue}</p>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {validation.recommendations.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Recommendations:</p>
                  {validation.recommendations.map((rec, index) => (
                    <p key={index} className="text-sm">• {rec}</p>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}