import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseLinkedInCards } from "./linkedin";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, "../../../test/fixtures/linkedin-search.html"), "utf8");

describe("parseLinkedInCards", () => {
  const jobs = parseLinkedInCards(fixture);

  it("parses every card in the response", () => {
    expect(jobs.length).toBe(3);
  });

  it("extracts title, company, url, location", () => {
    const j = jobs[0];
    expect(j.title).toBe("ML Platform Engineer | $85/hr Remote");
    expect(j.company).toBe("CodeGeniusRecruit");
    expect(j.url).toContain("linkedin.com/jobs/view/");
    expect(j.location).toBe("United States");
    expect(j.remote).toBe(true);
    expect(j.postedAt).toBe(new Date("2026-06-16").toISOString());
    expect(j.geoRaw).toBe("United States");
  });

  it("strips tracking query params and html entities from urls", () => {
    for (const j of jobs) {
      expect(j.url).not.toContain("&amp;");
      expect(j.url).not.toContain("?position=");
    }
  });

  it("never returns a card without a title or url", () => {
    for (const j of jobs) {
      expect(j.title.length).toBeGreaterThan(0);
      expect(j.url.length).toBeGreaterThan(0);
      expect(j.company.length).toBeGreaterThan(0);
    }
  });
});
