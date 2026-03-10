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

// =========================
// Ovoz → Text (STT)
// =========================
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

    // Sonlarni raqamga o‘zgartirish
    text = text
      .replace(/bitta/g, "1")
      .replace(/ikkita/g, "2")
      .replace(/uchta|uch/g, "3")
      .replace(/to'rt|to‘rt/g, "4")
      .replace(/beshta|besh/g, "5")
      .replace(/oltita/g, "6")
      .replace(/yettita/g, "7")
      .replace(/sakkizta/g, "8")
      .replace(/toqqizta/g, "9")
      .replace(/o'nta|o‘nta/g, "10");

    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "STT bilan bog'lanib bo'lmadi" });
  }
});

// =========================
// Text → JSON (AI)
// =========================
app.post("/api/parse-order", async (req, res) => {
  const { text } = req.body;

  const SYSTEM_PROMPT = `
Siz restoran buyurtmalarini analiz qiluvchi AI tizimsiz.
Foydalanuvchi gapini tahlil qiling.
JSON format:
[
 {
  "buyurtmaStoli": number | null,
  "buyurtmaNomi": string | null,
  "buyurtmaSoni": number | null,
  "buyurtmaTuri": string | null
 }
]
Agar buyurtma bo'lmasa:
{
 "message":"Kechirasiz, mavzudan chetlashdingiz"
}

Misol:
Input: "birinchi stolga turtashashlik 1 non 1 lavash berib oolin"
Output: [
  { "buyurtmaStoli": 1, "buyurtmaNomi": "turtashashlik", "buyurtmaSoni": 1, "buyurtmaTuri": null },
  { "buyurtmaStoli": 1, "buyurtmaNomi": "non", "buyurtmaSoni": 1, "buyurtmaTuri": null },
  { "buyurtmaStoli": 1, "buyurtmaNomi": "lavash", "buyurtmaSoni": 1, "buyurtmaTuri": null }
]
`;

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/moonshotai/Kimi-K2-Instruct-0905",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: `${SYSTEM_PROMPT}\nUser: ${text}\nAssistant:` }),
      }
    );

    const data = await response.json();
    let output = data?.[0]?.generated_text || data?.generated_text || "";

    // JSON ni ajratish
    const arrStart = output.indexOf("[");
    const arrEnd = output.lastIndexOf("]");
    const objStart = output.indexOf("{");
    const objEnd = output.lastIndexOf("}");

    let cleanJSON = null;

    if (arrStart !== -1 && arrEnd !== -1) cleanJSON = output.substring(arrStart, arrEnd + 1);
    else if (objStart !== -1 && objEnd !== -1) cleanJSON = output.substring(objStart, objEnd + 1);

    if (!cleanJSON) return res.json({ response: { message: "Kechirasiz, mavzudan chetlashdingiz" } });

    const parsed = JSON.parse(cleanJSON);
    res.json({ response: parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI bilan bog'lanib bo'lmadi" });
  }
});

app.listen(process.env.PORT || 5000, () =>
  console.log("Backend running on http://localhost:5000")
);