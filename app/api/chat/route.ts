import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

// Thử model chính trước, quá tải thì chuyển sang model dự phòng
const MODELS = [process.env.GEMINI_MODEL || "gemini-3.5-flash", "gemini-3.1-flash-lite"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openStream(ai: GoogleGenAI, contents: any[]) {
  let lastErr: any;
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await ai.models.generateContentStream({
          model,
          contents,
          config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.7 },
        });
      } catch (err: any) {
        lastErr = err;
        console.error(`[Gemini] ${model} (lần ${attempt}):`, err?.status ?? err?.message);
        if (![404, 429, 500, 503].includes(err?.status)) throw err; // lỗi key/dữ liệu: không thử lại
        if (err.status === 404) break; // model không tồn tại: sang model kế tiếp
        await sleep(1500);
      }
    }
  }
  throw lastErr;
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!apiKey) return new Response("Chưa cấu hình GEMINI_API_KEY", { status: 500 });
  // Log tạm để kiểm tra biến môi trường (không lộ key): xoá sau khi chạy ổn
  console.log("[Gemini] key", { len: apiKey.length, prefix: apiKey.slice(0, 3), hasSpace: /\s/.test(apiKey), hasEquals: apiKey.includes("=") });

  const { messages } = await req.json().catch(() => ({ messages: null }));
  if (!Array.isArray(messages) || messages.length === 0) return new Response("Dữ liệu không hợp lệ", { status: 400 });

  const contents = messages
    .slice(-20)
    .filter((m: any) => m?.content)
    .map((m: any) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: String(m.content).slice(0, 8000) }] }));
  while (contents[0]?.role === "model") contents.shift();

  try {
    const stream = await openStream(new GoogleGenAI({ apiKey, httpOptions: { headers: { "x-goog-api-key": apiKey } } }), contents);
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
    const busy = [429, 503].includes(err?.status);
    return new Response(busy ? "Gemini đang quá tải, bạn thử gửi lại sau ít giây nhé." : `Gemini lỗi: ${err?.message ?? "không rõ nguyên nhân"}`, { status: 502 });
  }
}