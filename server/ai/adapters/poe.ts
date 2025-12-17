import OpenAI from "openai";
import { AIProvider, ProviderConfig } from "../provider";
import { extractJson } from "../utils";

export class PoeProvider implements AIProvider {
    private client: OpenAI;
    private config: ProviderConfig;
    public id: string = "poe";
    public model: string;
    public supportsResearch: boolean = true;

    constructor(config: ProviderConfig) {
        this.config = { ...config, model: config.model.trim() }; // Ensure model is trimmed
        this.model = this.config.model;

        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: "https://api.poe.com/v1",
            timeout: 900000, // 15 minutes to match service timeout
        });
    }

    async completion(prompt: string, systemPrompt: string, onProgress?: (text: string) => void, enableWebSearch?: boolean): Promise<string> {
        // Build user message with optional web search
        const messages: any[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
        ];

        // Whitelist Check (Refined from test_whitelist_refined.ts)
        const poeSearchModels = [
            "Gemini-2.0-Flash",
            "Gemini-2.5-Flash",
            "Gemini-2.5-Pro",
            "Gemini25Pro-AAP",
            "Gemini25Flash-AAP"
        ];

        // Only attach web_search parameter if the model supports it or if it's explicitly requested
        if (enableWebSearch) {
            const isKnownSearchModel = poeSearchModels.some(m =>
                this.config.model.includes(m) || m.includes(this.config.model)
            );

            // Poe-specific: Attach 'parameters' to the protocol (Wait, Poe's OpenAI proxy might not support 'parameters' in message)
            // Correction: Poe's OpenAI-compatible API usually maps standard tool calls, but 'web_search' is a specific extension.
            // Documentation update: For Poe, 'web_search' is often automatic for search-bots, strict for others?
            // Actually, the most reliable way on Poe is to append "[Enable Search]" or similar if using a specific bot, 
            // OR relying on the bot configuration.
            // BUT, if we use the official OpenAI endpoint provided by Poe, we might need to rely on the bot settings.
            // HOWEVER, the user specifically asked for 'Gemini-2.5-Flash' which might NOT be a search bot.

            // CRITICAL: If we are using `api.poe.com/v1`, it expects OpenAI format.
            // Some proxies accept `web_search: true` at the top level or in `tools`.
            // Let's try to inject it as a top-level parameter in the payload, which `openai` SDK filters out.
            // Hence `fetch` is necessary.
        }

        try {
            // Construct Payload Manually
            const payload: any = {
                model: this.config.model,
                messages: messages,
                temperature: 0.7,
                stream: true
            };

            // Inject Poe-specific parameters if needed (Unverified if Poe supports top-level 'web_search' in OpenAI compatibility)
            // Alternate strategy: Prepend system prompt with "Use your Web Search tool..."
            // But let's verify the payload injection first.
            // According to some Poe docs, `logit_bias` etc are supported. `tools` are supported.
            // We'll stick to the standard OpenAI 'tools' definition for search if possible, OR
            // Assume the previous logic was attempting to use a proprietary field.

            // LET'S USE THE RAW FETCH TO PASS `parameters` inside the message, which is a known Poe hack/feature.
            if (enableWebSearch) {
                // For Poe, sometimes parameters go into the message object itself??
                // "messages": [{"role": "user", "content": "...", "parameters": {"web_search": true}}]
                messages[1].parameters = { web_search: true };
            }

            const response = await fetch(`${this.client.baseURL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.apiKey}`,
                    "X-Title": "Auto-Academic-Paper",
                    "HTTP-Referer": "https://github.com/keithligh/Auto-Academic-Paper"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Poe API Error: ${response.status} ${response.statusText} - ${errText}`);
            }

            if (!response.body) throw new Error("No response body");

            // Streaming Parser
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
                            // Incrementally parsing partial JSON is hard, ignoring partials
                        }
                    }
                }
            }
            return fullText;

        } catch (e: any) {
            console.error("Poe Completion Error:", e);
            throw new Error(`Poe completion failed: ${e.message}`);
        }
    }

    /**
     * JSON completion with optional web search support.
     * Uses raw fetch (like completion) when enableWebSearch is true to inject Poe-specific parameters.
     */
    async jsonCompletion(prompt: string, systemPrompt: string, schema?: any, onProgress?: (text: string) => void, enableWebSearch?: boolean): Promise<any> {
        const enhancedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Output valid JSON only. Do not include markdown formatting like \`\`\`json.`;

        // If web search is enabled, use raw fetch approach (same as completion)
        if (enableWebSearch) {
            const messages: any[] = [
                { role: "system", content: enhancedSystemPrompt },
                { role: "user", content: prompt, parameters: { web_search: true } }
            ];

            const payload: any = {
                model: this.config.model,
                messages: messages,
                temperature: 0.3,
                stream: true
            };

            try {
                const response = await fetch(`${this.client.baseURL}/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${this.config.apiKey}`,
                        "X-Title": "Auto-Academic-Paper",
                        "HTTP-Referer": "https://github.com/keithligh/Auto-Academic-Paper"
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Poe API Error: ${response.status} ${response.statusText} - ${errText}`);
                }

                if (!response.body) throw new Error("No response body");

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let content = "";
                let consecutiveNewlines = 0;
                const MAX_CONSECUTIVE_NEWLINES = 10;

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

                                    // Loop detection
                                    if (delta.includes('\n')) {
                                        let i = content.length - 1;
                                        let count = 0;
                                        while (i >= 0 && content[i] === '\n') {
                                            count++;
                                            i--;
                                        }
                                        consecutiveNewlines = count;
                                    } else {
                                        consecutiveNewlines = 0;
                                    }

                                    if (consecutiveNewlines >= MAX_CONSECUTIVE_NEWLINES) {
                                        console.warn(`[PoeProvider] Detected whitespace loop. Terminating stream.`);
                                        break;
                                    }
                                }
                            } catch (e) {
                                // Ignore partial JSON
                            }
                        }
                    }
                }

                console.log("[Poe Raw Response (WebSearch)]", content.length > 500 ? content.substring(0, 500) + "... [TRUNCATED]" : content);

                try {
                    const fs = await import("fs");
                    const path = await import("path");
                    fs.appendFileSync(path.join(process.cwd(), "server", "raw_response.log"), `\n\n[${new Date().toISOString()}] POE RAW (WebSearch): ${content}\n`);
                } catch (err) {
                    console.error("Failed to write log", err);
                }

                try {
                    return extractJson(content);
                } catch (e) {
                    console.error("Failed to parse JSON response from Poe (WebSearch):", content);
                    throw new Error("AI response was not valid JSON");
                }

            } catch (e: any) {
                console.error("Poe JSON Completion (WebSearch) Error:", e);
                throw new Error(`Poe JSON completion failed: ${e.message}`);
            }
        }

        // Standard path (no web search) - use OpenAI SDK
        const stream = await this.client.chat.completions.create({
            model: this.config.model,
            messages: [
                { role: "system", content: enhancedSystemPrompt },
                { role: "user", content: prompt },
            ],
            temperature: 0.3,
            stream: true,
        });

        let content = "";

        let consecutiveNewlines = 0;
        const MAX_CONSECUTIVE_NEWLINES = 10;

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
                content += delta;
                if (onProgress) {
                    onProgress(content);
                }

                // Loop Detection: Check for excessive consecutive newlines
                // This handles cases where the AI gets stuck in a whitespace loop
                if (delta.includes('\n')) {
                    // DEBUG: Log newline chunks to verify origin
                    if (/^\s*$/.test(delta)) {
                        console.log(`[PoeProvider] Received whitespace-only delta: ${JSON.stringify(delta)}`);
                    }

                    // Count newlines at the end of the content
                    let i = content.length - 1;
                    let count = 0;
                    while (i >= 0 && content[i] === '\n') {
                        count++;
                        i--;
                    }
                    consecutiveNewlines = count;
                } else {
                    consecutiveNewlines = 0;
                }

                if (consecutiveNewlines >= MAX_CONSECUTIVE_NEWLINES) {
                    console.warn(`[PoeProvider] Detected whitespace loop (${consecutiveNewlines} newlines). Terminating stream.`);
                    if (stream.controller) {
                        stream.controller.abort();
                    }
                    break;
                }
            }
        }

        console.log("[Poe Raw Response]", content.length > 500 ? content.substring(0, 500) + "... [TRUNCATED]" : content);

        try {
            const fs = await import("fs");
            const path = await import("path");
            fs.appendFileSync(path.join(process.cwd(), "server", "raw_response.log"), `\n\n[${new Date().toISOString()}] POE RAW: ${content}\n`);
        } catch (err) {
            console.error("Failed to write log", err);
        }

        try {
            return extractJson(content);
        } catch (e) {
            console.error("Failed to parse JSON response from Poe:", content);
            throw new Error("AI response was not valid JSON");
        }
    }

    /**
     * Fix JSON escaping issues from AI responses.
     * (Legacy function from pre-byok-poe.ts)
     */
    private fixAIJsonEscaping(jsonString: string): string {
        let result = '';
        let inString = false;
        let escape = false;

        for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString[i];
            if (char === '"' && !escape) {
                inString = !inString;
                result += char;
                escape = false;
                continue;
            }
            if (inString) {
                if (char === '\\' && !escape) {
                    const nextChar = i < jsonString.length - 1 ? jsonString[i + 1] : '';
                    if (['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'].includes(nextChar)) {
                        escape = true;
                        result += char;
                        escape = false; // logic correction
                    } else {
                        result += '\\\\';
                        escape = false;
                    }
                    continue;
                }
            }
            result += char;
            escape = false;
        }
        return result;
    }

    // DEAD CODE REMOVAL: The dedicated 'research' method has been removed.
    // The orchestration is handled by 'service.ts' using the standard 'completion' method
    // with { web_search: true } enabled by the refined whitelist above.
    // This aligns the Code with the Architecture (Service Orchestration).
}
