import { describe, it, expect } from "vitest";
import { classifyGeo } from "./eligibility";

const IN = "Chandigarh, India";
describe("classifyGeo", () => {
  it("worldwide markers are eligible", () => {
    for (const g of ["Worldwide", "Anywhere", "Remote - Global", "anywhere in the world"])
      expect(classifyGeo(g, IN).eligibility).toBe("eligible");
  });
  it("candidate country/region named is eligible", () => {
    for (const g of ["India", "Asia only", "APAC", "EMEA & APAC"])
      expect(classifyGeo(g, IN).eligibility).toBe("eligible");
  });
  it("other-region restrictions are ineligible with reason", () => {
    const r = classifyGeo("United States", IN);
    expect(r.eligibility).toBe("ineligible");
    expect(r.reason).toContain("United States");
    for (const g of ["USA only", "UK", "Canada", "EU timezones", "Europe", "LATAM"])
      expect(classifyGeo(g, IN).eligibility).toBe("ineligible");
  });
  it("null/empty/ambiguous is unknown", () => {
    expect(classifyGeo(null, IN).eligibility).toBe("unknown");
    expect(classifyGeo("", IN).eligibility).toBe("unknown");
    expect(classifyGeo("flexible", IN).eligibility).toBe("unknown");
  });
  it("mixed lists: any eligible token wins", () => {
    expect(classifyGeo("USA, India, UK", IN).eligibility).toBe("eligible");
  });
  it("different candidate location changes the verdict", () => {
    expect(classifyGeo("EU timezones", "Berlin, Germany").eligibility).toBe("eligible");
  });
});
