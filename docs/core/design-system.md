# LifePlanner — Design System

> **Role.** The concrete realization of `docs/core/design-principles.md` as **tokens (color · type · spacing) +
> components**, each with its **기준 (why it was chosen)**. Built by reading the project's code (the reference apps
> `reference/calculator.js`, `reference/kcal.js`), the service overview, the customer profiles, and the design
> principles. Scope = service-level; expressed as **portable tokens** that sit under the recommended base library
> (gluestack-ui v2 / NativeWind — see the design-system comparison). **Promoted to `docs/core/` — this is the
> design foundation.** It is encoded live in `app/tailwind.config.js` (§1 flags a *provisional* "Toss-form"
> skin the prototype currently runs; D36 forest/gold remains the confirmed baseline until a new D-entry locks it).

## 0. Foundations & method — where this came from
- **The palette is not invented — it is formalized from the user's own working app.** `calculator.js` already uses
  a refined **forest + gold + muted-neutral** language (`forest #1B4332`, `gold #C9A227`, `ink #1C2321` ramp,
  `negative #A6414B` — a *muted* plum, **not** a harsh alarm red — plus soft shadows and gentle success haptics).
  That language *already embodies* B2(adult) · C1(quiet) · B1(no-guilt), so we adopt & extend it. `kcal.js`'s
  generic Material green/red (`#4CAF50`/`#d32f2f`) is **superseded** to bring both apps into one voice.
- **Every token traces to a principle + a source** (design-principles #, reference code, or accessibility/persona).
- **Expressed as tokens** → drop into a Tailwind/NativeWind config; the component library (gluestack-ui v2) is
  restyled *to these tokens*, and the execution moment is built directly on them.

---

## 1. Color

> ### ✅ 확정: v5 "Toss-form" (D39, 2026-07-11) — 더 이상 잠정이 아님
> The skin is **LOCKED to v5** (**D39**), which **supersedes D36's forest/gold *color* baseline** (D36's
> *base-library* choice still stands). The live tokens are `app/tailwind.config.js`, and the **native
> execution moment (`ExecutionActivity.kt`) has been repainted to match** — no screen is left on the old
> palette. The forest/gold table further below is kept as **history** (where the palette came from), not truth.
>
> | Token | **CONFIRMED (v5, D39)** | *(superseded: D36 forest/gold)* |
> |---|---|---|
> | `brand` (interactive) | **`#3182F6` blue** · soft `#E8F3FF` | ~~`#1B4332` forest~~ |
> | `bg` (app background) | **`#FFFFFF` white** + grey groups `group`/`line` `#F2F4F6` | ~~`#F1F4EF` off-white~~ |
> | `gold` (the one DONE signal) | **`#B0862A`** · soft `#F7EFD6` | ~~`#C9A227`~~ |
> | execution ground | **`#FBFAF6` warm-white (LIGHT)** · ink `#191F28` | ~~`#F4F7F2`~~ |
> | `miss` | **`#8B7E74` taupe — never red** | (unchanged) |
> | typography | **Pretendard** (UI) + **GowunBatang** serif (execution voice) — free OFL (D10) | ~~system stack~~ |
>
> **Invariants (a reskin never touches these):** `miss` taupe — **never red**; `gold` = the **single** DONE
> signal (not buttons); the execution moment is **light**; **no confetti** (a gold 도장/seal stands in);
> **no in-flow escape**.

**Semantic roles (Light) — 기준 붙임.** Dark set mirrors it (§1.4). *(**Historical — the D36 forest/gold set.**
The confirmed values are the v5 table above (D39); the rows below explain the **reasoning** each token was
chosen for, which the v5 skin inherits role-for-role.)*

| Token | Value (Light) | Role | 기준 (why) |
|---|---|---|---|
| `bg` | `#F1F4EF` | app background | **deepened** off-white so white `surface` cards **visibly pop** (Q1 clarity/A3); still calm (C1) |
| `surface` | `#FFFFFF` | cards, sheets | calculator `card` |
| `surfaceAlt` | `#EEF1EC` | grouped rows, banners | muted green-gray — sections without hard lines (C1) |
| `ink` | `#1C2321` | primary text | calculator `ink` — near-black, high contrast for the tired reader (A3) |
| `inkSoft` | `#6B756F` | secondary text | calculator `inkSoft` |
| `inkFaint` | `#9AA39C` | hints, placeholders | calculator `inkFaint` |
| **`miss`** | `#8B7E74` | **miss outcome — neutral, never red** | taupe (category 기타) — distinct from cool-gray hints *and* from gold done (B1: miss=data) |
| `divider` | `#E7E9E4` | hairlines | calculator `divider` |
| `brand` | `#1B4332` | primary action, headers | calculator `forest` — a **calm, adult** brand, not a loud "engagement" hue (B2/D1) |
| `brandDeep` | `#0F2A20` | pressed, header gradient | calculator `forestDeep` |
| `brandSoft` | `#E3ECE6` | selected bg, chips | calculator `forestSoft` |
| **`accent`** | `#C9A227` | **the one competence signal** | calculator `gold` — warm but restrained; the *only* celebratory color (B1: calm signal, not confetti) |
| `accentSoft` | `#F3E9C9` | done highlight bg | calculator `goldSoft` |
| `warn` | `#B5533C` | **system error / invalid input only** | muted terracotta (from the category palette) — signals "fix this" *without* alarm-red shaming |
| `execBg` | `#F4F7F2` | execution-moment background | **LIGHT** (PRD v0.5 — the founder's repeated direction; the earlier near-black is dropped) — bright, calm, high-contrast |
| `execInk` | `#1C2321` | execution-moment text | dark ink on the light exec surface |

### 1.1 No-guilt color semantics (the single most principle-driven decision, B1)
- **A `miss` is NEVER red.** It uses the dedicated **`miss` token (taupe `#8B7E74`)** — a neutral outcome color,
  visibly distinct from faint text *and* from gold done — a miss is *data*, not failure (B1). No `#d32f2f`, no red
  badge, no "you failed" state anywhere.
- **`warn` (muted terracotta) is reserved for *system* problems** (invalid input, save failure) — a different
  concept from a miss, and still not an alarm red (so even errors feel calm).
- **`accent` (gold) is rationed** — it marks *one* thing: the competence signal ("안 하던 걸 해냈다") and the
  primary action. Scarcity keeps success calm (B1) and the app quiet (C1).

### 1.2 Execution moment (A1) — its own high-contrast treatment
**LIGHT** `execBg #F4F7F2` + dark `execInk #1C2321` + a single `accent` (gold) mark reserved for DONE, and a
solid-`brand` pill for the action. **기준:** A1 (the moment is the design centerpiece — distinct, bright, calm) and
A3 (a tired, glancing user reads it instantly). *(PRD v0.5: the earlier dark treatment is dropped per repeated
founder direction — the moment is bright, not a dark takeover.)*

### 1.3 Category colors (full-app budget only, D16 — kept as-is)
주식 `#1B4332` · 간식 `#C9A227` · 문화생활 `#46466B` · 잡화소모 `#3C7A89` · 이동통신 `#5B7C99` · 대중교통비
`#B5533C` · 뷰티 `#7C5295` · 기타 `#8B7E74`. **기준:** already a muted, sophisticated categorical set in
calculator.js; fixed by D16; consistent with the adult voice. (Prototype doesn't use these.)

### 1.4 Dark theme (OS-level, full app only — NOT the execution moment)
The execution moment is **light** (§1.2, PRD v0.5), not dark. A general OS-level dark theme for the full app
(calendar/logs, later phase) remains a valid accessibility option — `bg #0E1B15` · `surface #16281F` · `ink
#FAFBF9` · `inkSoft #9AA39C` · `accent #C9A227`, contrast ≥ WCAG AA — but it does **not** govern the execution
surface, which stays bright.

### 1.5 Clarity & primary distinctness (audit fixes)
- **Neutral ramp — no two adjacent surfaces read the same.** Core surfaces are only three, with clear contrast:
  `bg #F1F4EF` → `surface #FFFFFF` (cards pop) → `divider #E7E9E4`. Tints are used **by role**, not as extra grays:
  `brandSoft` = selected/note bg · `goldSoft` = done highlight. **기준:** Q1 / A3 — too many near-white greens hurt
  legibility; every token must be tell-apart-able.
- **The core action is the ONLY solid-`brand` pill.** Chrome (headers) uses the **deep gradient**
  (`brandDeep → bgHeader`); selected & category use **soft** fills (`brandSoft` / a category hue at low opacity, the
  hue as *text*). So a **solid forest pill = unambiguously "the action,"** which also resolves the
  `brand == 주식 #1B4332` clash (action = solid-filled; a 주식 chip = soft-filled). **기준:** Q2 / A3 — the tired user
  must spot the one action instantly.
- **On the light execution surface** (PRD v0.5), the primary action ("시작할게", "응, 시작했어") is a **solid
  `brand` (forest) pill** — the same "solid pill = the action" rule as the rest of the app; **gold is reserved for
  the single DONE mark** ("안 하던 걸 해냈다" ✓), not for buttons. **기준:** A1 / A3 (the one action, unmistakable)
  while gold stays the single competence signal (B1/C1), rationed.

---

## 2. Typography

| Token | Size / weight | Use | 기준 (why) |
|---|---|---|---|
| `caption` | 12 / 400 | timestamps, hints | reference small sizes |
| `label` | 13 / 500 | field labels, chips | — |
| **`body`** | **15 / 400** | default text, list titles | calculator's **most-used** size (15) → consistency (C2) |
| `subhead` | 17 / 500 | row emphasis | — |
| `title` | 20 / 600 | section titles | — |
| `screenTitle` | 24 / 600 | screen headers | restrained top size = adult/calm (B2/C1) |
| — execution moment (reserved) — | | | |
| `commitLine` | 26 / 600 | "어제 네가…정했잖아" | A1: dramatic, but readable |
| **`countdown`** | **72 / 600, tabular** | 5·4·3·2·1 | A1: the one theatrical element; A3: readable across a room |
| `microStart` | 22 / 500 | "지금 신발 신기" | big, single instruction (A3) |

- **Font:** **system stack** — iOS `SF Pro` / `Apple SD Gothic Neo`, Android `Roboto` / `Noto Sans KR`. **기준:**
  free (D10), **Korean-legible** (the app is Korean), and honors OS **Dynamic Type / font-scale** (accessibility);
  no custom font = no maintenance/weight (C2).
- **Numbers = tabular / mono** (times, amounts, countdown) — calculator.js uses `Menlo`/`monospace`. **기준:**
  aligned digits; steady countdown (no width jitter).
- **Weights limited to 400 / 500 / 600** (no black). **기준:** restraint = calm/adult (B2/C1).
- **Line-height ~1.4**, and **respect the user's font-size setting** (never truncate scaled text). **기준:** A3 +
  accessibility.

**One-loud-thing rule:** the dramatic scale (`countdown` 72, `commitLine` 26) lives *only* in the execution moment;
every other screen stays in the 12–24 restrained range (C1).

---

## 3. Spacing & layout

- **Base unit 4**, scale **4 · 8 · 12 · 16 · 20 · 24 · 32 · 40**. **기준:** matches the reference's common values
  (4/6/8/12/16/20); a consistent rhythm; **generous whitespace = calm/adult** (B2/C1).
- **Screen padding: 20** horizontal. **기준:** reference default; breathing room.
- **Minimum touch target: 48 × 48 dp.** **기준:** A3 (a tired user, one tap, no mis-taps) + accessibility (matches
  Material a11y).
- **Radius:** control `8` (reference default) · card `12–16` · **pill `999`** for the primary action & toggles.
  **기준:** soft but not childishly round (B2); the pill marks the *one* primary action per screen (A3).
- **Shadow:** subtle only — `shadowOpacity ~0.08`, soft radius (from calculator's `cardShadow`). **기준:** depth
  without loudness (C1); no heavy Material elevation.
- **One primary action per screen**, thumb-reachable (bottom). **기준:** A3 (zero-decision), depleted-state ergonomics.

---

## 4. Components (from the IA screens) — decision + 기준

| Component | Decision | 기준 (why) |
|---|---|---|
| **Button** | Primary (brand fill · pill · ≥48dp · **one per screen**); Secondary (ghost/outline); Text. Destructive = **muted, never alarm-red**. | A3 (one clear primary) · B1 (no aggressive/red) |
| **Block row (시간 블록)** | title `body` · start(–end) (mono `caption`, `inkSoft`) · 실행 알림 mark · **outcome** (done=`accent` gold · **miss=`miss` taupe, never red** · 쉼=neutral · pending=none). ≥48dp. *(프로토타입의 "할 일 row"가 이것으로 대체됨 — 반복 표식 없음, D37.)* | B1 (miss neutral, never red) · A3 (scannable) · C2 (conventional row) |
| **Input / field** | `fieldBg`, radius 8, ≥48dp · **inline validation in `warn`** (the *무효* state), not a red alarm | user-flow 무효 vs 에러 · A3 |
| **Toggle** | execution-alarm (**default ON**, prominent) · settings sound. `brand` when on. | user-flow re-check (no "do-nothing task") |
| **Execution-moment surface** ★ | full-bleed `execBg` · `commitLine` → `countdown` → `microStart` → single primary "시작할게" · done = "안 하던 걸 해냈다" + **one** gold mark, **no confetti**. **Custom-built** (not a library component). | A1 (deepest craft) · A3 (contrast) · B1 (calm done) |
| **Catch-up banner** | top-of-home, `surfaceAlt`, gentle two-variant copy ("놓쳤어요"/"아직 안 했죠"), muted | B1 (never scold) · R6 |
| **Empty state** | calm illustration-lite + CTA "첫 할 일을 정해보자" | user-flow (no dead-end) |
| **Icons** | Ionicons (line), restrained sizes | consistency with reference · calm/adult |
| **Category chip** (full-app) | category color bg-soft + label | D16 · consistency |

### 4.1 What we deliberately do NOT build (a design-system-level ban)
**No** streak counter · **no** progress-to-goal / consecutive bar · **no** confetti/celebration animation · **no**
badge collection / trophies / levels · **no** leaderboard · **no** red "실패" state · **no** nagging modal.
**기준:** B1 (no-guilt, no gamification) + D1 (no engagement mechanics). *Banning these is itself a design decision*
— it's what keeps the product calm and honest (§design-principles priority: B1 is inviolable).

### 4.2 Component states (평상시 / 눌림 / 비활성 / 포커스·선택 / 에러(무효) / 로딩)
> **기준:** Q3 — every interactive element defines all its states so nothing feels dead or ambiguous. **disabled =
> opacity / neutral (never red)**; **error = `warn` (muted), never alarm**.

| Component | default | pressed | disabled | focused/selected | error(무효) | loading |
|---|---|---|---|---|---|---|
| **Primary button** | solid `brand`, white text | `brandDeep` | `inkFaint` bg, no shadow, non-tappable | — | — | spinner + label, non-tappable |
| **Secondary / text** | ghost, `brand` text | `brandSoft` bg | `inkFaint` text | — | — | — |
| **Input field** | `fieldBg`, `inkFaint` placeholder | — | `inkFaint` bg, read-only | `brand` hairline | `warn` hairline + inline msg | — |
| **Toggle** | track `divider` / on=`brand` | slight scale | 40% opacity | — | — | — |
| **Task row** | `surface` | `brandSoft` tint | — | `brandSoft` (selected) | — | skeleton shimmer |
| **Exec primary "시작할게" / "응, 시작했어"** | solid `brand` on light `execBg`, white text | `brandDeep` | — | — | — | — |

### 4.3 Service-specific custom components (LifePlanner 고유 — 어떤 라이브러리에도 없음)
> **기준:** Q4 — standard libs give button/input/list/toggle; the *service-defining* controls below (the execution
> moment's parts + the alarm/recurrence/reminder pickers + the honesty banners) are **ours to hand-build** — they
> carry the product's soul.

| Component | 무엇 | 기준 |
|---|---|---|
| **Countdown 5·4·3·2·1** | 큰 tabular 숫자, ~1s 틱+햅틱, 자동 진행 | A1/A2 — 반숙고 시그니처 |
| **Commit line** | 시각정확 동적 문구 "어제/아까/지난주 네가 …정했잖아" | B2 — 어제의 나, 거짓 "어제" 금지 |
| **Micro-start + confirm** (v0.5 병합) | 5초짜리 첫 동작(노트 또는 기본)과 "시작했어?"를 **한 화면에**(BeReal식). **응/아직만** · 자동 타임아웃. **인-플로우 이탈구 없음** — "오늘은 쉼"은 발화 *전* 사전 토글(R1) | A2/B1 — 이탈은 착수 *전*에만 |
| **GO 추진 비트** (v0.6) | 응 직후 **"이제 그대로 나가."**로 실제로 나가게 미는 짧은 단계(신발 신기 ≠ 완료), 전진 전용 | A1/A2 |
| **Outcome dot** | done=gold · miss=taupe · pending=outline | B1 |
| **Lead-time preset picker** | {정각/10/30/60분/직접} 칩 | 사용자 결정 |
| ~~**Plain-reminder offset picker**~~ | **블록에서 폐기(D38)** — 소프트 알림은 **중요일정(R3)** 에만 있고, 리드 칩 하나로 고른다 | D38 |
| ~~**Recurrence picker**~~ | **폐기(D37)** — 대신 **여러 날짜 일괄 선택기**(추가 화면의 날짜 칩 줄): N개 날짜 → **독립 블록 N개**. 문구로 "반복이 아니라 각각 따로"임을 밝힌다 | D37 |
| **Catch-up banner** | 2변형 부드러운 프롬프트("놓쳤어요"/"아직 안 했죠") | B1/R6 |
| **Permission/degraded banner** | "실행 알림이 잠금화면을 못 뚫어요 — 켜기" | user-flow(조용히 실패 금지) |

---

## 5. Motion & haptics
- **Motion: minimal & purposeful.** The **5·4·3·2·1 countdown is the one place with prominent motion**; elsewhere
  subtle fades/slides ≤ ~200 ms. **기준:** C1 (quiet) · A1 (the moment).
- **Haptics** (from calculator.js helpers): **light** on tap, **success** on done, a **pulse** at execution FIRING.
  **기준:** A2 (a physical cue at the moment) · already the reference's pattern ("gentle, fail-silent" — matches B1).

## 6. How to apply (with the recommended base)
- Put §1–§3 tokens in the **Tailwind/NativeWind config** (colors, fontSize, spacing, radius).
- Restyle **gluestack-ui v2** components to these tokens for the standard screens (task row, form, toggle, banner).
- Build the **execution-moment surface by hand** on the tokens (no library component) — it's the design centerpiece.

## Cross-references
- Principles (the "why" behind every token) → `docs/core/design-principles.md`
- Reference code (palette/type/spacing source) → `reference/calculator.js`, `reference/kcal.js`
- Screens the components serve → `docs/research/information-architecture.md` §8 · Flows/states → `docs/research/prototype/user-flows.md`
- Library choice under these tokens → (design-system comparison; gluestack-ui v2 / NativeWind)
