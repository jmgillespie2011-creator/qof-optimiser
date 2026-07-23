import { getUserPractice, getIndicatorRows } from "@/lib/qof/data";
import IndicatorsTable from "@/components/IndicatorsTable";
export const dynamic = "force-dynamic";
export default async function IndicatorsPage() {
  const { practiceCode } = await getUserPractice();
  const rows = await getIndicatorRows(practiceCode!);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">All QOF indicators (2025/26)</h1>
        <p className="mt-1 text-slate-600">Every indicator across all domains. Search, filter and sort by opportunity.</p>
      </div>
      <IndicatorsTable rows={rows} />
    </div>
  );
}
