import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import FormData from "form-data";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

const HF_TOKEN = process.env.HF_TOKEN;
const STT_API_KEY = process.env.STT_API_KEY;

// Ovoz → Text (STT)
app.post("/api/stt", async (req, res) => {
  try {
    const { audioBase64 } = req.body;
    const audioBuffer = Buffer.from(audioBase64, "base64");

    const formData = new FormData();
    formData.append("file", audioBuffer, "audio.webm");
    formData.append("language", "uz");

    const sttRes = await fetch("https://uzbekvoice.ai/api/v1/stt", {
      method: "POST",
      headers: { Authorization: STT_API_KEY },
      body: formData,
    });

    const sttData = await sttRes.json();
    let text = sttData.result?.conversation_text || sttData.text || "Matn topilmadi";
    text = text.replace(/Speaker \d+:\s*/g, "").toLowerCase();

    // Miqdorlarni normalizatsiya
    text = text
      .replace(/bitta/g, "1")
      .replace(/ikkita/g, "2")
      .replace(/uch/g, "3")
      .replace(/to'rt/g, "4")
      .replace(/besh/g, "5");

    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "STT bilan bog'lanib bo'lmadi" });
  }
});

// Text → JSON (AI)
app.post("/api/parse-order", async (req, res) => {
  const { text } = req.body;

  const SYSTEM_PROMPT = `
Siz AI Restaurant Order Management System siz.
Foydalanuvchi buyurtma qilsa, quyidagi JSON formatida qaytaring:
{
  "tables": {
    "table_number": {
      "status": "ordering",
      "items": [
        { "name": "lavash", "quantity": 2, "price": 25000, "total": 50000 }
      ],
      "order_total": 50000
    }
  }
}
Menu: lavash 25000, choy 5000, cola 12000, osh 30000, somsa 8000
Foydalanuvchi gapini tahlil qilib, miqdorlarni raqam bilan JSONga qo‘ying.
Boshqa gap bo‘lsa: "Kechirasiz, mavzudan chetlashdingiz"
`;

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/moonshotai/Kimi-K2-Instruct-0905",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: SYSTEM_PROMPT + "\nUser: " + text }),
      }
    );

    const data = await response.json();
    let output = data?.[0]?.generated_text || data?.generated_text || "Kechirasiz, AI javob bermadi";

    if (output.includes("Kechirasiz")) {
      res.json({ response: "Kechirasiz, mavzudan chetlashdingiz" });
      return;
    }

    try {
      const json = JSON.parse(output);
      res.json({ response: json });
    } catch {
      res.json({ response: output });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI bilan bog'lanib bo'lmadi" });
  }
});

app.listen(5000, () => console.log("Backend running on http://localhost:5000"));