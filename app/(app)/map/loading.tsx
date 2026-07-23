export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-24 w-full rounded-xl bg-slate-200" />
      <div className="h-6 w-48 rounded bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-28 rounded-xl bg-slate-100" />
        <div className="h-28 rounded-xl bg-slate-100" />
        <div className="h-28 rounded-xl bg-slate-100" />
      </div>
      <div className="h-64 w-full rounded-xl bg-slate-100" />
    </div>
  );
}
