/**
 * How much of each term's catalog could say whether a class is in person or online.
 * The catalog has no modality field; the only proxies are a meeting's location, building and
 * room (the generator's inferredModality reads them). Reads the cached catalog that
 * scripts/local-catalog/start.sh and `bun run catalog-sync` download.
 *
 *   node scripts/catalog/measure-modality.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = path.join(
  process.env.CATALOG_CACHE || path.join(os.homedir(), ".cache/cmucourses-local-catalog"),
  "catalog"
);
if (!fs.existsSync(dir)) {
  console.error(`No cached catalog at ${dir}. Run scripts/local-catalog/start.sh once first.`);
  process.exit(1);
}

const terms = new Map();
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  for (const course of JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")).docs ?? []) {
    for (const schedule of course.schedules ?? []) {
      const key = `${schedule.year} ${schedule.semester}`;
      const term = terms.get(key) ?? { times: 0, withBuilding: 0, withRoom: 0, withLocation: 0, remote: 0, dnm: 0 };
      for (const meeting of [...(schedule.lectures ?? []), ...(schedule.sections ?? [])]) {
        for (const time of meeting.times ?? []) {
          term.times++;
          if (time.building) term.withBuilding++;
          if (time.room) term.withRoom++;
          if (meeting.location) term.withLocation++;
          if (/remote|online|zoom/i.test(`${meeting.location ?? ""} ${time.building ?? ""} ${time.room ?? ""}`))
            term.remote++;
          if (time.building === "DNM") term.dnm++;
        }
      }
      terms.set(key, term);
    }
  }
}

const order = { spring: 0, summer: 1, fall: 2 };
const rows = [...terms.entries()]
  .sort(([a], [b]) => a.split(" ")[0] - b.split(" ")[0] || order[a.split(" ")[1]] - order[b.split(" ")[1]])
  .slice(-8);
console.log("term          times  building  room  location  remote-like  DNM");
for (const [key, t] of rows) {
  console.log(
    `${key.padEnd(12)} ${String(t.times).padStart(6)} ${String(t.withBuilding).padStart(9)} ${String(t.withRoom).padStart(5)} ${String(t.withLocation).padStart(9)} ${String(t.remote).padStart(12)} ${String(t.dnm).padStart(4)}`
  );
}
