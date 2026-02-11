import { storage } from "../storage";

const CENSUS_BASE = "https://api.census.gov/data/2023/acs/acs5";
const DATA_YEAR = 2023;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const STATE_FIPS: Record<string, string> = {
  "Alabama": "01", "Alaska": "02", "Arizona": "04", "Arkansas": "05",
  "California": "06", "Colorado": "08", "Connecticut": "09", "Delaware": "10",
  "Florida": "12", "Georgia": "13", "Hawaii": "15", "Idaho": "16",
  "Illinois": "17", "Indiana": "18", "Iowa": "19", "Kansas": "20",
  "Kentucky": "21", "Louisiana": "22", "Maine": "23", "Maryland": "24",
  "Massachusetts": "25", "Michigan": "26", "Minnesota": "27", "Mississippi": "28",
  "Missouri": "29", "Montana": "30", "Nebraska": "31", "Nevada": "32",
  "New Hampshire": "33", "New Jersey": "34", "New Mexico": "35", "New York": "36",
  "North Carolina": "37", "North Dakota": "38", "Ohio": "39", "Oklahoma": "40",
  "Oregon": "41", "Pennsylvania": "42", "Rhode Island": "44", "South Carolina": "45",
  "South Dakota": "46", "Tennessee": "47", "Texas": "48", "Utah": "49",
  "Vermont": "50", "Virginia": "51", "Washington": "53", "West Virginia": "54",
  "Wisconsin": "55", "Wyoming": "56", "District of Columbia": "11",
};

const SPA_MAPPING: Record<string, { description: string; approximateArea: string; stateCode: string }> = {
  "SPA 1": { description: "Antelope Valley", approximateArea: "Lancaster/Palmdale area", stateCode: "06" },
  "SPA 2": { description: "San Fernando Valley", approximateArea: "San Fernando Valley area", stateCode: "06" },
  "SPA 3": { description: "San Gabriel Valley", approximateArea: "Pasadena/San Gabriel area", stateCode: "06" },
  "SPA 4": { description: "Metro LA", approximateArea: "Downtown LA/Hollywood area", stateCode: "06" },
  "SPA 5": { description: "West LA", approximateArea: "Santa Monica/Beverly Hills area", stateCode: "06" },
  "SPA 6": { description: "South LA", approximateArea: "South Los Angeles/Compton area", stateCode: "06" },
  "SPA 7": { description: "East LA", approximateArea: "East Los Angeles/Whittier area", stateCode: "06" },
  "SPA 8": { description: "South Bay/Harbor", approximateArea: "Long Beach/Torrance area", stateCode: "06" },
};

const SPA_POPULATIONS: Record<string, { totalPopulation: number; povertyRate: number; medianIncome: number }> = {
  "SPA 1": { totalPopulation: 475000, povertyRate: 21.5, medianIncome: 52000 },
  "SPA 2": { totalPopulation: 2200000, povertyRate: 13.8, medianIncome: 68000 },
  "SPA 3": { totalPopulation: 1800000, povertyRate: 12.2, medianIncome: 72000 },
  "SPA 4": { totalPopulation: 1100000, povertyRate: 22.1, medianIncome: 45000 },
  "SPA 5": { totalPopulation: 660000, povertyRate: 9.8, medianIncome: 95000 },
  "SPA 6": { totalPopulation: 1050000, povertyRate: 28.3, medianIncome: 38000 },
  "SPA 7": { totalPopulation: 1300000, povertyRate: 16.7, medianIncome: 55000 },
  "SPA 8": { totalPopulation: 1500000, povertyRate: 14.2, medianIncome: 65000 },
};

export interface CensusComparison {
  geographyLevel: string;
  geographyValue: string;
  totalPopulation: number | null;
  povertyRate: number | null;
  medianIncome: number | null;
  isApproximate: boolean;
  approximateNote?: string;
  dataYear: number;
}

function findStateFips(stateName: string): string | undefined {
  const normalized = stateName.trim();
  if (STATE_FIPS[normalized]) return STATE_FIPS[normalized];
  const lower = normalized.toLowerCase();
  for (const [name, fips] of Object.entries(STATE_FIPS)) {
    if (name.toLowerCase() === lower) return fips;
  }
  if (/^\d{2}$/.test(normalized)) return normalized;
  return undefined;
}

async function fetchFromCensus(variables: string, forGeo: string, inGeo?: string): Promise<string[][] | null> {
  try {
    const apiKey = process.env.CENSUS_API_KEY;
    let url = `${CENSUS_BASE}?get=${variables}&for=${forGeo}`;
    if (inGeo) url += `&in=${inGeo}`;
    if (apiKey) url += `&key=${apiKey}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      console.error(`Census API error: ${response.status} ${response.statusText}`);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error("Census API fetch error:", err);
    return null;
  }
}

function parseNumber(val: string | null | undefined): number | null {
  if (!val || val === "null" || val === "-") return null;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
}

async function fetchStateCensus(stateName: string): Promise<CensusComparison | null> {
  const fips = findStateFips(stateName);
  if (!fips) return null;

  const cached = await storage.getCensusData("State", stateName);
  if (cached && cached.fetchedAt && (Date.now() - cached.fetchedAt.getTime()) < CACHE_TTL_MS) {
    return {
      geographyLevel: "State",
      geographyValue: stateName,
      totalPopulation: cached.totalPopulation,
      povertyRate: cached.povertyCount && cached.povertyUniverse
        ? Math.round((cached.povertyCount / cached.povertyUniverse) * 1000) / 10
        : null,
      medianIncome: cached.medianIncome,
      isApproximate: false,
      dataYear: cached.dataYear,
    };
  }

  const data = await fetchFromCensus("NAME,B01003_001E,B17001_002E,B17001_001E,B19013_001E", `state:${fips}`);
  if (!data || data.length < 2) return null;

  const row = data[1];
  const totalPop = parseNumber(row[1]);
  const povertyCt = parseNumber(row[2]);
  const povertyUni = parseNumber(row[3]);
  const medIncome = parseNumber(row[4]);

  await storage.upsertCensusData({
    geographyLevel: "State",
    geographyValue: stateName,
    stateCode: fips,
    totalPopulation: totalPop,
    povertyCount: povertyCt,
    povertyUniverse: povertyUni,
    medianIncome: medIncome,
    dataYear: DATA_YEAR,
  });

  return {
    geographyLevel: "State",
    geographyValue: stateName,
    totalPopulation: totalPop,
    povertyRate: povertyCt && povertyUni ? Math.round((povertyCt / povertyUni) * 1000) / 10 : null,
    medianIncome: medIncome,
    isApproximate: false,
    dataYear: DATA_YEAR,
  };
}

async function fetchCountyCensus(countyName: string): Promise<CensusComparison | null> {
  const cached = await storage.getCensusData("County", countyName);
  if (cached && cached.fetchedAt && (Date.now() - cached.fetchedAt.getTime()) < CACHE_TTL_MS) {
    return {
      geographyLevel: "County",
      geographyValue: countyName,
      totalPopulation: cached.totalPopulation,
      povertyRate: cached.povertyCount && cached.povertyUniverse
        ? Math.round((cached.povertyCount / cached.povertyUniverse) * 1000) / 10
        : null,
      medianIncome: cached.medianIncome,
      isApproximate: false,
      dataYear: cached.dataYear,
    };
  }

  const data = await fetchFromCensus("NAME,B01003_001E,B17001_002E,B17001_001E,B19013_001E", "county:*", "state:*");
  if (!data || data.length < 2) return null;

  const normalized = countyName.toLowerCase().replace(/\s*county\s*/i, "").trim();
  const exactPattern = `${normalized} county,`;
  let matchRow: string[] | undefined = undefined;
  let fallback: string[] | undefined = undefined;

  for (let i = 1; i < data.length; i++) {
    const name = (data[i][0] || "").toLowerCase();
    if (name.startsWith(exactPattern)) {
      matchRow = data[i];
      break;
    }
    if (!fallback && name.includes(normalized)) {
      fallback = data[i];
    }
  }
  if (!matchRow) matchRow = fallback;

  if (!matchRow) return null;

  const totalPop = parseNumber(matchRow[1]);
  const povertyCt = parseNumber(matchRow[2]);
  const povertyUni = parseNumber(matchRow[3]);
  const medIncome = parseNumber(matchRow[4]);
  const stateCode = matchRow[6] || matchRow[5];

  await storage.upsertCensusData({
    geographyLevel: "County",
    geographyValue: countyName,
    stateCode: stateCode || null,
    totalPopulation: totalPop,
    povertyCount: povertyCt,
    povertyUniverse: povertyUni,
    medianIncome: medIncome,
    dataYear: DATA_YEAR,
  });

  return {
    geographyLevel: "County",
    geographyValue: countyName,
    totalPopulation: totalPop,
    povertyRate: povertyCt && povertyUni ? Math.round((povertyCt / povertyUni) * 1000) / 10 : null,
    medianIncome: medIncome,
    isApproximate: false,
    dataYear: DATA_YEAR,
  };
}

async function fetchCityCensus(cityName: string): Promise<CensusComparison | null> {
  const cached = await storage.getCensusData("City", cityName);
  if (cached && cached.fetchedAt && (Date.now() - cached.fetchedAt.getTime()) < CACHE_TTL_MS) {
    return {
      geographyLevel: "City",
      geographyValue: cityName,
      totalPopulation: cached.totalPopulation,
      povertyRate: cached.povertyCount && cached.povertyUniverse
        ? Math.round((cached.povertyCount / cached.povertyUniverse) * 1000) / 10
        : null,
      medianIncome: cached.medianIncome,
      isApproximate: false,
      dataYear: cached.dataYear,
    };
  }

  const allStates = Object.values(STATE_FIPS);
  let matchRow: string[] | null = null;

  for (const stateCode of ["06", "36", "48", "12", "17", ...allStates]) {
    const data = await fetchFromCensus(
      "NAME,B01003_001E,B17001_002E,B17001_001E,B19013_001E",
      "place:*",
      `state:${stateCode}`
    );
    if (!data || data.length < 2) continue;

    const normalized = cityName.toLowerCase().trim();
    const exactPattern = `${normalized} city,`;
    const cdpPattern = `${normalized} cdp,`;
    const townPattern = `${normalized} town,`;
    let bestMatch: string[] | null = null;
    let bestScore = 0;

    for (let i = 1; i < data.length; i++) {
      const name = (data[i][0] || "").toLowerCase();
      if (name.startsWith(exactPattern)) {
        bestMatch = data[i];
        bestScore = 100;
        break;
      }
      if (name.startsWith(cdpPattern) && bestScore < 80) {
        bestMatch = data[i];
        bestScore = 80;
      }
      if (name.startsWith(townPattern) && bestScore < 70) {
        bestMatch = data[i];
        bestScore = 70;
      }
      if (name.includes(normalized) && bestScore < 10) {
        bestMatch = data[i];
        bestScore = 10;
      }
    }
    const found = bestMatch;

    if (found) {
      matchRow = found;
      break;
    }
  }

  if (!matchRow) return null;

  const totalPop = parseNumber(matchRow[1]);
  const povertyCt = parseNumber(matchRow[2]);
  const povertyUni = parseNumber(matchRow[3]);
  const medIncome = parseNumber(matchRow[4]);

  await storage.upsertCensusData({
    geographyLevel: "City",
    geographyValue: cityName,
    stateCode: null,
    totalPopulation: totalPop,
    povertyCount: povertyCt,
    povertyUniverse: povertyUni,
    medianIncome: medIncome,
    dataYear: DATA_YEAR,
  });

  return {
    geographyLevel: "City",
    geographyValue: cityName,
    totalPopulation: totalPop,
    povertyRate: povertyCt && povertyUni ? Math.round((povertyCt / povertyUni) * 1000) / 10 : null,
    medianIncome: medIncome,
    isApproximate: false,
    dataYear: DATA_YEAR,
  };
}

function getSPACensus(spaValue: string): CensusComparison {
  const normalized = spaValue.trim().toUpperCase().replace(/\s+/g, " ");
  const key = Object.keys(SPA_POPULATIONS).find(k =>
    k.toUpperCase() === normalized || normalized.includes(k.replace("SPA ", ""))
  );
  const spaData = key ? SPA_POPULATIONS[key] : null;
  const spaInfo = key ? SPA_MAPPING[key] : null;

  return {
    geographyLevel: "SPA",
    geographyValue: spaValue,
    totalPopulation: spaData?.totalPopulation || null,
    povertyRate: spaData?.povertyRate || null,
    medianIncome: spaData?.medianIncome || null,
    isApproximate: true,
    approximateNote: spaInfo
      ? `${spaInfo.description} (${spaInfo.approximateArea}). SPA data is estimated from LA County census subdivisions.`
      : "SPA is an LA County planning area. Census data is approximate.",
    dataYear: DATA_YEAR,
  };
}

export async function getCensusComparison(
  geographyLevel: string,
  geographyValue: string
): Promise<CensusComparison> {
  try {
    switch (geographyLevel) {
      case "State": {
        const result = await fetchStateCensus(geographyValue);
        if (result) return result;
        break;
      }
      case "County": {
        const result = await fetchCountyCensus(geographyValue);
        if (result) return result;
        break;
      }
      case "City": {
        const result = await fetchCityCensus(geographyValue);
        if (result) return result;
        break;
      }
      case "SPA": {
        return getSPACensus(geographyValue);
      }
    }
  } catch (err) {
    console.error(`Census lookup failed for ${geographyLevel}/${geographyValue}:`, err);
  }

  return {
    geographyLevel,
    geographyValue,
    totalPopulation: null,
    povertyRate: null,
    medianIncome: null,
    isApproximate: false,
    dataYear: DATA_YEAR,
  };
}

const AGE_GROUP_VARS = [
  { label: "Under 5", minAge: 0, maxAge: 4, male: "B01001_003E", female: "B01001_027E" },
  { label: "5-9", minAge: 5, maxAge: 9, male: "B01001_004E", female: "B01001_028E" },
  { label: "10-14", minAge: 10, maxAge: 14, male: "B01001_005E", female: "B01001_029E" },
  { label: "15-17", minAge: 15, maxAge: 17, male: "B01001_006E", female: "B01001_030E" },
  { label: "18-19", minAge: 18, maxAge: 19, male: "B01001_007E", female: "B01001_031E" },
  { label: "20", minAge: 20, maxAge: 20, male: "B01001_008E", female: "B01001_032E" },
  { label: "21", minAge: 21, maxAge: 21, male: "B01001_009E", female: "B01001_033E" },
  { label: "22-24", minAge: 22, maxAge: 24, male: "B01001_010E", female: "B01001_034E" },
  { label: "25-29", minAge: 25, maxAge: 29, male: "B01001_011E", female: "B01001_035E" },
  { label: "30-34", minAge: 30, maxAge: 34, male: "B01001_012E", female: "B01001_036E" },
  { label: "35-39", minAge: 35, maxAge: 39, male: "B01001_013E", female: "B01001_037E" },
  { label: "40-44", minAge: 40, maxAge: 44, male: "B01001_014E", female: "B01001_038E" },
  { label: "45-49", minAge: 45, maxAge: 49, male: "B01001_015E", female: "B01001_039E" },
  { label: "50-54", minAge: 50, maxAge: 54, male: "B01001_016E", female: "B01001_040E" },
  { label: "55-59", minAge: 55, maxAge: 59, male: "B01001_017E", female: "B01001_041E" },
  { label: "60-61", minAge: 60, maxAge: 61, male: "B01001_018E", female: "B01001_042E" },
  { label: "62-64", minAge: 62, maxAge: 64, male: "B01001_019E", female: "B01001_043E" },
  { label: "65-66", minAge: 65, maxAge: 66, male: "B01001_020E", female: "B01001_044E" },
  { label: "67-69", minAge: 67, maxAge: 69, male: "B01001_021E", female: "B01001_045E" },
  { label: "70-74", minAge: 70, maxAge: 74, male: "B01001_022E", female: "B01001_046E" },
  { label: "75-79", minAge: 75, maxAge: 79, male: "B01001_023E", female: "B01001_047E" },
  { label: "80-84", minAge: 80, maxAge: 84, male: "B01001_024E", female: "B01001_048E" },
  { label: "85+", minAge: 85, maxAge: 120, male: "B01001_025E", female: "B01001_049E" },
];

export interface AgeGroupData {
  geographyLevel: string;
  geographyValue: string;
  totalPopulation: number | null;
  targetAgePopulation: number | null;
  ageGroups: { label: string; minAge: number; maxAge: number; population: number }[];
  isApproximate: boolean;
  dataYear: number;
}

const SPA_AGE_DISTRIBUTIONS: Record<string, Record<string, number>> = {
  "SPA 1": { "Under 5": 7.2, "5-9": 7.5, "10-14": 7.8, "15-17": 4.8, "18-19": 3.0, "20": 1.5, "21": 1.5, "22-24": 4.2, "25-29": 7.0, "30-34": 6.8, "35-39": 6.2, "40-44": 5.8, "45-49": 5.5, "50-54": 5.8, "55-59": 5.5, "60-61": 2.1, "62-64": 2.8, "65-66": 1.6, "67-69": 2.0, "70-74": 2.8, "75-79": 2.0, "80-84": 1.4, "85+": 1.2 },
  "SPA 2": { "Under 5": 5.8, "5-9": 6.0, "10-14": 6.2, "15-17": 3.9, "18-19": 2.6, "20": 1.3, "21": 1.3, "22-24": 4.0, "25-29": 7.5, "30-34": 7.2, "35-39": 6.8, "40-44": 6.5, "45-49": 6.2, "50-54": 6.0, "55-59": 5.8, "60-61": 2.3, "62-64": 3.0, "65-66": 1.8, "67-69": 2.3, "70-74": 3.2, "75-79": 2.5, "80-84": 1.8, "85+": 1.5 },
  "SPA 3": { "Under 5": 5.5, "5-9": 5.8, "10-14": 6.0, "15-17": 3.8, "18-19": 2.5, "20": 1.3, "21": 1.3, "22-24": 4.0, "25-29": 7.2, "30-34": 7.0, "35-39": 6.8, "40-44": 6.5, "45-49": 6.3, "50-54": 6.0, "55-59": 5.8, "60-61": 2.3, "62-64": 3.1, "65-66": 1.9, "67-69": 2.5, "70-74": 3.5, "75-79": 2.8, "80-84": 2.0, "85+": 1.6 },
  "SPA 4": { "Under 5": 5.0, "5-9": 4.8, "10-14": 4.5, "15-17": 2.8, "18-19": 2.5, "20": 1.5, "21": 1.5, "22-24": 5.0, "25-29": 9.5, "30-34": 8.8, "35-39": 7.5, "40-44": 6.5, "45-49": 5.8, "50-54": 5.5, "55-59": 5.2, "60-61": 2.2, "62-64": 3.0, "65-66": 1.8, "67-69": 2.3, "70-74": 3.2, "75-79": 2.5, "80-84": 1.8, "85+": 1.5 },
  "SPA 5": { "Under 5": 4.2, "5-9": 4.5, "10-14": 4.8, "15-17": 3.2, "18-19": 2.2, "20": 1.2, "21": 1.2, "22-24": 4.0, "25-29": 8.0, "30-34": 7.8, "35-39": 7.2, "40-44": 6.8, "45-49": 6.2, "50-54": 6.0, "55-59": 5.8, "60-61": 2.5, "62-64": 3.2, "65-66": 2.0, "67-69": 2.8, "70-74": 3.8, "75-79": 3.2, "80-84": 2.5, "85+": 2.0 },
  "SPA 6": { "Under 5": 7.8, "5-9": 7.5, "10-14": 7.2, "15-17": 4.5, "18-19": 3.0, "20": 1.5, "21": 1.5, "22-24": 4.5, "25-29": 7.5, "30-34": 7.0, "35-39": 6.5, "40-44": 6.0, "45-49": 5.5, "50-54": 5.2, "55-59": 5.0, "60-61": 2.0, "62-64": 2.5, "65-66": 1.5, "67-69": 1.8, "70-74": 2.5, "75-79": 1.8, "80-84": 1.2, "85+": 1.0 },
  "SPA 7": { "Under 5": 6.5, "5-9": 6.8, "10-14": 7.0, "15-17": 4.2, "18-19": 2.8, "20": 1.4, "21": 1.4, "22-24": 4.2, "25-29": 7.2, "30-34": 7.0, "35-39": 6.5, "40-44": 6.2, "45-49": 5.8, "50-54": 5.8, "55-59": 5.5, "60-61": 2.2, "62-64": 2.8, "65-66": 1.7, "67-69": 2.2, "70-74": 3.0, "75-79": 2.2, "80-84": 1.5, "85+": 1.2 },
  "SPA 8": { "Under 5": 5.5, "5-9": 5.8, "10-14": 6.0, "15-17": 3.8, "18-19": 2.5, "20": 1.3, "21": 1.3, "22-24": 4.0, "25-29": 7.5, "30-34": 7.2, "35-39": 6.8, "40-44": 6.5, "45-49": 6.2, "50-54": 6.0, "55-59": 5.8, "60-61": 2.3, "62-64": 3.0, "65-66": 1.8, "67-69": 2.4, "70-74": 3.2, "75-79": 2.5, "80-84": 1.8, "85+": 1.5 },
};

async function fetchAgeDataForGeography(
  geographyLevel: string,
  geographyValue: string
): Promise<AgeGroupData> {
  if (geographyLevel === "SPA") {
    const normalized = geographyValue.trim().toUpperCase().replace(/\s+/g, " ");
    const key = Object.keys(SPA_POPULATIONS).find(k =>
      k.toUpperCase() === normalized || normalized.includes(k.replace("SPA ", ""))
    );
    const spaData = key ? SPA_POPULATIONS[key] : null;
    const ageDist = key ? SPA_AGE_DISTRIBUTIONS[key] : null;

    if (!spaData || !ageDist) {
      return {
        geographyLevel, geographyValue, totalPopulation: null,
        targetAgePopulation: null, ageGroups: [], isApproximate: true, dataYear: DATA_YEAR,
      };
    }

    const ageGroups = AGE_GROUP_VARS.map(ag => ({
      label: ag.label, minAge: ag.minAge, maxAge: ag.maxAge,
      population: Math.round(spaData.totalPopulation * (ageDist[ag.label] || 0) / 100),
    }));

    return {
      geographyLevel, geographyValue, totalPopulation: spaData.totalPopulation,
      targetAgePopulation: null, ageGroups, isApproximate: true, dataYear: DATA_YEAR,
    };
  }

  const allVars = AGE_GROUP_VARS.flatMap(ag => [ag.male, ag.female]);
  const varString = ["NAME", "B01001_001E", ...allVars].join(",");

  let data: string[][] | null = null;

  if (geographyLevel === "State") {
    const fips = findStateFips(geographyValue);
    if (fips) data = await fetchFromCensus(varString, `state:${fips}`);
  } else if (geographyLevel === "County") {
    data = await fetchFromCensus(varString, "county:*", "state:*");
    if (data && data.length >= 2) {
      const normalized = geographyValue.toLowerCase().replace(/\s*county\s*/i, "").trim();
      const exactPattern = `${normalized} county,`;
      let matchRow: string[] | undefined;
      for (let i = 1; i < data.length; i++) {
        const name = (data[i][0] || "").toLowerCase();
        if (name.startsWith(exactPattern)) { matchRow = data[i]; break; }
      }
      data = matchRow ? [data[0], matchRow] : null;
    }
  } else if (geographyLevel === "City") {
    const allStates = Object.values(STATE_FIPS);
    for (const stateCode of ["06", "36", "48", "12", "17", ...allStates]) {
      const stateData = await fetchFromCensus(varString, "place:*", `state:${stateCode}`);
      if (!stateData || stateData.length < 2) continue;
      const normalized = geographyValue.toLowerCase().trim();
      const exactPattern = `${normalized} city,`;
      for (let i = 1; i < stateData.length; i++) {
        const name = (stateData[i][0] || "").toLowerCase();
        if (name.startsWith(exactPattern)) {
          data = [stateData[0], stateData[i]];
          break;
        }
      }
      if (data) break;
    }
  }

  if (!data || data.length < 2) {
    return {
      geographyLevel, geographyValue, totalPopulation: null,
      targetAgePopulation: null, ageGroups: [], isApproximate: false, dataYear: DATA_YEAR,
    };
  }

  const header = data[0];
  const row = data[1];
  const totalPop = parseNumber(row[1]);

  const ageGroups = AGE_GROUP_VARS.map(ag => {
    const maleIdx = header.indexOf(ag.male);
    const femaleIdx = header.indexOf(ag.female);
    const maleVal = maleIdx >= 0 ? parseNumber(row[maleIdx]) || 0 : 0;
    const femaleVal = femaleIdx >= 0 ? parseNumber(row[femaleIdx]) || 0 : 0;
    return { label: ag.label, minAge: ag.minAge, maxAge: ag.maxAge, population: maleVal + femaleVal };
  });

  return {
    geographyLevel, geographyValue, totalPopulation: totalPop,
    targetAgePopulation: null, ageGroups, isApproximate: false, dataYear: DATA_YEAR,
  };
}

export async function getCensusAgeGroups(
  geographies: { level: string; value: string }[],
  ageMin?: number,
  ageMax?: number,
): Promise<AgeGroupData[]> {
  const unique = new Map<string, { level: string; value: string }>();
  geographies.forEach(g => unique.set(`${g.level}:${g.value}`, g));

  const results = await Promise.all(
    Array.from(unique.values()).map(g => fetchAgeDataForGeography(g.level, g.value))
  );

  if (ageMin !== undefined || ageMax !== undefined) {
    const min = ageMin ?? 0;
    const max = ageMax ?? 120;
    for (const r of results) {
      r.targetAgePopulation = r.ageGroups
        .filter(ag => ag.maxAge >= min && ag.minAge <= max)
        .reduce((sum, ag) => sum + ag.population, 0);
    }
  }

  return results;
}

export async function getCensusForGeographies(
  geographies: { level: string; value: string }[]
): Promise<CensusComparison[]> {
  const unique = new Map<string, { level: string; value: string }>();
  geographies.forEach(g => unique.set(`${g.level}:${g.value}`, g));

  const results = await Promise.all(
    Array.from(unique.values()).map(g => getCensusComparison(g.level, g.value))
  );

  return results;
}
