// Home = 오늘 (할 일 목록, PRD R1). Real tasks from the local store; tap ＋ to add. Creating a task
// schedules its exact alarm (taskScheduler); long-press → delete cancels it (no ghost fire — R1).
//
// v5 skin round #2 (PROVISIONAL, iterating) — matches the reference mockup: date header · next-execution
// hero · 오늘 = grey cards with a switch · 지난 기록 = icon + relative time + 됨/미스 badge. Logic
// UNCHANGED from the wired version (catch-up net R6, permission banner §8, real repositories). The 오늘
// switch IS the R1 "오늘은 쉼" toggle (ON = 대기/armed today, OFF = 쉼) — not an alarm on/off switch.

import { View, Text, Pressable, FlatList, Alert, AppState, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listTasks, deleteTask, updateTask, type Task } from "@/core/data/taskRepository";
import {
  unscheduleTask,
  scheduleTask,
  todayYmd,
  pastOccurrenceFires,
  nextEffectiveFireAt,
  occurrenceDateForFire,
} from "@/core/schedule/taskScheduler";
import { recordOutcome, removeOutcome, listOutcomes, type OutcomeRecord } from "@/core/data/outcomeRepository";
import { listFires, setFires, appendFires, type FireRecord } from "@/core/data/firedRepository";
import { listMisses, setMisses, appendMisses, type MissedRecord } from "@/core/data/missedRepository";
import { appendLatencies } from "@/core/data/latencyRepository";
import { scheduleReminders, cancelReminders } from "@/core/notifications/plainReminders";
import { alarm } from "@/core/notifications/alarm";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

const recurrenceLabel = (r: Task["recurrence"]) =>
  r === "daily" ? "매일" : r === "weekly" ? "매주" : "한 번";

const pad2 = (n: number) => String(n).padStart(2, "0");

const hmFromMs = (ms: number) => {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const dateFromMs = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

// Relative day for the 지난 기록 log ("오늘 / 어제 / N일 전"), from the occurrence date.
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

// The Task model carries no explicit kind, so the log icon is inferred from the title (workout / run),
// with a neutral fallback — purely cosmetic, never affects logic. [follow-up: a real Task.kind field]
type IconKind = "workout" | "run" | "generic";
const iconKind = (title: string): IconKind => {
  if (/헬스|운동|웨이트|근력|짐|gym|workout|리프트/i.test(title)) return "workout";
  if (/러닝|런닝|달리기|조깅|마라톤|산책|run|jog|walk/i.test(title)) return "run";
  return "generic";
};

type HomeRow =
  | { kind: "section"; title: string }
  | { kind: "upcoming"; task: Task; fireAt: number | null; date: string; time: string; skipped: boolean }
  | { kind: "history"; outcome: OutcomeRecord };

// A gentle catch-up prompt (R6). `kind` decides the copy: an occurrence whose intervention NEVER fired
// (device off / alarm not armed → no fire marker) uses "놓쳤어요"; one that fired but was deferred
// ("아직"/timeout → has a fire marker) uses "아직 안 했죠". (PRD R6; impl-plan Phase 4.)
type CatchUpItem = {
  taskId: string;
  title: string;
  date: string;
  intended?: number;
  kind: "fired" | "missed";
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeRecord[]>([]);
  const [catchUps, setCatchUps] = useState<CatchUpItem[]>([]);
  const [needsPerm, setNeedsPerm] = useState<{ exact: boolean; fsi: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setTasks(await listTasks());
    setOutcomes((await listOutcomes()).slice().reverse()); // most recent first
    setLoading(false);
  }, []);

  const router = useRouter();

  // R6 catch-up — two both-gentle paths (PRD R6; impl-plan Phase 4):
  //  (a) fired-but-not-done: a fire marker with no outcome for its date → "아직 안 했죠".
  //  (b) never-fired: a recurring occurrence that should have fired but left NO marker (device off /
  //      alarm not armed), derived from the task's recurrence → "놓쳤어요".
  // Unresolved past the window → auto-archived as `miss` (no guilt), then it drops out of the net.
  const CATCHUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // [TBD ~7 days], PRD R6
  const NEVER_FIRED_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000; // how far back to reconstruct never-fired
  const computeCatchUps = useCallback(async () => {
    const fires = await listFires();
    const misses = await listMisses();
    const outs = await listOutcomes();
    const allTasks = await listTasks();
    const now = Date.now();
    const resolved = (taskId: string, date: string) =>
      outs.some((o) => o.taskId === taskId && o.date === date);

    const items: CatchUpItem[] = [];
    const seen = new Set<string>();
    // Occurrences already accounted for (have an outcome OR a fire marker) — so the never-fired
    // reconstruction never double-counts one the marker path already owns.
    const covered = new Set<string>();
    for (const o of outs) covered.add(`${o.taskId}|${o.date}`);

    // (a) fired-but-not-done, from the fire markers.
    const remaining: FireRecord[] = [];
    for (const f of fires) {
      covered.add(`${f.taskId}|${f.date}`);
      if (resolved(f.taskId, f.date)) continue; // done/miss/skip already recorded → out of the net
      if (now - f.firedAt > CATCHUP_WINDOW_MS) {
        await recordOutcome({ taskId: f.taskId, title: f.title, date: f.date, status: "miss", source: "catch-up", at: now });
        continue; // auto-archive
      }
      remaining.push(f);
      const key = `${f.taskId}|${f.date}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ taskId: f.taskId, title: f.title, date: f.date, kind: "fired" });
      }
    }
    await setFires(remaining);

    // Native backup/boot scans record "never fired" misses here. They remain until resolved or
    // auto-archived, so dismissing a prompt re-shows it on a later app open (R6).
    const remainingMisses: MissedRecord[] = [];
    for (const m of misses) {
      if (resolved(m.taskId, m.date)) {
        covered.add(`${m.taskId}|${m.date}`);
        continue;
      }
      const key = `${m.taskId}|${m.date}`;
      covered.add(key);
      if (now - m.intended > CATCHUP_WINDOW_MS) {
        await recordOutcome({ taskId: m.taskId, title: m.title, date: m.date, status: "miss", source: "catch-up", at: now });
        continue;
      }
      remainingMisses.push(m);
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ taskId: m.taskId, title: m.title, date: m.date, intended: m.intended, kind: "missed" });
      }
    }
    await setMisses(remainingMisses);

    // (b) never-fired: reconstruct past occurrences that left no marker (device off / not armed),
    // anchored on the native mirror's armed fireAt (the true occurrence series/weekday). A task whose
    // mirror fireAt is already PAST is left to the WorkManager backup (it will re-fire, leaving a
    // marker); JS only owns tasks the native path advanced past (e.g. a reboot after a device-off miss).
    let armed: { id: string; fireAt: number }[] = [];
    try {
      armed = alarm.getScheduled();
    } catch {
      // native unavailable (dev skew) — skip never-fired reconstruction this pass
    }
    const armedFireAt = new Map(armed.map((a) => [a.id, a.fireAt]));
    for (const t of allTasks) {
      const anchor = armedFireAt.get(t.id);
      if (anchor == null || anchor <= now) continue; // not armed, or native will re-fire it
      for (const occ of pastOccurrenceFires(t, anchor, now - NEVER_FIRED_LOOKBACK_MS, now)) {
        const key = `${t.id}|${occ.date}`;
        if (covered.has(key)) continue; // fired or already resolved
        if (now - occ.effectiveTime > CATCHUP_WINDOW_MS) {
          await recordOutcome({ taskId: t.id, title: t.title, date: occ.date, status: "miss", source: "catch-up", at: now });
          covered.add(key);
          continue; // older than the surface window → auto-archive as miss (honesty net)
        }
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({ taskId: t.id, title: t.title, date: occ.date, intended: occ.effectiveTime, kind: "missed" });
      }
    }

    items.sort((a, b) => (a.date < b.date ? 1 : -1)); // most recent occurrence first
    setCatchUps(items);
  }, []);

  // §8 graceful-denial: the lever dies silently if the OS denies exact-alarm / full-screen-intent.
  // Surface a persistent, gentle home banner (never fail silently) with one tap to the right setting.
  const checkReadiness = useCallback(() => {
    try {
      const exact = alarm.canScheduleExactAlarms();
      const fsi = alarm.canUseFullScreenIntent();
      setNeedsPerm(exact && fsi ? null : { exact, fsi });
    } catch {
      setNeedsPerm(null); // native not linked (dev skew) — don't block the app
    }
  }, []);

  // On open/resume: drain what the native moment recorded (outcomes + fire markers), recompute the
  // catch-up net, and re-fire anything the OS dropped while away (WorkManager one-shot).
  const sync = useCallback(async () => {
    alarm.catchUp();
    await appendMisses(alarm.consumePendingMisses());
    for (const o of alarm.consumePendingOutcomes()) {
      await recordOutcome({
        taskId: o.taskId,
        title: o.title,
        date: o.date,
        status: o.status === "done" ? "done" : "miss",
        source: "execution-screen",
        at: o.at,
      });
    }
    const fires = alarm.consumePendingFires();
    if (fires.length > 0) {
      // Stamp each fire with the task's creation time so the PRD §10 commit→fire gap is measurable
      // (flag last-minute-created occurrences in S2). Read from the JS store at drain time — the task
      // usually still exists moments after firing; absent (deleted) → gap simply unknown for that row.
      const createdById = new Map((await listTasks()).map((t) => [t.id, t.createdAt] as const));
      const enriched = fires.map((f) => ({ ...f, createdAt: createdById.get(f.taskId) }));
      await appendFires(enriched);
      await appendLatencies(enriched); // S1 latency + §10 commit→fire gap (never pruned)
    }
    await computeCatchUps();
    checkReadiness(); // §8 permission banner
    for (const t of await listTasks()) await scheduleReminders(t); // keep recurring plain reminders rolling
    load();
  }, [load, computeCatchUps, checkReadiness]);

  // First-run gate (PRD §8): route to onboarding once (explain → request permissions) before home.
  // `as never`: expo-router's generated route types (.expo/types) don't list /onboarding until the next
  // `expo start`/`prebuild` regenerates them; the route file exists, so the navigation is valid.
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

  // Reload whenever the screen regains focus (e.g. returning from 할 일 추가).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const confirmDelete = (task: Task) => {
    Alert.alert("삭제할까요?", `${task.title} · ${task.setTime}`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          unscheduleTask(task.id); // cancel the alarm first → no ghost fire
          await cancelReminders(task.id);
          await deleteTask(task.id);
          load();
        },
      },
    ]);
  };

  // "오늘은 쉼" (R1 v0.5): pre-skip today's occurrence (re-togglable) → re-arm to the next non-skipped
  // date. Recording a `skipped` outcome (source `pre-skip`) makes the skip visible in history (R1) and
  // keeps it out of the catch-up net; un-toggling removes it so a re-armed occurrence carries no stale mark.
  const toggleSkip = async (task: Task, date: string = todayYmd()) => {
    const set = new Set(task.skippedDates ?? []);
    if (set.has(date)) {
      set.delete(date);
      await removeOutcome(task.id, date, "pre-skip");
    } else {
      set.add(date);
      await recordOutcome({ taskId: task.id, title: task.title, date, status: "skipped", source: "pre-skip", at: Date.now() });
    }
    const updated: Task = { ...task, skippedDates: [...set] };
    await updateTask(updated);
    scheduleTask(updated);
    load();
  };

  // R6: resolve a catch-up occurrence (source = catch-up), or dismiss for this session (re-shows next open).
  const resolveCatchUp = async (f: CatchUpItem, status: "done" | "miss") => {
    await recordOutcome({ taskId: f.taskId, title: f.title, date: f.date, status, source: "catch-up", at: Date.now() });
    const fires = await listFires(); // clear any fire marker (no-op for the never-fired kind)
    await setFires(fires.filter((x) => !(x.taskId === f.taskId && x.date === f.date)));
    const misses = await listMisses();
    await setMisses(misses.filter((x) => !(x.taskId === f.taskId && x.date === f.date)));
    setCatchUps((prev) => prev.filter((x) => !(x.taskId === f.taskId && x.date === f.date)));
    load();
  };
  const dismissCatchUp = (f: CatchUpItem) => {
    setCatchUps((prev) => prev.filter((x) => !(x.taskId === f.taskId && x.date === f.date)));
  };

  const upcomingRows: Extract<HomeRow, { kind: "upcoming" }>[] = tasks
    .map((task) => {
      const fireAt = task.executionAlarm ? nextEffectiveFireAt(task) : null;
      const occurrenceDate = fireAt ? occurrenceDateForFire(fireAt, task.leadMinutes) : null;
      const skipped = occurrenceDate ? (task.skippedDates ?? []).includes(occurrenceDate) : false;
      const displayAt = fireAt ?? (() => {
        const [h, m] = task.setTime.split(":").map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        if (task.recurrence !== "none" && d.getTime() <= Date.now()) d.setDate(d.getDate() + (task.recurrence === "weekly" ? 7 : 1));
        return d.getTime();
      })();
      return {
        kind: "upcoming" as const,
        task,
        fireAt,
        date: occurrenceDate ?? dateFromMs(displayAt),
        time: task.executionAlarm ? hmFromMs(displayAt) : task.setTime,
        skipped,
      };
    })
    .sort((a, b) => (a.fireAt ?? Number.MAX_SAFE_INTEGER) - (b.fireAt ?? Number.MAX_SAFE_INTEGER));

  // The nearest execution is echoed as the hero card; the full 오늘 list still shows every task.
  const hero = upcomingRows[0] ?? null;

  const historyRows: HomeRow[] = outcomes.slice(0, 12).map((outcome) => ({ kind: "history", outcome }));
  const rows: HomeRow[] =
    tasks.length === 0 && outcomes.length === 0
      ? []
      : [
          ...(upcomingRows.length > 0 ? [{ kind: "section" as const, title: "오늘" }, ...upcomingRows] : []),
          ...(historyRows.length > 0 ? [{ kind: "section" as const, title: "지난 기록" }, ...historyRows] : []),
        ];

  const now = new Date();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      {/* top bar — date + settings */}
      <View className="flex-row items-baseline justify-between px-5 pt-4 pb-1">
        <Text className="text-ink" style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.4 }}>
          {now.getMonth() + 1}월 {now.getDate()}일{" "}
          <Text className="text-grey" style={{ fontSize: 15, fontWeight: "600" }}>
            {WD[now.getDay()]}
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
            needsPerm.exact ? alarm.openFullScreenIntentSettings() : alarm.openExactAlarmSettings()
          }
          className="mx-5 rounded-card px-4 py-3 mt-2 flex-row items-center justify-between"
          style={{ backgroundColor: "#FBEEEA" }}
        >
          <View className="flex-1 pr-3">
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#B5533C" }}>
              실행 알림이 잠금화면을 못 뚫어요
            </Text>
            <Text className="mt-0.5" style={{ fontSize: 12, color: "#B5533C" }}>
              정한 시각에 화면을 띄우려면 권한을 켜야 해요.
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
            row.kind === "upcoming"
              ? `u-${row.task.id}`
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
              {/* R6 catch-up prompts */}
              {catchUps.map((f, i) => (
                <View key={i} className="bg-brand-soft rounded-card px-4 py-3.5 mb-2 mt-3">
                  <Text className="text-ink" style={{ fontSize: 14, fontWeight: "700" }}>
                    {f.kind === "missed" ? `${f.title} 놓쳤어요` : `${f.title}, 아직 안 했죠`}
                  </Text>
                  <Text className="text-ink-soft mt-0.5" style={{ fontSize: 12 }}>
                    {f.date} · {f.kind === "missed" ? "지금이라도?" : "지금 할까요?"}
                  </Text>
                  {/* 했어/미룸 are opposite, non-undoable outcomes → wider gap + hitSlop so a mis-tap
                      can't silently log a false miss (no-guilt, R7); ≥48dp effective target (A3). */}
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
                        미룸
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
                  onPress={() => router.push({ pathname: "/add", params: { id: hero.task.id } })}
                  onLongPress={() => confirmDelete(hero.task)}
                  className="bg-brand-soft rounded-card mt-3"
                  style={{ padding: 18, opacity: hero.skipped ? 0.6 : 1 }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-brand" style={{ fontSize: 12, fontWeight: "700" }}>
                      다음 실행
                    </Text>
                    <View className="bg-surface rounded-full px-2.5 py-1">
                      <Text className="text-brand" style={{ fontSize: 11, fontWeight: "700" }}>
                        {recurrenceLabel(hero.task.recurrence)}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-ink" style={{ fontSize: 30, fontWeight: "800", letterSpacing: -0.8, marginTop: 6 }}>
                    {hero.time}
                    <Text style={{ fontSize: 19, fontWeight: "700" }}>  {hero.task.title}</Text>
                  </Text>
                  <Text className="text-ink-soft" style={{ fontSize: 12.5, marginTop: 6 }}>
                    {hero.task.executionAlarm ? (
                      <>
                        <Text style={{ fontWeight: "700" }}>{relLabel(hero.fireAt)}</Text>
                        {hero.task.leadMinutes > 0 ? ` · ${hero.task.leadMinutes}분 전 잠금화면 큐` : " · 잠금화면 큐"}
                        {hero.skipped ? " · 오늘은 쉼" : ""}
                      </>
                    ) : (
                      "실행 알림 꺼짐"
                    )}
                  </Text>
                </Pressable>
              )}
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
                  <TaskIcon kind={iconKind(o.title || "")} />
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
            // upcoming (오늘) — grey card with the R1 "오늘은 쉼" switch
            const task = item.task;
            const armedToday = task.executionAlarm && !item.skipped;
            return (
              <Pressable
                onPress={() => router.push({ pathname: "/add", params: { id: task.id } })}
                onLongPress={() => confirmDelete(task)}
                className="bg-group rounded-card flex-row items-center"
                style={{ padding: 14, opacity: item.skipped ? 0.6 : 1 }}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-ink" style={{ fontSize: 15.5, fontWeight: "700", letterSpacing: -0.2 }}>
                    {task.title}
                  </Text>
                  <Text className="text-grey mt-0.5" style={{ fontSize: 12.5 }}>
                    {item.time} · {recurrenceLabel(task.recurrence)}
                    {task.executionAlarm ? (item.skipped ? " · 오늘은 쉼" : "") : " · 알람 꺼짐"}
                  </Text>
                </View>
                <Switch
                  value={armedToday}
                  disabled={!task.executionAlarm}
                  onValueChange={() => toggleSkip(task, item.date)}
                  trackColor={{ true: "#3182F6", false: "#E5E8EB" }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#E5E8EB"
                />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            hero ? null : (
              <Text className="text-grey text-center mt-16" style={{ fontSize: 14 }}>
                첫 할 일을 정해보자
              </Text>
            )
          }
        />
      )}

      {/* pinned primary action */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 18, paddingHorizontal: 20 }}>
        <Link href="/add" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="할 일 추가"
            className="bg-brand items-center"
            style={{ borderRadius: 15, paddingVertical: 16, elevation: 4 }}
          >
            <Text className="text-white" style={{ fontSize: 16, fontWeight: "700" }}>
              ＋ 할 일 추가
            </Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

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

function TaskIcon({ kind }: { kind: IconKind }) {
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
