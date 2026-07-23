// Universal footer carried by every generated artefact (§0.6).
const SOURCE_URL =
  "https://digital.nhs.uk/data-and-information/publications/statistical/quality-and-outcomes-framework-achievement-prevalence-and-exceptions-data";

export function universalFooter(qofYear: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `Generated ${today} from published NHS QOF ${qofYear} data.`,
    "Estimates are indicative and based on published QOF data.",
    "Intended as prompts for discussion, not clinical or financial advice.",
    "Patient identification suggestions require clinician review before action.",
    SOURCE_URL,
  ].join("\n");
}
