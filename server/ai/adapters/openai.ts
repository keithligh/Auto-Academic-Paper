import OpenAI from "openai";
import { AIProvider, ProviderConfig } from "../provider";
import { extractJson } from "../utils";

export class OpenAICompatibleProvider implements AIProvider {
    private client: OpenAI;
    private config: ProviderConfig;
    public id: string;
    public model: string;
    public supportsResearch: boolean;

    constructor(config: ProviderConfig) {
        this.config = config;
        this.id = config.provider;
        this.model = config.model;

        // Configure Base URL based on provider if not explicitly set
        // Configure Base URL based on provider if not explicitly set
        let baseURL = config.baseURL;
        // Strict OpenAI only logic here
        if (config.provider !== "openai") {
            // This adapter should only be used for OpenAI. 
            // Other providers have their own dedicated adapters.
        }

        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: baseURL,
        });

        this.supportsResearch = false;
    }

    async completion(prompt: string, systemPrompt: string, onProgress?: (text: string) => void, enableWebSearch?: boolean): Promise<string> {
        let finalPrompt = prompt;

        const stream = await this.client.chat.completions.create({
            model: this.config.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: finalPrompt },
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


        console.log("[AI Raw Response]", content);

        try {
            const fs = await import("fs");
            const path = await import("path");
            fs.appendFileSync(path.join(process.cwd(), "server", "raw_response.log"), `\n\n[${new Date().toISOString()}] RAW: ${content}\n`);
        } catch (err) {
            console.error("Failed to write log", err);
        }

        console.log("[AI Raw Response]", content);

        try {
            return extractJson(content);
        } catch (e) {
            console.error("Failed to parse JSON response:", content);
            throw new Error("AI response was not valid JSON");
        }
    }

    async research(queries: string[]): Promise<string> {
        throw new Error("This provider does not support research");
    }
}
