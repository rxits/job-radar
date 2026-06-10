import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseRemotive } from "./remotive";

const data = JSON.parse(readFileSync("test/fixtures/remotive.json", "utf8"));

describe("remotive parser", () => {
  it("parses jobs array and returns correct count", () => {
    const jobs = parseRemotive(data.jobs);
    expect(jobs.length).toBe(data.jobs.length);
  });

  it("maps company_name, title, url correctly", () => {
    const jobs = parseRemotive(data.jobs);
    const j = jobs[0];
    expect(j.company).toBe(data.jobs[0].company_name);
    expect(j.title).toBe(data.jobs[0].title);
    expect(j.url).toMatch(/^https?:/);
    expect(j.remote).toBe(true);
  });

  it("maps candidate_required_location to geoRaw and location", () => {
    const jobs = parseRemotive(data.jobs);
    const j = jobs[0];
    expect(j.geoRaw).toBe(data.jobs[0].candidate_required_location || null);
    expect(j.location).toBe(data.jobs[0].candidate_required_location || null);
  });

  it("maps salary field (present string or null)", () => {
    const jobs = parseRemotive(data.jobs);
    for (const j of jobs) {
      if (j.salary !== null) expect(typeof j.salary).toBe("string");
    }
  });

  it("maps publication_date via safeDateISO", () => {
    const jobs = parseRemotive(data.jobs);
    for (const j of jobs) {
      if (j.postedAt) expect(() => new Date(j.postedAt!).toISOString()).not.toThrow();
    }
  });

  it("slices description to 4000 chars", () => {
    // inject a job with very long description
    const fakeJob = { ...data.jobs[0], description: "x".repeat(5000) };
    const jobs = parseRemotive([fakeJob]);
    expect(jobs[0].description.length).toBeLessThanOrEqual(4000);
  });

  it("survives missing candidate_required_location", () => {
    const fakeJob = { ...data.jobs[0], candidate_required_location: "" };
    const jobs = parseRemotive([fakeJob]);
    expect(jobs[0].geoRaw).toBeNull();
  });
});
