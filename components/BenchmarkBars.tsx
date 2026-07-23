"use client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, ReferenceLine, Tooltip } from "recharts";
type D = { label: string; value: number; you?: boolean };
export default function BenchmarkBars({ data, upper }: { data: D[]; upper?: number | null }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
          <Tooltip formatter={(v) => `${v}%`} />
          {upper ? <ReferenceLine y={upper} stroke="#007F3B" strokeDasharray="4 4" label={{ value: `target ${upper}%`, fontSize: 11, fill: "#007F3B" }} /> : null}
          <Bar dataKey="value" radius={[4,4,0,0]}>
            {data.map((d, i) => <Cell key={i} fill={d.you ? "#005EB8" : "#94a3b8"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
