import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { User, ListChecks, Code, ChartLine, Settings2, Upload, FolderOpen, RotateCcw, FileUp, XCircle, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileCard } from "@/components/FileCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { enhancementLevels, paperTypes } from "@shared/schema";
import { useAIConfig } from "@/context/AIConfigContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Generate a sanitized unique ID for file uploads
function generateUploadId(originalName: string) {
    const timestamp = Date.now();

    // Split name and extension
    const lastDotIndex = originalName.lastIndexOf('.');
    let name = originalName;
    let ext = '';

    if (lastDotIndex !== -1) {
        name = originalName.substring(0, lastDotIndex);
        ext = originalName.substring(lastDotIndex);
    }

    // Sanitize name:
    // 1. Replace spaces with underscores
    // 2. Remove Windows reserved chars (< > : " / \ | ? *)
    // 3. Remove control characters
    // 4. Trim
    const sanitizedName = name
        .replace(/\s+/g, '_')
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/[\x00-\x1F]/g, '')
        .trim();

    // Fallback if name becomes empty
    const finalName = sanitizedName || 'upload';

    // Combine: timestamp-name.ext
    return `${timestamp}-${finalName}${ext}`;
}

// Review Depth options (v1.6.13)
const reviewDepthOptions = [
    { value: "quick", label: "Quick Review", description: "Fast single-pass verification (~1 min)" },
    { value: "deep", label: "Deep Review", description: "Rigorous multi-pass analysis (~5-8 min)" },
] as const;

export default function LandingPage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { config } = useAIConfig();
    const [isDragActive, setIsDragActive] = useState(false);

    // Check if all agents are verified
    const isAIConfigured = config?.writer?.isVerified && config?.librarian?.isVerified && config?.strategist?.isVerified;

    // Staged File State
    const [stagedFile, setStagedFile] = useState<File | null>(null);
    const [uploadID, setUploadID] = useState<string>("");

    // Job Ticket State
    const [paperType, setPaperType] = useState("research_paper");
    const [enhancementLevel, setEnhancementLevel] = useState("standard");
    const [reviewDepth, setReviewDepth] = useState<"quick" | "deep">("quick"); // v1.6.13: Review Depth
    const [authorName, setAuthorName] = useState("");
    const [authorAffiliation, setAuthorAffiliation] = useState("");

    // Advanced Options
    const [advancedOptions, setAdvancedOptions] = useState({
        formula: true,
        hypothesis: true,
        diagram: true,
        logical_structure: true,
        symbol: true,
        citations: true,
    });

    const handleOptionToggle = (key: keyof typeof advancedOptions) => {
        setAdvancedOptions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // v1.9.2: Inline error state for job submission failures
    const [jobError, setJobError] = useState<string | null>(null);
    const clearJobError = () => setJobError(null);

    // v1.9.2: Inline error state for header actions (Recall Last, Import LaTeX)
    const [actionError, setActionError] = useState<string | null>(null);
    const clearActionError = () => setActionError(null);

    const handleRecallLast = useCallback(async () => {
        try {
            setActionError(null);  // Clear previous error
            const res = await apiRequest("GET", "/api/conversions/latest");
            const job = await res.json();

            if (!job || !job.id) {
                setActionError("No previous generation found. Generate a paper first to use this feature.");
                return;
            }

            setLocation(`/results/${job.id}`);
        } catch (err: any) {
            setActionError(`Failed to recall generation: ${err.message || "Could not fetch latest generation"}`);
        }
    }, [setLocation]);

    // Import LaTeX file for debugging
    const latexInputRef = useRef<HTMLInputElement>(null);

    const handleImportLatex = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setActionError(null);  // Clear previous error
            const latexContent = await file.text();

            // Create a debug job entry via API
            const res = await apiRequest("POST", "/api/conversions/debug-import", {
                latexContent,
                originalFileName: file.name
            });
            const job = await res.json();

            // Success - can use toast for non-error feedback
            toast({
                title: "LaTeX imported",
                description: `Imported ${file.name} for preview`
            });

            setLocation(`/results/${job.id}`);
        } catch (err: any) {
            setActionError(`Failed to import LaTeX: ${err.message || "Could not create preview job"}`);
        }

        // Reset input for re-import
        if (latexInputRef.current) {
            latexInputRef.current.value = '';
        }
    }, [setLocation, toast]);

    // Upload File to Local Storage
    const uploadFileToStorage = async (file: File, id: string) => {
        const url = `/api/local-upload/${id}`;
        await fetch(url, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
        });
    };

    // Create Job Mutation
    const createJobMutation = useMutation({
        mutationFn: async () => {
            if (!stagedFile || !uploadID) throw new Error("No file staged");

            // Upload the file first
            await uploadFileToStorage(stagedFile, uploadID);

            // Create the job - v1.6.13: Include reviewDepth in advancedOptions
            const res = await apiRequest("POST", "/api/conversions", {
                fileName: stagedFile.name,
                fileType: stagedFile.type,
                fileSize: stagedFile.size.toString(),
                uploadURL: `/api/local-upload/${uploadID}`,
                paperType,
                enhancementLevel,
                authorName,
                authorAffiliation,
                advancedOptions: {
                    ...advancedOptions,
                    reviewDepth, // v1.6.13: Add reviewDepth to advancedOptions
                },
            });
            return res.json();
        },
        onSuccess: (data) => {
            setJobError(null);  // Clear any previous error
            setLocation(`/processing/${data.jobId}`);
        },
        onError: (error) => {
            // v1.9.2: Set inline error instead of toast
            setJobError(error.message);
        },
    });

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            setStagedFile(file);

            // Generate upload ID locally
            const id = generateUploadId(file.name);
            setUploadID(id);
        }
    }, []);

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: {
            "application/pdf": [".pdf"],
            "text/plain": [".txt"],
            "text/markdown": [".md"],
        },
        maxFiles: 1,
        onDragEnter: () => setIsDragActive(true),
        onDragLeave: () => setIsDragActive(false),
        onDropAccepted: () => setIsDragActive(false),
        disabled: !isAIConfigured
    });

    const handleRemoveFile = () => {
        setStagedFile(null);
        setUploadID("");
    };

    // CALIBRATED UI: "Squashed" Upload Zone, Maintain Readable Fonts
    return (
        <div className="min-h-screen bg-white text-foreground font-sans selection:bg-gray-200">
            {/* Header - Kept Readable (h-20, text-lg) */}
            <header className="fixed top-0 z-50 w-full bg-white/80 backdrop-blur-sm border-b border-gray-100">
                <div className="flex items-center justify-between h-20 max-w-7xl mx-auto px-6">
                    <div className="flex items-center gap-2">
                        <h1 className="flex items-center">
                            <button
                                type="button"
                                onClick={() => setLocation("/")}
                                className="text-2xl font-serif font-bold text-gray-900 hover:opacity-80 transition-opacity focus:outline-none focus:underline"
                            >
                                <span className="md:hidden">AAP</span>
                                <span className="hidden md:inline">Auto Academic Paper</span>
                            </button>
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="lg"
                            onClick={handleRecallLast}
                            title="Recall Last Generation"
                            className="gap-2 text-lg h-12 px-6"
                        >
                            <RotateCcw className="w-6 h-6 text-gray-500" />
                            <span className="hidden sm:inline">Recall Last</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="lg"
                            onClick={() => latexInputRef.current?.click()}
                            title="Import LaTeX File for Debug"
                            className="gap-2 text-lg h-12 px-6"
                        >
                            <FileUp className="w-6 h-6 text-gray-500" />
                            <span className="hidden sm:inline">Import LaTeX</span>
                        </Button>
                        <input
                            ref={latexInputRef}
                            type="file"
                            accept=".tex,.latex,text/x-latex"
                            className="hidden"
                            onChange={handleImportLatex}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => apiRequest("POST", "/api/open-upload-folder")}
                            title="Open Uploads Folder"
                            className="h-12 w-12"
                        >
                            <FolderOpen className="w-7 h-7 text-gray-500" />
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => setLocation("/manual")}
                            className="gap-2 h-12 px-6"
                        >
                            <BookOpen className="w-6 h-6" />
                            <span className="text-lg font-medium">User Manual</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => setLocation("/config")}
                            className="gap-2 h-12 px-6"
                        >
                            <Settings2 className="w-6 h-6" />
                            <span className="text-lg font-medium">AI Configuration</span>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex flex-col h-screen pt-24">
                <div className="flex-1 flex flex-col justify-center px-6">
                    <div className="w-full max-w-5xl mx-auto space-y-6">

                        {/* v1.9.2: Inline Action Error Display */}
                        {actionError && (
                            <Alert variant="destructive" className="max-w-3xl mx-auto mb-4">
                                <XCircle className="w-5 h-5" />
                                <AlertTitle className="flex items-center justify-between">
                                    <span>Action Failed</span>
                                    <Button variant="ghost" size="sm" onClick={clearActionError} className="h-6 px-2 text-xs">
                                        Dismiss
                                    </Button>
                                </AlertTitle>
                                <AlertDescription className="mt-2">
                                    <pre className="text-sm whitespace-pre-wrap break-all font-mono bg-destructive/10 p-3 rounded-md max-h-40 overflow-y-auto select-text cursor-text">
                                        {actionError}
                                    </pre>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Hero Section - Kept Commanding (text-7xl/8xl) but slightly tighter margin */}
                        {!stagedFile && (
                            <div className="mb-8 flex flex-col items-center space-y-6 text-center">
                                <h1 className="text-7xl md:text-8xl font-serif font-bold tracking-tight text-gray-900 text-center">
                                    Auto Academic Paper
                                </h1>
                                <p className="max-w-4xl mx-auto text-3xl font-sans text-gray-500 text-center">
                                    Transform rough drafts into verified research papers.
                                </p>
                            </div>
                        )}

                        {/* Upload Zone - SQUASHED to max-w-3xl, min-h-[240px] */}
                        {!stagedFile && (
                            <>
                                {!isAIConfigured ? (
                                    <button
                                        type="button"
                                        onClick={() => setLocation("/config")}
                                        className="relative group w-full max-w-3xl mx-auto min-h-[240px] flex flex-col items-center justify-center gap-5 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                                        aria-label="Configure AI to Enable Upload"
                                    >
                                        <div className="flex flex-col items-center gap-4 text-gray-400 group-hover:text-gray-500 transition-colors">
                                            <div className="p-4 bg-white border border-gray-100 rounded-full shadow-md group-hover:scale-110 transition-transform duration-200">
                                                <Settings2 className="w-12 h-12" strokeWidth={1} /> {/* W-12 (48px) */}
                                            </div>
                                            <div className="space-y-1 text-center">
                                                <span className="block text-2xl font-serif font-medium text-gray-900">
                                                    Configure AI to Enable Upload
                                                </span>
                                                <span className="block text-lg text-gray-400">
                                                    Click to setup API keys
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                ) : (
                                    <div
                                        {...getRootProps()}
                                        className={`
                                            relative group w-full max-w-3xl mx-auto min-h-[240px]
                                            flex flex-col items-center justify-center gap-5
                                            bg-white rounded-2xl cursor-pointer
                                            border-2 border-dashed transition-all duration-200
                                            focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                                            ${isDragActive
                                                ? "border-black bg-gray-50 scale-[1.01]"
                                                : "border-gray-200 hover:border-gray-400 hover:bg-gray-50/50"
                                            }
                                        `}
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Drop Manuscript Here"
                                    >
                                        <input {...getInputProps()} />
                                        <div className="p-4 bg-white border border-gray-100 rounded-full shadow-md group-hover:scale-110 transition-transform duration-200">
                                            <Upload className="w-12 h-12 text-gray-700" strokeWidth={1} />
                                        </div>
                                        <div className="space-y-1 text-center">
                                            <h3 className="text-2xl font-serif text-gray-900">
                                                Drop Manuscript Here
                                            </h3>
                                            <p className="text-lg font-medium text-gray-500">
                                                PDF, TXT, or MD
                                            </p>
                                        </div>
                                        <Button variant="outline" size="lg" className="rounded-full text-lg h-12 px-8">
                                            Select from Device
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Job Ticket - Kept Readable (text-lg) */}
                        {stagedFile && (
                            <div className="duration-500 animate-in fade-in slide-in-from-bottom-4">
                                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                                    <div className="space-y-8 lg:col-span-2">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-3xl font-serif font-bold text-gray-900">
                                                Job Ticket
                                            </h2>
                                            <Button
                                                variant="ghost"
                                                size="lg"
                                                onClick={handleRemoveFile}
                                                className="text-red-600 hover:bg-red-50 hover:text-red-700 text-lg h-12"
                                            >
                                                Cancel
                                            </Button>
                                        </div>

                                        <FileCard
                                            fileName={stagedFile.name}
                                            fileSize={(stagedFile.size / 1024 / 1024).toFixed(2) + " MB"}
                                            fileType={stagedFile.type.split("/")[1] || "file"}
                                            onRemove={handleRemoveFile}
                                        />

                                        <Card className="p-8 space-y-6">
                                            <div className="space-y-6">
                                                <h3 className="flex items-center gap-3 font-medium text-xl text-gray-900">
                                                    <User className="w-6 h-6" /> Author Information
                                                </h3>
                                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                                    <div className="space-y-3">
                                                        <Label className="text-lg">Author Name</Label>
                                                        <Input
                                                            placeholder="e.g. Dr. Jane Smith"
                                                            value={authorName}
                                                            onChange={(e) => setAuthorName(e.target.value)}
                                                            className="text-lg h-12 px-4"
                                                        />
                                                    </div>
                                                    <div className="space-y-3">
                                                        <Label className="text-lg">Affiliation</Label>
                                                        <Input
                                                            placeholder="e.g. University of Example"
                                                            value={authorAffiliation}
                                                            onChange={(e) => setAuthorAffiliation(e.target.value)}
                                                            className="text-lg h-12 px-4"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>

                                        <Card className="p-8 space-y-6">
                                            <h3 className="flex items-center gap-3 font-medium text-xl text-gray-900">
                                                <Settings2 className="w-6 h-6" /> Advanced Options
                                            </h3>
                                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                                {/* Advanced Options - Readable */}
                                                <div className="flex items-center space-x-3">
                                                    <Checkbox
                                                        id="citations"
                                                        checked={advancedOptions.citations}
                                                        onCheckedChange={() => handleOptionToggle('citations')}
                                                        className="w-5 h-5"
                                                        disabled
                                                    />
                                                    <Label htmlFor="citations" className="cursor-pointer text-lg">Citation Verification</Label>
                                                </div>
                                                {/* ... (Kept loops shorter for brevity in plan, but writing full code in tool) */}
                                                <div className="flex items-center space-x-3">
                                                    <Checkbox
                                                        id="formula"
                                                        checked={advancedOptions.formula}
                                                        onCheckedChange={() => handleOptionToggle('formula')}
                                                        className="w-5 h-5"
                                                        disabled
                                                    />
                                                    <Label htmlFor="formula" className="cursor-pointer text-lg">Formula Editing</Label>
                                                </div>
                                                <div className="flex items-center space-x-3">
                                                    <Checkbox
                                                        id="hypothesis"
                                                        checked={advancedOptions.hypothesis}
                                                        onCheckedChange={() => handleOptionToggle('hypothesis')}
                                                        className="w-5 h-5"
                                                        disabled
                                                    />
                                                    <Label htmlFor="hypothesis" className="cursor-pointer text-lg">Hypothesis Highlighting</Label>
                                                </div>
                                                <div className="flex items-center space-x-3">
                                                    <Checkbox
                                                        id="diagram"
                                                        checked={advancedOptions.diagram}
                                                        onCheckedChange={() => handleOptionToggle('diagram')}
                                                        className="w-5 h-5"
                                                        disabled
                                                    />
                                                    <Label htmlFor="diagram" className="cursor-pointer text-lg">Diagram Generation</Label>
                                                </div>
                                                <div className="flex items-center space-x-3">
                                                    <Checkbox
                                                        id="logical_structure"
                                                        checked={advancedOptions.logical_structure}
                                                        onCheckedChange={() => handleOptionToggle('logical_structure')}
                                                        className="w-5 h-5"
                                                        disabled
                                                    />
                                                    <Label htmlFor="logical_structure" className="cursor-pointer text-lg">Logical Structure</Label>
                                                </div>
                                                <div className="flex items-center space-x-3">
                                                    <Checkbox
                                                        id="symbol"
                                                        checked={advancedOptions.symbol}
                                                        onCheckedChange={() => handleOptionToggle('symbol')}
                                                        className="w-5 h-5"
                                                        disabled
                                                    />
                                                    <Label htmlFor="symbol" className="cursor-pointer text-lg">Symbol Normalization</Label>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>

                                    <div className="space-y-6">
                                        <Card className="p-8 border-gray-200 bg-gray-50">
                                            <h3 className="mb-6 font-serif text-2xl font-bold">Job Summary</h3>
                                            <div className="space-y-4 text-lg">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">File</span>
                                                    <span className="font-medium truncate max-w-[200px]">{stagedFile.name}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Enhancements</span>
                                                    <span className="font-medium">{Object.values(advancedOptions).filter(Boolean).length} Selected</span>
                                                </div>
                                            </div>

                                            <div className="pt-8 mt-8 space-y-6 border-t border-gray-200">
                                                <div className="space-y-3">
                                                    <Label className="text-lg">Paper Type</Label>
                                                    <RadioGroup value={paperType} onValueChange={setPaperType}>
                                                        {paperTypes.map(t => (
                                                            <div key={t.value} className="flex items-center space-x-3">
                                                                <RadioGroupItem value={t.value} id={`paper-${t.value}`} className="w-5 h-5" />
                                                                <Label htmlFor={`paper-${t.value}`} className="font-normal cursor-pointer text-lg">{t.label}</Label>
                                                            </div>
                                                        ))}
                                                    </RadioGroup>
                                                </div>

                                                <div className="space-y-3">
                                                    <Label className="text-lg">Enhancement Level</Label>
                                                    <RadioGroup value={enhancementLevel} onValueChange={setEnhancementLevel}>
                                                        {enhancementLevels.map(l => (
                                                            <div key={l.value} className="flex items-center space-x-3">
                                                                <RadioGroupItem value={l.value} id={l.value} className="w-5 h-5" />
                                                                <Label htmlFor={l.value} className="font-normal cursor-pointer text-lg">{l.label}</Label>
                                                            </div>
                                                        ))}
                                                    </RadioGroup>
                                                </div>

                                                <div className="space-y-3">
                                                    <Label className="text-lg">Review Depth</Label>
                                                    <RadioGroup value={reviewDepth} onValueChange={(v) => setReviewDepth(v as "quick" | "deep")}>
                                                        {reviewDepthOptions.map(r => (
                                                            <div key={r.value} className="flex items-start space-x-3">
                                                                <RadioGroupItem value={r.value} id={`review-${r.value}`} className="mt-1 w-5 h-5" />
                                                                <div className="flex flex-col">
                                                                    <Label htmlFor={`review-${r.value}`} className="font-normal cursor-pointer text-lg">{r.label}</Label>
                                                                    <span className="text-base text-gray-400">{r.description}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </RadioGroup>
                                                </div>

                                                {/* v1.9.2: Inline Error Display */}
                                                {jobError && (
                                                    <Alert variant="destructive" className="mb-4">
                                                        <XCircle className="w-5 h-5" />
                                                        <AlertTitle className="flex items-center justify-between">
                                                            <span>Processing Failed</span>
                                                            <Button variant="ghost" size="sm" onClick={clearJobError} className="h-6 px-2 text-xs">
                                                                Dismiss
                                                            </Button>
                                                        </AlertTitle>
                                                        <AlertDescription className="mt-2">
                                                            <pre className="text-sm whitespace-pre-wrap break-all font-mono bg-destructive/10 p-3 rounded-md max-h-40 overflow-y-auto select-text cursor-text">
                                                                {jobError}
                                                            </pre>
                                                        </AlertDescription>
                                                    </Alert>
                                                )}

                                                <Button
                                                    size="lg"
                                                    className="w-full text-xl h-14"
                                                    onClick={() => createJobMutation.mutate()}
                                                    disabled={createJobMutation.isPending}
                                                >
                                                    {createJobMutation.isPending ? "Processing..." : "Submit Job"}
                                                </Button>
                                            </div>
                                        </Card>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Features Grid - Scaled Up: text-xl/lg */}
                        {!stagedFile && (
                            <div className="grid max-w-6xl gap-8 pt-4 mx-auto md:grid-cols-3">
                                <div className="flex flex-col items-center p-4 space-y-4 text-center">
                                    <div className="p-3 rounded-xl bg-gray-50">
                                        <ListChecks className="w-8 h-8 text-gray-700" />
                                    </div>
                                    <h3 className="font-semibold text-xl text-gray-900">Verified Citations</h3>
                                    <p className="text-lg leading-relaxed text-gray-500">
                                        Instantly format references according to any style guide.
                                    </p>
                                </div>
                                <div className="flex flex-col items-center p-4 space-y-4 text-center">
                                    <div className="p-3 rounded-xl bg-gray-50">
                                        <Code className="w-8 h-8 text-gray-700" />
                                    </div>
                                    <h3 className="font-semibold text-xl text-gray-900">Automated LaTeX</h3>
                                    <p className="text-lg leading-relaxed text-gray-500">
                                        Generate perfect mathematical typesetting and document structure.
                                    </p>
                                </div>
                                <div className="flex flex-col items-center p-4 space-y-4 text-center">
                                    <div className="p-3 rounded-xl bg-gray-50">
                                        <ChartLine className="w-8 h-8 text-gray-700" />
                                    </div>
                                    <h3 className="font-semibold text-xl text-gray-900">Vector Diagrams</h3>
                                    <p className="text-lg leading-relaxed text-gray-500">
                                        Convert sketches and images into sharp, scalable figures.
                                    </p>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
}
