// Modern line-style icons for the Logs surface (expense categories + meal types), replacing the old emoji
// glyphs. Same visual language as the app's other SVG art (the launch clock): a 24-viewBox, round-capped
// strokes, single parameterized colour. Each icon takes `size` + `color` so a caller can tint it to the
// category colour, white-on-selected, or a neutral ink.
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import type { ExpenseCategory, MealType } from "@/core/data/types";

type IconProps = { size?: number; color?: string; strokeWidth?: number };

const STROKE = (color: string, strokeWidth: number) =>
  ({ stroke: color, strokeWidth, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }) as const;

export function CategoryIcon({
  category,
  size = 22,
  color = "#4E5968",
  strokeWidth = 2,
}: { category: ExpenseCategory } & IconProps) {
  const p = STROKE(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {category === "주식" && (
        // rice bowl + steam
        <>
          <Path d="M4 11 H20 A8 8 0 0 1 4 11 Z" {...p} />
          <Path d="M9 6.4 q-1.1 -1.2 0 -2.4 q1.1 -1.2 0 -2.4" {...p} />
          <Path d="M15 6.4 q-1.1 -1.2 0 -2.4 q1.1 -1.2 0 -2.4" {...p} />
        </>
      )}
      {category === "간식" && (
        // cookie
        <>
          <Circle cx={12} cy={12} r={8} {...p} />
          <Circle cx={9.5} cy={10} r={1} fill={color} />
          <Circle cx={14} cy={11} r={1} fill={color} />
          <Circle cx={11} cy={15} r={1} fill={color} />
        </>
      )}
      {category === "문화생활" && (
        // play (media / culture)
        <>
          <Circle cx={12} cy={12} r={8.5} {...p} />
          <Path d="M10 8.5 L16 12 L10 15.5 Z" fill={color} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
        </>
      )}
      {category === "잡화소모" && (
        // shopping bag
        <>
          <Path d="M6 8 H18 L19 20 A1 1 0 0 1 18 21 H6 A1 1 0 0 1 5 20 Z" {...p} />
          <Path d="M9 8 V7 A3 3 0 0 1 15 7 V8" {...p} />
        </>
      )}
      {category === "이동통신" && (
        // smartphone
        <>
          <Rect x={7} y={3} width={10} height={18} rx={2.5} {...p} />
          <Line x1={10.5} y1={18} x2={13.5} y2={18} {...p} />
        </>
      )}
      {category === "대중교통비" && (
        // bus
        <>
          <Rect x={4} y={3} width={16} height={13} rx={2.5} {...p} />
          <Line x1={4} y1={9.5} x2={20} y2={9.5} {...p} />
          <Circle cx={8} cy={19} r={1.4} {...p} />
          <Circle cx={16} cy={19} r={1.4} {...p} />
        </>
      )}
      {category === "의료" && (
        // medical cross badge
        <>
          <Rect x={4} y={4} width={16} height={16} rx={4.5} {...p} />
          <Line x1={12} y1={9} x2={12} y2={15} {...p} />
          <Line x1={9} y1={12} x2={15} y2={12} {...p} />
        </>
      )}
      {category === "기타" && (
        // other (ellipsis)
        <>
          <Circle cx={6} cy={12} r={1.5} fill={color} />
          <Circle cx={12} cy={12} r={1.5} fill={color} />
          <Circle cx={18} cy={12} r={1.5} fill={color} />
        </>
      )}
      {category === "정기구독" && (
        // recurring (two arcs + arrowheads — a "repeats every month" glyph)
        <>
          <Path d="M5 12 A7 7 0 0 1 16.5 6.6" {...p} />
          <Path d="M13.5 6 L16.8 6.6 L16.2 9.9" {...p} />
          <Path d="M19 12 A7 7 0 0 1 7.5 17.4" {...p} />
          <Path d="M10.5 18 L7.2 17.4 L7.8 14.1" {...p} />
        </>
      )}
    </Svg>
  );
}

export function MealIcon({ meal, size = 22, color = "#4E5968", strokeWidth = 2 }: { meal: MealType } & IconProps) {
  const p = STROKE(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {meal === "아침" && (
        // sunrise
        <>
          <Line x1={3} y1={19} x2={21} y2={19} {...p} />
          <Path d="M7 19 A5 5 0 0 1 17 19" {...p} />
          <Line x1={12} y1={5} x2={12} y2={7.5} {...p} />
          <Line x1={5} y1={11} x2={6.8} y2={12.8} {...p} />
          <Line x1={19} y1={11} x2={17.2} y2={12.8} {...p} />
        </>
      )}
      {meal === "점심" && (
        // sun (midday)
        <>
          <Circle cx={12} cy={12} r={4} {...p} />
          <Line x1={12} y1={2.5} x2={12} y2={4.5} {...p} />
          <Line x1={12} y1={19.5} x2={12} y2={21.5} {...p} />
          <Line x1={2.5} y1={12} x2={4.5} y2={12} {...p} />
          <Line x1={19.5} y1={12} x2={21.5} y2={12} {...p} />
          <Line x1={5.2} y1={5.2} x2={6.6} y2={6.6} {...p} />
          <Line x1={17.4} y1={17.4} x2={18.8} y2={18.8} {...p} />
          <Line x1={18.8} y1={5.2} x2={17.4} y2={6.6} {...p} />
          <Line x1={6.6} y1={17.4} x2={5.2} y2={18.8} {...p} />
        </>
      )}
      {meal === "저녁" && (
        // crescent moon (evening)
        <Path d="M20 14.5 A8 8 0 1 1 9.5 4 A6.3 6.3 0 0 0 20 14.5 Z" {...p} />
      )}
      {meal === "간식" && (
        // coffee cup (snack / break)
        <>
          <Path d="M5 8 H16 V13 A5 5 0 0 1 11 18 H10 A5 5 0 0 1 5 13 Z" {...p} />
          <Path d="M16 9 H18 A2.5 2.5 0 0 1 18 15 H16" {...p} />
          <Line x1={8} y1={3.5} x2={8} y2={5.5} {...p} />
          <Line x1={12} y1={3.5} x2={12} y2={5.5} {...p} />
        </>
      )}
    </Svg>
  );
}
