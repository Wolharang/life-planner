// Guards on the shipped policy text.
//
// Not style checks. Each of these is a mistake that was actually made and would have gone out on a screen the
// user is asked to *agree to*:
//
//   · the drafts leaked their own scaffolding — `(초안)` in the title, `## 8.` on two different clauses
//   · 시행일 left as `2026년 ○월 ○일`
//   · a 수집항목 list naming 결제 기록 · IMEI · Mac Address · 체중 · 프로필 사진 — none of which this app touches
//   · and then, correcting for all that, **reassurance prose inside the instrument itself**:
//     "서비스는 의료 목적의 도구가 아닙니다", "최소한만 모읍니다".
//
// That last one is the subtle one. A 약관 is normative — it defines, allocates duties, disclaims liability, in
// 조·항·호. A 개인정보 처리방침 states the statutory items of 개인정보보호법 제30조. **Neither is a place to
// comfort the reader.** The comfort belongs on the consent row and in 공지사항; the document must bind. So the
// tests below hold the documents to the form of an instrument, not just to the truth of their contents.

import { AGE_CONSENT, LEGAL_DOCS, LEGAL_ORDER, LEGAL_VERSION, shortDate } from "./legal";

const flatten = (key: (typeof LEGAL_ORDER)[number]) =>
  LEGAL_DOCS[key].blocks.map((b) => (b.t === "list" ? b.items.join(" ") : b.text)).join("\n");

describe("the policy documents", () => {
  it("ships all three, and every one of them is required", () => {
    expect(LEGAL_ORDER).toEqual(["terms", "privacy", "location"]);
    for (const key of LEGAL_ORDER) {
      expect(LEGAL_DOCS[key].consent.startsWith("[필수]")).toBe(true);
    }
  });

  it("has a real effective date — not a placeholder", () => {
    for (const key of LEGAL_ORDER) {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(LEGAL_DOCS[key].effectiveDate)).toBe(true);
      expect(LEGAL_DOCS[key].effectiveDate).toBe(LEGAL_VERSION);
    }
  });

  it("shows the date the way the consent list does", () => {
    expect(shortDate("2026-07-14")).toBe("26. 07. 14.");
  });

  it("is an instrument, not a message — no reassurance asides, no 해요체", () => {
    for (const key of LEGAL_ORDER) {
      // The `note` block is the app's highlighted-aside style. It belongs in 공지사항. A clause that needs a
      // highlight to be believed is not a clause.
      expect(LEGAL_DOCS[key].blocks.some((b) => b.t === "note")).toBe(false);

      // The app's friendly voice ("~해요") is right everywhere else and wrong here. If it appears, someone has
      // started writing copy inside the instrument again.
      const text = flatten(key);
      for (const voice of ["해요", "돼요", "예요", "드려요"]) {
        expect(text.includes(voice)).toBe(false);
      }
    }
  });

  it("keeps each consent line to one short line", () => {
    // The rows once carried a subtitle explaining the document. **A consent list is not where a document gets
    // explained — that is what the document is for**, one tap away behind 보기. Prose piled onto a tick box does
    // not get read; it only makes the box harder to find.
    for (const key of LEGAL_ORDER) {
      const line = LEGAL_DOCS[key].consent;
      expect(line.startsWith("[필수]")).toBe(true);
      expect(line.length <= 22).toBe(true); // it must fit on one line, at 12.5sp, next to the 보기 link
      expect(line.includes("\n")).toBe(false);
    }
    expect(AGE_CONSENT.length <= 22).toBe(true);
  });

  it("keeps the substance the reassurance used to carry — as binding clauses", () => {
    const terms = flatten("terms");
    expect(terms.includes("「의료기기법」")).toBe(true); // 제14조 — was "의료 목적의 도구가 아닙니다"
    expect(terms.includes("책임을 지지 아니합니다")).toBe(true); // the alarm's limits, disclaimed

    const privacy = flatten("privacy");
    expect(privacy.includes("자동 수집 장치를 설치·운영하지 아니합니다")).toBe(true); // was "최소한만 모읍니다"
    expect(privacy.includes("「개인정보 보호법」 제30조")).toBe(true); // it says what it is

    const location = flatten("location");
    // The honest version of "we collect no location today": collection is conditioned, in a clause.
    expect(location.includes("수집되지 아니합니다")).toBe(true);
  });

  it("names the party as 기관 — never 운영자, never a person", () => {
    for (const key of LEGAL_ORDER) {
      const text = flatten(key);
      expect(text.includes("기관")).toBe(true);
      // "운영자(개인)" was a regression: it renamed the party and then signed it with an individual's name.
      // **A document that binds an individual by name binds the wrong thing.**
      expect(text.includes("운영자")).toBe(false);
      expect(text.includes("이상현")).toBe(false);
      expect(text.includes("(개인)")).toBe(false);
    }
    // The contact is an office.
    expect(flatten("privacy").includes("LifePlanner 담당자")).toBe(true);
  });

  it("keeps sentences out of parentheses", () => {
    // Founder's rule: parentheses are for a **heading** — 제1조 (목적) — a **single-word marker** — (필수)
    // (선택) (TLS) — or the definitional `(이하 “…”)`. Never a clause. **A qualification that matters belongs
    // in its own 항; one hidden in brackets is one nobody reads.**
    for (const key of LEGAL_ORDER) {
      for (const block of LEGAL_DOCS[key].blocks) {
        if (block.t === "article") continue; // headings are exactly where parentheses belong
        const text = block.t === "list" ? block.items.join("\n") : block.text;
        for (const [, inner] of text.matchAll(/\(([^)]*)\)/g)) {
          const ok = inner.startsWith("이하") || !inner.includes(" ");
          expect(ok).toBe(true);
        }
      }
    }
  });

  it("does not claim a 위치정보사업자's status, duties, or remedies", () => {
    // 위치정보법 제9조's 신고 duty binds those who provide the service **사업으로 영위**. This service is free
    // and is not a business, so it CANNOT file — and a document that borrows a 사업자's obligations (or its
    // remedies, e.g. 방송통신위원회 재정) would be claiming a status the 기관 does not hold.
    const location = flatten("location");
    expect(location.includes("사업으로 영위하지 아니합니다")).toBe(true);
    expect(location.includes("위치정보사업자 또는 위치기반서비스사업자에 해당하지 아니합니다")).toBe(true);
    expect(location.includes("방송통신위원회")).toBe(false);
    // What it does instead: bind itself by contract.
    expect(location.includes("스스로 부담합니다")).toBe(true);
  });

  it("keeps the age rule a discretion, and invents no duty out of it", () => {
    const terms = flatten("terms");

    // 제5조 lets the 기관 **승낙하지 아니할 수 있다**. It does not vow to refuse, and it does not bind itself to
    // hunt down and delete such an account.
    expect(terms.includes("만 18세 이하인 경우")).toBe(true);
    expect(terms.includes("승낙하지 아니할 수 있습니다")).toBe(true);

    // **Do not invent obligations on the 기관's behalf.** Every one of these was written by me, asked for by
    // nobody, and is a promise someone could later hold the 기관 to.
    for (const key of LEGAL_ORDER) {
      const text = flatten(key);
      expect(text.includes("성인을 대상으로")).toBe(false);
      expect(text.includes("가입을 받지 아니하며")).toBe(false);
      expect(text.includes("만 18세 이하임이 확인된 경우")).toBe(false); // the deletion duty I made up
      // The location terms' 8세 이하 clause presupposed an account holder the 기관 may refuse.
      expect(text.includes("8세 이하의 아동")).toBe(false);
    }

    // The discretion is exercised by ASKING — at signup, as a tick, recorded with the consent (처리방침 제2조 ④).
    expect(AGE_CONSENT.startsWith("[필수]")).toBe(true);
    expect(AGE_CONSENT.includes("만 19세 이상")).toBe(true);
    expect(flatten("privacy").includes("연령 확인 사실")).toBe(true);
  });

  it("does not restate in the location terms what the 이용약관 already governs", () => {
    // 면책 · 손해배상 · 분쟁의 조정 · 기관의 표시 live in 이용약관 제14조–제17조 and govern the whole service, of
    // which the location feature is a part. **A clause repeated in two documents is a clause that will one day
    // disagree with itself** — and then the user is bound by whichever half is worse for them.
    const location = flatten("location");
    for (const dup of ["(면책)", "(손해배상)", "(분쟁의 조정)", "(기관의 표시)"]) {
      expect(location.includes(dup)).toBe(false);
    }
    const terms = flatten("terms");
    expect(terms.includes("(서비스의 성격 및 면책)")).toBe(true);
    expect(terms.includes("(손해배상)")).toBe(true);
  });

  it("names the country the data actually goes to — 미국, not a hedge", () => {
    // The Firestore database is `locationId: nam5` — a United States multi-region. "미국 등 Google LLC가
    // 데이터센터를 운영하는 국가" named dozens of countries the data never reaches. **A 국외 이전 notice is not
    // safer for being broad; it is wrong.** Move the database and this line moves with it, in the same commit.
    const privacy = flatten("privacy");
    expect(privacy.includes("이전되는 국가 : 미국")).toBe(true);
    expect(privacy.includes("데이터센터를 운영하는 국가")).toBe(false);
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

  it("never leaks a draft's scaffolding onto the screen", () => {
    for (const key of LEGAL_ORDER) {
      const text = `${LEGAL_DOCS[key].title}\n${flatten(key)}`;
      for (const bad of ["(초안)", "##", "**", "TBD", "○월", "00월"]) {
        expect(text.includes(bad)).toBe(false);
      }
    }
  });

  it("does not claim to process what the app never touches", () => {
    // Each was in the draft's 수집항목. The code says otherwise: `sync.ts` ships blocks/devices/expenses/meals,
    // and Firebase Auth holds an email and a uid. That is the whole list.
    const neverProcessed = ["IMEI", "MAC", "결제", "체중", "신장", "사진", "팩스", "협력회사", "쿠키"];

    for (const block of LEGAL_DOCS.privacy.blocks) {
      const text = block.t === "list" ? block.items.join(" ") : block.text;
      for (const claim of neverProcessed) {
        if (!text.includes(claim)) continue;
        // The word may appear only in a clause that DENIES the processing. Anywhere else it is a claim.
        expect(text.includes("아니합니다") || text.includes("않습니다")).toBe(true);
      }
    }

    // And what we DO take must be named. Silence about the phone's name would be the same failure inverted:
    // D70 uploads it, so 제2조 owes the user that line.
    const privacy = flatten("privacy");
    expect(privacy.includes("기기의 이름")).toBe(true);
    expect(privacy.includes("Google LLC")).toBe(true); // the processor — and that the data leaves the country
  });
});
