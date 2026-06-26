import { describe, it, expect } from "vitest";
import { cn, scoreTier, tierMeta, regionLabel } from "./ui";

describe("cn", () => {
  it("joins truthy parts and drops falsy ones", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
    expect(cn()).toBe("");
  });
});

describe("scoreTier", () => {
  it("bands scores into tiers", () => {
    expect(scoreTier(92)).toBe("elite");
    expect(scoreTier(85)).toBe("elite");
    expect(scoreTier(72)).toBe("high");
    expect(scoreTier(55)).toBe("mid");
    expect(scoreTier(20)).toBe("low");
    expect(scoreTier(null)).toBe("low");
  });
});

describe("tierMeta", () => {
  it("gives every tier a label and classes", () => {
    for (const t of ["low", "mid", "high", "elite"] as const) {
      const m = tierMeta(t);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.barClass.length).toBeGreaterThan(0);
      expect(m.textClass.length).toBeGreaterThan(0);
    }
    expect(tierMeta("elite").textClass).toContain("accent");
  });
});

describe("regionLabel", () => {
  it("maps known regions and hides noise", () => {
    expect(regionLabel("us")).toBe("US");
    expect(regionLabel("worldwide")).toBe("Worldwide");
    expect(regionLabel("other")).toBeNull();
    expect(regionLabel(null)).toBeNull();
  });
});
