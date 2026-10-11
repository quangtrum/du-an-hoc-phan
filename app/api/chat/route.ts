import { SYSTEM_PROMPT } from "@/lib/system-prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const API_URL = "https://api.groq.com/openai/v1/chat/completions";
// Model chính (đổi bằng biến GROQ_MODEL) và model dự phòng khi bị quá tải
const MODELS = [process.env.GROQ_MODEL || "openai/gpt-oss-120b", "openai/gpt-oss-20b"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openStream(apiKey: string, messages: any[]): Promise<{ res: Response } | { status: number; text: string }> {
  let last = { status: 500, text: "" };
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: 0.7,
          ...(model.startsWith("openai/gpt-oss") && { reasoning_effort: "low" }),
        }),
      });
      if (res.ok && res.body) return { res };
      last = { status: res.status, text: await res.text() };
      console.error(`[Groq] ${model} (lần ${attempt}):`, last.status, last.text.slice(0, 300));
      if (![404, 429, 500, 503].includes(last.status)) return last; // lỗi key/dữ liệu: dừng ngay
      if (last.status === 404) break; // model không tồn tại: sang model kế tiếp
      await sleep(1500);
    }
  }
  return last;
}

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!apiKey) return new Response("Chưa cấu hình GROQ_API_KEY", { status: 500 });

  const { messages } = await req.json().catch(() => ({ messages: null }));
  if (!Array.isArray(messages) || messages.length === 0) return new Response("Dữ liệu không hợp lệ", { status: 400 });

  const history = messages
    .slice(-20)
    .filter((m: any) => m?.content)
    .map((m: any) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.content).slice(0, 8000) }));

  const out = await openStream(apiKey, [{ role: "system", content: SYSTEM_PROMPT }, ...history]);
  if (!("res" in out)) {
    const busy = [429, 503].includes(out.status);
    return new Response(busy ? "Groq đang quá tải hoặc hết lượt miễn phí, bạn thử lại sau ít giây nhé." : `Groq lỗi (${out.status}): ${out.text.slice(0, 200)}`, { status: 502 });
  }

  const reader = out.res.body!.getReader();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(ctrl) {
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (data === "[DONE]") continue;
              try {
                const text = JSON.parse(data).choices?.[0]?.delta?.content;
                if (text) ctrl.enqueue(enc.encode(text));
              } catch {}
            }
          }
        } catch {
          ctrl.enqueue(enc.encode("\n\n⚠️ Kết nối bị gián đoạn, hãy thử lại."));
        }
        ctrl.close();
      },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }
  );
}
