"use client";
import { useState } from "react";
import { registerAction } from "./actions";

type Match = { odsCode: string; name: string; postcode?: string };

export default function RegisterForm() {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [picked, setPicked] = useState<Match | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(v: string) {
    setQ(v); setPicked(null);
    if (v.trim().length < 3) { setMatches([]); return; }
    setLoading(true);
    const res = await fetch(`/api/ods?q=${encodeURIComponent(v)}`);
    const json = await res.json();
    setMatches(json.matches ?? []);
    setLoading(false);
  }

  return (
    <form action={registerAction} className="space-y-4">
      <div>
        <label className="label">Full name</label>
        <input name="full_name" required className="input" />
      </div>
      <div>
        <label className="label">Work email (NHS email recommended)</label>
        <input name="email" type="email" required className="input" />
      </div>
      <div>
        <label className="label">Password</label>
        <input name="password" type="password" required minLength={8} className="input" />
      </div>
      <div>
        <label className="label">Your role</label>
        <select name="role" className="input">
          <option value="gp">GP</option>
          <option value="practice_manager">Practice manager</option>
          <option value="nurse">Nurse</option>
        </select>
      </div>

      <div>
        <label className="label">Your GP practice (auto-loads from NHS ODS)</label>
        <input className="input" placeholder="Type practice name or postcode..." value={picked ? picked.name : q} onChange={(e) => search(e.target.value)} />
        {loading && <p className="mt-1 text-sm text-slate-500">Searching NHS directory...</p>}
        {!picked && matches.length > 0 && (
          <ul className="mt-1 max-h-52 overflow-auto rounded-lg border border-slate-200 bg-white">
            {matches.map((m) => (
              <li key={m.odsCode}>
                <button type="button" onClick={() => { setPicked(m); setMatches([]); }}
                  className="block w-full px-3 py-2 text-left hover:bg-slate-100">
                  <span className="font-medium">{m.name}</span>{" "}
                  <span className="text-sm text-slate-500">{m.odsCode}{m.postcode ? ` · ${m.postcode}` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {picked && <p className="mt-1 text-sm text-nhs-green">Selected: {picked.name} ({picked.odsCode})</p>}
        <input type="hidden" name="practice_ods_code" value={picked?.odsCode ?? ""} />
        <input type="hidden" name="practice_name" value={picked?.name ?? ""} />
      </div>

      <button className="btn w-full" type="submit">Create free account</button>
    </form>
  );
}
