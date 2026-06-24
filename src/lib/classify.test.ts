import { describe, it, expect } from "vitest";
import { detectInternship, payTier, regionOf } from "./classify";

describe("detectInternship", () => {
  it("flags internship titles", () => {
    expect(detectInternship("Software Engineering Intern", "")).toBe(true);
    expect(detectInternship("Summer Internship - ML", "")).toBe(true);
    expect(detectInternship("Backend Engineer", "We offer a co-op program")).toBe(true);
  });
  it("does not flag false positives", () => {
    expect(detectInternship("International Sales Lead", "")).toBe(false);
    expect(detectInternship("Internal Tools Engineer", "")).toBe(false);
    expect(detectInternship("Senior Backend Engineer", "Build internal systems")).toBe(false);
  });
});

describe("payTier", () => {
  it("bands high salaries", () => {
    expect(payTier("$150k–$200k")).toBe("high");
    expect(payTier("$150,000 - $200,000")).toBe("high");
    expect(payTier("€120,000")).toBe("high");
  });
  it("bands mid salaries", () => {
    expect(payTier("$80,000")).toBe("mid");
    expect(payTier("$30/hr")).toBe("mid"); // ~$62k annualized
  });
  it("bands low salaries", () => {
    expect(payTier("$12/hr")).toBe("low"); // ~$25k annualized
    expect(payTier("₹15,00,000")).toBe("low"); // ~$18k USD
  });
  it("returns unknown when no parseable amount", () => {
    expect(payTier(null)).toBe("unknown");
    expect(payTier("")).toBe("unknown");
    expect(payTier("Competitive")).toBe("unknown");
  });
});

describe("regionOf", () => {
  it("detects worldwide", () => {
    expect(regionOf("Remote, Worldwide", null)).toBe("worldwide");
    expect(regionOf(null, "Anywhere")).toBe("worldwide");
  });
  it("detects us / eu / au", () => {
    expect(regionOf("United States", null)).toBe("us");
    expect(regionOf("Berlin, Germany", null)).toBe("eu");
    expect(regionOf("Sydney, Australia", null)).toBe("au");
  });
  it("falls back to other / unknown", () => {
    expect(regionOf("Lagos, Nigeria", null)).toBe("other");
    expect(regionOf(null, null)).toBe("unknown");
  });
});
