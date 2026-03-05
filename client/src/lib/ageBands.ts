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

/** Numeric [min, max] age for each band value */
export const BAND_RANGES: Record<string, [number, number]> = {
  "newborn":  [0,   0],
  "under-1":  [0,   0],
  "1-4":      [1,   4],
  "5-9":      [5,   9],
  "10-12":    [10, 12],
  "13-15":    [13, 15],
  "16-18":    [16, 18],
  "19-24":    [19, 24],
  "25-34":    [25, 34],
  "35-44":    [35, 44],
  "45-54":    [45, 54],
  "55-64":    [55, 64],
  "65-74":    [65, 74],
  "75-84":    [75, 84],
  "85-100":   [85, 100],
  "100+":     [100, 999],
  "under-18": [0,  17],
  "18-24":    [18, 24],
  "65+":      [65, 999],
};

/** Keep only bands whose range overlaps [ageMin, ageMax] */
export function filterBandsByAge(
  bands: AgeBand[],
  ageMin: number | null | undefined,
  ageMax: number | null | undefined,
): AgeBand[] {
  if (ageMin == null && ageMax == null) return bands;
  const lo = ageMin ?? 0;
  const hi = ageMax ?? 999;
  return bands.filter(b => {
    const range = BAND_RANGES[b.value];
    if (!range) return true; // unknown band — keep it
    return range[0] <= hi && range[1] >= lo;
  });
}

/**
 * Single source of truth for age band resolution:
 * 1. Explicit ageBands (program-configured) — use as-is
 * 2. targetAgeMin / targetAgeMax — filter MASTER_AGE_BANDS
 * 3. Fallback — DEFAULT_AGE_BANDS
 */
export function resolveAgeBands(
  ageBands: AgeBand[] | null | undefined,
  targetAgeMin: number | null | undefined,
  targetAgeMax: number | null | undefined,
): AgeBand[] {
  if (ageBands && ageBands.length > 0) return ageBands;
  if (targetAgeMin != null || targetAgeMax != null)
    return filterBandsByAge(MASTER_AGE_BANDS, targetAgeMin, targetAgeMax);
  return DEFAULT_AGE_BANDS;
}

export const AGE_BAND_PRESETS: { label: string; bands: AgeBand[] }[] = [
  { label: "General",                  bands: DEFAULT_AGE_BANDS },
  { label: "Infant & Early Childhood", bands: pick("newborn", "under-1", "1-4", "5-9") },
  { label: "Youth",                    bands: pick("5-9", "10-12", "13-15", "16-18", "19-24") },
  { label: "Adult",                    bands: pick("19-24", "25-34", "35-44", "45-54", "55-64", "65-74") },
  { label: "Senior",                   bands: pick("55-64", "65-74", "75-84", "85-100", "100+") },
  { label: "Full Range",               bands: MASTER_AGE_BANDS },
];
