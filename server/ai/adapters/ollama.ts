import OpenAI from "openai";
import { AIProvider, ProviderConfig } from "../provider";
import { extractJson } from "../utils";

export class OllamaProvider implements AIProvider {
    private client: OpenAI;
    private config: ProviderConfig;
    public id: string = "ollama";
    public model: string;
    public supportsResearch: boolean = false;

    constructor(config: ProviderConfig) {
        this.config = config;
        this.model = config.model;
        this.client = new OpenAI({
            apiKey: "ollama", // Ollama doesn't require an API key
            baseURL: "http://localhost:11434/v1",
        });
    }

    async completion(prompt: string, systemPrompt: string, onProgress?: (text: string) => void): Promise<string> {
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
            console.error("Failed to parse JSON response from Ollama:", content);
            throw new Error("AI response was not valid JSON");
        }
    }
}
