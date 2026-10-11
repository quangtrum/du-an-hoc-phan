"use client";
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

function Pre({ children }: { children?: React.ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(ref.current?.innerText ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="not-prose group relative my-3">
      <button onClick={copy} className="absolute right-2 top-2 rounded-md bg-white/10 px-2 py-1 text-xs text-slate-200 opacity-0 transition hover:bg-white/20 focus:opacity-100 group-hover:opacity-100">
        {copied ? "Đã sao chép" : "Sao chép"}
      </button>
      <pre ref={ref} className="overflow-x-auto rounded-xl bg-[#0d1117] p-4 font-mono text-[13px] leading-relaxed"
        >{children}</pre>
    </div>
  );
}

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-slate max-w-none text-[15px] dark:prose-invert prose-code:rounded prose-code:bg-slate-200/70 prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[13px] prose-code:font-medium prose-code:before:content-none prose-code:after:content-none dark:prose-code:bg-slate-700/60">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{ pre: ({ children }) => <Pre>{children}</Pre> }}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
