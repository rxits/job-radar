import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseTimeline } from "./twitter";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, "../../../test/fixtures/twitter-timeline.json"), "utf8"));

describe("parseTimeline", () => {
  const jobs = parseTimeline(fixture, "acmehq");

  it("keeps only hiring tweets, drops chatter", () => {
    // 3 hiring tweets, 1 non-hiring → 3 kept
    expect(jobs.length).toBe(3);
    expect(jobs.every((j) => /hiring|join|apply|role|engineer|designer/i.test(j.title))).toBe(true);
  });

  it("uses the expanded outbound link as the job url", () => {
    expect(jobs[0].url).toBe("https://acme.com/careers/backend");
    expect(jobs[0].url).not.toContain("t.co");
  });

  it("tags company with the handle and detects remote", () => {
    expect(jobs[0].company).toBe("acmehq");
    expect(jobs[0].remote).toBe(true); // "fully remote"
    expect(jobs[2].remote).toBe(false); // "onsite, NYC"
  });

  it("tolerates missing timeline gracefully", () => {
    expect(parseTimeline({}, "x")).toEqual([]);
    expect(parseTimeline({ props: {} }, "x")).toEqual([]);
  });
});
