// 공지사항 — and it is not decoration.
//
// The terms promise it: 제3조 2항 says a change to the terms is announced **in the app's 공지사항**, 7 days
// ahead (30 for anything that disadvantages the user). Without this screen the app could not keep its own
// terms. A policy edit therefore lands here as a notice, not only as a version bump.
//
// Static and in-bundle on purpose. Fetching notices would mean a server, and a notice nobody can read offline
// is worse than one shipped in the binary.

import type { Block } from "./legal";

export interface Notice {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  body: Block[];
  /** Pinned to the top — used for policy changes, which the terms require us to announce in advance. */
  pinned?: boolean;
}

/** Newest first. */
export const NOTICES: Notice[] = [
  {
    id: "n-2026-07-14-legal",
    date: "2026-07-14",
    title: "이용약관 · 개인정보 처리방침 · 위치기반서비스 약관 시행",
    pinned: true,
    body: [
      {
        t: "p",
        text: "2026년 7월 14일부터 세 문서가 시행됩니다. 가입할 때 동의하게 되며, 언제든 설정 → 계정 맨 아래에서 다시 볼 수 있어요.",
      },
      {
        t: "list",
        items: ["서비스 이용약관", "개인정보 처리방침", "위치기반서비스 이용약관"],
      },
      {
        t: "note",
        text: "이 앱은 지금 위치 정보를 전혀 수집하지 않습니다. 위치기반서비스 약관은 앞으로 “운동 일정을 만든 뒤 실제로 그 장소에 갔는지” 확인해 주는 기능을 위한 것이며, 그 기능을 켜는 시점에 기기 권한과 함께 다시 확인합니다.",
      },
      {
        t: "p",
        text: "앞으로 약관이 바뀌면 시행 7일 전(이용자에게 불리한 변경은 30일 전)부터 이 공지사항으로 먼저 알려드립니다.",
      },
    ],
  },
  {
    id: "n-2026-07-14-devices",
    date: "2026-07-14",
    title: "실행 알람이 울릴 기기를 고를 수 있어요",
    body: [
      {
        t: "p",
        text: "여러 기기에 로그인하면 일정은 모든 기기에 똑같이 맞춰지지만, 전체화면 실행 알람은 고른 기기에서만 나타나요.",
      },
      {
        t: "p",
        text: "세 곳에서 동시에 울리는 신호는 더 이상 신호가 아니라 질문이 되니까요 — “그래서 어디서 하라고?”",
      },
      {
        t: "p",
        text: "고르지 않은 기기에서는 진동과 알림으로 그 시각이 왔다는 것만 알려줘요. 기기 선택은 블록을 만들거나 고칠 때 ‘실행’ 알림을 켜면 나타나요.",
      },
    ],
  },
];
