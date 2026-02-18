import { getParentGeographies } from "../../shared/geography";
export type { GeoHierarchy } from "../../shared/geography";
export { getParentGeographies } from "../../shared/geography";

export function expandGeographies(
  geographies: { level: string; value: string }[]
): { expanded: { level: string; value: string }[]; rollupMap: Record<string, string[]> } {
  const seen = new Set<string>();
  const expanded: { level: string; value: string }[] = [];
  const rollupMap: Record<string, string[]> = {};

  for (const geo of geographies) {
    const key = `${geo.level}:${geo.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      expanded.push(geo);
    }

    const parents = getParentGeographies(geo.level, geo.value);
    for (const parent of parents) {
      const parentKey = `${parent.level}:${parent.value}`;
      if (!rollupMap[parentKey]) rollupMap[parentKey] = [];
      if (!rollupMap[parentKey].includes(key)) {
        rollupMap[parentKey].push(key);
      }
      if (!seen.has(parentKey)) {
        seen.add(parentKey);
        expanded.push(parent);
      }
    }
  }

  return { expanded, rollupMap };
}
