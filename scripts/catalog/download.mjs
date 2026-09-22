/**
 * Downloads the CMU course catalog from ScottyLabs' public API into `catalogDir`, one JSON
 * file per page. Idempotent - an existing, non-empty page file is left alone, so re-running
 * only fills in what's missing.
 *
 * This duplicates (rather than shares) the download step scripts/local-catalog/start.sh runs
 * as embedded Python: that script is bash calling Python, this one is bash calling Bun/JS, and
 * there's no practical way to share code across that language boundary. They write the exact
 * same on-disk format to the exact same cache directory, so whichever runs first satisfies the
 * other - there's no real duplication of behavior that matters, just of the implementation.
 * If you change the download logic here (retry count, concurrency, page size), mirror the
 * change in start.sh's Python block too.
 */
const CATALOG_API = "https://course.apis.scottylabs.org/courses/search?schedules=true&page=";
const CONCURRENCY = 8;
const RETRIES = 3;

const fetchPage = async (page) => {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(`${CATALOG_API}${page}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      JSON.parse(text); // validate before writing, so a truncated response never gets cached
      return text;
    } catch (err) {
      if (attempt === RETRIES) throw new Error(`failed to download page ${page}: ${err.message}`);
    }
  }
};

/**
 * @param {string} catalogDir - directory to write pNNNN.json files into (created if missing)
 * @returns {Promise<number>} total pages in the catalog
 */
export const downloadCatalog = async (catalogDir) => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  fs.mkdirSync(catalogDir, { recursive: true });

  const pagePath = (p) => path.join(catalogDir, `p${String(p).padStart(4, "0")}.json`);
  const isCached = (p) => {
    try {
      return fs.statSync(pagePath(p)).size > 500;
    } catch {
      return false;
    }
  };

  const first = await fetchPage(1);
  const totalPages = JSON.parse(first).totalPages;
  if (!isCached(1)) fs.writeFileSync(pagePath(1), first);

  const remaining = [];
  for (let p = 2; p <= totalPages; p++) if (!isCached(p)) remaining.push(p);

  let cursor = 0;
  const worker = async () => {
    while (cursor < remaining.length) {
      const page = remaining[cursor++];
      fs.writeFileSync(pagePath(page), await fetchPage(page));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return totalPages;
};
