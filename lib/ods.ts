// NHS ODS ORD API client. Open-access, no key required.
// Docs: https://digital.nhs.uk/developer/api-catalogue/organisation-data-service-ord
const BASE = "https://directory.spineservices.nhs.uk/ORD/2-0-0";

export type OdsMatch = {
  odsCode: string;
  name: string;
  postcode?: string;
  status?: string;
};

// Search GP practices (PrimaryRoleId RO177 = GP Practice) by name.
export async function searchPractices(query: string): Promise<OdsMatch[]> {
  if (!query || query.trim().length < 3) return [];
  const url = `${BASE}/organisations?Name=${encodeURIComponent(query)}&PrimaryRoleId=RO177&Limit=20`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 86400 } });
  if (!res.ok) return [];
  const json = await res.json();
  const orgs = json?.Organisations ?? [];
  return orgs.map((o: any) => ({
    odsCode: o.OrgId,
    name: o.Name,
    postcode: o.PostCode,
    status: o.Status,
  }));
}

// Full organisation record incl. relationships (PCN / ICB parents).
export async function getOrganisation(odsCode: string) {
  const url = `${BASE}/organisations/${encodeURIComponent(odsCode)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 86400 } });
  if (!res.ok) return null;
  return res.json();
}
