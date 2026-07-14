// Guards on the shipped policy text.
//
// Not style checks — each of these is a mistake that was actually in the drafts we replaced, and each would
// have gone out on a screen the user is asked to *agree to*:
//   · `(초안)` in the title, and `## 8.` twice on two different clauses (markdown scaffolding, rendered raw)
//   · 시행일 left as `2026년 ○월 ○일` / `2000년 00월 00일`
//   · a collection list naming 결제 기록 · IMEI · Mac Address · 체중 · 프로필 사진 · 협력회사로부터의 제공 —
//     none of which this app has ever touched.
//
// **A privacy policy that claims collection we do not perform is not caution — it is a false statement about
// the user's data.** So the last test names the things we do not collect and holds the document to it.

import { LEGAL_DOCS, LEGAL_ORDER, LEGAL_VERSION, shortDate } from "./legal";

describe("the policy documents", () => {
  it("ships all three, and every one of them is required", () => {
    expect(LEGAL_ORDER).toEqual(["terms", "privacy", "location"]);
    for (const key of LEGAL_ORDER) {
      expect(LEGAL_DOCS[key].consent.startsWith("[필수]")).toBe(true);
    }
  });

  it("has a real effective date — not a placeholder", () => {
    for (const key of LEGAL_ORDER) {
      const doc = LEGAL_DOCS[key];
      expect(/^\d{4}-\d{2}-\d{2}$/.test(doc.effectiveDate)).toBe(true);
      expect(doc.effectiveDate).toBe(LEGAL_VERSION);
    }
  });

  it("shows the date the way the consent list does", () => {
    expect(shortDate("2026-07-14")).toBe("26. 07. 14.");
  });

  it("never leaks a draft's scaffolding onto the screen", () => {
    const banned = ["(초안)", "##", "**", "TBD", "○월", "00월"];
    for (const key of LEGAL_ORDER) {
      const doc = LEGAL_DOCS[key];
      const text = [doc.title, ...doc.blocks.map((b) => (b.t === "list" ? b.items.join(" ") : b.text))].join("\n");
      for (const bad of banned) {
        expect(text.includes(bad)).toBe(false);
      }
    }
  });

  it("numbers each 조 exactly once — the old privacy policy had two 제8조", () => {
    for (const key of LEGAL_ORDER) {
      const articles = LEGAL_DOCS[key].blocks
        .filter((b) => b.t === "article")
        .map((b) => (b.t === "article" ? b.text : ""))
        .filter((t) => t.startsWith("제"));
      expect(articles.length).toBe(new Set(articles).size);
    }
  });

  it("does not claim to collect what the app never touches", () => {
    // Each of these was in the draft's 수집항목. The app collects none of them — the code says so: `sync.ts`
    // ships blocks/devices/expenses/meals, and Firebase Auth holds an email and a uid. That is the whole list.
    const neverCollected = ["IMEI", "MAC 주소", "결제", "체중", "신장", "사진", "팩스", "협력회사", "광고"];

    for (const block of LEGAL_DOCS.privacy.blocks) {
      const text = block.t === "list" ? block.items.join(" ") : block.text;
      for (const claim of neverCollected) {
        // The word is allowed to appear — but only in a sentence that DENIES it. Anywhere else it is a claim.
        if (text.includes(claim)) {
          const denies = text.includes("수집하지 않습니다") || text.includes("쓰지 않습니다");
          expect(denies).toBe(true);
        }
      }
    }

    // And the things we DO collect must be named. Silence about the phone's name would be the same failure in
    // the other direction: D70 uploads it, so the user is owed the sentence.
    const privacy = LEGAL_DOCS.privacy.blocks
      .map((b) => (b.t === "list" ? b.items.join(" ") : b.text))
      .join("\n");
    expect(privacy.includes("기기 이름")).toBe(true);
    expect(privacy.includes("Google LLC")).toBe(true); // the processor — and that the data leaves the country
  });

  it("says plainly that no location is collected today", () => {
    const location = LEGAL_DOCS.location.blocks
      .map((b) => (b.t === "list" ? b.items.join(" ") : b.text))
      .join("\n");
    expect(location.includes("위치 정보를 전혀 수집하지 않습니다")).toBe(true);
  });
});
