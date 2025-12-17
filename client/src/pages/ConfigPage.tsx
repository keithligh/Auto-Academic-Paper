import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Info, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useAIConfig } from "@/context/AIConfigContext";

const providers = [
    { value: "poe", label: "Poe API (Proxy)" },
    { value: "openrouter", label: "OpenRouter" },
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "gemini", label: "Google Gemini" },
    { value: "grok", label: "xAI (Grok)" },
    { value: "ollama", label: "Ollama (Local)" },
    { value: "custom", label: "Custom / Other" },
];

const getPlaceholder = (provider: string) => {
    if (provider === "poe") return "Your Poe API Key";
    if (provider === "openai") return "sk-...........................";
    if (provider === "anthropic") return "sk-ant-.......................";
    if (provider === "gemini") return "AIza..........................";
    return "API Key";
};

interface ProviderSectionProps {
    title: string;
    description: string;
    role: "writer" | "strategist" | "librarian";
    isExpanded: boolean;
    onToggle: () => void;
    showWebSearchWarning?: boolean;
    showSameAsWriterSwitch?: boolean;
    useSameAsWriter?: boolean;
    onToggleSameAsWriter?: (checked: boolean) => void;
}

function ProviderSection({ title, description, role, isExpanded, onToggle, showWebSearchWarning, showSameAsWriterSwitch, useSameAsWriter, onToggleSameAsWriter }: ProviderSectionProps) {
    const { config, updateProviderConfig, verifyConnection, isVerifying, verifyingScope, lastError, clearError } = useAIConfig();
    const providerConfig = config[role];

    const isTestingThis = verifyingScope === role;
    const hasError = lastError && lastError.scope === role;  // v1.9.2: Inline error

    return (
        <Card className="overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full text-left p-6 flex items-center justify-between hover:bg-muted/50 transition-colors"
                type="button"
            >
                <div className="flex items-center gap-4">
                    {providerConfig.isVerified ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                    ) : (
                        <XCircle className="w-6 h-6 text-muted-foreground/50 flex-shrink-0" />
                    )}
                    <div>
                        <h3 className="font-semibold text-xl text-gray-900">{title}</h3>
                        <p className="text-base text-gray-500">{description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {providerConfig.isVerified ? (
                        <Badge variant="default" className="text-base py-1 px-3 bg-green-600 hover:bg-green-700 hidden sm:flex">
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Connected
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-base py-1 px-3 text-yellow-600 border-yellow-600 hidden sm:flex">
                            <AlertTriangle className="w-4 h-4 mr-2" /> Unverified
                        </Badge>
                    )}
                    {isExpanded ? (
                        <ChevronUp className="w-6 h-6 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="w-6 h-6 text-muted-foreground" />
                    )}
                </div>
            </button>

            {isExpanded && (
                <CardContent className="pt-0 pb-8 px-6 space-y-6 border-t">
                    {/* "Same as Writer" Switch - High Visibility */}
                    {showSameAsWriterSwitch && (
                        <div className="flex items-center justify-between py-4 px-5 bg-muted/50 rounded-xl mt-6">
                            <Label htmlFor="same-as-writer" className="text-lg font-medium cursor-pointer text-gray-700">
                                Use same settings as The Writer
                            </Label>
                            <Switch
                                id="same-as-writer"
                                checked={useSameAsWriter}
                                onCheckedChange={onToggleSameAsWriter}
                                className="scale-110"
                            />
                        </div>
                    )}

                    {showWebSearchWarning && (
                        <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-900 mt-6">
                            <AlertTriangle className="w-5 h-5 mt-0.5" />
                            <div className="ml-2">
                                <AlertTitle className="text-lg font-semibold">Web Search Required</AlertTitle>
                                <AlertDescription className="text-base mt-1">
                                    The Librarian requires a model capable of web search (e.g., Perplexity, Gemini, or Poe with web-enabled bots).
                                </AlertDescription>
                            </div>
                        </Alert>
                    )}

                    {/* Show message when using same as writer, otherwise show form */}
                    {useSameAsWriter ? (
                        <div className="text-lg text-muted-foreground py-6 text-center bg-muted/30 rounded-xl mt-6 font-medium">
                            Using same settings as The Writer
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div className="space-y-3">
                                    <Label className="text-lg font-medium text-gray-700">Provider</Label>
                                    <Select
                                        value={providerConfig.provider}
                                        onValueChange={(val: any) => {
                                            if (role === 'librarian') {
                                                // Reset model when switching providers if switching FROM/TO Poe for Librarian
                                                const isPoe = val === "poe";
                                                const isGrok = val === "grok";

                                                if (isPoe) {
                                                    updateProviderConfig(role, { provider: val, model: "Gemini25Pro-AAP" });
                                                } else if (isGrok) {
                                                    updateProviderConfig(role, { provider: val, model: "grok-4-1-fast" });
                                                } else {
                                                    // Manual Entry: Do not touch the model field for other providers.
                                                    updateProviderConfig(role, { provider: val });
                                                }
                                            } else {
                                                updateProviderConfig(role, { provider: val });
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="h-12 text-lg px-4">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {role === 'librarian'
                                                ? providers.filter(p => ["poe", "openrouter", "grok"].includes(p.value)).map(p => <SelectItem key={p.value} value={p.value} className="text-lg py-3">{p.label}</SelectItem>)
                                                : providers.map(p => <SelectItem key={p.value} value={p.value} className="text-lg py-3">{p.label}</SelectItem>)
                                            }
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-lg font-medium text-gray-700">Model Name</Label>

                                    {role === 'librarian' && providerConfig.provider === 'poe' ? (
                                        <Select
                                            value={providerConfig.model}
                                            onValueChange={(val) => updateProviderConfig(role, { model: val })}
                                        >
                                            <SelectTrigger className="h-12 text-lg px-4">
                                                <SelectValue placeholder="Select Poe Model" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Gemini25Pro-AAP" className="text-lg py-3">Gemini 2.5 Pro (Custom Bot)</SelectItem>
                                                <SelectItem value="Gemini25Flash-AAP" className="text-lg py-3">Gemini 2.5 Flash (Custom Bot)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : role === 'librarian' && providerConfig.provider === 'grok' ? (
                                        <Select
                                            value={providerConfig.model}
                                            onValueChange={(val) => updateProviderConfig(role, { model: val })}
                                        >
                                            <SelectTrigger className="h-12 text-lg px-4">
                                                <SelectValue placeholder="Select Grok Model" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="grok-4-1-fast" className="text-lg py-3">grok-4-1-fast</SelectItem>
                                                <SelectItem value="grok-4-1-fast-non-reasoning" className="text-lg py-3">grok-4-1-fast-non-reasoning</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input
                                            value={providerConfig.model}
                                            onChange={(e) => updateProviderConfig(role, { model: e.target.value })}
                                            placeholder="e.g. Claude-Sonnet-4.5, GPT-5.2"
                                            className="h-12 text-lg px-4"
                                        />
                                    )}

                                    {role === 'librarian' && providerConfig.provider === 'poe' ? (
                                        <p className="text-base text-muted-foreground">Only these models are whitelisted for Librarian on Poe.</p>
                                    ) : (
                                        <p className="text-base text-muted-foreground">Must match the provider's model ID exactly.</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <Label className="text-lg font-medium text-gray-700">API Key</Label>
                                <Input
                                    type="password"
                                    value={providerConfig.apiKey}
                                    onChange={(e) => updateProviderConfig(role, { apiKey: e.target.value })}
                                    placeholder={getPlaceholder(providerConfig.provider)}
                                    className="h-12 text-lg px-4 font-mono"
                                />
                            </div>

                            {providerConfig.provider === "custom" && (
                                <div className="space-y-3 pt-2">
                                    <Label className="text-lg font-medium text-gray-700">Base URL</Label>
                                    <Input
                                        value={providerConfig.baseURL || ""}
                                        onChange={(e) => updateProviderConfig(role, { baseURL: e.target.value })}
                                        placeholder="https://api.example.com/v1"
                                        className="h-12 text-lg px-4 font-mono"
                                    />
                                </div>
                            )}

                            <div className="pt-4">
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    onClick={() => verifyConnection(role)}
                                    disabled={isVerifying}
                                    className="h-12 px-8 text-lg font-medium w-full md:w-auto min-w-[180px]"
                                >
                                    {isTestingThis ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                            Verifying...
                                        </>
                                    ) : (
                                        "Test Connection"
                                    )}
                                </Button>

                                {/* v1.9.2: Inline Error Display */}
                                {hasError && (
                                    <Alert variant="destructive" className="mt-4">
                                        <XCircle className="w-5 h-5" />
                                        <AlertTitle className="flex items-center justify-between">
                                            <span>Connection Failed</span>
                                            <Button variant="ghost" size="sm" onClick={clearError} className="h-6 px-2 text-xs">
                                                Dismiss
                                            </Button>
                                        </AlertTitle>
                                        <AlertDescription className="mt-2">
                                            <pre className="text-sm whitespace-pre-wrap break-all font-mono bg-destructive/10 p-3 rounded-md max-h-40 overflow-y-auto select-text cursor-text">
                                                {lastError?.message}
                                            </pre>
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </>
                    )}
                </CardContent>
            )}
        </Card>
    );
}

export default function ConfigPage() {
    const [, setLocation] = useLocation();
    const { config, updateProviderConfig, resetConfig, verifyConnection } = useAIConfig();
    const [expandedSection, setExpandedSection] = useState<string | null>("writer");
    const [useSameAsWriter, setUseSameAsWriter] = useState(false);

    const verifiedCount = [
        config.writer.isVerified,
        config.strategist.isVerified,
        config.librarian.isVerified
    ].filter(Boolean).length;
    const allVerified = verifiedCount === 3;

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    // Handler for "Same as Writer" toggle
    const handleSameAsWriterToggle = async (checked: boolean) => {
        setUseSameAsWriter(checked);
        if (checked) {
            // Copy Writer config to Strategist
            updateProviderConfig("strategist", {
                provider: config.writer.provider,
                model: config.writer.model,
                apiKey: config.writer.apiKey,
                baseURL: config.writer.baseURL,
            });

            // Auto-verify using the NEW intent (since state update is async)
            if (config.writer.isVerified) {
                const tempConfig = {
                    ...config,
                    strategist: {
                        ...config.strategist, // keep other fields like isVerified (though it will be reset by updateProviderConfig)
                        provider: config.writer.provider,
                        model: config.writer.model,
                        apiKey: config.writer.apiKey,
                        baseURL: config.writer.baseURL,
                    }
                };
                await verifyConnection("strategist", tempConfig);
            }
        }
    };

    return (
        <div className="min-h-screen bg-background font-sans">
            {/* Header - High Visibility */}
            {/* Header - Standardized Hybrid Typography */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
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
                            className="font-serif text-2xl font-bold tracking-tight cursor-pointer hover:opacity-80 transition-opacity hidden md:block"
                            onClick={() => setLocation("/")}
                        >
                            Auto Academic Paper
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
                {/* Page Title & Controls - Hybrid Typography */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-100 pb-8">
                    <div>
                        <h1 className="text-4xl font-serif font-bold text-gray-900 tracking-tight">Configuration</h1>
                        <p className="text-lg text-gray-500 font-sans mt-2">Manage AI providers and model settings</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="lg"
                        onClick={resetConfig}
                        className="text-muted-foreground hover:text-red-600 font-sans"
                    >
                        Reset to Defaults
                    </Button>
                </div>

                {/* Privacy & Security Notice - Scaled Up */}
                <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-green-900 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Info className="w-6 h-6 flex-shrink-0 text-green-700" />
                        </div>
                        <span className="text-xl font-bold">Your API Keys Are 100% Safe</span>
                    </div>
                    <ul className="text-lg space-y-2 ml-2 pl-4 list-disc text-green-800/90 leading-relaxed">
                        <li><strong>Stored locally</strong> in your browser (localStorage) — never on any server</li>
                        <li><strong>Sent only</strong> to the AI providers you configure (OpenAI, Anthropic, etc.)</li>
                        <li><strong>No remote servers</strong> — this entire app runs on your local machine</li>
                        <li><strong>Go fully offline</strong> with Ollama for complete privacy</li>
                    </ul>
                </div>

                {/* Status Card - Scaled Up */}
                <div className={`p-6 rounded-xl border-2 ${allVerified ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'} transition-all duration-300`}>
                    <div className="flex items-center gap-5">
                        {allVerified ? (
                            <div className="p-3 bg-white rounded-full shadow-sm">
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </div>
                        ) : (
                            <div className="p-3 bg-white rounded-full shadow-sm">
                                <AlertTriangle className="w-8 h-8 text-amber-600" />
                            </div>
                        )}
                        <div>
                            <p className={`text-2xl font-bold ${allVerified ? 'text-green-800' : 'text-amber-800'}`}>
                                {allVerified ? 'All Providers Ready' : `${verifiedCount}/3 Providers Verified`}
                            </p>
                            {!allVerified && (
                                <p className="text-lg text-amber-700 mt-1 font-medium">
                                    Test each provider below before processing documents.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Provider Sections - Vertical Stack */}
                <div className="space-y-6">
                    <ProviderSection
                        title="The Writer"
                        description="Drafting & Editing"
                        role="writer"
                        isExpanded={expandedSection === "writer"}
                        onToggle={() => toggleSection("writer")}
                    />

                    <ProviderSection
                        title="The Strategist"
                        description="Critique & Planning"
                        role="strategist"
                        isExpanded={expandedSection === "strategist"}
                        onToggle={() => toggleSection("strategist")}
                        showSameAsWriterSwitch={true}
                        useSameAsWriter={useSameAsWriter}
                        onToggleSameAsWriter={handleSameAsWriterToggle}
                    />

                    <ProviderSection
                        title="The Librarian"
                        description="Research & Fact Check"
                        role="librarian"
                        isExpanded={expandedSection === "librarian"}
                        onToggle={() => toggleSection("librarian")}
                        showWebSearchWarning={true}
                    />
                </div>

                {/* Continue Button - Huge */}
                {allVerified && (
                    <div className="pt-6 pb-12">
                        <Button
                            size="lg"
                            className="w-full md:w-auto h-16 text-xl px-10 rounded-xl shadow-lg hover:shadow-xl transition-all"
                            onClick={() => setLocation("/")}
                        >
                            Continue to Upload
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}
