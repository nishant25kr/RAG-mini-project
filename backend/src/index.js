import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { generate_Embedding } from "./ai.js";
import { connectDB } from "./db.js";
import Data from "./models/Data.model.js";

dotenv.config();

const app = express();
const PORT = 3030;

async function extractPdfText(url) {
    const response = await axios.get(url, {
        responseType: "arraybuffer",
    });

    const pdfData = new Uint8Array(response.data);

    const loadingTask = pdfjs.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;

    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        const pageText = content.items.map(item => item.str).join(" ");
        fullText += pageText + "\n";
    }

    return fullText;
}

function cosineSimilarity(vecA, vecB) {
    let dot = 0.0;
    let normA = 0.0;
    let normB = 0.0;

    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function chunkText(text, chunkSize = 500, overlap = 50) {
    const words = text.split(" ");
    const chunks = [];

    for (let i = 0; i < words.length; i += chunkSize - overlap) {
        chunks.push(words.slice(i, i + chunkSize).join(" "));
    }

    return chunks;
}

app.get("/", async (req, res) => {
    try {
        const response = await generate_Embedding("hello this is a RAG");

        return res.status(200).json({
            message: "Message fetched successfully",
            embedding: response.embeddings[0],
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Failed to generate embedding",
        });
    }
});

app.get("/embed-data", async (req, res) => {
    try {
        const url = "https://investors.mongodb.com/node/12236/pdf";
        const fullText = await extractPdfText(url);

        const chunks = chunkText(fullText);

        for (const chunk of chunks) {
            const embeddingRes = await generate_Embedding(chunk);

            await Data.create({
                name: chunk,
                embedding: embeddingRes.embeddings[0].values
            });
        }

        res.json({ message: "PDF embedded successfully with chunks" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Embedding failed" });
    }
});

app.get("/search", async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({ message: "Query is required" });
        }

        // 1️⃣ Generate embedding for user query
        const queryEmbeddingResponse = await generate_Embedding(query);
        const queryEmbedding = queryEmbeddingResponse.embeddings[0].values;

        // 2️⃣ Fetch stored PDF embeddings
        const allDocs = await Data.find();

        // 3️⃣ Compute similarity
        const scored = allDocs.map(doc => ({
            name: doc.name,
            score: cosineSimilarity(queryEmbedding, doc.embedding)
        }));

        // 4️⃣ Sort by similarity
        scored.sort((a, b) => b.score - a.score);

        // 5️⃣ Return top match
        return res.status(200).json({
            query,
            bestMatch: scored[0],
            allScores: scored
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Search failed" });
    }
});

app.get("/ask", async (req, res) => {
    try {
        const { question } = req.query;

        if (!question) {
            return res.status(400).json({ message: "Question is required" });
        }

        // 1️⃣ Embed the question
        const qEmbeddingRes = await generate_Embedding(question);
        const qEmbedding = qEmbeddingRes.embeddings[0].values;

        // 2️⃣ Get all PDF chunks
        const docs = await Data.find();

        // 3️⃣ Score similarity
        const ranked = docs.map(doc => ({
            text: doc.text,
            score: cosineSimilarity(qEmbedding, doc.embedding)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3); // top 3 chunks

        // 4️⃣ Create context
        const context = ranked.map(r => r.text).join("\n\n");

        // 5️⃣ Ask LLM using PDF-only context
        const prompt = `
Answer the question ONLY using the context below.
If the answer is not present, say "Not found in the document".

Context:
${context}

Question:
${question}
`;

        const answer = await generate_Embedding(prompt); 

        res.json({
            question,
            answer: answer
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to answer question" });
    }
});

await connectDB();

app.listen(PORT, () => {
    console.log("Server is running at :", PORT);
});