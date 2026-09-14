/**
 * An entry in one of the fixed profile taxonomies.
 *
 * `id` is what gets stored in a profile, so once an id has shipped it must never be renamed
 * or removed — change `label` instead, and set `deprecated` to hide an entry from new picks
 * while keeping existing profiles valid.
 */
export interface TaxonomyItem {
  id: string;
  label: string;
  deprecated?: boolean;
}

export const activeItems = <T extends TaxonomyItem>(items: readonly T[]): T[] =>
  items.filter((item) => !item.deprecated);

// Taxonomy arrays are module-level constants (stable identity for the app's lifetime), so a
// WeakMap keyed by the array caches each one's id->label index after its first lookup instead
// of doing a linear scan on every call — this matters once course-tag pills call it per card.
const labelMaps = new WeakMap<readonly TaxonomyItem[], ReadonlyMap<string, string>>();

const labelMapFor = (items: readonly TaxonomyItem[]): ReadonlyMap<string, string> => {
  let map = labelMaps.get(items);
  if (!map) {
    map = new Map(items.map((item) => [item.id, item.label]));
    labelMaps.set(items, map);
  }
  return map;
};

export const labelOf = (items: readonly TaxonomyItem[], id: string): string => labelMapFor(items).get(id) ?? id;
