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

  it("does not split first-line fields on unpadded hyphens", () => {
    const jobs = parseHnThread({
      children: [{ id: 3, created_at: "2026-06-01T00:00:00Z",
        text: "SmarterDx | $150-250k+ | Senior Engineer | REMOTE (US only) — more details follow here." }],
    });
    expect(jobs[0].company).toBe("SmarterDx");
    expect(jobs[0].title).toBe("$150-250k+"); // intact, not split at the hyphen
  });

  it("does not flag 'distributed systems' roles as remote", () => {
    const jobs = parseHnThread({
      children: [{ id: 4, created_at: "2026-06-01T00:00:00Z",
        text: "BIT Capital | Backend Engineer | ONSITE Berlin | We build distributed systems at scale." }],
    });
    expect(jobs[0].remote).toBe(false);
  });
});
