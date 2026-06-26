import { describe, it, expect } from "vitest";
import { renderDigest } from "./digest";
import type { Contact, JobRow } from "./types";

function job(over: Partial<JobRow> = {}): JobRow {
  return {
    id: "id1", dedupeKey: "k1", source: "remoteok", company: "Acme",
    title: "AI Engineer", location: null, remote: true, salary: null,
    url: "https://acme.test/jobs/1", description: "", postedAt: null, geoRaw: null,
    status: "to_apply", scrapedAt: "2026-06-26T00:00:00.000Z",
    score: 88, reason: "Strong match on RAG + agents.", hasTailored: false,
    hasKit: false, eligibility: "eligible", eligibilityReason: null,
    starred: false, seenAt: null, aiFriendly: 80, isInternship: false,
    payTier: "high", region: "us",
    ...over,
  };
}

function contact(over: Partial<Contact> = {}): Contact {
  return {
    jobId: "id1", company: "Acme", personName: "Dana Lee",
    personTitle: "Head of Eng", emails: ["dana@acme.test"], links: [],
    source: "team-page", confidence: "found", ...over,
  };
}

const AT = "2026-06-26T09:00:00.000Z";

describe("renderDigest", () => {
  it("renders a match with tags, reason, contact and url", () => {
    const out = renderDigest({
      matches: [job()],
      contacts: { id1: contact() },
      followUps: [],
      generatedAt: AT,
    });
    expect(out).toContain("# job-radar digest — 2026-06-26");
    expect(out).toContain("1. Acme — AI Engineer  [88/100]");
    expect(out).toContain("US · high-pay · AI-friendly 80");
    expect(out).toContain('"Strong match on RAG + agents."');
    expect(out).toContain("Contact: Dana Lee, Head of Eng · dana@acme.test (found)");
    expect(out).toContain("https://acme.test/jobs/1");
  });

  it("marks a kit-ready match and counts kits in the header", () => {
    const out = renderDigest({
      matches: [job({ hasKit: true })],
      contacts: { id1: null },
      followUps: [],
      generatedAt: AT,
    });
    expect(out).toContain("1 with a kit already generated");
    expect(out).toContain("kit ready");
  });

  it("omits the contact line when there is no usable contact", () => {
    const out = renderDigest({
      matches: [job()],
      contacts: { id1: contact({ personName: null, emails: [], confidence: "none" }) },
      followUps: [],
      generatedAt: AT,
    });
    expect(out).not.toContain("Contact:");
  });

  it("shows an empty state when there are no matches", () => {
    const out = renderDigest({ matches: [], contacts: {}, followUps: [], generatedAt: AT });
    expect(out).toContain("No eligible, scored, to-apply matches");
  });

  it("lists follow-ups in their own section", () => {
    const fu = job({ id: "id2", company: "Beta Co", title: "ML Eng", status: "applied", url: "https://beta.test/2" });
    const out = renderDigest({ matches: [job()], contacts: { id1: null }, followUps: [fu], generatedAt: AT });
    expect(out).toContain("## Follow-ups (1)");
    expect(out).toContain("- Beta Co — ML Eng  https://beta.test/2");
  });

  it("falls back to internship and low-pay tags", () => {
    const out = renderDigest({
      matches: [job({ isInternship: true, payTier: "low", aiFriendly: null, region: "eu" })],
      contacts: { id1: null },
      followUps: [],
      generatedAt: AT,
    });
    expect(out).toContain("EU · low-pay · internship");
  });
});
