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
  const matchRow = data.find((row, i) => {
    if (i === 0) return false;
    const name = (row[0] || "").toLowerCase();
    return name.includes(normalized);
  });

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
    const found = data.find((row, i) => {
      if (i === 0) return false;
      const name = (row[0] || "").toLowerCase();
      return name.includes(normalized);
    });

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
