import { Button } from "@/components/ui/button";
import { ArrowDownTrayIcon, EyeIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/ui/card";

interface ExportPanelProps {
  onExportLatex: () => void;
  onPreviewPDF?: () => void;
  isExporting?: boolean;
  disabled?: boolean;
}

export function ExportPanel({ onExportLatex, onPreviewPDF, isExporting, disabled }: ExportPanelProps) {
  return (
    <Card className="p-6 border-t" data-testid="panel-export">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <h4 className="text-lg font-semibold text-foreground mb-1">Export Your Document</h4>
          <p className="text-sm text-muted-foreground">
            Download as LaTeX or preview as PDF
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onPreviewPDF && (
            <Button
              variant="outline"
              onClick={onPreviewPDF}
              disabled={disabled || isExporting}
              className="gap-2"
              data-testid="button-preview-pdf"
            >
              <EyeIcon className="w-4 h-4" />
              Preview PDF
            </Button>
          )}
          
          <Button
            onClick={onExportLatex}
            disabled={disabled || isExporting}
            className="gap-2"
            data-testid="button-export-latex"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            {isExporting ? "Exporting..." : "Download LaTeX"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
