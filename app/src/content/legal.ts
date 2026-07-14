// **The policy documents. This file IS the document** — not a copy of one.
//
// The earlier version baked `reference/*.md` into the bundle and rendered the markdown. That was wrong twice
// over: the drafts leaked their own scaffolding into the app (`(초안)`, `## 8.` — twice, on two different
// clauses), and they described an app we never built (결제 기록, IMEI, Mac Address, 체중·신장·프로필 사진,
// 협력회사로부터의 제공, 팩스 수집). **A privacy policy that claims collection we do not perform is not
// caution — it is a false statement about the user's data**, and it takes on duties we never owed.
//
// So the text is authored here, as structure rather than prose-with-hashes, and every collected item below was
// checked against the code that collects it (`sync.ts` KEYS · `deviceRepository` · Firebase Auth). If you add a
// field that leaves the phone, it belongs in 제2조 of the privacy policy **in the same commit**.
//
// The founder's drafts stay in `reference/` as the source they were drawn from; they are no longer shipped.

export type LegalKey = "terms" | "privacy" | "location";

/** One rendered element. A legal document is a structure, so it is stored as one. */
export type Block =
  | { t: "chapter"; text: string } // 제1장 총칙
  | { t: "article"; text: string } // 제1조 (목적)
  | { t: "p"; text: string } // a paragraph, incl. ① ② or 1. 2.
  | { t: "list"; items: string[] } // an indented list
  | { t: "note"; text: string }; // a highlighted aside — the things we most want read

export interface LegalDoc {
  key: LegalKey;
  /** Shown as the screen title and in the consent list. */
  title: string;
  /** YYYY-MM-DD — the day this version takes effect. Displayed as the version chip. */
  effectiveDate: string;
  /** The one line the user ticks. All three are required (founder, 2026-07-14). */
  consent: string;
  /** One-line summary under the consent row — what they are actually agreeing to. */
  summary: string;
  blocks: Block[];
}

/**
 * Bumped when a document's **meaning** changes. It is stamped on the consent record; a record carrying an old
 * version is what re-asks the user. Silently editing the words without bumping this would leave us claiming
 * consent to text they never saw.
 */
export const LEGAL_VERSION = "2026-07-14";

const EFFECTIVE = "2026-07-14";

/** The operator, stated once and reused — a policy that cannot be complained to is decoration. */
const CONTACT: Block[] = [
  { t: "article", text: "문의처" },
  {
    t: "list",
    items: ["서비스명 : LifePlanner", "개인정보 보호책임자 : 이상현", "이메일 : shleelee@yahoo.com"],
  },
  {
    t: "p",
    text: "개인정보와 관련한 문의·열람·정정·삭제·동의 철회 요청은 위 이메일로 보내 주세요. 받는 즉시 처리하고 그 결과를 알려드립니다.",
  },
];

// ── 이용약관 ────────────────────────────────────────────────────────────────────────────────────────

const TERMS: LegalDoc = {
  key: "terms",
  title: "서비스 이용약관",
  effectiveDate: EFFECTIVE,
  consent: "[필수] 만 14세 이상이며, 서비스 이용약관에 동의합니다",
  summary: "서비스의 이용 조건과 알림에 관한 약속",
  blocks: [
    { t: "chapter", text: "제1장 총칙" },

    { t: "article", text: "제1조 (목적)" },
    {
      t: "p",
      text: "이 약관은 LifePlanner(이하 “서비스”)를 이용하는 데 필요한 조건과 절차, 이용자와 운영자의 권리·의무를 정합니다.",
    },

    { t: "article", text: "제2조 (정의)" },
    {
      t: "list",
      items: [
        "“회원”이란 이 약관에 동의하고 계정을 만들어 서비스를 이용하는 사람을 말합니다.",
        "“비회원 이용자”란 계정 없이 기기 안에 저장하는 방식으로만 서비스를 이용하는 사람을 말합니다.",
        "“회원 데이터”란 이용자가 서비스에 직접 입력한 시간블록(일정), 지출 기록, 식사 기록과 그 부속 정보를 말합니다.",
        "“실행 알람”이란 이용자가 미리 정한 시각에, 그 일을 시작하도록 화면에 전체화면으로 나타나는 알림을 말합니다.",
      ],
    },

    { t: "article", text: "제3조 (약관의 게시와 변경)" },
    { t: "p", text: "① 운영자는 이 약관을 앱 안에서 언제든지 볼 수 있도록 게시합니다." },
    {
      t: "p",
      text: "② 약관을 바꾸는 경우, 적용일과 바뀐 내용, 그 이유를 적어 시행일 7일 전부터 앱의 공지사항에 알립니다. 이용자에게 불리한 변경은 시행일 30일 전부터 알립니다.",
    },
    {
      t: "p",
      text: "③ 내용이 실질적으로 바뀌는 경우에는 다시 동의를 받습니다. 동의하지 않으면 이용계약을 해지할 수 있습니다.",
    },

    { t: "chapter", text: "제2장 서비스의 이용" },

    { t: "article", text: "제4조 (계정과 가입)" },
    {
      t: "p",
      text: "① 계정은 오직 기기 간 동기화를 켜기 위한 것입니다. 로그인하지 않아도 서비스의 모든 기능을 그대로 쓸 수 있습니다.",
    },
    { t: "p", text: "② 가입은 이메일 또는 Google 계정으로 할 수 있으며, 가입 시 이 약관에 동의해야 합니다." },
    { t: "p", text: "③ 만 14세 미만은 가입할 수 없습니다." },
    { t: "p", text: "④ 비밀번호의 관리 책임은 이용자에게 있습니다." },

    { t: "article", text: "제5조 (탈퇴와 해지)" },
    {
      t: "p",
      text: "① 이용자는 언제든지 로그아웃하거나 계정을 삭제할 수 있습니다. 로그아웃해도 그 기기에 저장된 기록은 지워지지 않습니다.",
    },
    {
      t: "p",
      text: "② 계정을 삭제하면 서버에 보관된 회원 데이터는 지체 없이 파기됩니다. 기기 안의 기록은 앱을 지우면 함께 사라집니다.",
    },

    { t: "article", text: "제6조 (서비스의 내용)" },
    {
      t: "list",
      items: [
        "시간블록(일정)의 기록과 캘린더 표시",
        "정한 시각의 알림, 그리고 전체화면으로 나타나는 실행 알람",
        "지출·식사 기록과 하루 요약",
        "로그인한 경우, 여러 기기 간의 자동 동기화",
      ],
    },

    { t: "chapter", text: "제3장 알림과 실행" },

    { t: "article", text: "제7조 (알림에 관한 고지)" },
    {
      t: "p",
      text: "① 서비스의 핵심은 정한 시각에 정확히 도착하는 알림입니다. 이를 위해 알림, 정확한 알람, 전체화면 알림, 다른 앱 위에 표시 권한을 사용합니다. 이용자는 기기 설정에서 언제든 이 권한을 거둘 수 있으나, 그 경우 실행 알람은 동작하지 않습니다.",
    },
    {
      t: "p",
      text: "② 알림은 기기의 상태(전원 종료, 절전 모드, 앱 강제 종료, 제조사별 배터리 최적화 등)에 따라 늦거나 오지 않을 수 있습니다. 운영자는 알림의 도달을 보증하지 않습니다.",
    },
    {
      t: "note",
      text: "서비스는 의료·안전 목적의 도구가 아닙니다. 복약, 응급, 그 밖에 놓쳤을 때 위험이 따르는 일에는 이 서비스에만 의존하지 마세요.",
    },

    { t: "article", text: "제8조 (여러 기기에서의 실행)" },
    {
      t: "p",
      text: "여러 기기에 로그인한 경우, 일정은 모든 기기에 동기화되지만 전체화면 실행 알람은 이용자가 지정한 기기에서만 나타납니다. 지정하지 않은 기기에서는 진동과 알림으로만 알립니다.",
    },

    { t: "chapter", text: "제4장 기타" },

    { t: "article", text: "제9조 (이용자의 기록과 백업)" },
    {
      t: "p",
      text: "① 이용자가 만든 기록은 이용자의 것입니다. 운영자는 이를 광고에 이용하거나 제3자에게 판매하지 않습니다.",
    },
    {
      t: "p",
      text: "② 기록은 기본적으로 기기 안에 저장됩니다. 기기의 분실·초기화·앱 삭제로 기록이 사라질 수 있으므로, 로그인(동기화) 또는 내보내기 기능으로 스스로 백업할 것을 권합니다.",
    },

    { t: "article", text: "제10조 (금지 행위)" },
    {
      t: "p",
      text: "이용자는 타인의 계정에 접근하거나, 서버에 과도한 부하를 일으키거나, 법령을 위반하는 목적으로 서비스를 이용해서는 안 됩니다.",
    },

    { t: "article", text: "제11조 (서비스의 변경·중단)" },
    {
      t: "p",
      text: "서비스는 개인이 무료로 운영합니다. 운영자는 서비스의 내용을 바꾸거나 운영을 중단할 수 있으며, 중단하는 경우 이용자가 자신의 기록을 내보낼 수 있도록 앱 안에 미리 알립니다.",
    },

    { t: "article", text: "제12조 (책임의 한계)" },
    {
      t: "p",
      text: "서비스는 “있는 그대로” 무료로 제공됩니다. 운영자는 고의 또는 중대한 과실이 없는 한 서비스 이용으로 발생한 손해에 대해 책임지지 않습니다.",
    },

    { t: "article", text: "제13조 (준거법)" },
    { t: "p", text: "이 약관은 대한민국 법을 따르며, 분쟁은 민사소송법에 따른 관할 법원에 제기합니다." },

    ...CONTACT,

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
  summary: "무엇을 모으고, 왜 모으고, 언제 지우는지",
  blocks: [
    { t: "article", text: "제1조 (원칙)" },
    {
      t: "note",
      text: "이 앱은 서비스에 필요한 최소한만 모읍니다. 사진, 연락처, 통화 기록, 결제 정보, 광고 식별자, 기기 고유번호(IMEI·MAC 주소)는 수집하지 않습니다. 이용자의 기록을 광고에 쓰거나 제3자에게 판매하지 않습니다.",
    },
    {
      t: "p",
      text: "로그인하지 않고 쓰는 경우, 모든 기록은 이용자의 기기 안에만 저장되며 서버로 전송되지 않습니다.",
    },

    { t: "article", text: "제2조 (수집하는 항목)" },
    { t: "p", text: "① 계정을 만들 때" },
    {
      t: "list",
      items: [
        "이메일로 가입: 이메일 주소, 비밀번호",
        "Google로 가입: Google 계정 고유 식별자, 이메일 주소",
      ],
    },
    { t: "p", text: "② 로그인해서 동기화를 켰을 때 (이용자가 앱에 직접 입력한 내용)" },
    {
      t: "list",
      items: [
        "시간블록(일정) : 제목, 날짜와 시각, 종류, 알림 설정, 이용자가 적은 장소 이름과 메모",
        "지출 기록 : 이름, 금액, 분류, 날짜",
        "식사 기록 : 음식 이름, 칼로리, 식사 종류, 날짜",
        "기기 정보 : 기기 이름(예: “갤럭시 S23”)과 앱이 만든 기기 식별값 — 실행 알람을 어느 기기에서 띄울지 정하기 위해서만 씁니다",
        "약관 동의 기록 : 동의한 문서와 동의 시각",
      ],
    },
    { t: "p", text: "③ 자동으로 생성되는 정보" },
    {
      t: "list",
      items: [
        "로그인 처리 과정에서 Google Firebase가 남기는 접속 기록과 접속 IP (인증과 보안 목적)",
      ],
    },
    {
      t: "note",
      text: "위치 정보는 수집하지 않습니다. 시간블록의 “장소”는 이용자가 직접 적는 글자일 뿐, 기기의 위치를 읽지 않습니다.",
    },

    { t: "article", text: "제3조 (이용 목적)" },
    {
      t: "list",
      items: [
        "계정 확인과 여러 기기 간 동기화",
        "정한 시각에 알림과 실행 알람을 띄우기 위해",
        "이용자 본인에게 하루 요약과 실행 기록을 보여주기 위해",
      ],
    },
    { t: "p", text: "위 목적 외에는 이용하지 않으며, 목적이 바뀌면 다시 동의를 받습니다." },

    { t: "article", text: "제4조 (제3자 제공)" },
    { t: "p", text: "개인정보를 제3자에게 제공하지 않습니다." },

    { t: "article", text: "제5조 (처리 위탁과 국외 이전)" },
    { t: "p", text: "동기화를 위해 아래에 처리를 위탁합니다." },
    {
      t: "list",
      items: [
        "수탁자 : Google LLC (Firebase Authentication, Cloud Firestore)",
        "위탁 업무 : 계정 인증, 회원 데이터의 저장과 동기화",
        "이전되는 국가 : 미국 등 Google이 운영하는 데이터센터 소재 국가",
        "보유 기간 : 회원 탈퇴 시 또는 위탁 계약 종료 시까지",
      ],
    },
    { t: "p", text: "동의하지 않을 수 있으나, 이 경우 로그인과 기기 간 동기화를 이용할 수 없습니다. 로그인 없이 기기 안에서 쓰는 것은 그대로 가능합니다." },

    { t: "article", text: "제6조 (보유 기간과 파기)" },
    {
      t: "list",
      items: [
        "계정 정보와 서버에 저장된 회원 데이터 : 회원 탈퇴 시 지체 없이 파기",
        "기기 안의 기록 : 앱을 삭제하면 함께 삭제 (설정 → 기록 초기화로 직접 지울 수도 있습니다)",
        "법령에서 보관을 요구하는 경우, 그 기간 동안만 분리 보관 후 파기",
      ],
    },

    { t: "article", text: "제7조 (이용자의 권리)" },
    {
      t: "p",
      text: "이용자는 언제든지 앱 안에서 자신이 입력한 내용을 직접 보고, 고치고, 지울 수 있습니다. 설정의 내보내기(JSON) 기능으로 자신의 기록 전부를 파일로 내려받을 수 있습니다. 동의 철회는 로그아웃 또는 계정 삭제로 즉시 가능합니다.",
    },

    { t: "article", text: "제8조 (안전성 확보 조치)" },
    {
      t: "list",
      items: [
        "비밀번호는 운영자가 볼 수 없으며, Firebase Authentication이 암호화하여 보관합니다.",
        "서버에 저장된 기록은 보안 규칙에 따라 본인 계정만 읽고 쓸 수 있습니다.",
        "기기와 서버 사이의 모든 통신은 암호화(TLS)됩니다.",
      ],
    },

    { t: "article", text: "제9조 (만 14세 미만)" },
    { t: "p", text: "만 14세 미만 아동의 가입을 받지 않으며, 아동의 개인정보를 수집하지 않습니다." },

    { t: "article", text: "제10조 (방침의 변경)" },
    {
      t: "p",
      text: "이 방침이 바뀌면 시행 7일 전(이용자에게 불리한 변경은 30일 전)부터 앱의 공지사항으로 알리고, 내용이 실질적으로 바뀌는 경우 다시 동의를 받습니다.",
    },

    { t: "article", text: "제11조 (권익침해 구제)" },
    {
      t: "list",
      items: [
        "개인정보 침해신고센터 : privacy.kisa.or.kr / 국번없이 118",
        "개인정보 분쟁조정위원회 : kopico.go.kr / 1833-6972",
        "대검찰청 사이버수사과 : 국번없이 1301",
        "경찰청 사이버수사국 : ecrm.police.go.kr / 국번없이 182",
      ],
    },

    ...CONTACT,

    { t: "article", text: "부칙" },
    { t: "p", text: "이 개인정보 처리방침은 2026년 7월 14일부터 시행합니다." },
  ],
};

// ── 위치기반서비스 이용약관 ──────────────────────────────────────────────────────────────────────────

const LOCATION: LegalDoc = {
  key: "location",
  title: "위치기반서비스 이용약관",
  effectiveDate: EFFECTIVE,
  consent: "[필수] 위치기반서비스 이용약관에 동의합니다",
  summary: "지금은 위치를 수집하지 않아요 — 켤 때 다시 물어봅니다",
  blocks: [
    { t: "article", text: "제1조 (목적)" },
    {
      t: "p",
      text: "이 약관은 LifePlanner(이하 “서비스”)가 제공하는 위치기반서비스의 이용 조건과 절차, 이용자와 운영자의 권리·의무를 정합니다.",
    },

    {
      t: "note",
      text: "현재 이 앱은 위치 정보를 전혀 수집하지 않습니다. 위치 권한을 요청하지도 않습니다. 이 약관은 앞으로 위치 기능이 추가될 때를 위한 것이며, 그 기능을 실제로 켜는 시점에 기기 권한과 함께 다시 확인합니다.",
    },

    { t: "article", text: "제2조 (서비스의 내용)" },
    { t: "p", text: "위치 기능이 추가되면 다음 목적으로만 위치 정보를 이용합니다." },
    {
      t: "list",
      items: [
        "운동 일정을 만든 뒤, 이용자가 실제로 그 장소(예: 헬스장)에 도착했는지 스스로 확인해 주는 기능",
      ],
    },
    { t: "p", text: "위치 정보는 이 목적 외에 이용하지 않으며, 광고나 이용자 분석에 쓰지 않습니다." },

    { t: "article", text: "제3조 (위치 정보의 이용·제공)" },
    { t: "p", text: "① 위치 정보는 이용자 본인에게 결과를 보여주기 위해서만 처리하며, 제3자에게 제공하지 않습니다." },
    {
      t: "p",
      text: "② 위치 정보를 제3자에게 제공하게 되는 경우, 제공받는 자와 목적을 매회 이용자에게 미리 알리고 동의를 받습니다.",
    },

    { t: "article", text: "제4조 (수집·이용·제공 사실 확인자료의 보유)" },
    {
      t: "p",
      text: "「위치정보의 보호 및 이용 등에 관한 법률」 제16조 제2항에 따라 위치 정보의 수집·이용·제공 사실 확인자료를 자동으로 기록·보존하며, 6개월 이상 보관합니다.",
    },

    { t: "article", text: "제5조 (이용자의 권리)" },
    {
      t: "list",
      items: [
        "위치 정보 이용에 대한 동의는 언제든지 철회할 수 있습니다.",
        "동의를 철회하면 위치 정보와 그 확인자료를 지체 없이 파기합니다.",
        "위치 정보의 수집·이용·제공 사실 확인자료의 열람·고지를 요구할 수 있습니다.",
        "기기의 설정에서 위치 권한을 끄면 위치 기능은 즉시 동작하지 않습니다.",
      ],
    },
    {
      t: "note",
      text: "위치 기능에 동의하지 않아도, 또는 나중에 동의를 철회해도, 앱의 다른 모든 기능은 그대로 동작합니다.",
    },

    { t: "article", text: "제6조 (8세 이하 아동 등의 보호)" },
    {
      t: "p",
      text: "8세 이하의 아동, 피성년후견인, 중증 장애인의 보호의무자가 그 보호 목적으로 위치기반서비스 이용에 동의하는 경우, 본인의 동의가 있는 것으로 봅니다. 이 경우 보호의무자는 서면 또는 이메일로 동의 사실을 증명하는 서류를 제출해야 합니다.",
    },

    { t: "article", text: "제7조 (손해배상 및 분쟁조정)" },
    {
      t: "p",
      text: "운영자가 「위치정보법」 제15조부터 제26조까지의 규정을 위반하여 이용자에게 손해가 발생한 경우, 이용자는 손해배상을 청구할 수 있습니다. 분쟁이 조정되지 않는 경우 방송통신위원회에 재정을 신청하거나 개인정보 분쟁조정위원회에 조정을 신청할 수 있습니다.",
    },

    { t: "article", text: "제8조 (위치정보관리책임자)" },
    { t: "p", text: "위치정보관리책임자는 아래 문의처의 개인정보 보호책임자와 같습니다." },

    ...CONTACT,

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
