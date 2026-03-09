import { useState, useRef } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

export default function SpeechToText() {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [textResult, setTextResult] = useState("");
  const [jsonResult, setJsonResult] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  async function sendToSTT(audioBlob) {
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);

    return new Promise((resolve) => {
      reader.onloadend = async () => {
        const base64 = reader.result.split(",")[1];
        const res = await fetch("http://localhost:5000/api/stt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioBase64: base64 }),
        });
        const data = await res.json();
        resolve(data.text);
      };
    });
  }

  async function sendToAI(text) {
    const res = await fetch("http://localhost:5000/api/parse-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    setJsonResult(data.response);
  }

  function handleClick() {
    if (!recording) {
      setTextResult("");
      setJsonResult(null);

      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);

        recorder.onstop = async () => {
          setLoading(true);
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

          const text = await sendToSTT(blob);
          setTextResult(text);

          await sendToAI(text);

          setLoading(false);
        };

        recorder.start();
        setRecording(true);
      });
    } else {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <button
        onClick={handleClick}
        className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg
        ${recording ? "bg-red-500 animate-pulse" : "bg-blue-600"} text-white`}
      >
        {recording ? <Square size={32} /> : <Mic size={32} />}
      </button>

      <p className="text-lg font-medium">{recording ? "Gapiring..." : "Mikrofonni bosing"}</p>

      {loading && (
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 className="animate-spin" />
          <span>AI ishlayapti...</span>
        </div>
      )}

      <div className="w-[600px] bg-white border rounded-xl p-4">
        <h3 className="font-bold mb-2">Speech Text</h3>
        {textResult}
      </div>

      <div className="w-[600px] bg-black text-green-400 border rounded-xl p-4">
        <h3 className="font-bold mb-2 text-white">AI JSON Result</h3>
        <pre className="text-sm">{jsonResult ? JSON.stringify(jsonResult, null, 2) : "JSON shu yerda chiqadi"}</pre>
      </div>
    </div>
  );
}