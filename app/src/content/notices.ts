// 공지사항.
//
// The terms oblige it (제3조 ③): a change to the terms is announced **in the app's 공지사항**, 7 days ahead —
// 30 if it disadvantages the user. Without this screen the app could not keep its own terms.
//
// **What does NOT belong here:** an announcement that the policies exist. The founder cut it, and he was right
// — a user who is reading 공지사항 already agreed to them at signup, and the shelf at the bottom of 계정 is one
// tap away. A notice board that opens with an announcement about itself teaches people to stop reading it.
//
// So it carries what actually changed in the app, drawn from `docs/research/build-log.md`. Static and
// in-bundle on purpose: a notice nobody can read offline is worse than one shipped in the binary.

import type { Block } from "./legal";

export interface Notice {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  body: Block[];
  /** Pinned to the top. Reserved for policy changes — the thing the terms require us to announce in advance. */
  pinned?: boolean;
}

/** Newest first. */
export const NOTICES: Notice[] = [
  {
    id: "n-2026-07-14-auto-eval",
    date: "2026-07-14",
    title: "운동을 위치로 자동 판정해요",
    body: [
      {
        t: "p",
        text: "헬스·러닝 ‘실행’ 블록에서, 실제로 움직였는지 위치로 확인해 성공·미스를 자동으로 정해줘요. 실행을 시작한 순간과 약 5분 뒤, 약 15분 뒤의 위치를 봐요.",
      },
      {
        t: "p",
        text: "헬스장처럼 한곳에 머무는 운동은, 설정에서 헬스장 위치를 저장해 두면 가만히 있어도 성공으로 봐요. 자동 판정은 언제든 상세 화면에서 직접 바꿀 수 있어요.",
      },
      {
        t: "p",
        text: "위치는 이 기기 안에서만 확인한 뒤 곧바로 지워지고, 서버로 보내지 않아요. 설정에서 이 기능과 위치 권한을 끄면 위치는 수집되지 않아요.",
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
  {
    id: "n-2026-07-14-one-unit",
    date: "2026-07-14",
    title: "일정과 블록이 하나로 합쳐졌어요",
    body: [
      {
        t: "p",
        text: "전에는 캘린더의 ‘일정’과 홈의 ‘블록’이 따로였어요. 그래서 블록으로 넣은 수업이 캘린더에 보이지 않았고, 달력은 비어 있지 않은 오후를 비어 있다고 말했어요.",
      },
      { t: "p", text: "이제 하나예요. 알림을 어떻게 설정하느냐가 그 일정이 무엇인지를 말해 줘요." },
      {
        t: "list",
        items: [
          "없음 : 시간만 차지해요. 강의·이동처럼 확인할 필요가 없는 것. 그 시각이 지나면 알아서 지난 기록으로 넘어가요.",
          "알림 : 잊지 않게 알려만 줘요.",
          "실행 : 그 시각에 화면을 가져가서 시작하게 만들어요.",
        ],
      },
    ],
  },
  {
    id: "n-2026-07-14-silent",
    date: "2026-07-14",
    title: "무음 알림이 생겼어요",
    body: [
      {
        t: "p",
        text: "알림의 세기를 무음·진동·소리 중에서 고를 수 있어요. 실행 알람도 무음으로 둘 수 있어요.",
      },
      { t: "p", text: "화면을 가져가는 것이 실행을 만드는 것이고, 소리는 거기 따라붙는 것일 뿐이니까요." },
    ],
  },
  {
    id: "n-2026-07-13-sync",
    date: "2026-07-13",
    title: "로그인하면 기기 간에 자동으로 맞춰져요",
    body: [
      {
        t: "p",
        text: "설정 → 계정에서 로그인하면 일정·지출·식사가 다른 기기와 자동으로 맞춰져요. 로그인하지 않아도 앱의 모든 기능은 그대로 동작해요.",
      },
      {
        t: "p",
        text: "오프라인에서 바꾼 것도 그대로 저장되고, 연결되면 알아서 올라가요. 아직 올라가지 못한 기록이 있으면 계정 화면이 그 개수를 알려줘요. 기다리지 않게 만든 것이지, 모른 척하려는 게 아니니까요.",
      },
    ],
  },
  {
    id: "n-2026-07-13-records",
    date: "2026-07-13",
    title: "지난 기록을 고치고 지울 수 있어요",
    body: [
      {
        t: "list",
        items: [
          "답하지 않고 지나간 일은 ‘아직’으로 남아요. 없던 일처럼 사라지지 않아요.",
          "지난 기록을 길게 누르면 지울 수 있어요.",
          "미뤄 둔 일의 시각을 옮기면 그 일이 다시 열려요. 15시에 놓쳤어도 17시에 하면 되니까요.",
          "설정 → 자가실험 → 기록 초기화로 실행 기록만 비울 수 있어요. 계획은 그대로 남아요.",
        ],
      },
    ],
  },
];
