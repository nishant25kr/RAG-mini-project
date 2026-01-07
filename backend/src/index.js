import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { generate_Embedding } from "./ai.js";
import { connectDB } from "./db.js";
import pdfSchema from "./models/pdf.model.js";

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

        const text = await extractPdfText(url);

        const response = await generate_Embedding(text);

        // console.log(response.embeddings[0].values);

        const NewPdf = new pdfSchema(
            {
                name: "New pdf",
                embedding: response.embeddings[0].values
            }
        )

        if (!NewPdf) {
            return res
                .status(500)
                .json({
                    message: "error in uploading the embeeding"
                })
        }

        return res.status(200).json({
            messsage: "Pdf uploaded successfullt"
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "PDF extraction failed" });
    }
});

await connectDB();

app.listen(PORT, () => {
    console.log("Server is running at :", PORT);
});