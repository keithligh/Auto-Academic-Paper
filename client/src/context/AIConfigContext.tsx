import React, { createContext, useContext, useState, useEffect } from "react";
import { AIConfig, ProviderConfig, SearchConfig, defaultAIConfig } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AIConfigContextType {
    config: AIConfig;
    updateConfig: (newConfig: Partial<AIConfig>) => void;
    updateProviderConfig: (type: keyof AIConfig, updates: Partial<ProviderConfig>) => void;
    resetConfig: () => void;
    verifyConnection: (scope?: string, configOverride?: AIConfig) => Promise<boolean>;
    isVerifying: boolean;
    verifyingScope: string | null;
    lastError: { scope: string; message: string } | null;  // v1.9.2: Persistent error
    clearError: () => void;
}

const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
    provider: "poe",
    apiKey: "",
    model: "Claude-Opus-4.5",
    isVerified: false
};

const DEFAULT_SEARCH_CONFIG: SearchConfig = {
    provider: "none",
    apiKey: ""
};

const DEFAULT_CONFIG: AIConfig = {
    writer: { ...DEFAULT_PROVIDER_CONFIG },
    librarian: { ...DEFAULT_PROVIDER_CONFIG, model: "Gemini25Pro-AAP" },
    strategist: { ...DEFAULT_PROVIDER_CONFIG },
    search: { ...DEFAULT_SEARCH_CONFIG }
};

const AIConfigContext = createContext<AIConfigContextType | undefined>(undefined);

export function AIConfigProvider({ children }: { children: React.ReactNode }) {
    // Initialize from localStorage or defaults
    const [config, setConfig] = useState<AIConfig>(() => {
        const saved = localStorage.getItem("ai_config_v1");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge with defaults to ensure structure
                return { ...DEFAULT_CONFIG, ...parsed };
            } catch (e) {
                console.error("Failed to parse saved config", e);
                return DEFAULT_CONFIG;
            }
        }
        return DEFAULT_CONFIG;
    });

    const [verifyingScope, setVerifyingScope] = useState<string | null>(null);
    const [lastError, setLastError] = useState<{ scope: string; message: string } | null>(null);  // v1.9.2
    const { toast } = useToast();

    const clearError = () => setLastError(null);

    // Persist to localStorage whenever config changes
    useEffect(() => {
        localStorage.setItem("ai_config_v1", JSON.stringify(config));
    }, [config]);

    const updateConfig = (newConfig: Partial<AIConfig>) => {
        setConfig(prev => ({ ...prev, ...newConfig }));
    };

    const updateProviderConfig = (type: keyof AIConfig, updates: Partial<ProviderConfig>) => {
        setConfig(prev => {
            const current = prev[type] as ProviderConfig;
            // If critical fields change, reset verification status
            const needsReverification = updates.provider !== undefined || updates.apiKey !== undefined || updates.model !== undefined;

            return {
                ...prev,
                [type]: {
                    ...current,
                    ...updates,
                    isVerified: needsReverification ? false : current.isVerified
                }
            };
        });
    };

    const resetConfig = () => {
        setConfig(DEFAULT_CONFIG);
        toast({
            title: "Configuration Reset",
            description: "AI settings have been restored to defaults.",
        });
    };

    const verifyConnection = async (scope?: string, configOverride?: AIConfig): Promise<boolean> => {
        const activeScope = scope || 'all';
        setVerifyingScope(activeScope);
        try {
            // Use override if provided (for immediate verification after updates), otherwise use current state
            const configToVerify = configOverride || config;

            // Send config to backend for verification
            const res = await apiRequest("POST", "/api/verify-ai-config", {
                ...configToVerify,
                scope
            });

            const data = await res.json();

            if (data.status === "ok" || data.success) {
                // Mark verified providers
                setConfig(prev => {
                    const next = { ...prev };
                    if (scope) {
                        // Update specific provider
                        if (scope === 'writer' || scope === 'librarian' || scope === 'strategist') {
                            (next[scope] as ProviderConfig).isVerified = true;
                        }
                    } else {
                        // Update all
                        (next.writer as ProviderConfig).isVerified = true;
                        (next.librarian as ProviderConfig).isVerified = true;
                        (next.strategist as ProviderConfig).isVerified = true;
                    }
                    return next;
                });

                toast({
                    title: "Connection Verified",
                    description: scope ? `${scope} connected successfully.` : "All AI services connected successfully.",
                    variant: "default" // Success
                });
                return true;
            } else {
                throw new Error(data.error || "Verification failed");
            }
        } catch (error: any) {
            // v1.9.2: Set persistent error for inline display
            setLastError({ scope: scope || 'all', message: error.message });
            toast({
                title: "Connection Failed",
                description: "See error details below.",
                variant: "destructive"
            });
            return false;
        } finally {
            setVerifyingScope(null);
        }
    };

    return (
        <AIConfigContext.Provider value={{
            config,
            updateConfig,
            updateProviderConfig,
            resetConfig,
            verifyConnection,
            isVerifying: !!verifyingScope,
            verifyingScope,
            lastError,
            clearError
        }}>
            {children}
        </AIConfigContext.Provider>
    );
}

export function useAIConfig() {
    const context = useContext(AIConfigContext);
    if (context === undefined) {
        throw new Error("useAIConfig must be used within an AIConfigProvider");
    }
    return context;
}
