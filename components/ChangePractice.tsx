"use client";
import { useState } from "react";
import { setPracticeAction } from "@/app/(app)/account/actions";
type Match = { ods_code: string; name: string };
export default function ChangePractice({ current }: { current?: string }) {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [picked, setPicked] = useState<Match | null>(null);
  const [loading, setLoading] = useState(false);
  async function search(v: string) {
    setQ(v); setPicked(null);
    if (v.trim().length < 2) { setMatches([]); return; }
    setLoading(true);
    const res = await fetch(`/api/practices?q=${encodeURIComponent(v)}`);
    const json = await res.json();
    setMatches(json.matches ?? []); setLoading(false);
  }
  return (
    <form action={setPracticeAction} className="space-y-3">
      <label className="label">Search for your practice (name or ODS code)</label>
      <input className="input" placeholder="e.g. Densham Surgery or A81001"
        value={picked ? `${picked.name} (${picked.ods_code})` : q} onChange={(e) => search(e.target.value)} />
      {loading && <p className="text-sm text-slate-500">Searching…</p>}
      {!picked && matches.length > 0 && (
        <ul className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white">
          {matches.map((m) => (
            <li key={m.ods_code}>
              <button type="button" onClick={() => { setPicked(m); setMatches([]); }}
                className="block w-full px-3 py-2 text-left hover:bg-slate-100">
                <span className="font-medium">{m.name}</span> <span className="text-sm text-slate-500">{m.ods_code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input type="hidden" name="practice_ods_code" value={picked?.ods_code ?? ""} />
      <button className="btn" type="submit" disabled={!picked}>Set as my default practice</button>
      {current && <p className="text-xs text-slate-500">Applies across every device you sign in from.</p>}
    </form>
  );
}
