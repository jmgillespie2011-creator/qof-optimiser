import Link from "next/link";
export default function Landing() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-16">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xl font-bold text-nhs-blue">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-nhs-blue text-white">Q</span>
          QOF Optimiser
        </div>
        <nav className="flex gap-3">
          <Link href="/login" className="btn-ghost">Sign in</Link>
          <Link href="/register" className="btn">Get started free</Link>
        </nav>
      </header>

      <section className="mt-16 grid items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="inline-block rounded-full bg-nhs-blue/10 px-3 py-1 text-sm font-medium text-nhs-blue">Free during launch</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Find the QOF points your practice is leaving on the table.</h1>
          <p className="mt-5 text-lg text-slate-600">
            Benchmark every QOF domain against England, your ICB, your PCN and peers. Get up to three ranked
            improvement actions per indicator, backed by prescribing data, with ready-to-send Accurx questionnaires.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/register" className="btn">Create free account</Link>
            <Link href="/login" className="btn-ghost">Sign in</Link>
          </div>
        </div>

        {/* product preview mock */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div className="rounded-xl bg-nhs-blue p-4 text-white">
            <div className="text-xs opacity-90">Estimated QOF value at risk</div>
            <div className="text-3xl font-bold tabular-nums">£18,400</div>
          </div>
          <div className="mt-3 space-y-2">
            {[["CHOL004","34%","50%","red"],["DM036","56%","90%","amber"],["CHOL003","82%","95%","lime"]].map(([c,you,t,rc]) => (
              <div key={c} className="rounded-lg border border-slate-100 p-3">
                <div className="flex justify-between text-sm"><span className="font-medium text-nhs-blue">{c}</span><span className="text-slate-500">you {you} · target {t}</span></div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                  <div className="h-2 rounded-full" style={{ width: you, background: rc === "red" ? "#DA291C" : rc === "amber" ? "#FFB81C" : "#78BE20" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-20 grid gap-5 sm:grid-cols-3">
        {[
          ["Benchmark everywhere","Compare your achievement across England, ICB, PCN and peers for every QOF indicator."],
          ["Money, ranked","See the £ at stake per indicator at the current QOF point price, sorted by opportunity."],
          ["Act in one click","Copy pre-written Accurx questionnaires — ezetimibe offers, vaccination invites, smoking VBA."],
        ].map(([t,d]) => (
          <div key={t} className="card card-hover"><h3 className="font-semibold">{t}</h3><p className="mt-2 text-sm text-slate-600">{d}</p></div>
        ))}
      </section>

      <footer className="mt-24 border-t border-slate-200 pt-6 text-sm text-slate-500">
        Uses public NHS data only (QOF achievement, OpenPrescribing, ODS). No patient-identifiable data.
      </footer>
    </main>
  );
}
