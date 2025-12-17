import { processingSteps } from "@shared/schema";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { Progress } from "@/components/ui/progress";

interface ProcessingStatusProps {
  currentStep: number;
  status: string;
  fileName?: string;
  error?: string;
}

export function ProcessingStatus({ currentStep, status, fileName, error }: ProcessingStatusProps) {
  const progressPercent = (currentStep / (processingSteps.length - 1)) * 100;

  return (
    <div className="w-full max-w-3xl mx-auto px-4" data-testid="container-processing">
      <div className="bg-card border border-card-border rounded-lg p-8 shadow-sm">
        {/* Header */}
        <div className="text-center mb-8">
          {status === "failed" ? (
            <>
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-2">Processing Failed</h3>
              <p className="text-sm text-destructive" data-testid="text-error">{error}</p>
            </>
          ) : status === "completed" ? (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircleIcon className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-2">Processing Complete</h3>
              {error ? (
                <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Completed with warnings:</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Your document is ready for review</p>
              )}
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <ArrowPathIcon className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-2">
                {processingSteps[currentStep]?.description || "Processing..."}
              </h3>
              {fileName && (
                <p className="text-sm text-muted-foreground" data-testid="text-filename">{fileName}</p>
              )}
            </>
          )}
        </div>

        {/* Progress Bar */}
        {!error && (
          <div className="mb-8">
            <Progress value={progressPercent} className="h-1" />
          </div>
        )}

        {/* Step Indicators */}
        {!error && (
          <div className="flex justify-between items-center relative">
            {/* Connection line */}
            <div className="absolute top-5 left-0 right-0 h-px bg-border -z-10" />

            {processingSteps.map((step, index) => {
              const isCompleted = index < currentStep || status === "completed";
              const isCurrent = index === currentStep && status !== "completed";

              return (
                <div key={step.id} className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all
                      ${isCompleted ? "bg-primary text-primary-foreground" : ""}
                      ${isCurrent ? "bg-primary text-primary-foreground scale-110 ring-4 ring-primary/20" : ""}
                      ${!isCompleted && !isCurrent ? "bg-muted text-muted-foreground" : ""}
                    `}
                    data-testid={`step-${step.id}`}
                  >
                    {isCompleted ? (
                      <CheckCircleIcon className="w-6 h-6" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  <span className={`text-xs font-medium ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Expandable "What's happening" section */}
        {!error && status === "processing" && (
          <details className="mt-8 border-t border-border pt-6">
            <summary className="text-sm font-medium text-foreground cursor-pointer hover-elevate p-2 rounded-md">
              What's happening?
            </summary>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground pl-4">
              <p>• Extracting text content from your document</p>
              <p>• Analyzing themes, structure, and key concepts</p>
              <p>• Identifying opportunities for academic enhancements</p>
              <p>• Generating formulas, diagrams, and scholarly elements</p>
              <p>• Formatting content in professional LaTeX structure</p>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
