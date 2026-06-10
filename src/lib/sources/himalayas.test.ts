import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseHimalayas } from "./himalayas";

const data = JSON.parse(readFileSync("test/fixtures/himalayas.json", "utf8"));

describe("himalayas parser", () => {
  it("parses jobs array and returns correct count", () => {
    const jobs = parseHimalayas(data.jobs);
    expect(jobs.length).toBe(data.jobs.length);
  });

  it("maps companyName, title, url correctly", () => {
    const jobs = parseHimalayas(data.jobs);
    const j = jobs[0];
    expect(j.company).toBe(data.jobs[0].companyName);
    expect(j.title).toBe(data.jobs[0].title);
    expect(j.url).toMatch(/^https?:/);
    expect(j.remote).toBe(true);
  });

  it("uses applicationLink for url, falling back to guid", () => {
    const fakeJob = { ...data.jobs[0], applicationLink: "", guid: "https://himalayas.app/fallback" };
    const jobs = parseHimalayas([fakeJob]);
    expect(jobs[0].url).toBe("https://himalayas.app/fallback");
  });

  it("sets geoRaw and location from locationRestrictions (non-empty array)", () => {
    const fakeJob = { ...data.jobs[0], locationRestrictions: ["United States", "Canada"] };
    const jobs = parseHimalayas([fakeJob]);
    expect(jobs[0].geoRaw).toBe("United States, Canada");
    expect(jobs[0].location).toBe("United States, Canada");
  });

  it("sets geoRaw and location to 'Worldwide' for empty locationRestrictions", () => {
    const fakeJob = { ...data.jobs[0], locationRestrictions: [] };
    const jobs = parseHimalayas([fakeJob]);
    expect(jobs[0].geoRaw).toBe("Worldwide");
    expect(jobs[0].location).toBe("Worldwide");
  });

  it("builds salary when both minSalary and maxSalary are >0", () => {
    const fakeJob = { ...data.jobs[0], minSalary: 100000, maxSalary: 150000 };
    const jobs = parseHimalayas([fakeJob]);
    expect(jobs[0].salary).toBe("$100000–$150000");
  });

  it("returns null salary when salaries are 0 or missing", () => {
    const fakeJob = { ...data.jobs[0], minSalary: 0, maxSalary: 0 };
    const jobs = parseHimalayas([fakeJob]);
    expect(jobs[0].salary).toBeNull();
  });

  it("converts numeric epoch seconds pubDate to ISO string", () => {
    const fakeJob = { ...data.jobs[0], pubDate: 1700000000 };
    const jobs = parseHimalayas([fakeJob]);
    expect(jobs[0].postedAt).not.toBeNull();
    // 1700000000 seconds = 2023-11-14
    expect(jobs[0].postedAt!).toContain("2023");
  });

  it("also handles string pubDate", () => {
    const fakeJob = { ...data.jobs[0], pubDate: "2026-01-15T10:00:00Z" };
    const jobs = parseHimalayas([fakeJob]);
    expect(jobs[0].postedAt).not.toBeNull();
    expect(jobs[0].postedAt!).toContain("2026");
  });

  it("slices description to 4000 chars", () => {
    const fakeJob = { ...data.jobs[0], description: "x".repeat(5000) };
    const jobs = parseHimalayas([fakeJob]);
    expect(jobs[0].description.length).toBeLessThanOrEqual(4000);
  });
});
