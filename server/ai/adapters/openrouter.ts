import OpenAI from "openai"; // Keep for type definitions if needed, or remove if unused. For now, removing SDK usage.
import { AIProvider, ProviderConfig } from "../provider";
import { extractJson } from "../utils";

export class OpenRouterProvider implements AIProvider {
    private config: ProviderConfig;
    public id: string = "openrouter";
    public model: string;
    public supportsResearch: boolean = true;

    constructor(config: ProviderConfig) {
        this.config = config;
        this.model = config.model;
    }

    async completion(prompt: string, systemPrompt: string, onProgress?: (text: string) => void, enableWebSearch?: boolean): Promise<string> {
        // FIX v1.9.1: Use explicit Exa plugin instead of :online suffix
        // This avoids 403 Forbidden errors from providers like Anthropic that may not support native web search
        const payload: any = {
            model: this.config.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            stream: true
        };

        // Add Exa web search plugin if enabled
        if (enableWebSearch) {
            payload.plugins = [{
                id: "web",
                engine: "exa",      // Force Exa instead of native to avoid provider-specific issues
                max_results: 5
            }];
            console.log(`[OpenRouter] Web search enabled with Exa plugin for model: ${this.config.model}`);
        }

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.apiKey}`,
                    "HTTP-Referer": "https://github.com/keithligh/Auto-Academic-Paper",
                    "X-Title": "Auto-Academic-Paper"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`OpenRouter API Error: ${response.status} ${response.statusText} - ${errText}`);
            }

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line === 'data: [DONE]') continue;
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const content = data.choices[0]?.delta?.content || "";
                            if (content) {
                                fullText += content;
                                if (onProgress) onProgress(fullText);
                            }
                        } catch (e) {
                            // Ignore parse errors for partial chunks
                        }
                    }
                }
            }
            return fullText;

        } catch (e: any) {
            console.error("OpenRouter Completion Error:", e);
            throw new Error(`OpenRouter completion failed: ${e.message}`);
        }
    }

    async jsonCompletion(prompt: string, systemPrompt: string, schema?: any, onProgress?: (text: string) => void, enableWebSearch?: boolean): Promise<any> {
        const enhancedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Output valid JSON only. Do not include markdown formatting like \`\`\`json.`;

        const payload = {
            model: this.config.model,
            messages: [
                { role: "system", content: enhancedSystemPrompt },
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
            stream: true,
            // OpenRouter supports 'response_format': { type: 'json_object' } for some models, but strict prompting is safer universally
        };

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.apiKey}`,
                    "HTTP-Referer": "https://github.com/keithligh/Auto-Academic-Paper",
                    "X-Title": "Auto-Academic-Paper"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`OpenRouter API Error: ${response.status} ${response.statusText} - ${errText}`);
            }

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let content = "";
            let fullText = ""; // For logging if needed

            // Simple loop detector needed? 
            // Reuse logic from Poe if necessary, but keep it simple for now.

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line === 'data: [DONE]') continue;
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const delta = data.choices[0]?.delta?.content || "";
                            if (delta) {
                                content += delta;
                                if (onProgress) onProgress(content);
                            }
                        } catch (e) { }
                    }
                }
            }

            return extractJson(content);

        } catch (e: any) {
            console.error("OpenRouter JSON Error:", e);
            throw new Error(`AI response was not valid JSON: ${e.message || String(e)}`);
        }
    }

    async research(queries: string[]): Promise<string> {
        const queryList = queries.map(q => `- ${q}`).join("\n");
        const prompt = `Perform comprehensive research on the distinction between the user's request and the available data.\n\nQueries:\n${queryList}`;

        // Strategy: Use the :online model or plugins if configured. 
        // For simplicity and robustness, we will use the existing completion logic which now supports :online suffix handling internally 
        // if we pass the enableWebSearch flag.

        // However, the research interface expects a direct string return.
        // We will call our own completion method with web search enabled.

        try {
            return await this.completion(prompt, "You are a Research Librarian. Search the web for these queries.", undefined, true);
        } catch (e) {
            console.error("OpenResearch Error:", e);
            throw e;
        }
    }
}
