import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseHnThread } from "./hn-hiring";

const thread = JSON.parse(readFileSync("test/fixtures/hn-thread.json", "utf8"));

describe("hn-hiring parser", () => {
  it("extracts jobs from top-level comments", () => {
    const jobs = parseHnThread(thread);
    expect(jobs.length).toBeGreaterThan(0);
    const j = jobs[0];
    expect(j.company).toBeTruthy();
    expect(j.title).toBeTruthy();
    expect(j.url).toContain("news.ycombinator.com/item?id=");
    expect(j.description.length).toBeGreaterThan(0);
  });

  it("ignores empty/deleted comments", () => {
    const jobs = parseHnThread({ children: [{ id: 1, text: null }, { id: 2, text: "" }] });
    expect(jobs.length).toBe(0);
  });
});
