// 공지사항 — and it is not decoration.
//
// The terms promise it: 제3조 3항 says a change to the terms is announced **"서비스 내 공지사항으로"**, 7 days
// ahead (30 for anything that disadvantages the user). Without this screen the app could not keep its own
// terms. The same clause is why a policy edit must land here as a notice, not only as a version bump.
//
// It is a static list on purpose. Fetching notices would mean a server, and the lever must keep working with
// no network at all; a notice nobody can read offline is worse than a notice shipped in the binary.

export interface Notice {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  /** Plain paragraphs, rendered as-is. */
  body: string;
  /** Pinned to the top — used for policy changes, which the terms require us to announce in advance. */
  pinned?: boolean;
}

/** Newest first. */
export const NOTICES: Notice[] = [
  {
    id: "n-2026-07-14-legal",
    date: "2026-07-14",
    title: "이용약관 · 개인정보처리방침 · 위치기반서비스 약관 시행",
    pinned: true,
    body: [
      "회원가입 시 동의하는 세 가지 문서를 앱 안에서 언제든 볼 수 있도록 넣었어요. 설정 → 계정 맨 아래에 있어요.",
      "",
      "· 이용약관 (필수)",
      "· 개인정보처리방침 (필수)",
      "· 위치기반서비스 이용약관 (선택)",
      "",
      "위치기반서비스 약관은 지금은 **선택**이에요. 앱은 현재 위치 정보를 전혀 수집하지 않아요. 나중에 '헬스장에 실제로 들어갔는지'를 스스로 확인해 주는 기능이 준비되면, 그때 이 동의를 쓰게 돼요. 동의하지 않아도 앱의 모든 기능은 그대로 동작해요.",
      "",
      "앞으로 약관이 바뀌면 시행 7일 전(이용자에게 불리한 변경은 30일 전)에 이 공지사항으로 먼저 알려드려요.",
    ].join("\n"),
  },
  {
    id: "n-2026-07-14-devices",
    date: "2026-07-14",
    title: "실행 순간이 울릴 기기를 고를 수 있어요",
    body: [
      "여러 기기에 로그인하면 일정은 모든 기기에 똑같이 맞춰지지만, **전체화면 실행 순간은 고른 기기에서만** 나타나요.",
      "",
      "세 곳에서 동시에 울리는 신호는 더 이상 신호가 아니라 질문이 되니까요 — '그래서 어디서 하라고?'",
      "",
      "고르지 않은 기기에서는 진동 한 번과 알림으로 그 시각이 왔다는 것만 알려줘요. 기기 선택은 블록을 만들거나 고칠 때 '실행' 알림을 켜면 나타나요.",
    ].join("\n"),
  },
];
