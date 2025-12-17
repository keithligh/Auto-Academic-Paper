import OpenAI from "openai";
import { AIProvider, ProviderConfig } from "../provider";
import { extractJson } from "../utils";

export class GrokProvider implements AIProvider {
    private client: OpenAI;
    private config: ProviderConfig;
    public id: string = "grok";
    public model: string;
    public supportsResearch: boolean = true;

    constructor(config: ProviderConfig) {
        this.config = config;
        this.model = config.model;
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: "https://api.x.ai/v1",
        });
    }

    async completion(prompt: string, systemPrompt: string, onProgress?: (text: string) => void, enableWebSearch?: boolean): Promise<string> {

        // --- Agentic Search (Web Search) ---
        if (enableWebSearch) {
            // Reference: https://docs.x.ai/docs/guides/tools/search-tools
            // Using non-streaming request for reliability as per cURL example
            const response = await fetch("https://api.x.ai/v1/responses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model,
                    input: [
                        { role: "user", content: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt }
                    ],
                    tools: [
                        { type: "web_search" }
                    ],
                    stream: false
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Grok API error: ${response.status} ${response.statusText} - ${errText}`);
            }

            const data = await response.json();
            // The response structure from docs is the full response object
            // The content is likely in choices[0].message.content or similar standard OpenAI format
            // OR strictly per docs print(response.json()) -> we need to inspect the payload.
            // Based on standard xAI/OpenAI compat, let's try standard access AND generic access.
            // Docs say: "As mentioned in the overview page... the citations array contains..."
            // The user provided python output example shows: chunk.content.

            // Let's assume standard OpenAI-like response or the specific /responses schema
            // If strictly /responses:
            // The output is usually in `response` field or standard chat completion structure.
            // Let's handle generic object.
            // Parse generic access for /responses endpoint
            // Structure: { output: [ { type: 'tool_use', ... }, { type: 'message', role: 'assistant', content: [ { type: 'text', text: '...' } ] } ] }
            let result = "";

            if (data.output && Array.isArray(data.output)) {
                // Find the last message from assistant
                const lastMessage = data.output.slice().reverse().find((item: any) => item.role === 'assistant' || item.type === 'message');
                if (lastMessage) {
                    if (Array.isArray(lastMessage.content)) {
                        result = lastMessage.content
                            .filter((c: any) => c.type === 'text' || c.type === 'output_text')
                            .map((c: any) => c.text)
                            .join("\n");
                    } else if (typeof lastMessage.content === 'string') {
                        result = lastMessage.content;
                    }
                }
            }

            // Fallback to standard paths if strictly text/chat
            if (!result) {
                result = data.response || data.choices?.[0]?.message?.content || "";
            }

            // Fallback for debugging if still empty (so we don't crash on empty string)
            if (!result && data) {
                console.warn("[Grok] Warning: Could not extract text from response. returning JSON dump.");
                result = JSON.stringify(data);
            }

            if (onProgress) onProgress(result);
            return result;
        }

        // --- Standard Chat ---
        const stream = await this.client.chat.completions.create({
            model: this.config.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
            stream: true,
        });

        let fullText = "";

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                fullText += content;
                if (onProgress) {
                    onProgress(fullText);
                }
            }
        }

        return fullText;
    }

    async jsonCompletion(prompt: string, systemPrompt: string, schema?: any, onProgress?: (text: string) => void, enableWebSearch?: boolean): Promise<any> {
        const enhancedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Output valid JSON only. Do not include markdown formatting like \`\`\`json.`;

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

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
                content += delta;
                if (onProgress) {
                    onProgress(content);
                }
            }
        }

        try {
            return extractJson(content);
        } catch (e) {
            console.error("Failed to parse JSON response from Grok:", content);
            throw new Error("AI response was not valid JSON");
        }
    }

    async research(queries: string[]): Promise<string> {
        const prompt = `Please research the following topics and provide a detailed summary with citations:\n\n${queries.map(q => `- ${q}`).join("\n")}`;

        // Use the custom /responses endpoint for agentic search
        try {
            const response = await fetch("https://api.x.ai/v1/responses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model, // Enforce configured model
                    input: [
                        { role: "user", content: prompt }
                    ],
                    tools: [
                        { type: "web_search" }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`Grok API error: ${response.statusText}`);
            }

            const data = await response.json();
            // Parse the specific Grok response structure
            // Parse the specific Grok response structure
            let output = "";
            if (data.output && Array.isArray(data.output)) {
                const lastMessage = data.output.slice().reverse().find((item: any) => item.role === 'assistant' || item.type === 'message');
                if (lastMessage) {
                    if (Array.isArray(lastMessage.content)) {
                        output = lastMessage.content
                            .filter((c: any) => c.type === 'text' || c.type === 'output_text')
                            .map((c: any) => c.text)
                            .join("\n");
                    } else if (typeof lastMessage.content === 'string') {
                        output = lastMessage.content;
                    }
                }
            }

            // Fallback
            if (!output) {
                output = data.response || data.output?.[0]?.content?.[0]?.text || JSON.stringify(data);
            }
            return output;

        } catch (e) {
            console.error("Grok research error", e);
            throw e;
        }
    }
}
