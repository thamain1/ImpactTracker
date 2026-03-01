/**
 * Zip Code → Geographic Hierarchy Resolution
 *
 * For US zip codes:
 *  - Checks LA County SPA zip table for SPA assignment
 *  - Calls Nominatim for city / county / state
 *  - Returns full geoContext: { spa?, city?, county?, state? }
 *
 * Source: la_county_zip_to_spa.csv (authoritative LA County DPH crosswalk)
 */

export interface GeoContext {
  spa?: string;
  city?: string;
  county?: string;
  state?: string;
}

// LA County zip code → SPA mapping
// Rebuilt from la_county_zip_to_spa.csv (LA County DPH Service Planning Areas)
const LA_ZIP_TO_SPA: Record<string, string> = {
  // SPA 1 — Antelope Valley
  "93510": "SPA 1", "93523": "SPA 1", "93532": "SPA 1", "93534": "SPA 1",
  "93535": "SPA 1", "93536": "SPA 1", "93543": "SPA 1", "93544": "SPA 1",
  "93550": "SPA 1", "93551": "SPA 1", "93552": "SPA 1", "93553": "SPA 1",
  "93563": "SPA 1", "93584": "SPA 1", "93586": "SPA 1", "93590": "SPA 1",
  "93591": "SPA 1",

  // SPA 2 — San Fernando Valley
  "91011": "SPA 2", "91040": "SPA 2", "91042": "SPA 2", "91046": "SPA 2",
  "91201": "SPA 2", "91202": "SPA 2", "91203": "SPA 2", "91204": "SPA 2",
  "91205": "SPA 2", "91206": "SPA 2", "91207": "SPA 2", "91208": "SPA 2",
  "91214": "SPA 2", "91301": "SPA 2", "91302": "SPA 2", "91303": "SPA 2",
  "91304": "SPA 2", "91306": "SPA 2", "91307": "SPA 2", "91311": "SPA 2",
  "91316": "SPA 2", "91321": "SPA 2", "91324": "SPA 2", "91325": "SPA 2",
  "91326": "SPA 2", "91331": "SPA 2", "91335": "SPA 2", "91340": "SPA 2",
  "91342": "SPA 2", "91343": "SPA 2", "91344": "SPA 2", "91345": "SPA 2",
  "91350": "SPA 2", "91351": "SPA 2", "91352": "SPA 2", "91354": "SPA 2",
  "91355": "SPA 2", "91356": "SPA 2", "91361": "SPA 2", "91362": "SPA 2",
  "91364": "SPA 2", "91367": "SPA 2", "91381": "SPA 2", "91384": "SPA 2",
  "91401": "SPA 2", "91402": "SPA 2", "91403": "SPA 2", "91404": "SPA 2",
  "91405": "SPA 2", "91406": "SPA 2", "91423": "SPA 2", "91436": "SPA 2",
  "91501": "SPA 2", "91502": "SPA 2", "91504": "SPA 2", "91505": "SPA 2",
  "91506": "SPA 2", "91601": "SPA 2", "91602": "SPA 2", "91604": "SPA 2",
  "91605": "SPA 2", "91606": "SPA 2", "91607": "SPA 2", "91608": "SPA 2",

  // SPA 3 — San Gabriel Valley
  "91001": "SPA 3", "91006": "SPA 3", "91007": "SPA 3", "91010": "SPA 3",
  "91012": "SPA 3", "91016": "SPA 3", "91020": "SPA 3", "91023": "SPA 3",
  "91024": "SPA 3", "91030": "SPA 3", "91101": "SPA 3", "91103": "SPA 3",
  "91104": "SPA 3", "91105": "SPA 3", "91106": "SPA 3", "91107": "SPA 3",
  "91108": "SPA 3", "91702": "SPA 3", "91706": "SPA 3", "91711": "SPA 3",
  "91722": "SPA 3", "91723": "SPA 3", "91724": "SPA 3", "91731": "SPA 3",
  "91732": "SPA 3", "91733": "SPA 3", "91740": "SPA 3", "91741": "SPA 3",
  "91744": "SPA 3", "91745": "SPA 3", "91746": "SPA 3", "91748": "SPA 3",
  "91750": "SPA 3", "91754": "SPA 3", "91755": "SPA 3", "91765": "SPA 3",
  "91766": "SPA 3", "91767": "SPA 3", "91768": "SPA 3", "91770": "SPA 3",
  "91773": "SPA 3", "91775": "SPA 3", "91776": "SPA 3", "91780": "SPA 3",
  "91789": "SPA 3", "91790": "SPA 3", "91791": "SPA 3", "91792": "SPA 3",
  "91801": "SPA 3", "91802": "SPA 3", "91803": "SPA 3",

  // SPA 4 — Metro LA
  "90004": "SPA 4", "90005": "SPA 4", "90006": "SPA 4", "90010": "SPA 4",
  "90012": "SPA 4", "90013": "SPA 4", "90014": "SPA 4", "90015": "SPA 4",
  "90016": "SPA 4", "90017": "SPA 4", "90019": "SPA 4", "90020": "SPA 4",
  "90021": "SPA 4", "90026": "SPA 4", "90027": "SPA 4", "90028": "SPA 4",
  "90029": "SPA 4", "90030": "SPA 4", "90031": "SPA 4", "90032": "SPA 4",
  "90033": "SPA 4", "90036": "SPA 4", "90038": "SPA 4", "90039": "SPA 4",
  "90041": "SPA 4", "90042": "SPA 4", "90046": "SPA 4", "90048": "SPA 4",
  "90057": "SPA 4", "90063": "SPA 4", "90065": "SPA 4", "90068": "SPA 4",
  "90069": "SPA 4", "90071": "SPA 4",

  // SPA 5 — West
  "90024": "SPA 5", "90025": "SPA 5", "90034": "SPA 5", "90035": "SPA 5",
  "90045": "SPA 5", "90049": "SPA 5", "90056": "SPA 5", "90064": "SPA 5",
  "90066": "SPA 5", "90067": "SPA 5", "90073": "SPA 5", "90077": "SPA 5",
  "90094": "SPA 5", "90210": "SPA 5", "90211": "SPA 5", "90212": "SPA 5",
  "90230": "SPA 5", "90231": "SPA 5", "90232": "SPA 5", "90262": "SPA 5",
  "90265": "SPA 5", "90272": "SPA 5", "90290": "SPA 5", "90291": "SPA 5",
  "90292": "SPA 5", "90293": "SPA 5", "90401": "SPA 5", "90402": "SPA 5",
  "90403": "SPA 5", "90404": "SPA 5", "90405": "SPA 5",

  // SPA 6 — South LA
  "90001": "SPA 6", "90002": "SPA 6", "90003": "SPA 6", "90007": "SPA 6",
  "90008": "SPA 6", "90011": "SPA 6", "90018": "SPA 6", "90037": "SPA 6",
  "90043": "SPA 6", "90044": "SPA 6", "90047": "SPA 6", "90051": "SPA 6",
  "90059": "SPA 6", "90061": "SPA 6", "90062": "SPA 6", "90220": "SPA 6",
  "90221": "SPA 6", "90222": "SPA 6", "90723": "SPA 6",

  // SPA 7 — East LA / San Gabriel Valley South
  "90022": "SPA 7", "90023": "SPA 7", "90040": "SPA 7", "90058": "SPA 7",
  "90201": "SPA 7", "90240": "SPA 7", "90241": "SPA 7", "90242": "SPA 7",
  "90270": "SPA 7", "90601": "SPA 7", "90602": "SPA 7", "90603": "SPA 7",
  "90604": "SPA 7", "90605": "SPA 7", "90606": "SPA 7", "90631": "SPA 7",
  "90638": "SPA 7", "90640": "SPA 7", "90650": "SPA 7", "90660": "SPA 7",
  "90661": "SPA 7", "90670": "SPA 7", "90701": "SPA 7", "90703": "SPA 7",
  "90704": "SPA 7", "90706": "SPA 7", "90707": "SPA 7", "90712": "SPA 7",
  "90713": "SPA 7", "90714": "SPA 7", "90715": "SPA 7", "90716": "SPA 7",

  // SPA 8 — South Bay / Long Beach
  "90245": "SPA 8", "90247": "SPA 8", "90248": "SPA 8", "90249": "SPA 8",
  "90250": "SPA 8", "90254": "SPA 8", "90255": "SPA 8", "90260": "SPA 8",
  "90266": "SPA 8", "90274": "SPA 8", "90275": "SPA 8", "90277": "SPA 8",
  "90278": "SPA 8", "90280": "SPA 8", "90301": "SPA 8", "90302": "SPA 8",
  "90303": "SPA 8", "90304": "SPA 8", "90305": "SPA 8", "90501": "SPA 8",
  "90502": "SPA 8", "90503": "SPA 8", "90504": "SPA 8", "90505": "SPA 8",
  "90710": "SPA 8", "90717": "SPA 8", "90731": "SPA 8", "90732": "SPA 8",
  "90744": "SPA 8", "90745": "SPA 8", "90746": "SPA 8", "90747": "SPA 8",
  "90803": "SPA 8", "90804": "SPA 8", "90805": "SPA 8", "90806": "SPA 8",
  "90807": "SPA 8", "90808": "SPA 8", "90810": "SPA 8", "90813": "SPA 8",
  "90814": "SPA 8", "90815": "SPA 8", "90822": "SPA 8", "90834": "SPA 8",
  "90840": "SPA 8",
};

/** Resolve a 5-digit US zip code to its geographic hierarchy. Returns null if zip is invalid or unrecognized. */
export async function resolveZipCode(zip: string): Promise<GeoContext | null> {
  const cleaned = zip.trim().replace(/\D/g, "").slice(0, 5);
  if (cleaned.length !== 5) return null;

  const context: GeoContext = {};

  // SPA lookup (LA County only)
  const spa = LA_ZIP_TO_SPA[cleaned];
  if (spa) context.spa = spa;

  // City / county / state via Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&postalcode=${cleaned}&country=US&addressdetails=1&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ImpactTracker/1.0 (nonprofit impact reporting)" },
    });
    if (res.ok) {
      const data = await res.json() as any[];
      if (data.length > 0) {
        const addr = data[0].address as Record<string, string>;
        // Nominatim returns various keys for city — try them in priority order
        const city = addr.city || addr.town || addr.village || addr.suburb || addr.hamlet;
        if (city) context.city = city;
        if (addr.county) context.county = addr.county;
        if (addr.state) context.state = addr.state;
      }
    }
  } catch {
    // Nominatim unavailable — return what we have from static table
  }

  return Object.keys(context).length > 0 ? context : null;
}
