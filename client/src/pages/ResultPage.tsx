import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ConversionJob } from "@shared/schema";
import { UnifiedResultView } from "@/components/UnifiedResultView";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function ResultPage() {
    const [, params] = useRoute("/results/:id");
    const [, setLocation] = useLocation();
    const jobId = params?.id;

    const { data: job, isLoading } = useQuery<ConversionJob>({
        queryKey: ["/api/conversions", jobId],
        enabled: !!jobId,
    });

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!job || job.status !== "completed") {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <h1 className="text-xl font-semibold">Job not found or not completed</h1>
                <Button onClick={() => setLocation("/")}>Go Home</Button>
            </div>
        );
    }

    const handleExportLatex = () => {
        if (!jobId) return;
        // Use the new backend endpoint that sanitizes LaTeX for export (fixing "Missing $", inputenc, etc.)
        // This separates the "Preview Version" (which needs latex.js hacks) from the "Export Version" (which needs strict latex).
        window.location.href = `/api/conversions/${jobId}/export`;
    };

    return (
        <div className="min-h-screen text-foreground font-sans" style={{ backgroundColor: '#fafafa' }}>
            <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <h1
                        className="font-serif text-2xl font-bold text-gray-900 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setLocation("/")}
                    >
                        Auto Academic Paper
                    </h1>
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="lg" className="text-lg h-12 px-6" onClick={() => setLocation("/")}>
                            New Document
                        </Button>
                        <Button size="lg" className="text-lg h-12 px-6" onClick={handleExportLatex}>
                            Export LaTeX
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto py-8 px-6">
                <UnifiedResultView
                    originalContent={job.originalContent || ""}
                    latexContent={job.latexContent || ""}
                    fileName={job.originalFileName}
                />
            </main>
        </div>
    );
}
