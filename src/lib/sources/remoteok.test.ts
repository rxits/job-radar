import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseRemoteOK } from "./remoteok";

const data = JSON.parse(readFileSync("test/fixtures/remoteok.json", "utf8"));

describe("remoteok parser", () => {
  it("skips the legal metadata row and maps fields", () => {
    const jobs = parseRemoteOK(data);
    expect(jobs.length).toBeGreaterThan(0);
    const j = jobs[0];
    expect(j.company).toBeTruthy();
    expect(j.title).toBeTruthy();
    expect(j.url).toMatch(/^https?:/);
    expect(j.remote).toBe(true);
  });
});
