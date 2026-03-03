export interface GeoHierarchy {
  level: string;
  value: string;
}

const CITY_TO_COUNTY: Record<string, string> = {
  "los angeles": "Los Angeles County",
  "long beach": "Los Angeles County",
  "pasadena": "Los Angeles County",
  "glendale": "Los Angeles County",
  "burbank": "Los Angeles County",
  "torrance": "Los Angeles County",
  "inglewood": "Los Angeles County",
  "compton": "Los Angeles County",
  "pomona": "Los Angeles County",
  "west covina": "Los Angeles County",
  "el monte": "Los Angeles County",
  "downey": "Los Angeles County",
  "norwalk": "Los Angeles County",
  "lancaster": "Los Angeles County",
  "palmdale": "Los Angeles County",
  "santa clarita": "Los Angeles County",
  "whittier": "Los Angeles County",
  "alhambra": "Los Angeles County",
  "lakewood": "Los Angeles County",
  "bellflower": "Los Angeles County",
  "lynwood": "Los Angeles County",
  "redondo beach": "Los Angeles County",
  "carson": "Los Angeles County",
  "south gate": "Los Angeles County",
  "hawthorne": "Los Angeles County",
  "monrovia": "Los Angeles County",
  "arcadia": "Los Angeles County",
  "diamond bar": "Los Angeles County",
  "watts": "Los Angeles County",
  "san diego": "San Diego County",
  "san francisco": "San Francisco County",
  "san jose": "Santa Clara County",
  "sacramento": "Sacramento County",
  "fresno": "Fresno County",
  "oakland": "Alameda County",
  "bakersfield": "Kern County",
  "riverside": "Riverside County",
  "stockton": "San Joaquin County",
  "anaheim": "Orange County",
  "santa ana": "Orange County",
  "irvine": "Orange County",
  "new york": "New York County",
  "chicago": "Cook County",
  "houston": "Harris County",
  "phoenix": "Maricopa County",
  "philadelphia": "Philadelphia County",
  "dallas": "Dallas County",
  "austin": "Travis County",
  "seattle": "King County",
  "denver": "Denver County",
  "portland": "Multnomah County",
  "atlanta": "Fulton County",
  "miami": "Miami-Dade County",
  "detroit": "Wayne County",
  "boston": "Suffolk County",
  "las vegas": "Clark County",
};

const COUNTY_TO_STATE: Record<string, string> = {
  "los angeles county": "California",
  "san diego county": "California",
  "san francisco county": "California",
  "santa clara county": "California",
  "sacramento county": "California",
  "fresno county": "California",
  "alameda county": "California",
  "kern county": "California",
  "riverside county": "California",
  "san joaquin county": "California",
  "orange county": "California",
  "new york county": "New York",
  "cook county": "Illinois",
  "harris county": "Texas",
  "maricopa county": "Arizona",
  "philadelphia county": "Pennsylvania",
  "dallas county": "Texas",
  "travis county": "Texas",
  "king county": "Washington",
  "denver county": "Colorado",
  "multnomah county": "Oregon",
  "fulton county": "Georgia",
  "miami-dade county": "Florida",
  "wayne county": "Michigan",
  "suffolk county": "Massachusetts",
  "clark county": "Nevada",
};

const CITY_TO_SPA: Record<string, string[]> = {
  "los angeles": ["SPA 4", "SPA 6"],
  "compton": ["SPA 6"],
  "inglewood": ["SPA 6"],
  "long beach": ["SPA 8"],
  "torrance": ["SPA 8"],
  "carson": ["SPA 8"],
  "redondo beach": ["SPA 8"],
  "hawthorne": ["SPA 8"],
  "pasadena": ["SPA 3"],
  "glendale": ["SPA 2"],
  "burbank": ["SPA 2"],
  "lancaster": ["SPA 1"],
  "palmdale": ["SPA 1"],
  "santa clarita": ["SPA 2"],
  "pomona": ["SPA 3"],
  "west covina": ["SPA 3"],
  "el monte": ["SPA 3"],
  "alhambra": ["SPA 3"],
  "arcadia": ["SPA 3"],
  "monrovia": ["SPA 3"],
  "whittier": ["SPA 7"],
  "downey": ["SPA 7"],
  "norwalk": ["SPA 7"],
  "south gate": ["SPA 7"],
  "bellflower": ["SPA 7"],
  "lakewood": ["SPA 7"],
  "lynwood": ["SPA 6"],
  "diamond bar": ["SPA 3"],
  "watts": ["SPA 6"],
};

const SPA_TO_COUNTY = "Los Angeles County";
const SPA_COUNTY_STATE = "California";

const SPA_TO_CITY: Record<string, string> = {
  "SPA 1": "Los Angeles",
  "SPA 2": "Los Angeles",
  "SPA 3": "Los Angeles",
  "SPA 4": "Los Angeles",
  "SPA 5": "Los Angeles",
  "SPA 6": "Los Angeles",
  "SPA 7": "Los Angeles",
  "SPA 8": "Los Angeles",
};

export function getParentGeographies(level: string, value: string): GeoHierarchy[] {
  const parents: GeoHierarchy[] = [];
  const normalizedValue = value.trim().toLowerCase();

  switch (level) {
    case "City": {
      const county = CITY_TO_COUNTY[normalizedValue];
      if (county) {
        parents.push({ level: "County", value: county });
        const state = COUNTY_TO_STATE[county.toLowerCase()];
        if (state) parents.push({ level: "State", value: state });
      }
      const spas = CITY_TO_SPA[normalizedValue];
      if (spas) {
        spas.forEach(spa => parents.push({ level: "SPA", value: spa }));
      }
      break;
    }
    case "County": {
      const state = COUNTY_TO_STATE[normalizedValue];
      if (state) parents.push({ level: "State", value: state });
      break;
    }
    case "SPA": {
      parents.push({ level: "County", value: SPA_TO_COUNTY });
      parents.push({ level: "State", value: SPA_COUNTY_STATE });
      const spaCity = SPA_TO_CITY[value.trim()];
      if (spaCity) parents.push({ level: "City", value: spaCity });
      break;
    }
  }

  return parents;
}
