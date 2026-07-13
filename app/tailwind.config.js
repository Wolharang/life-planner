/**
 * Design tokens — v5 "Toss-form + one craft moment". **LOCKED (D39, 2026-07-11).**
 *
 * This header used to say the opposite — "PROVISIONAL, the confirmed baseline is still D36's forest/gold" —
 * long after D39 locked v5 and repainted the native execution moment to match. It even pointed at a doc path
 * that no longer exists. That is the most dangerous kind of stale comment: an instruction. A future agent
 * reading it would have "restored" a palette the founder had already retired, and the moment — the one screen
 * that must not be touched casually — would have gone with it. The truth: **v5 is confirmed**; D36's *colors*
 * are superseded, while its no-guilt *semantics* survive unchanged (gold = the one calm DONE and never a
 * button; a miss is taupe #8B7E74 and never red). Source of truth: `docs/core/design-system.md`.
 *
 * Utility screens (home/add/settings): clean white · blue interactive · grey-grouped settings.
 * Execution moment: warm-white ground · serif commit · gold 도장(seal) DONE.
 * Color roles: brand(blue) = interactive · gold = SUCCESS only · miss = taupe (NEVER red).
 * Invariant (skin-independent): miss=taupe, gold=single DONE signal, execution=light, no confetti.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#FFFFFF",              // app background (utility)
        group: "#F2F4F6",          // grouped-settings background
        surface: "#FFFFFF",
        line: "#F2F4F6",           // hairline / soft grey fills
        ink: "#191F28",            // primary text (Toss ink)
        "ink-soft": "#4E5968",
        grey: "#8B95A1",           // secondary text
        faint: "#B0B8C1",          // tertiary / placeholder
        brand: { DEFAULT: "#3182F6", soft: "#E8F3FF" }, // interactive / primary / toggle-on
        gold: { DEFAULT: "#B0862A", soft: "#F7EFD6" },  // the ONE success signal (was muddy #C9A227)
        miss: { DEFAULT: "#8B7E74", soft: "#EFECE8" },  // miss outcome — NEVER red
        off: "#E5E8EB",            // toggle track (off)
        warn: "#B5533C",           // system error only — muted, not alarm-red
        // execution moment — LIGHT warm-white (the heavy beige is dropped); gold stays reserved for DONE
        warm: "#FBFAF6",
        sumuk: "#201D17",
        exec: { bg: "#FBFAF6", ink: "#201D17", soft: "#6E675A", line: "#E7E9E4" },
      },
      fontFamily: {
        sans: ["Pretendard"],      // utility UI
        serif: ["GowunBatang"],    // the execution-moment voice only
      },
      borderRadius: { control: "12px", card: "18px", pill: "9999px" },
      fontSize: {
        caption: "12px",
        label: "13px",
        body: "15px",
        subhead: "16px",
        title: "20px",
        screen: "22px",   // screen H1 (Toss "문제 내용을 선택해주세요")
        hero: "30px",     // big-number hero (next execution)
        commit: "25px",   // execution moment commit line
        micro: "27px",
        count: "112px",   // countdown
      },
      spacing: { touch: "48px" },
    },
  },
  plugins: [],
};
