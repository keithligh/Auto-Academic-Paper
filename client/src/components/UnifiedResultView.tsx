import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { DocumentTextIcon, CodeBracketIcon, EyeIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { LatexPreview } from "./LatexPreview";
import { useToast } from "@/hooks/use-toast";

interface UnifiedResultViewProps {
  originalContent: string;
  latexContent: string;
  fileName?: string;
}

export function UnifiedResultView({ originalContent, latexContent, fileName }: UnifiedResultViewProps) {
  // View State: 'latex' (default) or 'original'. Removed 'split' mode.
  const [activeView, setActiveView] = useState<"latex" | "original">("latex");
  const [latexViewMode, setLatexViewMode] = useState<"code" | "preview">("preview");
  const { toast } = useToast();

  const handleCopyLatex = async () => {
    try {
      await navigator.clipboard.writeText(latexContent);
      toast({
        title: "Copied to clipboard",
        description: "LaTeX code has been copied to your clipboard.",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy text to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Unified Main Header */}
      <div className="flex items-center justify-between mb-4 px-4 shrink-0 h-10">
        <div className="flex items-center gap-4">

          {/* Main View Toggle */}
          <div className="flex gap-1 bg-muted p-0.5 rounded-lg border border-border/50">
            <Button
              variant={activeView === "original" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveView("original")}
              data-testid="button-view-original"
              className="h-7 text-xs px-3"
            >
              <DocumentTextIcon className="w-3.5 h-3.5 mr-1.5" />
              Original
            </Button>
            <Button
              variant={activeView === "latex" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveView("latex")}
              data-testid="button-view-latex"
              className="h-7 text-xs px-3"
            >
              <CodeBracketIcon className="w-3.5 h-3.5 mr-1.5" />
              LaTeX
            </Button>
          </div>
        </div>

        {/* Right Side: Context Actions */}
        <div className="flex items-center gap-2">
          {activeView === "latex" && (
            <>
              {/* LaTeX Toolbar */}
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="h-4 w-px bg-border mx-1" />

                <div className="flex bg-muted p-0.5 rounded-lg border border-border/50">
                  <Button
                    variant={latexViewMode === "code" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setLatexViewMode("code")}
                    className="h-7 text-xs px-3"
                    title="View LaTeX Source Code"
                  >
                    Code
                  </Button>
                  <Button
                    variant={latexViewMode === "preview" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setLatexViewMode("preview")}
                    className="h-7 text-xs px-3"
                    title="View Rendered Preview"
                  >
                    Preview
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLatex}
                  className="h-8 text-xs px-3 ml-1"
                  title="Copy LaTeX Code"
                >
                  <ClipboardDocumentIcon className="w-3.5 h-3.5 mr-1.5" />
                  Copy
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden gap-4 min-h-0">

        {/* ORIGINAL CONTENT PANE */}
        {activeView === "original" && (
          <div className="w-full flex flex-col min-h-0 transition-all duration-300">
            <Card className="flex-1 flex flex-col overflow-hidden border-border/50">
              {/* Removed Inner Header */}
              <ScrollArea className="flex-1">
                <div className="p-6">
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground/80 leading-relaxed bg-transparent">
                    {originalContent}
                  </pre>
                </div>
              </ScrollArea>
            </Card>
          </div>
        )}

        {/* LATEX CONTENT PANE */}
        {activeView === "latex" && (
          <div className="w-full flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col overflow-hidden border-border/50 shadow-sm">
              {/* Removed Inner Header */}

              <div className="flex-1 overflow-hidden relative bg-muted/10">
                {latexViewMode === "code" ? (
                  <ScrollArea className="h-full">
                    <div className="p-6">
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground/90 leading-relaxed">
                        {latexContent}
                      </pre>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-full w-full overflow-y-auto" style={{ backgroundColor: '#fafafa' }}>
                    {/* Pass className to manage internal scrolling if needed, or let parent handle */}
                    <div style={{ zoom: 1.15 }}>
                      <LatexPreview latexContent={latexContent} className="min-h-full py-8" />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
