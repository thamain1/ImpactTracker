export interface AgeBand {
  value: string;
  label: string;
}

/** Full palette — every possible band from newborn to 100+ */
export const MASTER_AGE_BANDS: AgeBand[] = [
  { value: "newborn", label: "Newborn (0–1 mo)" },
  { value: "under-1", label: "Under 1 year" },
  { value: "1-4",     label: "1–4" },
  { value: "5-9",     label: "5–9" },
  { value: "10-12",   label: "10–12" },
  { value: "13-15",   label: "13–15" },
  { value: "16-18",   label: "16–18" },
  { value: "19-24",   label: "19–24" },
  { value: "25-34",   label: "25–34" },
  { value: "35-44",   label: "35–44" },
  { value: "45-54",   label: "45–54" },
  { value: "55-64",   label: "55–64" },
  { value: "65-74",   label: "65–74" },
  { value: "75-84",   label: "75–84" },
  { value: "85-100",  label: "85–100" },
  { value: "100+",    label: "100+" },
];

/** Legacy default — used when a program has no age_bands configured */
export const DEFAULT_AGE_BANDS: AgeBand[] = [
  { value: "under-18", label: "Under 18" },
  { value: "18-24",    label: "18–24" },
  { value: "25-34",    label: "25–34" },
  { value: "35-44",    label: "35–44" },
  { value: "45-54",    label: "45–54" },
  { value: "55-64",    label: "55–64" },
  { value: "65+",      label: "65+" },
];

const pick = (...values: string[]): AgeBand[] =>
  MASTER_AGE_BANDS.filter(b => values.includes(b.value));

export const AGE_BAND_PRESETS: { label: string; bands: AgeBand[] }[] = [
  { label: "General",                  bands: DEFAULT_AGE_BANDS },
  { label: "Infant & Early Childhood", bands: pick("newborn", "under-1", "1-4", "5-9") },
  { label: "Youth",                    bands: pick("5-9", "10-12", "13-15", "16-18", "19-24") },
  { label: "Adult",                    bands: pick("19-24", "25-34", "35-44", "45-54", "55-64", "65-74") },
  { label: "Senior",                   bands: pick("55-64", "65-74", "75-84", "85-100", "100+") },
  { label: "Full Range",               bands: MASTER_AGE_BANDS },
];
