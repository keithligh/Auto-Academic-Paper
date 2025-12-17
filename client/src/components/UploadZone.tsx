import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { DocumentArrowUpIcon } from "@heroicons/react/24/outline";
import { supportedFileTypes, maxFileSize } from "@shared/schema";
import { Button } from "@/components/ui/button";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  isProcessing?: boolean;
}

export function UploadZone({ onFileSelect, isProcessing }: UploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    maxSize: maxFileSize,
    disabled: isProcessing,
  });

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      <div
        {...getRootProps()}
        className={`
          min-h-96 rounded-lg border-2 border-dashed transition-all duration-200
          flex flex-col items-center justify-center p-12 cursor-pointer
          ${isDragActive
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-accent/30"
          }
          ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
        `}
        data-testid="dropzone-upload"
      >
        <input {...getInputProps()} data-testid="input-file" />

        <DocumentArrowUpIcon className="w-20 h-20 text-muted-foreground mb-6 scale-125" />

        <h3 className="text-2xl font-semibold text-foreground mb-3">
          {isDragActive ? "Drop your document here" : "Drop your document here"}
        </h3>

        <p className="text-base text-muted-foreground mb-6 text-center max-w-md">
          or click to browse • PDF, TXT • Max 50MB
        </p>

        <Button
          type="button"
          size="lg"
          className="mt-2"
          disabled={isProcessing}
          data-testid="button-browse"
        >
          Browse Files
        </Button>
      </div>

      {/* Feature callouts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        <div className="text-center p-6" data-testid="feature-ai">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h4 className="text-xl font-medium text-foreground mb-2">AI-Powered Analysis</h4>
          <p className="text-sm text-muted-foreground">
            Advanced content understanding to identify themes and opportunities
          </p>
        </div>

        <div className="text-center p-6" data-testid="feature-enhancements">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h4 className="text-xl font-medium text-foreground mb-2">Smart Enhancements</h4>
          <p className="text-sm text-muted-foreground">
            Automatic insertion of formulas, diagrams, and scholarly structures
          </p>
        </div>

        <div className="text-center p-6" data-testid="feature-export">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h4 className="text-xl font-medium text-foreground mb-2">LaTeX Export</h4>
          <p className="text-sm text-muted-foreground">
            Download publication-ready LaTeX files or PDF previews
          </p>
        </div>
      </div>
    </div>
  );
}
