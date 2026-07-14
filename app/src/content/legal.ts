// **The policy documents. This file IS the document** — not a copy of one, and not a message.
//
// Three corrections are baked in here, each paid for:
//
//   1. The first version rendered the founder's `reference/*.md` drafts, which leaked their own scaffolding
//      onto the screen and described an app we never built (D71).
//   2. The second replaced that with **reassurance prose** — "서비스는 의료 목적의 도구가 아닙니다", "최소한만
//      모읍니다". Those are *messages*. A 약관 is normative: it defines, allocates duties, and disclaims
//      liability, in 조·항·호; a 개인정보 처리방침 states the statutory items of 개인정보보호법 제30조. **Neither
//      is a place to comfort the reader** (D72).
//   3. It also renamed the party from **기관** to "운영자(개인)" and signed it with a personal name. Restored:
//      the party is **LifePlanner, 이하 “기관”**, and the contact is **LifePlanner 담당자** — an office, not a
//      person. A document that binds an individual by name binds the wrong thing.
//
// **House rules for the text** (founder, 2026-07-14):
//   · Parentheses are for **headings** — 제1조 (목적) — and **single-word markers** — (필수) (선택) (TLS) — and
//     the definitional `(이하 “…”)`. **Never a sentence or a clause.** A qualification that matters belongs in
//     its own 항; a qualification hidden in brackets is one nobody reads.
//   · Every item in 개인정보 처리방침 제2조 is checked against the code that collects it (`sync.ts` KEYS ·
//     `deviceRepository` · Firebase Auth). A field that leaves the phone belongs in 제2조 in the same commit.
//
// **On 위치정보 (founder, 2026-07-14):** 위치정보법 제9조's 신고 duty binds those who provide such a service
// **사업으로 영위** — as a business. This service is free and is not one, so it **cannot** file, and the
// document must not pretend to the obligations or the remedies of a 사업자. The location terms therefore bind
// the 기관 by **contract**, not by a status it does not hold.
//
// `legal.test.ts` enforces all of the above. The founder's drafts stay in `reference/`, superseded.

export type LegalKey = "terms" | "privacy" | "location";

/** One rendered element. A legal document is a structure, so it is stored as one. */
export type Block =
  | { t: "chapter"; text: string } // 제1장 총칙
  | { t: "article"; text: string } // 제1조 (목적)
  | { t: "p"; text: string } // 항 — ① ② …
  | { t: "list"; items: string[] } // 호 — an indented enumeration
  | { t: "note"; text: string }; // **공지사항 only.** A legal document must not carry one.

export interface LegalDoc {
  key: LegalKey;
  title: string;
  /** YYYY-MM-DD — the day this version takes effect. Shown as the version chip. */
  effectiveDate: string;
  /** The one line the user ticks. All three are required (founder, 2026-07-14). */
  consent: string;
  /** Plain Korean, under the consent row. **This** is where the message goes — not inside the document. */
  summary: string;
  blocks: Block[];
}

/**
 * Bumped when a document's **meaning** changes. It is stamped on the consent record; a record carrying an old
 * version is what re-asks the user.
 */
export const LEGAL_VERSION = "2026-07-14";

const EFFECTIVE = "2026-07-14";

/** The 기관's own particulars. An office, never a person. Stated in each document — each is separately enforceable. */
const OPERATOR: Block[] = [
  {
    t: "list",
    items: ["기관 : LifePlanner", "담당자 : LifePlanner 담당자", "이메일 : shleelee@yahoo.com"],
  },
];

// ── 서비스 이용약관 ──────────────────────────────────────────────────────────────────────────────────

const TERMS: LegalDoc = {
  key: "terms",
  title: "서비스 이용약관",
  effectiveDate: EFFECTIVE,
  consent: "[필수] 만 14세 이상이며, 서비스 이용약관에 동의합니다",
  summary: "서비스를 어떤 조건으로 제공하고, 알림에 대해 무엇을 책임지는지",
  blocks: [
    { t: "chapter", text: "제1장 총칙" },

    { t: "article", text: "제1조 (목적)" },
    {
      t: "p",
      text: "이 약관은 LifePlanner(이하 “기관”)가 모바일 애플리케이션을 통하여 제공하는 일정·실행 관리 및 기록 서비스(이하 “서비스”)의 이용에 관하여 기관과 회원 간의 권리·의무 및 책임사항, 이용조건과 절차를 정함을 목적으로 합니다.",
    },

    { t: "article", text: "제2조 (정의)" },
    { t: "p", text: "① 이 약관에서 사용하는 용어의 뜻은 다음과 같습니다." },
    {
      t: "list",
      items: [
        "1. “회원”이란 이 약관에 동의하고 기관과 이용계약을 체결하여 서비스를 이용하는 자를 말합니다.",
        "2. “비회원 이용자”란 계정을 생성하지 아니하고 기기 내 저장 기능만으로 서비스를 이용하는 자를 말합니다.",
        "3. “회원 데이터”란 회원이 서비스에 입력·생성한 시간블록, 지출 기록, 식사 기록 및 그 부속 정보를 말합니다.",
        "4. “실행 알람”이란 회원이 미리 지정한 시각에 해당 일의 착수를 돕기 위하여 기기 화면에 전체화면으로 표시되는 알림을 말합니다.",
        "5. “동기화”란 회원 데이터를 기관의 서버를 통하여 회원의 복수 기기 간에 일치시키는 기능을 말합니다.",
      ],
    },
    { t: "p", text: "② 이 약관에서 정하지 아니한 용어의 뜻은 관계 법령과 일반적인 거래 관행에 따릅니다." },

    { t: "article", text: "제3조 (약관의 효력 및 변경)" },
    { t: "p", text: "① 이 약관은 애플리케이션 화면에 게시하고, 회원이 동의함으로써 효력이 발생합니다." },
    {
      t: "p",
      text: "② 기관은 「약관의 규제에 관한 법률」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관계 법령을 위반하지 아니하는 범위에서 이 약관을 개정할 수 있습니다.",
    },
    {
      t: "p",
      text: "③ 기관이 약관을 개정하는 경우 적용일자, 개정 내용 및 개정 사유를 명시하여 적용일자 7일 전부터 서비스 내 공지사항에 게시합니다.",
    },
    { t: "p", text: "④ 제3항에도 불구하고 회원에게 불리한 내용으로 개정하는 경우에는 적용일자 30일 전부터 게시합니다." },
    {
      t: "p",
      text: "⑤ 개정 약관의 내용이 실질적으로 변경되는 경우 기관은 회원의 동의를 다시 받습니다. 회원이 개정 약관에 동의하지 아니하는 경우 이용계약을 해지할 수 있습니다.",
    },

    { t: "chapter", text: "제2장 이용계약" },

    { t: "article", text: "제4조 (이용계약의 성립)" },
    {
      t: "p",
      text: "① 이용계약은 가입신청자가 이 약관에 동의하고 기관이 정한 절차에 따라 가입을 신청하며, 기관이 이를 승낙함으로써 성립합니다.",
    },
    { t: "p", text: "② 가입은 이메일 주소와 비밀번호에 의한 방법 또는 Google 계정에 의한 방법으로 할 수 있습니다." },
    {
      t: "p",
      text: "③ 계정은 동기화 기능의 제공을 위한 것입니다. 회원이 아닌 이용자도 동기화 기능을 제외한 서비스의 모든 기능을 이용할 수 있습니다.",
    },

    { t: "article", text: "제5조 (가입의 제한)" },
    { t: "p", text: "① 기관은 다음 각 호에 해당하는 경우 가입 신청을 승낙하지 아니할 수 있습니다." },
    {
      t: "list",
      items: [
        "1. 가입신청자가 만 14세 미만인 경우",
        "2. 타인의 명의를 도용하거나 허위의 정보를 기재한 경우",
        "3. 이 약관을 위반하여 이용계약이 해지된 사실이 있는 경우",
        "4. 서비스의 기술적 사정으로 승낙이 곤란한 경우",
      ],
    },
    { t: "p", text: "② 기관은 만 14세 미만 아동의 가입을 받지 아니합니다." },

    { t: "article", text: "제6조 (탈퇴 및 이용계약의 해지)" },
    { t: "p", text: "① 회원은 언제든지 애플리케이션 내에서 탈퇴를 신청하여 이용계약을 해지할 수 있습니다." },
    {
      t: "p",
      text: "② 탈퇴 시 서버에 저장된 회원 데이터 및 계정 정보는 지체 없이 파기됩니다. 다만, 회원의 기기 내부에 저장된 정보는 회원이 애플리케이션을 삭제하거나 초기화하기 전까지 유지됩니다.",
    },
    { t: "p", text: "③ 로그아웃은 이용계약의 해지에 해당하지 아니하며, 로그아웃으로 회원의 기기 내 정보가 삭제되지 아니합니다." },

    { t: "chapter", text: "제3장 서비스의 제공" },

    { t: "article", text: "제7조 (서비스의 내용)" },
    { t: "p", text: "① 기관은 회원에게 다음 각 호의 서비스를 무료로 제공합니다." },
    {
      t: "list",
      items: [
        "1. 시간블록의 기록 및 캘린더 표시",
        "2. 회원이 지정한 시각의 알림 및 실행 알람의 제공",
        "3. 지출 기록·식사 기록 및 하루 요약의 제공",
        "4. 회원 데이터의 파일 내보내기 및 가져오기",
        "5. 회원 데이터의 기기 간 동기화",
      ],
    },
    { t: "p", text: "② 제1항 제5호의 동기화는 로그인한 회원에 한하여 제공됩니다." },

    { t: "article", text: "제8조 (서비스 제공의 변경 및 중단)" },
    {
      t: "p",
      text: "① 기관은 서비스의 내용을 변경하거나 그 제공을 중단할 수 있습니다. 이 경우 변경 또는 중단의 사유와 일자를 사전에 서비스 내 공지사항에 게시합니다.",
    },
    {
      t: "p",
      text: "② 서비스의 제공을 종료하는 경우 기관은 회원이 회원 데이터를 파일로 내보낼 수 있도록 종료일 30일 전까지 그 사실을 공지합니다.",
    },
    {
      t: "p",
      text: "③ 천재지변, 정전, 수탁자의 설비 장애 등 불가항력적 사유가 있는 경우 기관은 사전 공지 없이 서비스의 제공을 일시 중단할 수 있습니다.",
    },

    { t: "article", text: "제9조 (실행 알람의 제공과 그 한계)" },
    {
      t: "p",
      text: "① 실행 알람의 제공을 위하여 회원의 기기에 알림, 정확한 알람, 전체화면 알림, 다른 앱 위에 표시 권한이 필요합니다. 회원은 언제든지 기기의 설정에서 해당 권한을 철회할 수 있으며, 이 경우 실행 알람은 제공되지 아니합니다.",
    },
    {
      t: "p",
      text: "② 알림은 회원의 기기 환경에 따라 지연되거나 제공되지 아니할 수 있습니다. 그 사유는 전원의 차단, 절전 모드의 동작, 애플리케이션의 강제 종료, 제조사별 배터리 최적화 정책, 권한의 철회 등입니다.",
    },
    {
      t: "p",
      text: "③ 기관은 알림의 도달을 보증하지 아니하며, 제2항의 사유로 알림이 지연되거나 제공되지 아니한 것에 대하여 책임을 지지 아니합니다. 다만, 기관의 고의 또는 중대한 과실이 있는 경우에는 그러하지 아니합니다.",
    },

    { t: "article", text: "제10조 (복수 기기에서의 실행 알람)" },
    {
      t: "p",
      text: "회원이 복수의 기기에서 동일한 계정으로 로그인한 경우, 회원 데이터는 모든 기기에 동기화되나 실행 알람은 회원이 지정한 기기에서만 전체화면으로 표시됩니다. 지정되지 아니한 기기에서는 알림 및 진동으로만 제공됩니다.",
    },

    { t: "chapter", text: "제4장 권리와 의무" },

    { t: "article", text: "제11조 (기관의 의무)" },
    {
      t: "p",
      text: "① 기관은 관계 법령과 이 약관이 금지하는 행위를 하지 아니하며, 계속적이고 안정적으로 서비스를 제공하기 위하여 노력합니다.",
    },
    { t: "p", text: "② 기관은 회원 데이터를 광고에 이용하거나 제3자에게 판매하지 아니합니다." },
    { t: "p", text: "③ 기관은 회원의 개인정보를 개인정보 처리방침에 따라 처리하며, 이를 보호하기 위하여 노력합니다." },

    { t: "article", text: "제12조 (회원의 의무)" },
    { t: "p", text: "회원은 다음 각 호의 행위를 하여서는 아니 됩니다." },
    {
      t: "list",
      items: [
        "1. 타인의 계정 또는 회원 데이터에 부당하게 접근하는 행위",
        "2. 서비스의 설비에 과도한 부하를 일으키거나 정상적인 운영을 방해하는 행위",
        "3. 서비스를 역설계·복제·변조하거나 이를 시도하는 행위",
        "4. 법령 또는 공서양속에 위반되는 목적으로 서비스를 이용하는 행위",
      ],
    },

    { t: "article", text: "제13조 (회원 데이터의 귀속 및 백업)" },
    { t: "p", text: "① 회원 데이터에 관한 권리는 회원에게 있습니다." },
    {
      t: "p",
      text: "② 회원 데이터는 회원의 기기 내부에 저장됩니다. 회원은 기기의 분실·초기화 또는 애플리케이션의 삭제로 회원 데이터가 소멸될 수 있음을 이해하고, 동기화 기능 또는 내보내기 기능을 이용하여 스스로 백업할 책임을 부담합니다.",
    },

    { t: "chapter", text: "제5장 책임과 관할" },

    { t: "article", text: "제14조 (서비스의 성격 및 면책)" },
    {
      t: "p",
      text: "① 서비스는 「의료기기법」에 따른 의료기기가 아니며, 질병의 진단·치료·경감·처치 또는 예방을 목적으로 제공되지 아니합니다.",
    },
    {
      t: "p",
      text: "② 회원은 복약, 응급 상황 등 이행하지 아니할 경우 생명·신체에 위험이 발생할 수 있는 사항에 대하여 서비스의 알림에만 의존하여서는 아니 됩니다.",
    },
    {
      t: "p",
      text: "③ 서비스는 무료로 제공되며, 기관은 서비스의 완전성·정확성 또는 특정 목적에의 적합성을 보증하지 아니합니다.",
    },

    { t: "article", text: "제15조 (손해배상)" },
    {
      t: "p",
      text: "기관은 무료로 제공되는 서비스의 이용과 관련하여 회원에게 발생한 손해에 대하여 배상할 책임을 지지 아니합니다. 다만, 기관의 고의 또는 중대한 과실로 인한 손해의 경우에는 그러하지 아니합니다.",
    },

    { t: "article", text: "제16조 (준거법 및 재판관할)" },
    {
      t: "p",
      text: "이 약관은 대한민국 법령에 따라 규율되며, 서비스 이용과 관련하여 발생한 분쟁에 대하여는 「민사소송법」에 따른 관할 법원을 관할 법원으로 합니다.",
    },

    { t: "article", text: "제17조 (기관의 표시)" },
    ...OPERATOR,

    { t: "article", text: "부칙" },
    { t: "p", text: "이 약관은 2026년 7월 14일부터 시행합니다." },
  ],
};

// ── 개인정보 처리방침 ────────────────────────────────────────────────────────────────────────────────

const PRIVACY: LegalDoc = {
  key: "privacy",
  title: "개인정보 처리방침",
  effectiveDate: EFFECTIVE,
  consent: "[필수] 개인정보 수집·이용에 동의합니다",
  summary: "무엇을 처리하고, 어디에 맡기고, 언제 파기하는지",
  blocks: [
    {
      t: "p",
      text: "LifePlanner(이하 “기관”)는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하게 처리할 수 있도록 다음과 같이 개인정보 처리방침을 수립·공개합니다.",
    },

    { t: "article", text: "제1조 (개인정보의 처리 목적)" },
    { t: "p", text: "① 기관은 다음 각 호의 목적을 위하여 개인정보를 처리합니다." },
    {
      t: "list",
      items: [
        "1. 회원 가입 의사의 확인, 회원의 식별 및 계정 관리",
        "2. 회원 데이터의 기기 간 동기화 및 복원",
        "3. 회원이 지정한 시각의 알림 및 실행 알람의 제공",
        "4. 회원 본인에 대한 하루 요약 및 실행 기록의 제공",
      ],
    },
    { t: "p", text: "② 기관은 제1항의 목적 외의 용도로는 개인정보를 이용하지 아니합니다." },
    {
      t: "p",
      text: "③ 처리 목적이 변경되는 경우 기관은 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행합니다.",
    },

    { t: "article", text: "제2조 (처리하는 개인정보의 항목)" },
    { t: "p", text: "① 회원 가입 및 계정 관리" },
    {
      t: "list",
      items: [
        "이메일 가입 시 (필수) : 이메일 주소, 비밀번호",
        "Google 계정 가입 시 (필수) : Google 계정 고유 식별자, 이메일 주소",
      ],
    },
    { t: "p", text: "② 동기화 서비스의 제공을 위하여 회원이 애플리케이션에 직접 입력한 정보" },
    {
      t: "list",
      items: [
        "시간블록 : 제목, 날짜 및 시각, 종류, 알림 설정, 회원이 입력한 장소명 및 메모",
        "지출 기록 : 항목명, 금액, 분류, 일자",
        "식사 기록 : 음식명, 열량, 식사 종류, 일자",
        "기기 정보 : 기기의 이름 및 애플리케이션이 생성한 기기 식별값",
      ],
    },
    {
      t: "p",
      text: "③ 제2항의 기기 정보는 실행 알람을 표시할 기기를 지정하는 목적으로만 이용하며, 그 밖의 목적으로 이용하지 아니합니다.",
    },
    { t: "p", text: "④ 약관 동의 이력 : 동의한 문서, 문서의 버전, 동의 일시" },
    {
      t: "p",
      text: "⑤ 서비스 이용 과정에서 접속 일시 및 접속 IP 주소가 자동으로 생성·수집됩니다. 이는 제5조의 수탁자가 제공하는 인증 서비스에서 인증 및 보안의 목적으로 생성됩니다.",
    },
    {
      t: "p",
      text: "⑥ 회원이 로그인하지 아니하고 서비스를 이용하는 경우, 제2항 및 제4항의 정보는 회원의 기기 내부에만 저장되며 기관에 전송되지 아니합니다.",
    },

    { t: "article", text: "제3조 (개인정보의 처리 및 보유 기간)" },
    { t: "p", text: "① 기관은 다음 각 호의 기간 동안 개인정보를 보유합니다." },
    {
      t: "list",
      items: [
        "1. 계정 정보 및 서버에 저장된 회원 데이터 : 회원 탈퇴 시까지",
        "2. 약관 동의 이력 : 회원 탈퇴 시까지",
        "3. 접속 일시 및 접속 IP 주소 : 수탁자의 인증 서비스 정책에 따른 보관 기간까지",
      ],
    },
    {
      t: "p",
      text: "② 법령에서 일정 기간의 보존을 요구하는 경우 해당 기간 동안 다른 개인정보와 분리하여 보관한 후 파기합니다.",
    },

    { t: "article", text: "제4조 (개인정보의 제3자 제공)" },
    {
      t: "p",
      text: "기관은 정보주체의 개인정보를 제1조에서 명시한 범위 내에서만 처리하며, 정보주체의 동의 또는 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 제3자에게 제공합니다. 현재 기관이 개인정보를 제공하는 제3자는 없습니다.",
    },

    { t: "article", text: "제5조 (개인정보 처리업무의 위탁)" },
    { t: "p", text: "① 기관은 동기화 서비스의 제공을 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다." },
    {
      t: "list",
      items: [
        "수탁자 : Google LLC",
        "위탁 업무의 내용 : 계정 인증, 회원 데이터의 저장 및 동기화",
        "이용하는 서비스 : Firebase Authentication, Cloud Firestore",
        "위탁 기간 : 회원 탈퇴 시 또는 위탁 계약 종료 시까지",
      ],
    },
    {
      t: "p",
      text: "② 기관은 위탁계약 체결 시 「개인정보 보호법」 제26조에 따라 개인정보의 안전한 관리에 관한 사항을 문서에 규정하고, 수탁자가 개인정보를 안전하게 처리하는지를 감독합니다.",
    },

    { t: "article", text: "제6조 (개인정보의 국외 이전)" },
    { t: "p", text: "① 제5조의 위탁에 따라 개인정보가 다음과 같이 국외로 이전됩니다." },
    {
      t: "list",
      items: [
        "이전받는 자 : Google LLC",
        "이전되는 국가 : 미국 등 Google LLC가 데이터센터를 운영하는 국가",
        "이전 일시 및 방법 : 서비스 이용 시 정보통신망을 통하여 수시로 전송",
        "이전 항목 : 제2조 제1항, 제2항, 제4항 및 제5항의 정보",
        "이전받는 자의 이용 목적 : 제1조 각 호의 목적",
        "이전받는 자의 보유 기간 : 회원 탈퇴 시까지",
      ],
    },
    {
      t: "p",
      text: "② 정보주체는 국외 이전을 거부할 수 있습니다. 이 경우 로그인 및 동기화 기능을 이용할 수 없으나, 로그인하지 아니하고 기기 내에서 서비스를 이용하는 것은 제한되지 아니합니다.",
    },

    { t: "article", text: "제7조 (개인정보의 파기 절차 및 방법)" },
    {
      t: "p",
      text: "① 기관은 개인정보의 보유 기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 해당 개인정보를 파기합니다.",
    },
    {
      t: "p",
      text: "② 전자적 파일 형태의 개인정보는 복구할 수 없는 방법으로 영구 삭제합니다. 회원의 기기 내부에 저장된 정보는 회원이 애플리케이션을 삭제하거나 애플리케이션 내의 초기화 기능을 실행함으로써 삭제됩니다.",
    },

    { t: "article", text: "제8조 (정보주체의 권리·의무 및 행사 방법)" },
    {
      t: "p",
      text: "① 정보주체는 언제든지 개인정보의 열람·정정·삭제·처리정지를 요구할 수 있으며, 애플리케이션 내에서 본인이 입력한 정보를 직접 조회·수정·삭제하거나 파일로 내보낼 수 있습니다.",
    },
    {
      t: "p",
      text: "② 개인정보의 수집·이용에 대한 동의는 언제든지 철회할 수 있으며, 로그아웃 또는 계정의 삭제로 이를 행사할 수 있습니다.",
    },
    {
      t: "p",
      text: "③ 제1항 및 제2항에 따른 권리 행사는 제11조의 개인정보 보호책임자에게 서면 또는 전자우편으로 할 수 있으며, 기관은 지체 없이 조치합니다.",
    },

    { t: "article", text: "제9조 (개인정보의 안전성 확보 조치)" },
    { t: "p", text: "기관은 개인정보의 안전성 확보를 위하여 다음 각 호의 조치를 취하고 있습니다." },
    {
      t: "list",
      items: [
        "1. 비밀번호는 수탁자의 인증 서비스에서 암호화되어 저장되며, 기관은 이를 열람할 수 없습니다.",
        "2. 서버에 저장된 회원 데이터는 접근 권한 규칙에 따라 해당 계정만이 조회·수정할 수 있습니다.",
        "3. 기기와 서버 간의 모든 통신에 전송 구간 암호화(TLS)를 적용합니다.",
      ],
    },

    { t: "article", text: "제10조 (개인정보 자동 수집 장치의 설치·운영 및 거부)" },
    {
      t: "p",
      text: "기관은 이용자의 행태정보를 수집하기 위한 쿠키, 광고 식별자 등 자동 수집 장치를 설치·운영하지 아니합니다.",
    },

    { t: "article", text: "제11조 (개인정보 보호책임자)" },
    { t: "p", text: "① 기관은 개인정보 처리에 관한 업무를 총괄하여 책임질 개인정보 보호책임자를 다음과 같이 지정합니다." },
    ...OPERATOR,
    {
      t: "p",
      text: "② 정보주체는 서비스를 이용하면서 발생한 개인정보 보호 관련 문의, 불만 처리, 피해 구제 등에 관한 사항을 개인정보 보호책임자에게 문의할 수 있으며, 기관은 지체 없이 답변합니다.",
    },

    { t: "article", text: "제12조 (권익침해에 대한 구제 방법)" },
    {
      t: "p",
      text: "정보주체는 개인정보 침해로 인한 구제를 받기 위하여 다음 각 호의 기관에 분쟁 해결이나 상담을 신청할 수 있습니다.",
    },
    {
      t: "list",
      items: [
        "1. 개인정보분쟁조정위원회 : www.kopico.go.kr / 1833-6972",
        "2. 개인정보침해신고센터 : privacy.kisa.or.kr / 국번없이 118",
        "3. 대검찰청 사이버수사과 : www.spo.go.kr / 국번없이 1301",
        "4. 경찰청 사이버수사국 : ecrm.police.go.kr / 국번없이 182",
      ],
    },

    { t: "article", text: "제13조 (만 14세 미만 아동의 개인정보)" },
    { t: "p", text: "기관은 만 14세 미만 아동의 가입을 받지 아니하며, 아동의 개인정보를 처리하지 아니합니다." },

    { t: "article", text: "제14조 (개인정보 처리방침의 변경)" },
    {
      t: "p",
      text: "① 기관이 이 개인정보 처리방침을 변경하는 경우 시행일의 7일 전부터 서비스 내 공지사항에 게시합니다.",
    },
    { t: "p", text: "② 정보주체에게 불리한 변경의 경우에는 시행일의 30일 전부터 게시합니다." },
    { t: "p", text: "③ 내용이 실질적으로 변경되는 경우 기관은 정보주체의 동의를 다시 받습니다." },

    { t: "article", text: "부칙" },
    { t: "p", text: "이 개인정보 처리방침은 2026년 7월 14일부터 시행합니다." },
  ],
};

// ── 위치기반서비스 이용약관 ──────────────────────────────────────────────────────────────────────────
//
// The 기관 is **not** a 위치정보사업자: 위치정보법 제9조's 신고 duty binds those who provide such a service
// **사업으로 영위**, and this service is free. So this document must not borrow a 사업자's obligations or its
// remedies (방송통신위원회 재정 등) — it would be claiming a status the 기관 does not hold. What it can do, and
// does, is **bind the 기관 by contract** to the same protections.

const LOCATION: LegalDoc = {
  key: "location",
  title: "위치기반서비스 이용약관",
  effectiveDate: EFFECTIVE,
  consent: "[필수] 위치기반서비스 이용약관에 동의합니다",
  summary: "위치는 회원이 권한을 허용하고 기능을 켠 경우에만 수집됩니다",
  blocks: [
    { t: "article", text: "제1조 (목적)" },
    {
      t: "p",
      text: "이 약관은 LifePlanner(이하 “기관”)가 제공하는 위치기반서비스의 이용에 관하여 기관과 회원 간의 권리·의무 및 책임사항을 정함을 목적으로 합니다.",
    },

    { t: "article", text: "제2조 (기관의 지위)" },
    {
      t: "p",
      text: "① 기관은 서비스를 무료로 제공하며, 위치정보를 이용한 서비스의 제공을 사업으로 영위하지 아니합니다. 따라서 기관은 「위치정보의 보호 및 이용 등에 관한 법률」에 따른 위치정보사업자 또는 위치기반서비스사업자에 해당하지 아니합니다.",
    },
    {
      t: "p",
      text: "② 제1항에도 불구하고 기관은 이 약관으로써 다음 각 조에서 정하는 보호 조치를 회원에 대하여 스스로 부담합니다.",
    },

    { t: "article", text: "제3조 (약관의 효력 및 변경)" },
    { t: "p", text: "① 이 약관은 회원이 그 내용에 동의함으로써 효력이 발생합니다." },
    { t: "p", text: "② 기관이 약관을 개정하는 경우 적용일자 7일 전부터 서비스 내 공지사항에 게시합니다." },
    { t: "p", text: "③ 회원에게 불리한 내용으로 개정하는 경우에는 적용일자 30일 전부터 게시합니다." },

    { t: "article", text: "제4조 (서비스의 내용 및 이용요금)" },
    { t: "p", text: "① 기관이 제공하는 위치기반서비스의 내용은 다음과 같습니다." },
    {
      t: "list",
      items: ["1. 회원이 운동 일정에 지정한 장소로의 도착 여부를 확인하여 회원 본인에게 알리는 서비스"],
    },
    {
      t: "p",
      text: "② 위치정보는 회원이 기기의 위치 접근 권한을 허용하고 제1항의 기능을 활성화한 경우에 한하여 수집됩니다. 권한을 허용하지 아니하거나 해당 기능을 사용하지 아니하는 경우 위치정보는 수집되지 아니합니다.",
    },
    {
      t: "p",
      text: "③ 회원이 이 약관에 동의하지 아니하거나 제1항의 기능을 이용하지 아니하는 경우에도 그 밖의 서비스는 제한 없이 이용할 수 있습니다.",
    },
    { t: "p", text: "④ 위치기반서비스의 이용요금은 무료입니다." },

    { t: "article", text: "제5조 (위치정보의 이용 및 제공)" },
    {
      t: "p",
      text: "① 기관은 제4조 제1항의 목적을 달성하기 위한 범위에서만 위치정보를 이용하며, 회원의 동의 없이 이를 제3자에게 제공하지 아니합니다.",
    },
    {
      t: "p",
      text: "② 기관은 위치정보를 회원의 기기에서 처리하며, 그 결과를 회원 본인에게만 표시합니다.",
    },
    { t: "p", text: "③ 기관은 위치정보를 광고 또는 이용자 분석의 목적으로 이용하지 아니합니다." },

    { t: "article", text: "제6조 (위치정보의 보유 및 파기)" },
    {
      t: "p",
      text: "① 기관은 위치정보의 이용사실을 확인할 수 있는 자료를 기록·보존하며, 그 보존 기간은 6개월로 합니다.",
    },
    { t: "p", text: "② 제4조 제1항의 목적이 달성된 위치정보는 지체 없이 파기합니다." },

    { t: "article", text: "제7조 (회원의 권리)" },
    { t: "p", text: "① 회원은 위치정보의 수집·이용에 대한 동의의 전부 또는 일부를 언제든지 철회할 수 있습니다." },
    {
      t: "p",
      text: "② 회원은 위치정보의 수집·이용의 일시적인 중지를 요구할 수 있으며, 기관은 이를 거절하지 아니합니다.",
    },
    {
      t: "p",
      text: "③ 회원은 위치정보의 이용사실 확인자료에 대한 열람 또는 고지를 요구할 수 있으며, 기관은 정당한 사유 없이 이를 거절하지 아니합니다.",
    },
    {
      t: "p",
      text: "④ 제1항에 따라 동의를 철회한 경우 기관은 지체 없이 위치정보 및 제6조 제1항의 확인자료를 파기합니다.",
    },
    { t: "p", text: "⑤ 회원은 기기의 설정에서 위치 접근 권한을 철회함으로써 언제든지 위치정보의 수집을 중단시킬 수 있습니다." },

    { t: "article", text: "제8조 (8세 이하의 아동 등의 보호)" },
    {
      t: "p",
      text: "① 8세 이하의 아동, 피성년후견인 또는 「장애인복지법」에 따른 장애인 중 일정한 자(이하 “8세 이하의 아동등”)의 보호의무자가 8세 이하의 아동등의 생명·신체의 보호를 위하여 위치정보의 이용에 동의하는 경우에는 본인의 동의가 있는 것으로 봅니다.",
    },
    {
      t: "p",
      text: "② 제1항에 따른 동의를 하려는 보호의무자는 서면 또는 전자우편으로 그 관계를 증명하는 서류를 첨부하여 기관에 제출하여야 합니다.",
    },
    { t: "p", text: "③ 보호의무자는 8세 이하의 아동등을 대신하여 제7조의 권리를 모두 행사할 수 있습니다." },

    { t: "article", text: "제9조 (면책)" },
    {
      t: "p",
      text: "기관은 천재지변, 정전, 위성신호의 오류, 기기의 위치 기능의 장애 등 기관의 귀책사유 없는 사정으로 위치기반서비스가 제공되지 아니하거나 위치정보가 부정확한 경우 그로 인한 손해에 대하여 책임을 지지 아니합니다.",
    },

    { t: "article", text: "제10조 (손해배상)" },
    {
      t: "p",
      text: "기관이 이 약관에서 정한 보호 조치를 위반하여 회원에게 손해가 발생한 경우, 기관은 그 손해를 배상할 책임을 부담합니다.",
    },

    { t: "article", text: "제11조 (분쟁의 조정)" },
    {
      t: "p",
      text: "위치정보와 관련된 분쟁에 대하여 당사자 간 협의가 이루어지지 아니한 경우, 회원은 「개인정보 보호법」 제43조에 따라 개인정보분쟁조정위원회에 조정을 신청할 수 있습니다.",
    },

    { t: "article", text: "제12조 (기관의 표시)" },
    ...OPERATOR,

    { t: "article", text: "부칙" },
    { t: "p", text: "이 약관은 2026년 7월 14일부터 시행합니다." },
  ],
};

export const LEGAL_DOCS: Record<LegalKey, LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
  location: LOCATION,
};

/** The order they are shown in, at signup and in the consent list. */
export const LEGAL_ORDER: LegalKey[] = ["terms", "privacy", "location"];

/** "2026-07-14" → "26. 07. 14." — the form the consent list and the version chip use. */
export function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${y.slice(2)}. ${m}. ${d}.`;
}
