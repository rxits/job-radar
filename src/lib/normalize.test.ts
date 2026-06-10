import { describe, it, expect } from "vitest";
import { normalize, dedupeKey, looksRemote } from "./normalize";

describe("normalize", () => {
  it("builds a stable dedupe key independent of case/whitespace", () => {
    const a = dedupeKey("Acme", "Engineer", "https://X/1");
    const b = dedupeKey("  acme ", "engineer", "https://x/1");
    expect(a).toBe(b);
  });

  it("different jobs get different keys", () => {
    expect(dedupeKey("Acme", "Engineer", "u1")).not.toBe(dedupeKey("Beta", "Engineer", "u1"));
  });

  it("detects remote from text", () => {
    expect(looksRemote("Fully remote role")).toBe(true);
    expect(looksRemote("Onsite in NYC")).toBe(false);
  });

  it("treats negated remote as not remote", () => {
    expect(looksRemote("Great role. No remote, must be in NYC")).toBe(false);
    expect(looksRemote("ONSITE | REMOTE: no")).toBe(false);
    expect(looksRemote("Remote OK or onsite in Berlin")).toBe(true);
  });

  it("normalizes a raw job and attaches source + key", () => {
    const n = normalize(
      { company: "Acme", title: "Eng", location: null, remote: true, salary: null,
        url: "https://x/1", description: "d", postedAt: null, geoRaw: null }, "hn");
    expect(n.source).toBe("hn");
    expect(n.dedupeKey).toBe(dedupeKey("Acme", "Eng", "https://x/1"));
  });
});
