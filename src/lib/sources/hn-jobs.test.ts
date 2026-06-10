import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseHnJob } from "./hn-jobs";

const item = JSON.parse(readFileSync("test/fixtures/hn-job.json", "utf8"));

describe("hn-jobs parser", () => {
  it("maps an HN job item to RawJob", () => {
    const j = parseHnJob(item);
    expect(j).not.toBeNull();
    expect(j!.title).toBeTruthy();
    expect(j!.url).toMatch(/^https?:/);
  });

  it("splits 'Company is hiring Role' titles", () => {
    const j = parseHnJob({ id: 9, type: "job", title: "Acme (YC W21) is hiring a Senior Engineer", time: 1700000000, url: "https://acme.com" });
    expect(j!.company).toContain("Acme");
    expect(j!.title.toLowerCase()).toContain("engineer");
  });

  it("returns null for non-job or missing title", () => {
    expect(parseHnJob(null)).toBeNull();
    expect(parseHnJob({ id: 1, type: "story", title: "x" })).toBeNull();
    expect(parseHnJob({ id: 2, type: "job" })).toBeNull();
  });
});
