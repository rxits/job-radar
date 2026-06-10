import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseRemoteOK } from "./remoteok";

const data = JSON.parse(readFileSync("test/fixtures/remoteok.json", "utf8"));

describe("remoteok parser", () => {
  it("skips the legal metadata row and maps fields", () => {
    const jobs = parseRemoteOK(data);
    expect(jobs.length).toBe(data.length - 1); // exactly the legal row dropped
    const j = jobs[0];
    expect(j.company).toBeTruthy();
    expect(j.title).toBeTruthy();
    expect(j.url).toMatch(/^https?:/);
    expect(j.remote).toBe(true);
  });

  it("treats zero salary_min/max as no salary", () => {
    const jobs = parseRemoteOK(data);
    const zeroSalaried = data.slice(1).filter((r: any) => !(r.salary_min > 0));
    expect(zeroSalaried.length).toBeGreaterThan(0); // fixture covers this case
    for (const j of jobs) {
      if (j.salary !== null) expect(j.salary).toMatch(/^\$\d+–\$\d+$/);
    }
  });

  it("strips trailing commas from locations and nulls empty ones", () => {
    const jobs = parseRemoteOK(data);
    for (const j of jobs) {
      if (j.location !== null) {
        expect(j.location).not.toMatch(/,\s*$/);
        expect(j.location.length).toBeGreaterThan(0);
      }
    }
  });

  it("survives an invalid date without crashing the batch", () => {
    const jobs = parseRemoteOK([{ id: 1, position: "Eng", company: "X", date: "not-a-date" }]);
    expect(jobs.length).toBe(1);
    expect(jobs[0].postedAt).toBeNull();
  });

  it("produces valid ISO postedAt for good dates", () => {
    const jobs = parseRemoteOK(data);
    for (const j of jobs) {
      if (j.postedAt) expect(() => new Date(j.postedAt!).toISOString()).not.toThrow();
    }
  });
});
