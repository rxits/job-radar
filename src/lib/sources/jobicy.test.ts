import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseJobicy } from "./jobicy";

const data = JSON.parse(readFileSync("test/fixtures/jobicy.json", "utf8"));

describe("jobicy parser", () => {
  it("parses jobs array and returns correct count", () => {
    const jobs = parseJobicy(data.jobs);
    expect(jobs.length).toBe(data.jobs.length);
  });

  it("maps companyName, jobTitle, url correctly", () => {
    const jobs = parseJobicy(data.jobs);
    const j = jobs[0];
    expect(j.company).toBe(data.jobs[0].companyName);
    expect(j.title).toBe(data.jobs[0].jobTitle);
    expect(j.url).toMatch(/^https?:/);
    expect(j.remote).toBe(true);
  });

  it("maps jobGeo to geoRaw and location", () => {
    const jobs = parseJobicy(data.jobs);
    const j = jobs[0];
    expect(j.geoRaw).toBe(data.jobs[0].jobGeo || null);
    expect(j.location).toBe(data.jobs[0].jobGeo || null);
  });

  it("builds salary string when both min and max are >0", () => {
    const fakeJob = { ...data.jobs[0], annualSalaryMin: 80000, annualSalaryMax: 120000 };
    const jobs = parseJobicy([fakeJob]);
    expect(jobs[0].salary).toBe("$80000–$120000");
  });

  it("returns null salary when min or max is missing/zero", () => {
    const fakeJob = { ...data.jobs[0], annualSalaryMin: 0, annualSalaryMax: 0 };
    const jobs = parseJobicy([fakeJob]);
    expect(jobs[0].salary).toBeNull();
  });

  it("maps pubDate via safeDateISO", () => {
    const jobs = parseJobicy(data.jobs);
    for (const j of jobs) {
      if (j.postedAt) expect(() => new Date(j.postedAt!).toISOString()).not.toThrow();
    }
  });

  it("uses jobExcerpt as description when available, sliced to 4000", () => {
    const fakeJob = { ...data.jobs[0], jobExcerpt: "short excerpt", jobDescription: "<p>long</p>" };
    const jobs = parseJobicy([fakeJob]);
    expect(jobs[0].description).toBe("short excerpt");
  });

  it("falls back to jobDescription when jobExcerpt is absent", () => {
    const fakeJob = { ...data.jobs[0], jobExcerpt: undefined, jobDescription: "<p>desc</p>" };
    const jobs = parseJobicy([fakeJob]);
    expect(jobs[0].description).toBe("<p>desc</p>");
  });

  it("slices description to 4000 chars", () => {
    const fakeJob = { ...data.jobs[0], jobExcerpt: "x".repeat(5000) };
    const jobs = parseJobicy([fakeJob]);
    expect(jobs[0].description.length).toBeLessThanOrEqual(4000);
  });
});
