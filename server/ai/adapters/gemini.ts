import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIProvider, ProviderConfig } from "../provider";
import { extractJson } from "../utils";

export class GeminiProvider implements AIProvider {
    private client: GoogleGenerativeAI;
    private config: ProviderConfig;
    public id: string = "gemini";
    public model: string;
    public supportsResearch: boolean = false;

    constructor(config: ProviderConfig) {
        this.config = config;
        this.model = config.model;
        this.client = new GoogleGenerativeAI(config.apiKey);
    }

    async completion(prompt: string, systemPrompt: string): Promise<string> {
        const model = this.client.getGenerativeModel({
            model: this.config.model,
            systemInstruction: systemPrompt
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Gemini request timed out")), 180000)
        );

        const result = await Promise.race([
            model.generateContent(prompt),
            timeoutPromise
        ]);

        // Handle result safely as it comes from Promise.race logic
        // Because of Typescript, we cast result to match what generateContent returns or ensure it mimics it.
        // Actually, generateContent returns a GenerateContentResult.
        return (result as any).response.text();
    }

    async jsonCompletion(prompt: string, systemPrompt: string, schema?: any, onProgress?: (text: string) => void, enableWebSearch?: boolean): Promise<any> {
        const model = this.client.getGenerativeModel({
            model: this.config.model,
            systemInstruction: systemPrompt,
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        try {
            return extractJson(text);
        } catch (e) {
            console.error("Failed to parse JSON response from Gemini:", text);
            throw new Error("AI response was not valid JSON");
        }
    }
}
