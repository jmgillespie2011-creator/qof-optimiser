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
          <p className="inline-flex items-center gap-2 rounded-full bg-nhs-blue/10 px-3 py-1 text-sm font-medium text-nhs-blue">
            <span aria-hidden>✦</span> AI-powered · free during launch
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">An AI quality-improvement analyst for your practice.</h1>
          <p className="mt-5 text-lg text-slate-600">
            One click generates a practice-specific plan across every QOF domain — benchmarked against your ICB, PCN and
            peers, backed by prescribing data, and written to close the gap. Not just points: it flags patients still
            missed once exception coding is counted back in, so you can chase <span className="font-medium text-slate-800">clinical excellence</span>, not just payment.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/register" className="btn">Create free account</Link>
            <Link href="/login" className="btn-ghost">Sign in</Link>
          </div>
          <p className="mt-3 text-xs text-slate-400">Public NHS data only · a clinician reviews every suggestion before action.</p>
        </div>

        {/* product preview mock — the AI plan */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between rounded-xl bg-nhs-blue p-4 text-white">
            <div>
              <div className="text-xs opacity-90">AI QI plan · all domains</div>
              <div className="text-lg font-bold">Ready in ~20 seconds</div>
            </div>
            <span className="rounded-lg bg-white/15 px-2 py-1 text-xs font-semibold">✦ Generate</span>
          </div>
          <div className="mt-3 space-y-2">
            {[["CS005","cervical screening","63% of register screened","red"],["SGLT2i","diabetes/CKD prescribing","bottom decile vs peers","amber"],["AF008","AF anticoagulation","at target — no action","lime"]].map(([c,label,note,rc]) => (
              <div key={c} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono font-medium text-nhs-blue">{c}</span>
                  <span className="h-2 w-2 rounded-full" style={{ background: rc === "red" ? "#DA291C" : rc === "amber" ? "#FFB81C" : "#78BE20" }} />
                </div>
                <div className="mt-0.5 text-sm text-slate-600">{label}</div>
                <div className="text-xs text-slate-400">{note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-20 grid gap-5 sm:grid-cols-3">
        {[
          ["✦ AI QI plans","One click writes a practice-specific plan across every domain — the position, ranked priorities, and named actions with owners and effort. Reads like a report you can hand to your ICB."],
          ["Beyond the points","Benchmarks the whole eligible register, not just the payment rate — surfacing patients hidden by exception coding, plus prescribing signals vs your peers."],
          ["Act in one click","Every action names the search, the tool and the message — with copy-ready Accurx questionnaires for recall, ezetimibe offers and vaccination invites."],
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
