/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { escapeRegExp } from "./util";

describe("escapeRegExp", () => {
  test("makes a name with regex characters match only itself", () => {
    const name = "O'Neil, J. (Jr.)";
    const pattern = new RegExp(`^${escapeRegExp(name)}$`, "i");
    expect(pattern.test("o'neil, j. (jr.)")).toBe(true);
    expect(pattern.test("O'Neil, Jx (Jr.)")).toBe(false);
  });
});
