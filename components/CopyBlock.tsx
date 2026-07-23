"use client";
import { useState } from "react";
export default function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <pre className="whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-sm text-slate-100">{text}</pre>
      <button className="btn mt-3" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),1500); }}>
        {copied ? "Copied ✓" : "Copy to clipboard"}
      </button>
    </div>
  );
}
