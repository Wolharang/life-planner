// A scroll-snap wheel column (like a native date spinner): items snap to a fixed row height, the row at the
// centre band is the selection, and it bolds live as you scroll. No dependency — just a snapping ScrollView.
// Reused by the 정기구독 schedule picker (D98) and mirrors the calendar's inline month/year wheels.
import { ScrollView, View, Text } from "react-native";
import { useEffect, useRef } from "react";

export function Wheel<T extends string | number>({
  data,
  value,
  onChange,
  format,
  itemHeight = 44,
  rows = 5,
  width,
}: {
  data: T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
  itemHeight?: number;
  rows?: number; // odd, so one row sits dead-centre
  width?: number | string;
}) {
  const ref = useRef<ScrollView>(null);
  const inited = useRef(false);
  const scrolling = useRef(false); // true while the user is actively dragging this wheel
  const index = Math.max(0, data.indexOf(value));
  const settle = (y: number) => {
    const i = Math.min(Math.max(Math.round(y / itemHeight), 0), data.length - 1);
    if (data[i] !== value) onChange(data[i]);
  };
  // Keep the centred row in sync when `value` changes from OUTSIDE (the sheet re-seeds on open, or the sibling
  // frequency wheel swaps this wheel's data). Skip while the user is dragging, so we never fight an active scroll —
  // their own settle() already lands the right row. Without this the wheel could bold a row that isn't selected.
  useEffect(() => {
    if (scrolling.current) return;
    ref.current?.scrollTo({ y: Math.max(0, data.indexOf(value)) * itemHeight, animated: false });
  }, [value, data, itemHeight]);
  return (
    <View style={{ width: width as never, height: itemHeight * rows }}>
      <ScrollView
        ref={ref}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onLayout={() => {
          if (!inited.current) {
            inited.current = true;
            ref.current?.scrollTo({ y: index * itemHeight, animated: false });
          }
        }}
        onScrollBeginDrag={() => (scrolling.current = true)}
        onScroll={(e) => settle(e.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={(e) => {
          scrolling.current = false;
          settle(e.nativeEvent.contentOffset.y);
        }}
        contentContainerStyle={{ paddingVertical: (itemHeight * (rows - 1)) / 2 }}
      >
        {data.map((v) => (
          <View key={String(v)} style={{ height: itemHeight, alignItems: "center", justifyContent: "center" }}>
            <Text
              style={{
                fontSize: v === value ? 20 : 16,
                fontWeight: v === value ? "800" : "500",
                color: v === value ? "#191F28" : "#C4CBD4",
              }}
            >
              {format(v)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
