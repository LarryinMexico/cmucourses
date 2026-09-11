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

export const labelOf = (items: readonly TaxonomyItem[], id: string): string =>
  items.find((item) => item.id === id)?.label ?? id;
