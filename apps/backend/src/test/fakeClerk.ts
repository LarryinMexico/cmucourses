/// <reference types="bun-types" />
import { mock } from "bun:test";

type FakeUser = { emailAddresses: { emailAddress: string }[] };

/** Stand-in for `clerkClient.users.getUser`; a test sets what it resolves (or rejects) with. */
export const fakeGetUser = mock(async (): Promise<FakeUser> => ({ emailAddresses: [] }));

export const fakeClerkClient = { users: { getUser: fakeGetUser } };
