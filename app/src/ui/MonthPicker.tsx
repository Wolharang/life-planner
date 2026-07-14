// A month calendar you can open to reach **any** date — including one that is months away.
//
// The block editor offered a 21-day chip row and, in edit mode, a ‹ › that moved **one day at a time**. So a
// real appointment — 9월 2일 개강, 12월의 시험 — was effectively **unreachable**: you would have to tap the arrow
// eighty times. The calendar is the natural instrument for "a date far from now", and the app already *is* a
// calendar; it just never handed one to the editor.
//
// It supports the multi-date add (D37: N ticked dates = N independent blocks, never a repeat rule), so it is a
// multi-select by default; `single` collapses it to one.

import { View, Text, Pressable, Modal } from "react-native";
import { useState } from "react";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const BRAND = "#3182F6";

const pad = (n: number) => String(n).padStart(2, "0");
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

interface Props {
  visible: boolean;
  /** Currently chosen dates (YYYY-MM-DD). */
  value: string[];
  /** Only one date may be chosen (edit mode: a block belongs to exactly one day). */
  single?: boolean;
  /** The month to open on. */
  initial?: string;
  onChange: (dates: string[]) => void;
  onClose: () => void;
}

export function MonthPicker({ visible, value, single, initial, onChange, onClose }: Props) {
  const base = initial ?? value[0] ?? new Date().toISOString().slice(0, 10);
  const [by, bm] = base.split("-").map(Number);
  const [view, setView] = useState({ y: by, m: (bm || 1) - 1 });

  const first = new Date(view.y, view.m, 1);
  const lead = first.getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => key(view.y, view.m, i + 1)),
  ];

  const shift = (d: number) => {
    const n = new Date(view.y, view.m + d, 1);
    setView({ y: n.getFullYear(), m: n.getMonth() });
  };

  const toggle = (d: string) => {
    if (single) {
      onChange([d]);
      onClose();
      return;
    }
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  };

  const today = new Date();
  const todayKey = key(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(25,31,40,0.35)", justifyContent: "center", padding: 24 }}
      >
        {/* Stop the backdrop's press from closing when the sheet itself is touched. */}
        <Pressable onPress={() => {}} style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18 }}>
          <View className="flex-row items-center justify-between" style={{ marginBottom: 10 }}>
            <Pressable onPress={() => shift(-1)} hitSlop={12} className="px-2 py-1">
              <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700" }}>
                ‹
              </Text>
            </Pressable>
            <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
              {view.y}년 {view.m + 1}월
            </Text>
            <Pressable onPress={() => shift(1)} hitSlop={12} className="px-2 py-1">
              <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700" }}>
                ›
              </Text>
            </Pressable>
          </View>

          <View className="flex-row">
            {WD.map((w) => (
              <Text
                key={w}
                className="text-grey text-center"
                style={{ width: `${100 / 7}%`, fontSize: 11.5, fontWeight: "600", paddingBottom: 4 }}
              >
                {w}
              </Text>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {cells.map((c, i) => {
              if (!c) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
              const on = value.includes(c);
              const isToday = c === todayKey;
              return (
                <Pressable
                  key={c}
                  onPress={() => toggle(c)}
                  style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}
                >
                  <View
                    className="items-center justify-center"
                    style={{
                      flex: 1,
                      borderRadius: 999,
                      backgroundColor: on ? BRAND : "transparent",
                      borderWidth: !on && isToday ? 1.5 : 0,
                      borderColor: BRAND,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: on || isToday ? "700" : "500",
                        color: on ? "#FFFFFF" : "#191F28",
                      }}
                    >
                      {Number(c.slice(-2))}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {!single && (
            <Text className="text-grey" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 18 }}>
              {value.length > 1
                ? `${value.length}개의 날에 각각 하나씩 만들어요 (반복이 아니라 각각 따로예요)`
                : "여러 날을 눌러 한 번에 놓을 수 있어요"}
            </Text>
          )}

          <Pressable
            onPress={onClose}
            className="bg-brand items-center"
            style={{ borderRadius: 14, paddingVertical: 13, marginTop: 12 }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>
              {single ? "닫기" : "완료"}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
