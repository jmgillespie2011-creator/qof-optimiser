// OpenPrescribing.net API client. Open, no key. Docs: https://openprescribing.net/api/
const BASE = "https://openprescribing.net/api/1.0";

export async function spendingByOrg(orgType: "practice" | "sicbl" | "pcn", code: string, bnfCode: string) {
  const url = `${BASE}/spending_by_org/?org_type=${orgType}&code=${code}&code=${bnfCode}&format=json`;
  const res = await fetch(url, { next: { revalidate: 604800 } });
  if (!res.ok) return [];
  return res.json();
}

export async function measureForOrg(measureId: string, orgType: "practice" | "pcn" | "sicbl", code: string) {
  const url = `${BASE}/measure_by_practice/?measure=${measureId}&org=${code}&format=json`;
  const res = await fetch(url, { next: { revalidate: 604800 } });
  if (!res.ok) return null;
  return res.json();
}

export async function searchOrg(q: string, orgType: "practice" | "CCG" = "practice") {
  const url = `${BASE}/org_code/?q=${encodeURIComponent(q)}&org_type=${orgType}&format=json`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return [];
  return res.json();
}
