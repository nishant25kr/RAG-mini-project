import {GoogleGenAI} from "@google/genai"

const model = "gemini-embedding-001"

export const generate_Embedding = async(text) => {

    if(!text) throw new Error("Text is not there")
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await ai.models.embedContent({
        model: model,
        contents: text
    })
    
    return response;

} 
