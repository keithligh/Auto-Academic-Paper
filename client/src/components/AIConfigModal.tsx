/*
 * Copyright © 2025 Keith Li <keith@keithli.com>
 *
 * This file is part of Auto Academic Paper.
 *
 * Auto Academic Paper is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Auto Academic Paper is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Auto Academic Paper. If not, see <https://www.gnu.org/licenses/>.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, CheckCircle2, XCircle, RefreshCw, AlertTriangle, Info } from "lucide-react";
import { useAIConfig } from "@/context/AIConfigContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

export function AIConfigModal({ trigger }: { trigger?: React.ReactNode }) {
    const { config, updateProviderConfig, verifyConnection, isVerifying, resetConfig } = useAIConfig();
    const [activeTab, setActiveTab] = useState("writer");

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

    const renderProviderStatus = (isVerified: boolean) => {
        if (isVerified) {
            return <Badge variant="default" className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</Badge>;
        }
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertTriangle className="w-3 h-3 mr-1" /> Unverified</Badge>;
    };

    const getPlaceholder = (provider: string) => {
        if (provider === "poe") return "Your Poe API Key";
        if (provider === "openai") return "sk-...........................";
        if (provider === "anthropic") return "sk-ant-.......................";
        if (provider === "gemini") return "AIza..........................";
        return "API Key";
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <Settings className="w-4 h-4" />
                        AI Configuration
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-2xl font-serif">AI Agent Configuration</DialogTitle>
                            <DialogDescription>
                                Configure the "Bring Your Own Key" (BYOK) settings for each agent in the pipeline.
                            </DialogDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={resetConfig} className="text-muted-foreground">
                            Reset Defaults
                        </Button>
                    </div>
                    {/* Privacy Note - Single row for space efficiency */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-blue-800 text-sm">
                        <Info className="w-4 h-4 flex-shrink-0" />
                        <span><strong>100% Local:</strong> This app runs entirely on your machine. No remote servers. Only LLM API calls go online. Use Ollama for fully offline mode.</span>
                    </div>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden">
                    <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="flex-1 flex h-full">
                        <div className="w-64 border-r bg-muted/30 p-4 flex flex-col gap-2">
                            {/* Verification Status Summary */}
                            {(() => {
                                const verifiedCount = [
                                    config.writer.isVerified,
                                    config.strategist.isVerified,
                                    config.librarian.isVerified
                                ].filter(Boolean).length;
                                const allVerified = verifiedCount === 3;
                                return (
                                    <div className={`mb-4 p-3 rounded-lg border ${allVerified ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            {allVerified ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                            ) : (
                                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                            )}
                                            <span className={`text-sm font-semibold ${allVerified ? 'text-green-700' : 'text-amber-700'}`}>
                                                {allVerified ? 'Ready to Use' : `${verifiedCount}/3 Verified`}
                                            </span>
                                        </div>
                                        {!allVerified && (
                                            <p className="text-[10px] text-amber-600 leading-tight">
                                                Test each provider below before processing documents.
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}

                            <TabsList className="flex flex-col h-auto bg-transparent gap-2 w-full">
                                <TabsTrigger value="writer" className="w-full justify-between px-4 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                    <div className="text-left">
                                        <div className="font-semibold">The Writer</div>
                                        <div className="text-xs text-muted-foreground">Drafting & Editing</div>
                                    </div>
                                    {config.writer.isVerified ? (
                                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    ) : (
                                        <XCircle className="w-4 h-4 text-muted-foreground/50" />
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="strategist" className="w-full justify-between px-4 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                    <div className="text-left">
                                        <div className="font-semibold">The Strategist</div>
                                        <div className="text-xs text-muted-foreground">Critique & Planning</div>
                                    </div>
                                    {config.strategist.isVerified ? (
                                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    ) : (
                                        <XCircle className="w-4 h-4 text-muted-foreground/50" />
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="librarian" className="w-full justify-between px-4 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                    <div className="text-left">
                                        <div className="font-semibold">The Librarian</div>
                                        <div className="text-xs text-muted-foreground">Research & Fact Check</div>
                                    </div>
                                    {config.librarian.isVerified ? (
                                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    ) : (
                                        <XCircle className="w-4 h-4 text-muted-foreground/50" />
                                    )}
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 p-6 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                            {/* STRATEGIST TAB */}
                            <TabsContent value="strategist" className="mt-0 space-y-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-medium">The Strategist (Critic)</h3>
                                        <p className="text-sm text-muted-foreground">Responsible for analyzing drafts, identifying weak claims, and planning research.</p>
                                    </div>
                                    {renderProviderStatus(config.strategist.isVerified || false)}
                                </div>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Provider Settings</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Provider</Label>
                                                <Select
                                                    value={config.strategist.provider}
                                                    onValueChange={(val: any) => updateProviderConfig("strategist", { provider: val })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {providers.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Model Name</Label>
                                                <Input
                                                    value={config.strategist.model}
                                                    onChange={(e) => updateProviderConfig("strategist", { model: e.target.value })}
                                                    placeholder="e.g. Claude-Sonnet-4.5, GPT-5.1, Grok-4.1"
                                                />
                                                <p className="text-[10px] text-muted-foreground">Must match the provider's model ID exactly.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>API Key</Label>
                                            <Input
                                                type="password"
                                                value={config.strategist.apiKey}
                                                onChange={(e) => updateProviderConfig("strategist", { apiKey: e.target.value })}
                                                placeholder={getPlaceholder(config.strategist.provider)}
                                            />
                                        </div>

                                        {config.strategist.provider === "custom" && (
                                            <div className="space-y-2">
                                                <Label>Base URL</Label>
                                                <Input
                                                    value={config.strategist.baseURL || ""}
                                                    onChange={(e) => updateProviderConfig("strategist", { baseURL: e.target.value })}
                                                    placeholder="https://api.example.com/v1"
                                                />
                                            </div>
                                        )}

                                        <div className="pt-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => verifyConnection("strategist")}
                                                disabled={isVerifying}
                                            >
                                                Test Connection
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* LIBRARIAN TAB */}
                            <TabsContent value="librarian" className="mt-0 space-y-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-medium">The Librarian (Researcher)</h3>
                                        <p className="text-sm text-muted-foreground">Responsible for finding citations and verifying facts. Needs web access.</p>
                                    </div>
                                    {renderProviderStatus(config.librarian.isVerified || false)}
                                </div>

                                <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-800 mb-4">
                                    <AlertTriangle className="w-4 h-4" />
                                    <AlertTitle>Web Search Required</AlertTitle>
                                    <AlertDescription>
                                        The Librarian requires a model capable of web search (e.g., Perplexity, Gemini, or Poe with web-enabled bots).
                                    </AlertDescription>
                                </Alert>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Provider Settings</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Provider</Label>
                                                <Select
                                                    value={config.librarian.provider}
                                                    onValueChange={(val: any) => updateProviderConfig("librarian", { provider: val })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {providers.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Model Name</Label>
                                                <Input
                                                    value={config.librarian.model}
                                                    onChange={(e) => updateProviderConfig("librarian", { model: e.target.value })}
                                                    placeholder="e.g. Gemini-2.5-Pro, Gemini-3.0-Pro"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>API Key</Label>
                                            <Input
                                                type="password"
                                                value={config.librarian.apiKey}
                                                onChange={(e) => updateProviderConfig("librarian", { apiKey: e.target.value })}
                                                placeholder={getPlaceholder(config.librarian.provider)}
                                            />
                                        </div>

                                        <div className="pt-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => verifyConnection("librarian")}
                                                disabled={isVerifying}
                                            >
                                                Test Connection
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* WRITER TAB */}
                            <TabsContent value="writer" className="mt-0 space-y-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-medium">The Writer (Editor)</h3>
                                        <p className="text-sm text-muted-foreground">Responsible for initial drafting and final citation insertion.</p>
                                    </div>
                                    {renderProviderStatus(config.writer.isVerified || false)}
                                </div>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Provider Settings</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Provider</Label>
                                                <Select
                                                    value={config.writer.provider}
                                                    onValueChange={(val: any) => updateProviderConfig("writer", { provider: val })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {providers.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Model Name</Label>
                                                <Input
                                                    value={config.writer.model}
                                                    onChange={(e) => updateProviderConfig("writer", { model: e.target.value })}
                                                    placeholder="e.g. Claude-Sonnet-4.5, GPT-5.1, o3-pro"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>API Key</Label>
                                            <Input
                                                type="password"
                                                value={config.writer.apiKey}
                                                onChange={(e) => updateProviderConfig("writer", { apiKey: e.target.value })}
                                                placeholder={getPlaceholder(config.writer.provider)}
                                            />
                                        </div>

                                        <div className="pt-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => verifyConnection("writer")}
                                                disabled={isVerifying}
                                            >
                                                Test Connection
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
