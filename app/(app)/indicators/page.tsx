import { getUserPractice, getIndicatorRows, CURRENT_YEAR } from "@/lib/qof/data";
import IndicatorsTable from "@/components/IndicatorsTable";
export const dynamic = "force-dynamic";
export const metadata = { title: "All indicators" };
export default async function IndicatorsPage() {
  const { practiceCode } = await getUserPractice();
  const rows = await getIndicatorRows(practiceCode!);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">All QOF indicators ({CURRENT_YEAR})</h1>
        <p className="mt-1 text-slate-600">Every indicator across all domains. Search, filter and sort by opportunity.</p>
        <p className="mt-2 text-sm text-slate-500">
          QOF (the Quality and Outcomes Framework) rewards practices with points for delivering defined care. Each
          <span className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">CODE</span>
          is one indicator — e.g. <span className="font-mono text-xs">CHOL002</span> is cholesterol control in CVD patients.
          Hover any code for its full definition, or click through for the detail and benchmarks.
        </p>
      </div>
      <IndicatorsTable rows={rows} />
    </div>
  );
}
