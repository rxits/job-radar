import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseWwr } from "./wwr";

const xml = readFileSync("test/fixtures/wwr.xml", "utf8");

describe("wwr parser", () => {
  it("parses items from the XML fixture", () => {
    const jobs = parseWwr(xml);
    expect(jobs.length).toBeGreaterThan(0);
  });

  it("splits title on first colon to get company and role", () => {
    const jobs = parseWwr(xml);
    const j = jobs[0];
    expect(j.company).toBeTruthy();
    expect(j.title).toBeTruthy();
    // Title from fixture: "Stellar AI: Senior Software Engineer"
    expect(j.company).toBe("Stellar AI");
    expect(j.title).toBe("Senior Software Engineer");
  });

  it("maps region tag to geoRaw and location", () => {
    const jobs = parseWwr(xml);
    const j = jobs[0];
    expect(j.geoRaw).not.toBeNull();
    expect(j.location).toBe(j.geoRaw);
  });

  it("sets remote=true for all jobs", () => {
    const jobs = parseWwr(xml);
    for (const j of jobs) expect(j.remote).toBe(true);
  });

  it("produces valid ISO postedAt dates", () => {
    const jobs = parseWwr(xml);
    for (const j of jobs) {
      if (j.postedAt) expect(() => new Date(j.postedAt!).toISOString()).not.toThrow();
    }
  });

  it("url is populated for all jobs", () => {
    const jobs = parseWwr(xml);
    for (const j of jobs) expect(j.url).toMatch(/^https?:/);
  });

  it("strips HTML entities from description", () => {
    const jobs = parseWwr(xml);
    for (const j of jobs) {
      // should not contain raw &lt; or &gt; (those are entity-encoded HTML)
      expect(j.description).not.toMatch(/&lt;|&gt;|&amp;/);
    }
  });

  it("slices description to 4000 chars", () => {
    const jobs = parseWwr(xml);
    for (const j of jobs) expect(j.description.length).toBeLessThanOrEqual(4000);
  });

  it("drops items with no company or title (malformed title)", () => {
    const malformedXml = `<item><title>NoColon</title><link>https://example.com</link><pubDate>Mon, 01 Jan 2026 00:00:00 +0000</pubDate><description></description></item>`;
    const jobs = parseWwr(malformedXml);
    expect(jobs.length).toBe(0);
  });
});
