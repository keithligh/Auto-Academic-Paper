import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ConversionJob } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Terminal, Loader2, Clock, ArrowLeft } from "lucide-react";

// Micro-steps for the UI visualization
// Mapped to the 6-Phase AI Pipeline (server/ai/service.ts)
// FINAL DEFINITIVE LABELS per User Request
const MICRO_STEPS = [
    { id: "init", label: "Formulating Execution Strategy", duration: 3000 },      // Phase 1
    { id: "research", label: "Conducting Online Research", duration: 8000 },      // Phase 2
    { id: "draft", label: "Synthesizing Core Arguments", duration: 6000 },        // Phase 3
    { id: "review", label: "Executing AI Peer Review", duration: 6000 },          // Phase 4 & 5
    { id: "edit", label: "Verify and Injecting Citations", duration: 6000 },      // Phase 6 (Specific User Wording)
    { id: "compile", label: "Compiling LaTeX Source", duration: 2000 },           // Compilation
];

export default function ProcessingPage() {
    const [, params] = useRoute("/processing/:id");
    const [, setLocation] = useLocation();
    const jobId = params?.id;

    // Local state
    const [logs, setLogs] = useState<string[]>([]);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [stallWarning, setStallWarning] = useState(false);
    const [userScrolled, setUserScrolled] = useState(false); // v1.9.127: Autoscroll control
    const lastUpdateRef = useRef<number>(Date.now());
    const logContainerRef = useRef<HTMLDivElement>(null);

    // Poll for job status
    const { data: job, error, isError } = useQuery<ConversionJob>({
        queryKey: ["/api/conversions", jobId],
        enabled: !!jobId,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            // Stop polling if completed or failed
            return status === "processing" || status === "pending" ? 2000 : false;
        },
        retry: false,
    });

    // Effect: Handle Job Completion/Failure
    useEffect(() => {
        if (job?.status === "completed") {
            setTimeout(() => setLocation(`/results/${jobId}`), 1000);
        }
    }, [job?.status, jobId, setLocation]);

    // Rotating status messages for long-running steps
    const [statusMessage, setStatusMessage] = useState("");

    useEffect(() => {
        const messages = [
            "Analyzing document structure...",
            "Identifying key arguments...",
            "Cross-referencing citations...",
            "Verifying academic sources...",
            "Synthesizing research data...",
            "Formatting mathematical expressions...",
            "Optimizing LaTeX code..."
        ];
        let i = 0;
        const interval = setInterval(() => {
            setStatusMessage(messages[i % messages.length]);
            i++;
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Effect: Update logs from job data (REAL-TIME LOGGING)
    useEffect(() => {
        if (job?.logs && Array.isArray(job.logs)) {
            setLogs(job.logs);
            // Auto-scroll only if user hasn't manually scrolled up (v1.9.127)
            if (logContainerRef.current && !userScrolled) {
                logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
            }
            // Update timestamp for Stall Detection
            lastUpdateRef.current = Date.now();
            setStallWarning(false);
        }
    }, [job?.logs, userScrolled]);

    // Effect: Stall Detection (The Safety Net)
    // If logs haven't changed for >10 seconds, show "Deep research" warning
    useEffect(() => {
        const interval = setInterval(() => {
            if (job?.status === 'processing' && Date.now() - lastUpdateRef.current > 10000) {
                setStallWarning(true);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [job?.status]);

    // Effect: Sync Progress Bar with Real Logs
    useEffect(() => {
        if (!job || !job.logs) return;

        const logString = job.logs.join(" ");
        let newStepIndex = 0;

        // Determine step based on log content
        // MAPPING STRATEGY: Check for highest phase first

        // Step 5: Compiling LaTeX Source
        if (logString.includes("Generating LaTeX") || logString.includes("LaTeX generation successful")) {
            newStepIndex = 5;
        }
        // Step 4: Verify and Injecting Citations (Phase 6: Editor)
        else if (logString.includes("[Phase 6/6]") || logString.includes("[Editor]")) {
            newStepIndex = 4;
        }
        // Step 3: Executing AI Peer Review (Phase 4 & 5: Critic/Rewriter)
        else if (logString.includes("[Phase 5/6]") || logString.includes("[Phase 4/6]") || logString.includes("[Rewriter]") || logString.includes("[Critic]")) {
            newStepIndex = 3;
        }
        // Step 2: Synthesizing Core Arguments (Phase 3: Thinker)
        else if (logString.includes("[Phase 3/6]") || logString.includes("[Thinker]")) {
            newStepIndex = 2;
        }
        // Step 1: Conducting Online Research (Phase 2: Librarian)
        else if (logString.includes("[Phase 2/6]") || logString.includes("[Librarian]")) {
            newStepIndex = 1;
        }
        // Step 0: Formulating Execution Strategy (Init + Phase 1: Strategist)
        else {
            newStepIndex = 0;
        }

        setActiveStepIndex(newStepIndex);
    }, [job?.logs]);

    // Initial Log
    useEffect(() => {
        if (logs.length === 0 && !job?.logs) {
            setLogs(["Initializing processing environment..."]);
        }
    }, []);

    // Error State (404)
    if (isError || (job === undefined && error)) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center space-y-6 border border-red-100 bg-red-50/50 p-8 rounded-xl">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-serif font-bold text-red-900">Job Not Found</h3>
                        <p className="text-base text-red-700 leading-relaxed">
                            The conversion job could not be found. The server may have restarted or the ID is invalid.
                        </p>
                    </div>
                    <Button onClick={() => setLocation("/")} variant="outline" size="lg" className="w-full border-red-200 text-red-900 hover:bg-red-100">
                        Return Home
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-foreground font-sans selection:bg-gray-100">
            {/* Header - High Visibility */}
            <header className="fixed top-0 w-full bg-white/90 backdrop-blur-sm border-b border-gray-100 z-50">
                {/* WIDENED HEADER TO match main content */}
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocation("/")}
                            className="md:hidden h-12 w-12"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </Button>
                        <span
                            className="font-serif font-bold text-2xl tracking-tight cursor-pointer hover:opacity-80 transition-opacity hidden md:block"
                            onClick={() => setLocation("/")}
                        >
                            Auto Academic Paper
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-mono text-gray-500 bg-gray-50 px-3 py-1.5 rounded-md">
                        <span className="font-semibold">STATUS: {job?.status?.toUpperCase() || "CONNECTING..."}</span>
                        <div className={`w-3 h-3 rounded-full ${job?.status === 'processing' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                    </div>
                </div>
            </header>

            {/* UPGRADED TO max-w-6xl for wider stance */}
            <main className="pt-32 pb-16 px-6 max-w-6xl mx-auto space-y-12">

                {/* 1. Status Heading - Scaled Up */}
                <div className="text-center space-y-6">
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 text-center mx-auto tracking-tight">
                        {job?.status === 'failed' ? 'Processing Failed' : 'Transforming into Academic Paper'}
                    </h1>
                    <p className="text-xl text-gray-500 font-sans text-center mx-auto max-w-2xl">
                        {job?.originalFileName || "Document"}
                    </p>
                    {job?.status === 'processing' && (
                        <div className="h-8 overflow-hidden">
                            <p className="text-lg text-blue-600 font-medium transition-all duration-500">
                                {statusMessage}
                            </p>
                        </div>
                    )}
                </div>

                {/* 2. Micro-Steps Visualization - SQUARE ASPECT RATIO & WIDER */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    {MICRO_STEPS.map((step, index) => {
                        const isActive = index === activeStepIndex;
                        const isCompleted = index < activeStepIndex;

                        return (
                            <div key={step.id} className={`
                relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-500 aspect-square
                ${isActive ? 'border-black bg-gray-50 shadow-md scale-105 z-10' : 'border-gray-100 bg-white'}
                ${isCompleted ? 'border-gray-200' : ''}
              `}>
                                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors duration-300
                  ${isActive ? 'bg-black text-white' : ''}
                  ${isCompleted ? 'bg-gray-100 text-gray-600' : ''}
                  ${!isActive && !isCompleted ? 'bg-gray-50 text-gray-300' : ''}
                `}>
                                    {isCompleted ? <CheckCircle2 className="w-8 h-8" /> :
                                        isActive ? <Loader2 className="w-7 h-7 animate-spin" /> :
                                            <span className="text-xl font-mono font-bold">{index + 1}</span>}
                                </div>
                                {/* Updated to Final User Request Version */}
                                <span className={`text-sm font-bold text-center leading-tight ${isActive ? 'text-black' : 'text-gray-400'}`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* 3. Live Activity Log (Console) - High Visibility Mode */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 text-base font-semibold text-gray-700">
                            <Terminal className="w-5 h-5" />
                            <span>Activity Log</span>
                        </div>
                        {stallWarning && (
                            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full animate-pulse border border-amber-100">
                                <Clock className="w-4 h-4" />
                                <span className="hidden md:inline font-medium">Deep research in progress... this may take a moment.</span>
                                <span className="md:hidden">Processing...</span>
                            </div>
                        )}
                    </div>

                    <div
                        ref={logContainerRef}
                        className="h-80 bg-gray-950 rounded-xl p-6 overflow-y-auto font-mono text-sm text-gray-300 shadow-inner scroll-smooth border border-gray-800"
                        onScroll={(e) => {
                            // v1.9.127: Autoscroll control - detect if user scrolled up
                            const el = e.currentTarget;
                            const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
                            setUserScrolled(!isAtBottom);
                        }}
                    >
                        {logs.map((log, i) => {
                            const splitIndex = log.indexOf(']');
                            const timestamp = splitIndex > -1 ? log.substring(0, splitIndex + 1) : '';
                            const message = splitIndex > -1 ? log.substring(splitIndex + 1) : log;

                            return (
                                <div key={i} className="py-1 border-l-2 border-transparent hover:border-gray-700 pl-3 transition-colors flex">
                                    <span className="text-gray-500 mr-3 flex-shrink-0 w-32">{timestamp}</span>
                                    <span className="text-gray-100">{message}</span>
                                </div>
                            );
                        })}
                        {job?.status === 'processing' && (
                            <div className="py-1 pl-3 animate-pulse text-gray-500 font-bold text-lg">
                                _
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Actions / Error Recovery - Scaled Up */}
                {job?.status === 'failed' && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="space-y-2 text-center md:text-left">
                            <h4 className="font-bold text-xl text-red-900">Processing Error</h4>
                            <p className="text-base text-red-700 max-w-xl">{job.error}</p>
                        </div>
                        <Button onClick={() => setLocation("/")} variant="destructive" size="lg" className="h-12 px-8 text-lg font-medium shadow-md hover:shadow-lg transition-all w-full md:w-auto">
                            Try Again
                        </Button>
                    </div>
                )}

            </main>
        </div>
    );
}
