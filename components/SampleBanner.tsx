export default function SampleBanner() {
  const year = process.env.NEXT_PUBLIC_QOF_YEAR || "2025/26";
  const sample = year === "2025/26";
  return (
    <div className={sample ? "bg-nhs-amber/20 text-amber-900" : "bg-nhs-green/10 text-nhs-green"}>
      <div className="mx-auto max-w-6xl px-4 py-1.5 text-xs sm:px-6">
        {sample
          ? <>Showing <strong>sample data</strong> for the demo practice · run the ingestion to load live NHS figures.</>
          : <>Showing <strong>published NHS QOF {year}</strong> data · points priced at that year&apos;s value.</>}
      </div>
    </div>
  );
}
