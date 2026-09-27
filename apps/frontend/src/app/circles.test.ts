import { unreadTotal } from "./circles";

describe("unreadTotal", () => {
  it("adds up unread messages across conversations", () => {
    expect(
      unreadTotal([
        { unreadCount: 2 },
        { unreadCount: 0 },
        { unreadCount: 3 },
      ] as never)
    ).toBe(5);
  });
  it("is 0 with no conversations or none loaded", () => {
    expect(unreadTotal([])).toBe(0);
    expect(unreadTotal(undefined)).toBe(0);
  });
});
