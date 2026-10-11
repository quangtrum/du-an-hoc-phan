"use client";
import { useEffect, useRef, useState } from "react";
import { Menu, Moon, Plus, SendHorizontal, Sparkles, Sun, Trash2 } from "lucide-react";
import Markdown from "./Markdown";

type Msg = { role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Msg[] };

const KEY = "it-mentor-chats";
const SUGGESTIONS = [
  "Giải thích giúp mình khái niệm Đệ quy là gì?",
  "Lộ trình học Web Developer cho người mới bắt đầu?",
  "Khác nhau giữa TCP và UDP là gì?",
  "Khi nào nên dùng SQL, khi nào dùng NoSQL?",
];

export default function ChatApp() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [menu, setMenu] = useState(false);
  const [ready, setReady] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try { setChats(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {}
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(chats)); }, [chats, ready]);

  const active = chats.find((c) => c.id === activeId);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [active?.messages]);

  const toggleTheme = () => {
    const dark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", dark ? "dark" : "light");
  };
  const remove = (id: string) => {
    setChats((p) => p.filter((c) => c.id !== id));
    if (id === activeId) setActiveId(null);
  };

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;
    const history: Msg[] = [...(active?.messages ?? []), { role: "user", content: text }];
    let id = activeId;
    if (!id) {
      const newId = crypto.randomUUID();
      id = newId;
      setChats((p) => [{ id: newId, title: text.slice(0, 40), messages: [] }, ...p]);
      setActiveId(newId);
    }
    const update = (fn: (m: Msg[]) => Msg[]) =>
      setChats((p) => p.map((c) => (c.id === id ? { ...c, messages: fn(c.messages) } : c)));

    update(() => [...history, { role: "assistant", content: "" }]);
    setInput("");
    if (field.current) field.current.style.height = "auto";
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        update((m) => [...m.slice(0, -1), { role: "assistant", content: acc }]);
      }
    } catch (e: any) {
      update((m) => [...m.slice(0, -1), { role: "assistant", content: `⚠️ ${e?.message || "Chưa nhận được phản hồi."}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      {menu && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setMenu(false)} />}

      <aside className={`fixed z-30 flex h-full w-72 flex-col border-r border-stone-200 bg-white p-3 transition-transform motion-reduce:transition-none dark:border-slate-800 dark:bg-[#0a0d12] md:static md:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-3 flex items-center gap-2 px-2 py-1 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-600 font-mono text-sm text-white">{"</>"}</span>
          IT Mentor
        </div>
        <button onClick={() => { setActiveId(null); setMenu(false); }} className="flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2.5 text-sm font-medium transition hover:bg-stone-100 dark:border-slate-700 dark:hover:bg-slate-800">
          <Plus size={16} /> Đoạn chat mới
        </button>
        <p className="mt-5 px-2 text-xs font-medium text-slate-400">Lịch sử trò chuyện</p>
        <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto">
          {chats.length === 0 && <p className="px-2 py-2 text-sm text-slate-400">Chưa có đoạn chat nào.</p>}
          {chats.map((c) => (
            <div key={c.id} className={`group flex items-center rounded-lg pr-1 ${c.id === activeId ? "bg-teal-50 text-teal-900 dark:bg-teal-950/50 dark:text-teal-100" : "hover:bg-stone-100 dark:hover:bg-slate-800/60"}`}>
              <button onClick={() => { setActiveId(c.id); setMenu(false); }} className="flex-1 truncate px-3 py-2 text-left text-sm">{c.title}</button>
              <button aria-label="Xoá đoạn chat" onClick={() => remove(c.id)} className="p-1.5 text-slate-400 opacity-0 hover:text-red-500 focus:opacity-100 group-hover:opacity-100"><Trash2 size={14} /></button>
            </div>
          ))}
        </nav>
        <button onClick={toggleTheme} className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-stone-100 dark:hover:bg-slate-800">
          <Sun size={16} className="hidden dark:block" /><Moon size={16} className="dark:hidden" /> Đổi giao diện sáng/tối
        </button>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-stone-200 px-4 py-3 dark:border-slate-800 md:hidden">
          <button aria-label="Mở menu" onClick={() => setMenu(true)}><Menu size={20} /></button>
          <span className="font-semibold">IT Mentor</span>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {!active?.messages.length ? (
              <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-600 text-white"><Sparkles size={26} /></span>
                <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Chào bạn, mình là IT Mentor</h1>
                <p className="mt-2 max-w-md text-slate-500 dark:text-slate-400">Hỏi mình về giải thuật, lập trình, mạng, cơ sở dữ liệu hay cách học để đi đường dài trong ngành IT.</p>
                <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-xl border border-stone-200 bg-white p-4 text-left text-sm transition hover:border-teal-500 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-teal-500">{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {active.messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-teal-600 px-4 py-2.5 text-[15px] text-white">{m.content}</div>
                    </div>
                  ) : (
                    <div key={i} className="flex gap-3">
                      <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-600 text-white"><Sparkles size={16} /></span>
                      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-stone-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                        {m.content ? <Markdown>{m.content}</Markdown> : (
                          <span className="flex gap-1 py-2" aria-label="Đang trả lời">
                            {[0, 1, 2].map((d) => <i key={d} className="h-2 w-2 animate-bounce rounded-full bg-slate-400 motion-reduce:animate-none" style={{ animationDelay: `${d * 150}ms` }} />)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
            <div ref={bottom} />
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-stone-300 bg-white p-2 shadow-sm focus-within:border-teal-500 dark:border-slate-700 dark:bg-slate-900">
            <textarea
              ref={field} rows={1} value={input} placeholder="Hỏi mình bất cứ điều gì về IT…"
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); }
              }}
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-slate-400"
            />
            <button onClick={() => send(input)} disabled={!input.trim() || loading} aria-label="Gửi tin nhắn" className="rounded-xl bg-teal-600 p-2.5 text-white transition hover:bg-teal-500 disabled:opacity-40">
              <SendHorizontal size={18} />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">Enter để gửi, Shift + Enter để xuống dòng. IT Mentor có thể mắc lỗi, hãy kiểm chứng thông tin quan trọng.</p>
        </div>
      </main>
    </div>
  );
}