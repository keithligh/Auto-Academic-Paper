import Anthropic from "@anthropic-ai/sdk";
import { AIProvider, ProviderConfig } from "../provider";
import { extractJson } from "../utils";

export class AnthropicProvider implements AIProvider {
    private client: Anthropic;
    private config: ProviderConfig;
    public id: string = "anthropic";
    public model: string;
    public supportsResearch: boolean = false;

    constructor(config: ProviderConfig) {
        this.config = config;
        this.model = config.model;
        this.client = new Anthropic({
            apiKey: config.apiKey,
        });
    }

    async completion(prompt: string, systemPrompt: string): Promise<string> {
        const response = await this.client.messages.create({
            model: this.config.model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
                { role: "user", content: prompt },
            ],
        });

        // Handle different content block types safely
        const content = response.content[0];
        if (content.type === "text") {
            return content.text;
        }
        return "";
    }

    async jsonCompletion(prompt: string, systemPrompt: string, schema?: any, onProgress?: (text: string) => void, enableWebSearch?: boolean): Promise<any> {
        // Anthropic is great at following instructions, so we use a strong system prompt
        const enhancedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: You must output ONLY valid JSON. Do not include any explanatory text, markdown formatting, or code blocks. Just the raw JSON object.`;

        const response = await this.client.messages.create({
            model: this.config.model,
            max_tokens: 4096,
            system: enhancedSystemPrompt,
            messages: [
                { role: "user", content: prompt },
            ],
        });

        const contentBlock = response.content[0];
        let content = "";
        if (contentBlock.type === "text") {
            content = contentBlock.text;
        }

        try {
            return extractJson(content);
        } catch (e) {
            console.error("Failed to parse JSON response from Anthropic:", content);
            throw new Error("AI response was not valid JSON");
        }
    }
}
