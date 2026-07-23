import { rag, RAG_HEX } from "@/lib/qof/calc";
export default function PaymentBar({ pct, lower, upper }: { pct: number | null; lower: number | null; upper: number | null }) {
  const hasBand = lower != null && upper != null;
  const lo = lower ?? 0, hi = upper ?? 100;
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const colour = RAG_HEX[rag(pct, lower, upper)];
  return (
    <div className="w-full">
      <div className="relative h-3 w-full rounded-full bg-slate-100">
        {/* payment band */}
        {hasBand && <div className="absolute inset-y-0 rounded-full bg-slate-200" style={{ left: `${clamp(lo)}%`, width: `${clamp(hi) - clamp(lo)}%` }} />}
        {/* your position */}
        {pct != null && (
          <div className="absolute -top-1 h-5 w-1.5 rounded" style={{ left: `calc(${clamp(pct)}% - 3px)`, background: colour }} title={`You: ${pct}%`} />
        )}
      </div>
      {hasBand ? (
        <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>{lo}% lower</span><span className="font-medium text-nhs-green">{hi}% target</span></div>
      ) : (
        <div className="mt-1 text-[11px] text-slate-400">achievement {pct ?? "—"}%</div>
      )}
    </div>
  );
}
