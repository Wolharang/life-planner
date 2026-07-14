// **The policy the user agreed to must be the policy we keep on file.**
//
// `legal.generated.ts` is a copy of `reference/*.md` baked into the bundle (the app cannot read a repo file at
// runtime). A copy can drift, and a drifted copy is the quiet kind of wrong: the app would go on showing — and
// collecting consent for — words that no longer exist anywhere else. So the copy is re-derived here and
// compared. Edit a policy, forget `npm run legal:sync`, and this fails.

const fs = require("fs");
const { generate, OUT } = require("../../scripts/sync-legal.js");

import { LEGAL_DOCS, LEGAL_ORDER, LEGAL_VERSION } from "./legal.generated";

describe("legal documents", () => {
  it("matches reference/ verbatim — regenerate with `npm run legal:sync`", () => {
    expect(fs.readFileSync(OUT, "utf8")).toBe(generate());
  });

  it("ships all three documents, in signup order", () => {
    expect(LEGAL_ORDER).toEqual(["terms", "privacy", "location"]);
  });

  it("carries a version — it is what re-asks the user when a policy changes", () => {
    expect(typeof LEGAL_VERSION === "string" && LEGAL_VERSION.length > 0).toBe(true);
  });

  it("gates signup on the two documents the service cannot run without", () => {
    expect(LEGAL_DOCS.terms.required).toBe(true);
    expect(LEGAL_DOCS.privacy.required).toBe(true);
    // Location is optional on purpose: we collect none today, and the feature it exists for (spotting that you
    // walked into the gym) is not built. Blocking signup on it would extract a consent we have no use for.
    expect(LEGAL_DOCS.location.required).toBe(false);
  });

  it("carries the 만 14세 floor the terms themselves impose (제4조)", () => {
    expect(LEGAL_DOCS.terms.consent.includes("만 14세")).toBe(true);
  });

  it("has a real body for every document, not a stub", () => {
    for (const key of LEGAL_ORDER) {
      expect(LEGAL_DOCS[key].body.length > 500).toBe(true);
    }
  });
});
