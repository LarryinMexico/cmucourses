/**
 * Demo data for Scotty Circles: fake students (clerkUserId "demo_*") with profiles, busy times,
 * saved schedules and per-semester posts built from real catalog sections, plus follows,
 * reactions, comments and a few messages among them.
 *
 *   bun run demo-seed                                  dry run: shows what it would do, writes nothing
 *   bun run demo-seed -- --yes                         write the demo data (replacing any earlier demo data)
 *   bun run demo-seed -- --yes --with-real-users       also connect the demo students with every real
 *                                                      profile: all of them follow you, you follow about
 *                                                      half of them (so those are mutual and can message),
 *                                                      and two of them send you an opening message
 *   bun run demo-seed -- --remove --yes                delete all demo data
 *   bun run demo-seed -- --migrate-old --yes           copy data from the old socialSchedules /
 *                                                      scheduleReactions / scheduleComments collections
 *                                                      into posts (the old documents are left as they are)
 *
 * Run from the repo root so Bun loads MONGODB_URI from the root .env. It only ever creates or
 * deletes documents that belong to demo_ users (or, with --migrate-old, posts copied from the old
 * collections); it never edits a real user's profile.
 */
import db from "../../packages/db/index.ts";

const args = new Set(process.argv.slice(2));
const CONFIRM = args.has("--yes");
const REMOVE = args.has("--remove");
const WITH_REAL = args.has("--with-real-users");
const MIGRATE = args.has("--migrate-old");
const PREFIX = "demo_";
const log = (...a) => console.log("[demo-seed]", ...a);

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error("[demo-seed] MONGODB_URI is not set. Run from the repo root (bun run demo-seed) or export it.");
  process.exit(1);
}
const dbName = new URL(URI.replace(/^mongodb(\+srv)?:/, "http:")).pathname.replace(/^\//, "");
log("target:", URI.replace(/\/\/[^@]*@/, "//<redacted>@"));
if (!dbName || dbName === "test") {
  console.error(`[demo-seed] refusing: the database name in MONGODB_URI is "${dbName || "(empty)"}".`);
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------
const STUDENTS = [
  ["Maya Chen", "scs", ["cs"], ["swe", "ml-ai"], ["python", "algorithms", "machine-learning"], "Junior in CS. Looking for 15-445 study buddies!", true],
  ["Leo Park", "cit", ["ece"], ["hardware-embedded", "systems-infra"], ["c-cpp", "embedded-systems", "computer-architecture"], "ECE sophomore, robotics club.", false],
  ["Priya Nair", "dietrich", ["statistics-ml"], ["data-science", "ml-ai"], ["python", "statistics", "probability"], "Stats & ML. Coffee > sleep.", true],
  ["Ethan Brooks", "tepper", [], ["quant-finance", "consulting"], ["financial-modeling", "statistics"], "Business + econ, aiming for quant.", false],
  ["Sofia Alvarez", "scs", ["ai"], ["ml-ai", "research"], ["deep-learning", "nlp", "python"], "AI major, into NLP research.", true],
  ["Noah Kim", "mcs", ["mathematical-sciences"], ["quant-finance", "research"], ["probability", "linear-algebra", "optimization"], "Math major. Ask me about 21-241.", false],
  ["Hana Suzuki", "cfa", [], ["ux-design", "product-management"], ["ui-ux-design", "user-research"], "Design student exploring HCI.", true],
  ["Omar Haddad", "heinz", ["mism"], ["product-management", "consulting"], ["sql", "product-strategy", "data-visualization"], "MISM '27. Happy to chat about Heinz.", false],
  ["Grace Liu", "scs", ["cs"], ["security", "systems-infra"], ["systems-programming", "security-fundamentals", "networking"], "CTF player, PPP.", true],
  ["Daniel Wright", "cit", ["mechanical-engineering"], ["robotics"], ["controls", "c-cpp"], "MechE, building a Mars rover.", false],
  ["Aisha Mohammed", "dietrich", ["information-systems"], ["product-management", "swe"], ["web-development", "sql", "javascript-typescript"], "IS major, frontend dev.", true],
  ["Lucas Rossi", "scs", ["cs"], ["swe", "entrepreneurship"], ["distributed-systems", "cloud-devops", "java"], "Startup nerd, 15-440 survivor.", false],
  ["Mei Tanaka", "mcs", ["neuroscience"], ["research", "data-science"], ["statistics", "python"], "Neuro + comp. Lab life.", true],
  ["Ben Carter", "dietrich", ["economics"], ["tech-policy", "consulting"], ["statistics", "technical-writing"], "Econ & policy. Running for student senate.", false],
];

const COURSE_POOLS = {
  scs: ["15-122", "15-150", "15-213", "15-251", "15-281", "15-445", "10-301", "21-241", "05-391", "15-440", "11-411", "17-313"],
  cit: ["18-100", "18-213", "18-240", "18-290", "24-101", "24-261", "21-259", "33-141", "18-349"],
  dietrich: ["36-200", "36-226", "36-401", "73-102", "73-230", "67-250", "67-262", "85-211", "79-104"],
  tepper: ["70-122", "70-311", "70-381", "73-102", "21-120", "36-200", "70-391"],
  mcs: ["21-241", "21-259", "21-301", "33-141", "03-121", "85-219", "36-226", "21-355"],
  cfa: ["51-121", "51-171", "05-391", "05-360", "60-101", "62-150"],
  heinz: ["95-702", "95-703", "95-706", "95-713", "94-806", "95-744", "95-880"],
};
const COMMENTS = [
  "Nice schedule! Are you in the same recitation as me?",
  "That Friday looks brutal 😅",
  "Let's study for the midterm together.",
  "How is the workload so far?",
  "I took that last year, happy to share notes.",
  "Wow, you fit everything before 3pm!",
  "Same lecture! See you there.",
  "Do you know if the TA office hours are on Thursday?",
];
const REACTIONS = ["👍", "🎉", "🔥", "📚"];
const BUSY_LABELS = ["Part-time job", "Club meeting", "Research lab", "Gym", "Tutoring", "Volunteer"];

// ---------------------------------------------------------------------------------------------
const rand = (() => {
  let seed = 20260925;
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
})();
const pick = (list) => list[Math.floor(rand() * list.length)];
const daysAgo = (d, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000);

const minutes = (t) => {
  const m = /^(\d{2}):(\d{2})(AM|PM)$/.exec(t ?? "");
  if (!m) return null;
  return ((Number(m[1]) % 12) + (m[3] === "PM" ? 12 : 0)) * 60 + Number(m[2]);
};
const overlaps = (a, b) =>
  a.some((x) =>
    b.some((y) => {
      const [ab, ae, bb, be] = [minutes(x.begin), minutes(x.end), minutes(y.begin), minutes(y.end)];
      return ab !== null && bb !== null && x.days.some((d) => y.days.includes(d)) && ab < be && bb < ae;
    })
  );

/** Latest two regular semesters that have schedules, from the database, else from the public API. */
const loadSchedules = async (courseIDs) => {
  const rows = await db.schedules.findMany({ where: { courseID: { in: courseIDs } } });
  if (rows.length > 0) return { rows, source: "database" };
  log("no schedules in this database (catalog-sync never run); reading sections from the public API");
  const url = `https://course.apis.scottylabs.org/courses?${courseIDs.map((c) => `courseID=${c}`).join("&")}&schedules=true`;
  const courses = await (await fetch(url, { headers: { "User-Agent": "cmucourses-demo-seed" } })).json();
  return { rows: courses.flatMap((c) => c.schedules ?? []), source: "public API" };
};

const optionFor = (schedule) => {
  const lecture = schedule.lectures?.find((l) => (l.times ?? []).some((t) => minutes(t.begin) !== null));
  if (lecture) {
    const section = schedule.sections?.find((s) => s.lecture === lecture.name);
    return { lecture: lecture.name, section: section?.name ?? null, times: [...lecture.times, ...(section?.times ?? [])] };
  }
  const section = schedule.sections?.find((s) => (s.times ?? []).some((t) => minutes(t.begin) !== null));
  return section ? { lecture: null, section: section.name, times: section.times } : null;
};

// ---------------------------------------------------------------------------------------------
const demoUsers = await db.profiles.findMany({ where: { clerkUserId: { startsWith: PREFIX } } });
const demoPosts = await db.circlePosts.findMany({ where: { authorUserId: { startsWith: PREFIX } } });
log(`currently: ${demoUsers.length} demo profiles, ${demoPosts.length} demo posts`);

const removeDemo = async () => {
  const profileIds = (await db.profiles.findMany({ where: { clerkUserId: { startsWith: PREFIX } } })).map((p) => p.id);
  const postIds = (await db.circlePosts.findMany({ where: { authorUserId: { startsWith: PREFIX } } })).map((p) => p.id);
  const counts = {
    postReactions: (await db.postReactions.deleteMany({ where: { OR: [{ postId: { in: postIds } }, { reactorUserId: { startsWith: PREFIX } }] } })).count,
    postComments: (await db.postComments.deleteMany({ where: { OR: [{ postId: { in: postIds } }, { authorUserId: { startsWith: PREFIX } }] } })).count,
    circlePosts: (await db.circlePosts.deleteMany({ where: { authorUserId: { startsWith: PREFIX } } })).count,
    savedSchedules: (await db.savedSchedules.deleteMany({ where: { clerkUserId: { startsWith: PREFIX } } })).count,
    directMessages: (await db.directMessages.deleteMany({ where: { OR: [{ senderUserId: { startsWith: PREFIX } }, { recipientUserId: { startsWith: PREFIX } }] } })).count,
    follows: (await db.follows.deleteMany({ where: { OR: [{ followerUserId: { startsWith: PREFIX } }, { followedProfileId: { in: profileIds } }] } })).count,
    profiles: (await db.profiles.deleteMany({ where: { clerkUserId: { startsWith: PREFIX } } })).count,
  };
  log("removed:", JSON.stringify(counts));
};

// ---------------------------------------------------------------------------------------------
if (MIGRATE) {
  const old = (await db.$runCommandRaw({ find: "socialSchedules", filter: {} })).cursor.firstBatch;
  const oldReactions = (await db.$runCommandRaw({ find: "scheduleReactions", filter: {} })).cursor.firstBatch;
  const oldComments = (await db.$runCommandRaw({ find: "scheduleComments", filter: {} })).cursor.firstBatch;
  log(`--migrate-old: ${old.length} old published schedules, ${oldReactions.length} reactions, ${oldComments.length} comments`);
  if (CONFIRM) {
    let made = 0;
    for (const s of old) {
      const exists = await db.circlePosts.findUnique({
        where: { authorUserId_semester_year: { authorUserId: s.clerkUserId, semester: s.semester, year: s.year } },
      });
      if (exists) continue;
      const post = await db.circlePosts.create({
        data: {
          authorUserId: s.clerkUserId,
          name: s.name,
          semester: s.semester,
          year: s.year,
          session: null,
          courses: (s.courses ?? []).map((c) => ({ courseID: c.courseID, lecture: c.lecture ?? null, section: c.section ?? null })),
        },
      });
      made++;
      const author = await db.profiles.findUnique({ where: { clerkUserId: s.clerkUserId } });
      if (!author) continue;
      for (const r of oldReactions.filter((r) => String(r.targetProfileId?.$oid ?? r.targetProfileId) === author.id)) {
        await db.postReactions.upsert({
          where: { reactorUserId_postId: { reactorUserId: r.reactorUserId, postId: post.id } },
          update: {},
          create: { reactorUserId: r.reactorUserId, postId: post.id, reaction: r.reaction },
        });
      }
      for (const c of oldComments.filter((c) => String(c.targetProfileId?.$oid ?? c.targetProfileId) === author.id)) {
        await db.postComments.create({ data: { authorUserId: c.authorUserId, postId: post.id, body: c.body } });
      }
    }
    log(`migrated ${made} posts (old documents left untouched)`);
  }
}

if (REMOVE) {
  if (!CONFIRM) log("dry run: would delete every demo_ profile, post, saved schedule, follow, reaction, comment and message. Add --yes.");
  else await removeDemo();
  await db.$disconnect();
  process.exit(0);
}

if (MIGRATE && !args.has("--seed")) {
  if (!CONFIRM) log("dry run: add --yes to migrate.");
  await db.$disconnect();
  process.exit(0);
}

const allCourseIDs = [...new Set(Object.values(COURSE_POOLS).flat())];
const { rows: schedules, source } = await loadSchedules(allCourseIDs);
const terms = [...new Set(schedules.filter((s) => s.semester !== "summer").map((s) => `${s.year}:${s.semester}`))]
  .map((k) => ({ year: Number(k.split(":")[0]), semester: k.split(":")[1] }))
  .sort((a, b) => b.year - a.year || (a.semester === "fall" ? -1 : 1))
  .slice(0, 2);
log(`sections from the ${source}; posting for ${terms.map((t) => `${t.semester} ${t.year}`).join(" and ")}`);

const realProfiles = WITH_REAL
  ? await db.profiles.findMany({ where: { NOT: { clerkUserId: { startsWith: PREFIX } } } })
  : [];
log(
  `plan: ${STUDENTS.length} demo students, about ${STUDENTS.length * 1.5 | 0} posts, follows/reactions/comments among them` +
    (WITH_REAL ? `, connected with ${realProfiles.length} real profile(s)` : "")
);
if (!CONFIRM) {
  log("dry run: nothing written. Add --yes to write (earlier demo data is replaced).");
  await db.$disconnect();
  process.exit(0);
}

await removeDemo();

const VIS = (pub) => ({
  academic: "PUBLIC",
  careers: "PUBLIC",
  skills: pub ? "PUBLIC" : "PRIVATE",
  courses: "PRIVATE",
  busyLabels: pub ? "PUBLIC" : "PRIVATE",
});

const people = [];
for (const [i, [name, college, majors, careers, skills, bio, open]] of STUDENTS.entries()) {
  const clerkUserId = `${PREFIX}${name.toLowerCase().replace(/[^a-z]+/g, "_")}`;
  const busyBlocks = Array.from({ length: 2 + (i % 3) }, (_, k) => {
    const day = 1 + ((i + k * 2) % 5);
    const begin = (9 + ((i * 3 + k * 5) % 9)) * 60;
    return { day, begin, end: begin + 60 + 30 * (k % 3), label: pick(BUSY_LABELS) };
  });
  const profile = await db.profiles.create({
    data: {
      clerkUserId,
      displayName: name,
      bio,
      careers,
      skillsHave: skills.slice(0, 2),
      skillsWant: skills.slice(2),
      academic: { college, majors, minors: [] },
      busyBlocks,
      visibility: VIS(open),
      onboardedAt: daysAgo(20),
    },
  });
  people.push({ profile, college });
}

let postCount = 0;
for (const [i, { profile, college }] of people.entries()) {
  const myTerms = i % 3 === 0 ? terms : terms.slice(0, 1);
  for (const [t, term] of myTerms.entries()) {
    const chosen = [];
    for (const courseID of [...COURSE_POOLS[college]].sort(() => rand() - 0.5)) {
      if (chosen.length >= 4) break;
      const schedule = schedules.find(
        (s) => s.courseID === courseID && Number(s.year) === term.year && s.semester === term.semester
      );
      const option = schedule && optionFor(schedule);
      if (!option || chosen.some((c) => overlaps(c.times, option.times))) continue;
      chosen.push({ courseID, ...option });
    }
    if (chosen.length === 0) continue;
    const courses = chosen.map(({ courseID, lecture, section }) => ({ courseID, lecture, section }));
    const name = `${profile.displayName.split(" ")[0]}'s ${term.semester} ${term.year}`;
    const saved = await db.savedSchedules.create({
      data: { clerkUserId: profile.clerkUserId, name, semester: term.semester, year: String(term.year), session: null, courses },
    });
    const when = daysAgo((i * 13 + t * 5) % 14, i);
    const post = await db.circlePosts.create({
      data: {
        authorUserId: profile.clerkUserId,
        name,
        semester: term.semester,
        year: String(term.year),
        session: null,
        courses,
        sourceScheduleId: saved.id,
        createdAt: when,
      },
    });
    // @updatedAt is set by Prisma on write; put the post back in the past so the feed has a history.
    await db.$runCommandRaw({
      update: "circlePosts",
      updates: [{ q: { _id: { $oid: post.id } }, u: { $set: { updatedAt: { $date: when.toISOString() } } } }],
    });
    postCount++;
  }
}

// follows: everyone follows 4-6 others, so there are plenty of mutual pairs
let follows = 0;
for (const [i, { profile }] of people.entries()) {
  const others = people.filter((_, j) => j !== i).sort(() => rand() - 0.5).slice(0, 4 + (i % 3));
  for (const o of others) {
    await db.follows.create({ data: { followerUserId: profile.clerkUserId, followedProfileId: o.profile.id, createdAt: daysAgo(15) } });
    follows++;
  }
}

// reactions and comments from followers
const posts = await db.circlePosts.findMany({ where: { authorUserId: { startsWith: PREFIX } } });
const allFollows = await db.follows.findMany({ where: { followerUserId: { startsWith: PREFIX } } });
let reactions = 0;
let comments = 0;
for (const post of posts) {
  const author = people.find((p) => p.profile.clerkUserId === post.authorUserId);
  const fans = allFollows.filter((f) => f.followedProfileId === author.profile.id).map((f) => f.followerUserId);
  for (const [k, fan] of fans.entries()) {
    if (rand() < 0.7) {
      await db.postReactions.create({ data: { reactorUserId: fan, postId: post.id, reaction: pick(REACTIONS) } });
      reactions++;
    }
    if (k < 2 && rand() < 0.6) {
      await db.postComments.create({ data: { authorUserId: fan, postId: post.id, body: pick(COMMENTS), createdAt: daysAgo(rand() * 5) } });
      comments++;
    }
  }
}

// a couple of conversations among demo students
const key = (a, b) => [a, b].sort().join(":");
const dm = (from, to, body, ago) =>
  db.directMessages.create({
    data: { conversationKey: key(from, to), senderUserId: from, recipientUserId: to, body, createdAt: daysAgo(0, ago), readAt: daysAgo(0, ago - 0.1) },
  });
await dm(people[0].profile.clerkUserId, people[8].profile.clerkUserId, "Are you taking 15-445 in the fall?", 30);
await dm(people[8].profile.clerkUserId, people[0].profile.clerkUserId, "Yes! Want to form a project group?", 29);

// connect with the real accounts
let realNotes = "";
if (WITH_REAL) {
  for (const real of realProfiles) {
    for (const [i, { profile }] of people.entries()) {
      await db.follows.create({ data: { followerUserId: profile.clerkUserId, followedProfileId: real.id } });
      if (i % 2 === 0) {
        await db.follows.upsert({
          where: { followerUserId_followedProfileId: { followerUserId: real.clerkUserId, followedProfileId: profile.id } },
          update: {},
          create: { followerUserId: real.clerkUserId, followedProfileId: profile.id },
        });
      }
    }
    for (const [i, text] of [
      [0, "Hi! Saw your schedule in Circles. Want to study together this semester?"],
      [2, "Hey, are you in any of my classes? Feel free to message me!"],
    ]) {
      await db.directMessages.create({
        data: {
          conversationKey: key(people[i].profile.clerkUserId, real.clerkUserId),
          senderUserId: people[i].profile.clerkUserId,
          recipientUserId: real.clerkUserId,
          body: text,
          createdAt: daysAgo(0, 2 - i * 0.5),
        },
      });
    }
  }
  realNotes = `, connected with ${realProfiles.length} real profile(s)`;
}

log(`wrote: ${people.length} profiles, ${postCount} posts, ${follows} follows, ${reactions} reactions, ${comments} comments${realNotes}`);
await db.$disconnect();
