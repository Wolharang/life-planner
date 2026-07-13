// Home = **My Day** (PRD R6): today's TimeBlocks as execution cards — next-up as the hero, flagged
// (실행 알림) blocks prominent. Plan/execution surface ONLY: spending & meals never appear here (D32).
// The R6 catch-up net, the §8 permission banner and the no-guilt outcome model carry over unchanged
// from the prototype; only the unit changed (Task → TimeBlock, per-date, no recurrence).
//
// The switch on a card IS the R7 "오늘은 쉼" pre-fire toggle (ON = armed, OFF = 쉼) — never an
// alarm on/off switch, and it disappears once the moment has passed (no in-flow escape).

import { View, Text, Pressable, FlatList, Alert, AppState, Switch, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  listBlocks,
  blocksOn,
  deleteBlock,
  updateBlock,
  rearmBlockAlarms,
  type TimeBlock,
} from "@/core/data/blockRepository";
import { blockFireAt, blockStartAt, isSkipped, pastUnfiredBlocks, todayYmd, shiftYmd } from "@/core/schedule/blockScheduler";
import { recordOutcome, removeOutcome, listOutcomes, type OutcomeRecord } from "@/core/data/outcomeRepository";
import { notificationPermissionGranted } from "@/core/notifications/plainReminders";
import { listFires, setFires, appendFires, type FireRecord } from "@/core/data/firedRepository";
import { listMisses, setMisses, appendMisses, type MissedRecord } from "@/core/data/missedRepository";
import { appendLatencies } from "@/core/data/latencyRepository";
import { rearmEventNotifications } from "@/core/notifications/plainReminders";
import { listEvents } from "@/core/data/eventRepository";
import { alarm } from "@/core/notifications/alarm";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const hmFromMs = (ms: number) => {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// Relative label for the next-execution hero ("곧 / N분 후 / N시간 후").
const relLabel = (ms: number | null) => {
  if (ms == null) return "";
  const diff = ms - Date.now();
  if (diff <= 0) return "곧";
  const m = Math.round(diff / 60000);
  if (m < 1) return "곧";
  if (m < 60) return `${m}분 후`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}시간 ${mm}분 후` : `${h}시간 후`;
};

// Relative day for the 지난 기록 log ("오늘 / 어제 / N일 전").
const relDay = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  then.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  if (diff <= 0) return "오늘";
  if (diff === 1) return "어제";
  return `${diff}일 전`;
};

type IconKind = TimeBlock["kind"];

type HomeRow =
  | { kind: "section"; title: string }
  | { kind: "block"; block: TimeBlock; fireAt: number | null; started: boolean }
  | { kind: "history"; outcome: OutcomeRecord };

// A gentle catch-up prompt (R6). `kind` decides the copy: a block whose intervention NEVER fired
// (device off / alarm not armed → no fire marker) uses "놓쳤어요"; one that fired but was deferred
// ("아직" at the re-check) uses "아직 안 했죠".
type CatchUpItem = {
  taskId: string; // = block id (the outcome stores keep the prototype's field name)
  title: string;
  date: string;
  intended?: number;
  kind: "fired" | "missed";
};

export default function Home() {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeRecord[]>([]);
  const [catchUps, setCatchUps] = useState<CatchUpItem[]>([]);
  const [needsPerm, setNeedsPerm] = useState<{ exact: boolean; fsi: boolean; notif: boolean; overlay: boolean } | null>(null);
  const [askReason, setAskReason] = useState<{ id: string; title: string } | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setBlocks(await listBlocks());
    setOutcomes((await listOutcomes()).slice().reverse()); // most recent first
    setLoading(false);
  }, []);

  const router = useRouter();
  const today = todayYmd();

  // Record an outcome AND reflect it on the block itself (status/​completedAt) so the plan-vs-actual
  // evaluation (R17, Later) can read it straight off the block (data-model §2.3).
  const settle = useCallback(
    async (blockId: string, date: string, title: string, status: "done" | "miss", source: OutcomeRecord["source"], at = Date.now()) => {
      await recordOutcome({ taskId: blockId, title, date, status, source, at });
      const all = await listBlocks();
      const b = all.find((x) => x.id === blockId);
      if (b) {
        // `status` is the single field (a settled block can't also read as 쉼), and updateBlock
        // reconciles the alarm, so a settled block never keeps a live cue.
        await updateBlock({
          ...b,
          status: status === "done" ? "success" : "fail",
          completedAt: status === "done" ? at : undefined,
          updatedAt: Date.now(),
        });
      }
    },
    []
  );

  // R6 catch-up — three gentle paths, all no-guilt:
  //  (a) fired-but-not-done: a fire marker with no outcome → "아직 안 했죠".
  //  (b) native missed markers (boot/backup scans) → "놓쳤어요".
  //  (c) never-fired: a past flagged block that left NO marker (device off / not armed) → "놓쳤어요".
  // Unresolved past the window → auto-archived as `miss` (no guilt), then it drops out of the net.
  const CATCHUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // [TBD ~7 days], PRD R6
  const NEVER_FIRED_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
  const computeCatchUps = useCallback(async () => {
    const fires = await listFires();
    const misses = await listMisses();
    const outs = await listOutcomes();
    const allBlocks = await listBlocks();
    const now = Date.now();
    const resolved = (id: string, date: string) => outs.some((o) => o.taskId === id && o.date === date);

    const items: CatchUpItem[] = [];
    const seen = new Set<string>();
    const covered = new Set<string>(); // occurrences a marker or outcome already owns
    for (const o of outs) covered.add(`${o.taskId}|${o.date}`);

    // (a) fired-but-not-done.
    const remaining: FireRecord[] = [];
    for (const f of fires) {
      covered.add(`${f.taskId}|${f.date}`);
      if (resolved(f.taskId, f.date)) continue;
      if (now - f.firedAt > CATCHUP_WINDOW_MS) {
        await settle(f.taskId, f.date, f.title, "miss", "catch-up", now); // auto-archive
        continue;
      }
      remaining.push(f);
      const key = `${f.taskId}|${f.date}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ taskId: f.taskId, title: f.title, date: f.date, kind: "fired" });
      }
    }
    await setFires(remaining);

    // (b) native "never fired" markers from boot/backup scans.
    const remainingMisses: MissedRecord[] = [];
    for (const m of misses) {
      const key = `${m.taskId}|${m.date}`;
      covered.add(key);
      if (resolved(m.taskId, m.date)) continue;
      if (now - m.intended > CATCHUP_WINDOW_MS) {
        await settle(m.taskId, m.date, m.title, "miss", "catch-up", now);
        continue;
      }
      remainingMisses.push(m);
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ taskId: m.taskId, title: m.title, date: m.date, intended: m.intended, kind: "missed" });
      }
    }
    await setMisses(remainingMisses);

    // (c) never-fired blocks the markers can't see. Blocks the native mirror still holds with a past
    // fireAt are left to the WorkManager backup (it re-fires them, leaving a marker) — not claimed here.
    let armedPast = new Set<string>();
    try {
      armedPast = new Set(alarm.getScheduled().filter((a) => a.fireAt <= now).map((a) => a.id));
    } catch {
      // native unavailable (dev skew) — skip the never-fired reconstruction this pass
    }
    for (const b of pastUnfiredBlocks(allBlocks, armedPast, now - NEVER_FIRED_LOOKBACK_MS, now)) {
      const key = `${b.id}|${b.date}`;
      if (covered.has(key)) continue;
      const fireAt = blockFireAt(b)!;
      if (now - fireAt > CATCHUP_WINDOW_MS) {
        await settle(b.id, b.date, b.title, "miss", "catch-up", now); // older than the window → archive
        covered.add(key);
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ taskId: b.id, title: b.title, date: b.date, intended: fireAt, kind: "missed" });
    }

    items.sort((a, b) => (a.date < b.date ? 1 : -1)); // most recent first
    setCatchUps(items);
  }, [settle]);

  // §8 graceful-denial (R16): the lever dies **silently** if the OS denies any of the three grants it
  // needs — and POST_NOTIFICATIONS is one of them: the cue is delivered as a full-screen-intent
  // *notification*, and the native path swallows the SecurityException when it's missing. Checking only
  // exact-alarm + FSI left exactly the failure mode R16 exists to prevent. Never fail silently.
  const checkReadiness = useCallback(async () => {
    try {
      const exact = alarm.canScheduleExactAlarms();
      const fsi = alarm.canUseFullScreenIntent();
      const notif = await notificationPermissionGranted();
      // "다른 앱 위에 표시": without it the moment only takes over a LOCKED screen — while the phone is
      // in use the OS degrades it to a banner you have to tap, which is not the lever.
      const overlay = alarm.canDrawOverlays();
      setNeedsPerm(exact && fsi && notif && overlay ? null : { exact, fsi, notif, overlay });
    } catch {
      setNeedsPerm(null); // native not linked (dev skew) — don't block the app
    }
  }, []);

  // On open/resume: drain what the native moment recorded, recompute the catch-up net, re-arm alerts.
  const sync = useCallback(async () => {
    alarm.catchUp();
    await appendMisses(alarm.consumePendingMisses());
    for (const o of alarm.consumePendingOutcomes()) {
      await settle(o.taskId, o.date, o.title, o.status === "done" ? "done" : "miss", "execution-screen", o.at);
    }
    const fires = alarm.consumePendingFires();
    if (fires.length > 0) {
      // Stamp each fire with the block's creation time so the commit→fire gap is measurable (S2).
      const createdById = new Map((await listBlocks()).map((b) => [b.id, b.createdAt] as const));
      const enriched = fires.map((f) => ({ ...f, createdAt: createdById.get(f.taskId) }));
      await appendFires(enriched);
      await appendLatencies(enriched);
    }
    await computeCatchUps();
    await checkReadiness(); // §8/R16 permission banner
    // Self-healing (architecture §11 layer 4): re-derive every alarm from the repositories, so a
    // divergence from the native mirror (cleared data, restored backup, failed schedule, migration)
    // is corrected on app open instead of silently dropping — or ghosting — a cue.
    await rearmBlockAlarms();
    await rearmEventNotifications(await listEvents());
    load();
  }, [load, computeCatchUps, checkReadiness, settle]);

  // First-run gate (PRD §8): route to onboarding once (explain → request permissions) before home.
  useEffect(() => {
    (async () => {
      const seen = await AsyncStorage.getItem("lp.onboarded.v1");
      if (!seen) router.replace("/onboarding" as never);
    })();
  }, [router]);

  useEffect(() => {
    sync();
    const s = AppState.addEventListener("change", (st) => {
      if (st === "active") sync();
    });
    return () => s.remove();
  }, [sync]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const confirmDelete = (block: TimeBlock) => {
    Alert.alert("삭제할까요?", `${block.title} · ${block.start}`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          await deleteBlock(block.id); // the repository evicts the alarm → no ghost fire
          load();
        },
      },
    ]);
  };

  // "오늘은 쉼" (R7): the pre-fire, re-togglable skip — the ONLY intentional skip. A `skipped` outcome
  // (source `pre-skip`) makes it visible in history and keeps it out of the catch-up net; un-toggling
  // removes that record and re-arms the block, so nothing stale is left behind.
  const toggleSkip = async (block: TimeBlock) => {
    const skip = !isSkipped(block);
    if (skip) {
      await recordOutcome({ taskId: block.id, title: block.title, date: block.date, status: "skipped", source: "pre-skip", at: Date.now() });
    } else {
      await removeOutcome(block.id, block.date, "pre-skip");
    }
    // updateBlock re-arms / cancels the alarm for us (the repository owns that, architecture §9-2).
    await updateBlock({ ...block, status: skip ? "skipped" : "planned", updatedAt: Date.now() });
    load();
  };

  // Mark a today block done straight from its card (R6). Source is `catch-up`, not `execution-screen`,
  // so S1 (the lever's proof) keeps counting only what the execution moment itself produced.
  const markDone = async (block: TimeBlock) => {
    await settle(block.id, block.date, block.title, "done", "catch-up");
    const fires = await listFires();
    await setFires(fires.filter((x) => !(x.taskId === block.id && x.date === block.date)));
    setCatchUps((prev) => prev.filter((x) => !(x.taskId === block.id && x.date === block.date)));
    load();
  };

  // R6: resolve a catch-up occurrence, or dismiss for this session (re-shows on the next open).
  // On a miss we offer — never demand — a one-line reason (D5 needs it for R17; B1 forbids nagging for
  // it). The record is already closed by the time the field appears, so "그냥 닫기" is a real option and
  // costs nothing: an empty reason is a perfectly valid outcome.
  const resolveCatchUp = async (f: CatchUpItem, status: "done" | "miss") => {
    await settle(f.taskId, f.date, f.title, status, "catch-up");
    const fires = await listFires();
    await setFires(fires.filter((x) => !(x.taskId === f.taskId && x.date === f.date)));
    const misses = await listMisses();
    await setMisses(misses.filter((x) => !(x.taskId === f.taskId && x.date === f.date)));
    setCatchUps((prev) => prev.filter((x) => !(x.taskId === f.taskId && x.date === f.date)));
    if (status === "miss") setAskReason({ id: f.taskId, title: f.title });
    load();
  };

  /** Attach the optional reason to the block (D5 free text). Blank → nothing is written. */
  const saveReason = async () => {
    const text = reason.trim();
    if (askReason && text) {
      const b = (await listBlocks()).find((x) => x.id === askReason.id);
      if (b) await updateBlock({ ...b, failReason: text, updatedAt: Date.now() });
    }
    setAskReason(null);
    setReason("");
    load();
  };
  const dismissCatchUp = (f: CatchUpItem) => {
    setCatchUps((prev) => prev.filter((x) => !(x.taskId === f.taskId && x.date === f.date)));
  };

  const now = Date.now();
  const todayBlocks = blocksOn(blocks, today);
  const blockRows: Extract<HomeRow, { kind: "block" }>[] = todayBlocks.map((block) => ({
    kind: "block" as const,
    block,
    fireAt: blockFireAt(block),
    started: blockStartAt(block) <= now,
  }));

  // The hero = the next block still ahead today (a flagged one wins ties by being earlier anyway).
  const hero = blockRows.find((r) => !r.started && !isSkipped(r.block)) ?? null;

  // Blocks whose moment fired and got no answer ("아직" at the re-check). The card must be able to SAY so:
  // its state is neither "done" nor "missed" but **still open**, and the app owes the user that word — the
  // alternative is a card that shows nothing and lets the user guess (which is how "해냄" got read as a
  // verdict). It is stated in taupe, never red: an unanswered block is neutral data (R14).
  const awaiting = new Set(catchUps.map((c) => `${c.taskId}|${c.date}`));

  const historyRows: HomeRow[] = outcomes.slice(0, 12).map((outcome) => ({ kind: "history", outcome }));
  const rows: HomeRow[] = [
    ...(blockRows.length > 0 ? [{ kind: "section" as const, title: "오늘" }, ...blockRows] : []),
    ...(historyRows.length > 0 ? [{ kind: "section" as const, title: "지난 기록" }, ...historyRows] : []),
  ];

  const d = new Date();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      {/* top bar — date + settings */}
      <View className="flex-row items-baseline justify-between px-5 pt-4 pb-1">
        <Text className="text-ink" style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.4 }}>
          {d.getMonth() + 1}월 {d.getDate()}일{" "}
          <Text className="text-grey" style={{ fontSize: 15, fontWeight: "600" }}>
            {WD[d.getDay()]}
          </Text>
        </Text>
        <Link href="/settings" asChild>
          <Pressable hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
            <Text className="text-grey" style={{ fontSize: 14, fontWeight: "600" }}>
              설정
            </Text>
          </Pressable>
        </Link>
      </View>

      {/* §8 graceful-denial banner — never fail silently when the OS blocks the lever. */}
      {needsPerm && (
        <Pressable
          onPress={() =>
            // send the user to whichever grant is actually missing
            !needsPerm.notif
              ? alarm.openAppNotificationSettings()
              : !needsPerm.exact
                ? alarm.openExactAlarmSettings()
                : !needsPerm.fsi
                  ? alarm.openFullScreenIntentSettings()
                  : alarm.openOverlaySettings()
          }
          className="mx-5 rounded-card px-4 py-3 mt-2 flex-row items-center justify-between"
          style={{ backgroundColor: "#FBEEEA" }}
        >
          <View className="flex-1 pr-3">
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#B5533C" }}>
              {needsPerm.exact && needsPerm.fsi && needsPerm.notif
                ? "화면을 켜고 쓰는 중엔 실행 화면이 안 떠요"
                : "실행 알림이 잠금화면을 못 뚫어요"}
            </Text>
            <Text className="mt-0.5" style={{ fontSize: 12, color: "#B5533C" }}>
              {needsPerm.exact && needsPerm.fsi && needsPerm.notif
                ? "'다른 앱 위에 표시'를 켜야 그 시각에 바로 떠요."
                : "정한 시각에 화면을 띄우려면 권한을 켜야 해요."}
            </Text>
          </View>
          <View className="rounded-full px-3.5 py-1.5" style={{ backgroundColor: "#B5533C" }}>
            <Text className="text-white" style={{ fontSize: 12, fontWeight: "700" }}>
              켜기
            </Text>
          </View>
        </Pressable>
      )}

      {loading ? (
        <Text className="text-grey text-center mt-10">불러오는 중…</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row, i) =>
            row.kind === "block"
              ? `b-${row.block.id}`
              : row.kind === "history"
                ? `h-${row.outcome.taskId}-${row.outcome.date}-${i}`
                : `s-${row.title}`
          }
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 104 }}
          ItemSeparatorComponent={({ leadingItem }) => (
            <View style={{ height: leadingItem?.kind === "history" ? 0 : 8 }} />
          )}
          ListHeaderComponent={
            <View>
              {/* Optional fail reason (D5) — offered, never demanded (B1). The miss is ALREADY recorded;
                  this only adds a note for 돌아보기, and closing without one is a first-class choice. */}
              {askReason && (
                <View className="bg-group rounded-card px-4 py-3.5 mb-2 mt-3">
                  <Text className="text-ink" style={{ fontSize: 14, fontWeight: "700" }}>
                    {askReason.title} — 왜 못 했는지 한 줄 남길까요?
                  </Text>
                  <Text className="text-grey mt-0.5" style={{ fontSize: 12 }}>
                    안 남겨도 괜찮아요. 나중에 나에게 힌트가 될 뿐이에요.
                  </Text>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder="예: 야근, 너무 피곤함"
                    placeholderTextColor="#B0B8C1"
                    className="bg-surface text-ink mt-2.5"
                    style={{ fontSize: 14, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}
                  />
                  <View className="flex-row items-center mt-2.5" style={{ gap: 14 }}>
                    <Pressable
                      onPress={saveReason}
                      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                      className="bg-brand rounded-full px-4 py-1.5"
                    >
                      <Text className="text-white" style={{ fontSize: 12, fontWeight: "700" }}>
                        남기기
                      </Text>
                    </Pressable>
                    {/* "그냥 닫기" is a FIRST-CLASS answer, so it must LOOK like one (founder): a faint
                        text link reads as "you really should write something", and that friction is
                        exactly what makes people quietly stop using an app (C2/B1). */}
                    <Pressable
                      onPress={() => {
                        setAskReason(null);
                        setReason("");
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                      className="bg-surface rounded-full px-4 py-1.5"
                      style={{ borderWidth: 1, borderColor: "#E5E8EB" }}
                    >
                      <Text className="text-ink-soft" style={{ fontSize: 12, fontWeight: "700" }}>
                        그냥 닫기
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* R6 catch-up prompts */}
              {catchUps.map((f, i) => (
                <View key={i} className="bg-brand-soft rounded-card px-4 py-3.5 mb-2 mt-3">
                  <Text className="text-ink" style={{ fontSize: 14, fontWeight: "700" }}>
                    {f.kind === "missed" ? `${f.title} 놓쳤어요` : `${f.title}, 아직 안 했죠`}
                  </Text>
                  <Text className="text-ink-soft mt-0.5" style={{ fontSize: 12 }}>
                    {f.date} · {f.kind === "missed" ? "지금이라도?" : "지금 할까요?"}
                  </Text>
                  {/* Three answers, and only two words may mean "later" — or the user picks the wrong one.
                      This button used to say **미룸** ("postponed") while it permanently and irreversibly
                      recorded a **miss**. Next to it sat **나중에**, which really does just defer. Two
                      buttons that both read as "I'll do it later", doing opposite things: the founder
                      pressed 미룸 meaning "defer" and the app heard "I failed". The word now matches the
                      deed — **안 했어**, the same phrase the execution moment uses — so a miss is only ever
                      recorded by someone who said they missed it. Wide gap + hitSlop: 했어/안 했어 are
                      opposite and non-undoable, so a mis-tap must not log a false outcome (≥48dp, A3). */}
                  <View className="flex-row items-center mt-2.5" style={{ gap: 14 }}>
                    <Pressable
                      onPress={() => resolveCatchUp(f, "done")}
                      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                      className="bg-brand rounded-full px-4 py-1.5"
                    >
                      <Text className="text-white" style={{ fontSize: 12, fontWeight: "700" }}>
                        했어
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => resolveCatchUp(f, "miss")}
                      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                      className="bg-group rounded-full px-4 py-1.5"
                    >
                      <Text className="text-ink-soft" style={{ fontSize: 12 }}>
                        안 했어
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => dismissCatchUp(f)}
                      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                      className="px-3 py-1.5"
                    >
                      <Text className="text-faint" style={{ fontSize: 12 }}>
                        나중에
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}

              {/* next-execution hero */}
              {hero && (
                <Pressable
                  onPress={() => router.push({ pathname: "/add-block", params: { id: hero.block.id } })}
                  onLongPress={() => confirmDelete(hero.block)}
                  className="bg-brand-soft rounded-card mt-3"
                  style={{ padding: 18 }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-brand" style={{ fontSize: 12, fontWeight: "700" }}>
                      {hero.block.alert === "execution" ? "다음 실행" : "다음 블록"}
                    </Text>
                    {hero.block.kind !== "normal" && (
                      <View className="bg-surface rounded-full px-2.5 py-1">
                        <Text className="text-brand" style={{ fontSize: 11, fontWeight: "700" }}>
                          {hero.block.kind === "workout" ? "운동" : "러닝"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-ink" style={{ fontSize: 30, fontWeight: "800", letterSpacing: -0.8, marginTop: 6 }}>
                    {hero.block.start}
                    <Text style={{ fontSize: 19, fontWeight: "700" }}>  {hero.block.title}</Text>
                  </Text>
                  <Text className="text-ink-soft" style={{ fontSize: 12.5, marginTop: 6 }}>
                    {hero.block.alert === "execution" ? (
                      <>
                        <Text style={{ fontWeight: "700" }}>{relLabel(hero.fireAt)}</Text>
                        {hero.block.alarmLeadMinutes > 0
                          ? ` · ${hero.block.alarmLeadMinutes}분 전 잠금화면 큐`
                          : " · 잠금화면 큐"}
                      </>
                    ) : (
                      "알림만 · 전체화면 없음"
                    )}
                  </Text>
                </Pressable>
              )}

              {/* D-1 planning nudge (S3 — the biggest adoption risk is never designing tomorrow) */}
              <Pressable
                onPress={() => router.push({ pathname: "/day", params: { date: shiftYmd(today, 1) } })}
                className="bg-group rounded-card mt-2 flex-row items-center justify-between"
                style={{ paddingHorizontal: 16, paddingVertical: 13 }}
              >
                <Text className="text-ink" style={{ fontSize: 14, fontWeight: "700" }}>
                  내일 하루 설계하기
                </Text>
                <Text className="text-grey" style={{ fontSize: 18, fontWeight: "700" }}>
                  ›
                </Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            if (item.kind === "section") {
              return (
                <Text className="text-ink px-1 mt-6 mb-2" style={{ fontSize: 15, fontWeight: "800" }}>
                  {item.title}
                </Text>
              );
            }
            if (item.kind === "history") {
              const o = item.outcome;
              return (
                <View className="flex-row items-center px-1" style={{ paddingVertical: 9 }}>
                  <BlockIcon kind={iconOf(o.title || "")} />
                  <View className="flex-1" style={{ marginLeft: 11 }}>
                    <Text className="text-ink" style={{ fontSize: 15, fontWeight: "700", letterSpacing: -0.2 }}>
                      {o.title || "실행"}
                    </Text>
                    <Text className="text-grey mt-0.5" style={{ fontSize: 12 }}>
                      {relDay(o.date)} {hmFromMs(o.at)}
                    </Text>
                  </View>
                  <OutcomeBadge status={o.status} />
                </View>
              );
            }

            // today's block card
            const b = item.block;
            const settled = b.status === "success" || b.status === "fail";
            const skipped = isSkipped(b);
            return (
              <Pressable
                onPress={() => router.push({ pathname: "/add-block", params: { id: b.id } })}
                onLongPress={() => confirmDelete(b)}
                className="bg-group rounded-card flex-row items-center"
                style={{ padding: 14, opacity: skipped || settled ? 0.6 : 1 }}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-ink" style={{ fontSize: 15.5, fontWeight: "700", letterSpacing: -0.2 }}>
                    {b.title}
                  </Text>
                  <Text className="text-grey mt-0.5" style={{ fontSize: 12.5 }}>
                    {b.start}
                    {b.end ? `–${b.end}` : ""}
                    {skipped ? " · 오늘은 쉼" : b.alert === "execution" ? " · 실행 알림" : " · 알림"}
                    {b.location ? ` · ${b.location}` : ""}
                  </Text>
                  {awaiting.has(`${b.id}|${b.date}`) && !settled && (
                    <Text className="text-miss mt-1" style={{ fontSize: 12.5, fontWeight: "600" }}>
                      아직 안 했어요
                    </Text>
                  )}
                </View>
                {settled ? (
                  <OutcomeBadge status={b.status === "success" ? "done" : "miss"} />
                ) : item.started ? (
                  // The moment has passed → OFFER to record it, never nag. This must not be mistaken for a
                  // *state*: it used to be a filled pill reading "해냄" (a noun) sitting exactly where the
                  // settled badges 됨/미스 sit, so an unanswered block looked like the app had decided you
                  // did it. That silently corrupts S1 — the founder read it as "the app says I did it" and
                  // moved on. It is now an outlined button in the first person ("했어요"), which reads as an
                  // answer you give, not a verdict you receive.
                  <Pressable
                    onPress={() => markDone(b)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="rounded-full px-3.5 py-1.5"
                    style={{ borderWidth: 1.5, borderColor: "#3182F6", backgroundColor: "transparent" }}
                  >
                    <Text className="text-brand" style={{ fontSize: 12, fontWeight: "700" }}>
                      했어요
                    </Text>
                  </Pressable>
                ) : (
                  // before the moment → the "오늘은 쉼" toggle (the only intentional skip, R7)
                  <Switch
                    value={!skipped}

                    onValueChange={() => toggleSkip(b)}
                    trackColor={{ true: "#3182F6", false: "#E5E8EB" }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="#E5E8EB"
                  />
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text className="text-grey text-center mt-16" style={{ fontSize: 14 }}>
              오늘의 첫 블록을 놓아보자
            </Text>
          }
        />
      )}

      {/* pinned primary action */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 18, paddingHorizontal: 20 }}>
        <Link href={{ pathname: "/add-block", params: { date: today } }} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="블록 추가"
            className="bg-brand items-center"
            style={{ borderRadius: 15, paddingVertical: 16, elevation: 4 }}
          >
            <Text className="text-white" style={{ fontSize: 16, fontWeight: "700" }}>
              ＋ 블록 추가
            </Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

// History rows only carry a denormalized title (they outlive the block), so the icon is inferred.
const iconOf = (title: string): IconKind => {
  if (/헬스|운동|웨이트|근력|짐|gym|workout|리프트/i.test(title)) return "workout";
  if (/러닝|런닝|달리기|조깅|마라톤|산책|run|jog|walk/i.test(title)) return "run";
  return "normal";
};

function OutcomeBadge({ status }: { status: OutcomeRecord["status"] }) {
  if (status === "done") {
    return (
      <View className="bg-gold-soft rounded-full px-3 py-1">
        <Text className="text-gold" style={{ fontSize: 12, fontWeight: "700" }}>
          됨
        </Text>
      </View>
    );
  }
  if (status === "skipped") {
    return (
      <View className="bg-group rounded-full px-3 py-1">
        <Text className="text-faint" style={{ fontSize: 12, fontWeight: "600" }}>
          쉼
        </Text>
      </View>
    );
  }
  return (
    <View className="bg-miss-soft rounded-full px-3 py-1">
      <Text className="text-miss" style={{ fontSize: 12, fontWeight: "700" }}>
        미스
      </Text>
    </View>
  );
}

function BlockIcon({ kind }: { kind: IconKind }) {
  return (
    <View className="bg-brand-soft items-center justify-center" style={{ width: 38, height: 38, borderRadius: 11 }}>
      <Svg width={19} height={19} viewBox="0 0 24 24">
        {kind === "workout" ? (
          <Path
            d="M4 9v6M20 9v6M7 7v10M17 7v10M7 12h10"
            stroke="#3182F6"
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : kind === "run" ? (
          <>
            <Path
              d="M13 4l-1.5 4 3 2-1 4M6 20l3-6M18 14l-4-1"
              stroke="#3182F6"
              strokeWidth={1.8}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle cx={15} cy={5} r={1.4} stroke="#3182F6" strokeWidth={1.8} fill="none" />
          </>
        ) : (
          <>
            <Circle cx={12} cy={12} r={7} stroke="#3182F6" strokeWidth={1.8} fill="none" />
            <Path d="M12 8v4l2.5 1.5" stroke="#3182F6" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </Svg>
    </View>
  );
}
