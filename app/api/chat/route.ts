import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return new Response("Chưa cấu hình GEMINI_API_KEY", { status: 500 });

  const { messages } = await req.json().catch(() => ({ messages: null }));
  if (!Array.isArray(messages) || messages.length === 0) return new Response("Dữ liệu không hợp lệ", { status: 400 });

  const contents = messages
    .slice(-20)
    .filter((m: any) => m?.content)
    .map((m: any) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: String(m.content).slice(0, 8000) }] }));
  while (contents[0]?.role === "model") contents.shift();

  try {
    const ai = new GoogleGenAI({ apiKey });
    const stream = await ai.models.generateContentStream({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      contents,
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.7 },
    });
    const enc = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(ctrl) {
          try {
            for await (const chunk of stream) if (chunk.text) ctrl.enqueue(enc.encode(chunk.text));
          } catch {
            ctrl.enqueue(enc.encode("\n\n⚠️ Kết nối bị gián đoạn, hãy thử lại."));
          }
          ctrl.close();
        },
      }),
      { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("[Gemini]", err);
    return new Response(`Gemini lỗi: ${err?.message ?? "không rõ nguyên nhân"}`, { status: 502 });
  }
}