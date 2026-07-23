"use client";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
export default function TrendChart({ data, upper }: { data: { year: string; value: number }[]; upper?: number | null }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
          <Tooltip formatter={(v) => `${v}%`} />
          {upper ? <ReferenceLine y={upper} stroke="#007F3B" strokeDasharray="4 4" label={{ value: `target ${upper}%`, fontSize: 11, fill: "#007F3B" }} /> : null}
          <Line type="monotone" dataKey="value" stroke="#005EB8" strokeWidth={2.5} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
