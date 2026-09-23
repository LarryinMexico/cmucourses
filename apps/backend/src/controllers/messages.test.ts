/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";
import { fakeDb, resetFakeDb } from "../test/fakeDb";
import { call } from "../test/http";
import { conversationKey, getThread, groupConversations, listConversations, sendMessage } from "./messages";

const ME = { id: "74b7f0c2a1d3e4f5a6b7c8d0", clerkUserId: "user_me", displayName: "Me" };
const ADA = { id: "64b7f0c2a1d3e4f5a6b7c8d9", clerkUserId: "user_ada", displayName: "Ada" };
const CY = { id: "54b7f0c2a1d3e4f5a6b7c8d8", clerkUserId: "user_cy", displayName: null };

beforeEach(resetFakeDb);

type Args = { where: Record<string, unknown> };
const stub = (fn: (args: Args) => unknown) => fn as never;

/** Who follows whom, seen from the caller (user_me) and Ada. */
const world = ({ me = ME as object | null, iFollow = true, theyFollow = true } = {}) => {
  fakeDb.profiles!.findUnique!.mockImplementation(
    stub(async (args) =>
      args.where.id === ADA.id ? ADA : args.where.id === CY.id ? CY : args.where.clerkUserId === "user_me" ? me : null
    )
  );
  fakeDb.follows!.findUnique!.mockImplementation(
    stub(async (args) => {
      const key = args.where.followerUserId_followedProfileId as { followerUserId: string; followedProfileId: string };
      if (key.followerUserId === "user_me" && key.followedProfileId === ADA.id) return iFollow ? { id: "f1" } : null;
      if (key.followerUserId === "user_ada" && key.followedProfileId === ME.id) return theyFollow ? { id: "f2" } : null;
      return null;
    })
  );
};

describe("conversationKey", () => {
  test("is the same whichever side asks, and never a bare Clerk id", () => {
    expect(conversationKey("user_b", "user_a")).toBe(conversationKey("user_a", "user_b"));
    expect(conversationKey("user_a", "user_b")).toBe("user_a:user_b");
  });
});

describe("groupConversations", () => {
  const msg = (id: string, from: string, to: string, at: string) => ({
    id,
    senderUserId: from,
    recipientUserId: to,
    body: id,
    createdAt: new Date(at),
  });

  test("one entry per other person, latest message first, newest conversation first", () => {
    const groups = groupConversations(
      [
        msg("m4", "user_me", "user_cy", "2026-09-04"),
        msg("m3", "user_ada", "user_me", "2026-09-03"),
        msg("m2", "user_me", "user_ada", "2026-09-02"),
      ],
      "user_me"
    );
    expect(groups.map((g) => [g.otherUserId, g.last.body, g.last.senderUserId === "user_me"])).toEqual([
      ["user_cy", "m4", true],
      ["user_ada", "m3", false],
    ]);
  });
});

describe("sendMessage", () => {
  const send = (body: unknown, profileID: string = ADA.id) =>
    call(sendMessage as never, "user_me", { profileID, body });

  test("400 for an empty or too long message", async () => {
    world();
    expect((await send("  ")).status).toBe(400);
    expect((await send("x".repeat(1001))).status).toBe(400);
    expect(fakeDb.directMessages!.create!.mock.calls).toHaveLength(0);
  });

  test("404 for an unknown profile or yourself", async () => {
    world();
    expect((await send("hi", "44b7f0c2a1d3e4f5a6b7c8aa")).status).toBe(404);
    fakeDb.profiles!.findUnique!.mockImplementation(stub(async () => ME));
    expect((await send("hi", ME.id)).status).toBe(404);
  });

  test("403 unless both of you follow each other, whichever way it is missing", async () => {
    for (const opts of [{ iFollow: false }, { theyFollow: false }, { me: null }]) {
      resetFakeDb();
      world(opts);
      const { status, body } = await send("hi");
      expect(status).toBe(403);
      expect(body).toEqual({ error: "You can message students you follow who follow you back" });
      expect(fakeDb.directMessages!.create!.mock.calls).toHaveLength(0);
    }
  });

  test("a mutual follow can message; the stored key does not depend on who sends", async () => {
    world();
    const { status, body } = await send("  hello  ");
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(fakeDb.directMessages!.create!.mock.calls[0]).toEqual([
      {
        data: {
          conversationKey: "user_ada:user_me",
          senderUserId: "user_me",
          recipientUserId: "user_ada",
          body: "hello",
        },
      },
    ]);
  });
});

describe("listConversations", () => {
  const list = () => call(listConversations as never, "user_me");
  const at = (d: string) => new Date(d);

  const setup = ({ iFollowAda = true, adaFollowsMe = true } = {}) => {
    world();
    fakeDb.directMessages!.findMany!.mockImplementation(
      stub(async (args) =>
        "select" in args
          ? [{ senderUserId: "user_ada" }, { senderUserId: "user_bob" }] // unread, to me
          : [
              {
                id: "m4",
                senderUserId: "user_me",
                recipientUserId: "user_cy",
                body: "to cy",
                createdAt: at("2026-09-04"),
              },
              {
                id: "m3",
                senderUserId: "user_ada",
                recipientUserId: "user_me",
                body: "hello",
                createdAt: at("2026-09-03"),
              },
              {
                id: "m2",
                senderUserId: "user_me",
                recipientUserId: "user_ada",
                body: "hi",
                createdAt: at("2026-09-02"),
              },
              {
                id: "m1",
                senderUserId: "user_bob",
                recipientUserId: "user_me",
                body: "yo",
                createdAt: at("2026-09-01"),
              },
            ]
      )
    );
    fakeDb.profiles!.findMany!.mockResolvedValue([ADA, CY] as never); // bob has no profile
    fakeDb.follows!.findMany!.mockImplementation(
      stub(async (args) =>
        "followerUserId" in args.where
          ? [...(iFollowAda ? [{ followedProfileId: ADA.id }] : [])]
          : [...(adaFollowsMe ? [{ followerUserId: "user_ada" }] : [])]
      )
    );
  };

  test("lists people you have talked to, newest first, with unread counts", async () => {
    setup();
    const { body } = await list();
    const rows = body as {
      profileID: string;
      displayName: string;
      unreadCount: number;
      canSend: boolean;
      lastMessage: { body: string; fromMe: boolean };
    }[];
    expect(rows.map((r) => [r.displayName, r.lastMessage.body, r.lastMessage.fromMe, r.unreadCount])).toEqual([
      ["CMU student", "to cy", true, 0],
      ["Ada", "hello", false, 1],
    ]);
  });

  test("counts unread with a filter that also matches messages that never had readAt set", async () => {
    setup();
    await list();
    const unreadQuery = fakeDb
      .directMessages!.findMany!.mock.calls.map(([args]) => args as { where: object; select?: object })
      .find((args) => args.select);
    expect(unreadQuery?.where).toEqual({
      recipientUserId: "user_me",
      OR: [{ readAt: null }, { readAt: { isSet: false } }],
    });
  });

  test("drops people who have no profile and never exposes Clerk ids", async () => {
    setup();
    const { body } = await list();
    expect((body as unknown[]).length).toBe(2); // bob is gone
    expect(JSON.stringify(body)).not.toContain("user_");
  });

  test("canSend is true only for a mutual follow", async () => {
    setup();
    const canSend = async () =>
      ((await list()).body as { profileID: string; canSend: boolean }[]).map((r) => [r.profileID, r.canSend]);
    expect(await canSend()).toEqual([
      [CY.id, false],
      [ADA.id, true],
    ]);
    resetFakeDb();
    setup({ adaFollowsMe: false });
    expect(await canSend()).toEqual([
      [CY.id, false],
      [ADA.id, false],
    ]);
  });
});

describe("getThread", () => {
  const open = (profileID: string = ADA.id) => call(getThread as never, "user_me", { profileID });

  test("404 for an unknown profile or yourself", async () => {
    world();
    expect((await open("44b7f0c2a1d3e4f5a6b7c8aa")).status).toBe(404);
    fakeDb.profiles!.findUnique!.mockImplementation(stub(async () => ME));
    expect((await open(ME.id)).status).toBe(404);
  });

  test("returns the last 100 oldest first and marks the ones sent to you as read", async () => {
    world();
    fakeDb.directMessages!.findMany!.mockResolvedValue([
      {
        id: "m2",
        senderUserId: "user_ada",
        recipientUserId: "user_me",
        body: "second",
        createdAt: new Date("2026-09-02"),
      },
      {
        id: "m1",
        senderUserId: "user_me",
        recipientUserId: "user_ada",
        body: "first",
        createdAt: new Date("2026-09-01"),
      },
    ] as never);
    const { body } = await open();
    expect(fakeDb.directMessages!.findMany!.mock.calls[0]).toEqual([
      { where: { conversationKey: "user_ada:user_me" }, orderBy: { createdAt: "desc" }, take: 100 },
    ]);
    expect((body as { messageID: string; body: string; fromMe: boolean }[]).map((m) => [m.body, m.fromMe])).toEqual([
      ["first", true],
      ["second", false],
    ]);
    expect(JSON.stringify(body)).not.toContain("user_");

    const [update] = fakeDb.directMessages!.updateMany!.mock.calls[0] as [{ where: object; data: { readAt: Date } }];
    // A message has no readAt field until it is read, and Prisma's `readAt: null` does not match a
    // missing field on MongoDB, so "unread" has to say `isSet: false` as well.
    expect(update.where).toEqual({
      conversationKey: "user_ada:user_me",
      recipientUserId: "user_me",
      OR: [{ readAt: null }, { readAt: { isSet: false } }],
    });
    expect(update.data.readAt).toBeInstanceOf(Date);
  });

  test("history stays readable after you stop following each other", async () => {
    world({ iFollow: false, theyFollow: false });
    fakeDb.directMessages!.findMany!.mockResolvedValue([
      { id: "m1", senderUserId: "user_ada", recipientUserId: "user_me", body: "old", createdAt: new Date() },
    ] as never);
    const { status, body } = await open();
    expect(status).toBe(200);
    expect((body as unknown[]).length).toBe(1);
  });
});
