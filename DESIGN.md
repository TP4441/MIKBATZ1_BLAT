---
name: Technion Monograph
description: Calm academic study edition for Technion Cluster 1 medical past-exam practice, simulation, and peer notes in bilingual Hebrew RTL/LTR.
colors:
  haifa-cobalt: "#163A5F"
  deep-cobalt: "#102B47"
  cobalt-wash: "#EBF1F6"
  archival-paper: "#F9F7F2"
  reading-plate: "#FFFFFF"
  muted-parchment: "#F2EFE6"
  pressed-parchment: "#EAE5D9"
  hairline-rule: "#DFDBD0"
  folio-rule: "#C9C3B5"
  editorial-ink: "#111827"
  graphite-muted: "#525866"
  chalk-ivory: "#FAF8F5"
  slate-mist: "#CBD5E1"
  clinical-emerald: "#15803D"
  emerald-wash: "#DCFCE7"
  deep-emerald-ink: "#14532D"
  crimson-alert: "#B91C1C"
  crimson-wash: "#FEE2E2"
  deep-crimson-ink: "#991B1B"
  amber-appeal: "#B45309"
  amber-wash: "#FEF3C7"
  deep-amber-ink: "#92400E"
  night-abyss: "#0B121B"
  night-plate: "#131E2C"
  night-slate: "#1A2738"
  night-slate-hover: "#223247"
  night-hairline: "#2A3B52"
  night-rule-strong: "#394F6C"
  luminous-chalk: "#F1F5F9"
  moonstone-muted: "#9FB0C7"
  harbor-cobalt: "#0F1F33"
  harbor-border: "#1E3A5F"
  crisp-starlight: "#F8FAFC"
  luminous-cobalt: "#1D4ED8"
  deep-luminous-cobalt: "#1E40AF"
  night-blue-wash: "rgba(59, 130, 246, 0.2)"
  sky-cobalt-ink: "#93C5FD"
  night-emerald-wash: "rgba(34, 197, 94, 0.16)"
  night-emerald-ink: "#86EFAC"
  night-crimson-wash: "rgba(239, 68, 68, 0.18)"
  night-crimson-ink: "#FCA5A5"
  night-amber: "#D97706"
  night-amber-wash: "rgba(245, 158, 11, 0.18)"
  night-amber-ink: "#FDE68A"
typography:
  display:
    fontFamily: '"Heebo", "Segoe UI", "Arial", sans-serif'
    fontSize: "1.65rem"
    fontWeight: 800
    lineHeight: 1.2
    fontFeature: "tnum"
  headline:
    fontFamily: '"Heebo", "Segoe UI", "Arial", sans-serif'
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.3
  title:
    fontFamily: '"Heebo", "Segoe UI", "Arial", sans-serif'
    fontSize: "1rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: '"Heebo", "Segoe UI", "Arial", sans-serif'
    fontSize: "1.02rem"
    fontWeight: 400
    lineHeight: 1.62
  label:
    fontFamily: '"Heebo", "Segoe UI", "Arial", sans-serif'
    fontSize: "0.8rem"
    fontWeight: 700
    lineHeight: 1.3
    fontFeature: "tnum"
rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.haifa-cobalt}"
    textColor: "{colors.reading-plate}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.deep-cobalt}"
  button-secondary:
    backgroundColor: "{colors.muted-parchment}"
    textColor: "{colors.editorial-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-secondary-hover:
    backgroundColor: "{colors.pressed-parchment}"
  input-search:
    backgroundColor: "{colors.muted-parchment}"
    textColor: "{colors.editorial-ink}"
    rounded: "{rounded.sm}"
    padding: "7px 34px 7px 30px"
  nav-topbar:
    backgroundColor: "{colors.haifa-cobalt}"
    textColor: "{colors.chalk-ivory}"
    padding: "8px 18px"
  chip-filter:
    backgroundColor: "{colors.muted-parchment}"
    textColor: "{colors.editorial-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-filter-active:
    backgroundColor: "{colors.haifa-cobalt}"
    textColor: "{colors.reading-plate}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  card-question:
    backgroundColor: "{colors.reading-plate}"
    textColor: "{colors.editorial-ink}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  option-row:
    backgroundColor: "{colors.muted-parchment}"
    textColor: "{colors.editorial-ink}"
    rounded: "{rounded.md}"
    padding: "9px 14px"
  option-row-correct:
    backgroundColor: "{colors.emerald-wash}"
    textColor: "{colors.editorial-ink}"
    rounded: "{rounded.md}"
    padding: "9px 14px"
  option-row-wrong:
    backgroundColor: "{colors.crimson-wash}"
    textColor: "{colors.editorial-ink}"
    rounded: "{rounded.md}"
    padding: "9px 14px"
  drawer-notes:
    backgroundColor: "{colors.muted-parchment}"
    textColor: "{colors.editorial-ink}"
    rounded: "{rounded.md}"
    padding: "12px"
---

# Design System: Technion Monograph

## Overview

**Creative North Star: "Technion Monograph"**

Technion Monograph replaces dense SaaS quiz chrome with a calm, high-legibility academic study edition engineered for sustained medical exam preparation. A slim Haifa Cobalt header anchors the five study modes and utility controls, while a single collapsed Exam Index Strip keeps search and active filter counts visible without pushing the active clinical question below the fold. Every question sits on a crisp reading plate over warm archival paper so clinical stems, embedded English/Latin medical terms, diagnostic images, and five Hebrew-lettered options command immediate focus from the first pixel.

The system adapts seamlessly across long library sessions and late-night review on mobile. In light mode, warm parchment surfaces and hairline rules eliminate harsh pure-white glare across the viewport while reserving stark `#FFFFFF` exclusively for reading plates and diagnostic image frames. Switching to the paired "Night Desk" dark theme shifts the workspace into deep navy slate surfaces with luminous sky-cobalt inks and desaturated translucent state washes, preserving exact clinical legibility without visual fatigue.

**Key Characteristics:**
- Warm archival paper ground (`#F9F7F2`) paired with pure white reading plates (`#FFFFFF`) and warm hairline rules (`#DFDBD0`), paired with a low-glare "Night Desk" dark mode (`#0B121B` / `#131E2C`).
- Single-line collapsed Exam Index Strip (`951/951` counter, search input, shuffle controls, and expandable filter drawer) so the Question Card leads above the fold on desktop and mobile.
- Bilingual Hebrew RTL/LTR `Heebo` typography with `tabular-nums` alignment across question numbers, timers, KPI metrics, and readiness matrix cells.
- Unified `1.75px`-stroke rounded-cap inline SVG iconography across header utilities, mode tabs, flag toggles, and inline distractor strike-out controls.
- Thumb-friendly mobile ergonomics (`<=720px`) featuring `46px` minimum option tap targets and a sticky bottom navigation dock with safe-area padding.

## Colors

A disciplined academic palette pairs deep Haifa Cobalt structural accents with warm paper neutrals and WCAG-verified clinical semantic states across both Light ("Technion Monograph") and Dark ("Night Desk") themes.

### Primary
- **Haifa Cobalt** (`#163A5F` / dark `#0F1F33` shell, `#1D4ED8` action fill): Anchors the sticky top navigation shell, primary navigation CTAs, active filter chips, and progress bars.
- **Deep Cobalt** (`#102B47` / dark `#1E40AF` action hover, `#1E3A5F` shell border): Provides the topbar bottom rule and crisp hover darkening on primary solid controls.
- **Cobalt Wash & Ink** (`#EBF1F6` wash with `#163A5F` ink; dark `rgba(59, 130, 246, 0.2)` wash with `#93C5FD` ink): Highlights exam badges, active filter summaries, selected simulation options, author chips, and keyboard focus outlines.

### Secondary
- **Clinical Emerald** (`#15803D` border/solid, `#DCFCE7` wash, `#14532D` ink; dark `rgba(34, 197, 94, 0.16)` wash, `#86EFAC` ink): Signals verified correct answers, positive feedback banners, flashcard "ידעתי" actions, and `>=75%` readiness matrix cells.
- **Crimson Alert** (`#B91C1C` border/solid, `#FEE2E2` wash, `#991B1B` ink; dark `rgba(239, 68, 68, 0.18)` wash, `#FCA5A5` ink): Signals wrong answers, distractor strike-out hover/active states, danger reset/submit actions, and `<50%` readiness matrix cells.
- **Amber Appeal** (`#B45309` border, `#FEF3C7` wash, `#92400E` ink; dark `#D97706` border, `rgba(245, 158, 11, 0.18)` wash, `#FDE68A` ink): Marks appeal questions (`שאלת ערעור`), flagged questions, drill streaks, active filter indicator dots, and `50%–74%` readiness matrix cells.

### Neutral
- **Archival Paper & Night Desk Abyss** (`#F9F7F2` light / `#0B121B` dark): Viewport ground beneath cards and modals, tuned for multi-hour reading comfort.
- **Reading Plate & Night Plate** (`#FFFFFF` light / `#131E2C` dark): Primary elevated surface for `.card`, `.kpi-card`, modals, and the sticky mobile footer dock.
- **Muted & Pressed Parchment** (`#F2EFE6` / `#EAE5D9` light; `#1A2738` / `#223247` dark): Recessed secondary surfaces for answer options, filter chips, search inputs, secondary buttons, notes drawer, and matrix table headers.
- **Hairline & Folio Rules** (`#DFDBD0` / `#C9C3B5` light; `#2A3B52` / `#394F6C` dark): Defines subtle `1px` card borders, dashed drawer dividers, and stronger borders on hover or sticky boundaries.
- **Editorial Ink & Graphite Muted** (`#111827` / `#525866` light; `#F1F5F9` / `#9FB0C7` dark): High-contrast primary copy and secondary metadata labels; shell text uses Chalk Ivory (`#FAF8F5`) and Slate Mist (`#CBD5E1`) in light mode.

### Named Rules
**The Clinical Contrast Rule.** Semantic colors (`#15803D`, `#B91C1C`, `#B45309`) are reserved strictly for clinical answer feedback, appeal/flag states, drill badges, and readiness heatmaps—never for decorative chrome or mode branding.
**The White-Plate Imaging Rule.** Clinical image thumbnails (`.q-image-wrap`) and zoomed lightbox images (`.lightbox-stage img`) always render on a pure `#FFFFFF` backing even in Night Desk dark mode so ECG grids, tracings, and diagrams never invert or bleed into dark slate.

## Typography

**Display & Body Font:** `Heebo` (weights `400`, `500`, `600`, `700`, `800`) with `"Segoe UI", "Arial", sans-serif` fallback.
**Numeric Presentation:** `font-variant-numeric: tabular-nums` (`tabular-text`) across counters, timers, percentages, and matrices.

**Character:** Clean geometric Hebrew proportions with crisp Latin/English sub-glyph alignment, allowing RTL clinical narratives and embedded LTR drug names, lab values, and anatomical abbreviations to read together without baseline jitter.

### Hierarchy
- **Display** (`800`, `1.65rem` KPIs / `1.35rem` simulation timer, `1.2` line-height, `tabular-nums`): Analytics KPI figures and live countdown clock.
- **Headline** (`800`, `1.25rem` section heads / `1.12rem` modals / `1.08rem` analytics panels): Primary view and dialog headers.
- **Title** (`800`, `1rem` desktop / `0.88rem` mobile, `1.2` line-height, `-0.01em` tracking): Topbar brand heading (`מבחני עבר – מקבץ 1`).
- **Body** (`400`, `1.02rem` desktop / `0.98rem` mobile stem, `1.62` / `1.58` line-height, `max-width: 72ch`): Clinical question stems, `0.94rem` (`1.48` line-height) option text, and `0.92rem` (`1.58` line-height) community notes.
- **Label** (`500–700`, `0.72rem–0.86rem`, `tabular-nums`): Navigation tabs (`0.86rem`), badges and filter chips (`0.8rem`), subtle metadata (`0.74rem–0.75rem`), and drill count pills (`0.72rem`).

### Named Rules
**The Tabular Numerals Rule.** Every dynamic numeric readout—question counters, session accuracy, exam timer, jump inputs, simulation grid cells, and readiness matrix ratios—must apply `tabular-nums` so numbers align vertically and never shift layout during updates.
**The 72-Character Clinical Measure Rule.** Question stems cap line length at `max-width: 72ch` to maintain effortless eye tracking across desktop viewports and split-column clinical image layouts.

## Layout

The application uses a centered single-column reading workbench capped at `1080px` (`margin: 12px auto 40px`, `padding: 0 16px`, `gap: 12px`) beneath a full-bleed sticky topbar whose inner container caps at `1280px` (`padding: 8px 18px`). Practice and Flashcard modes pair the collapsible Exam Index Strip directly above the Question Card; Exam Simulation, Mistake Drill, and Analytics modes hide the filter strip so only relevant workspace controls occupy vertical space.

Responsive behavior pivots across four measured breakpoints:
- **`>= 960px` (Inline Desktop Header):** `.topbar-inner` collapses into a single horizontal row (`flex-wrap: nowrap`) ordering `.brand` (`order: 1`), `.mode-tabs` (`order: 2`), and `.topbar-utils` (`order: 3`).
- **`>= 860px` (Split Stem & Clinical Imaging):** When a question includes images (`.q-content-grid.has-images`), the body switches from vertical stack to a two-column CSS Grid (`minmax(0, 1.35fr) minmax(260px, 0.75fr)`, `gap: 20px`), keeping diagnostic figures visible beside the clinical stem without scrolling.
- **`<= 1240px` (Compact Sync Status):** `.sync-text-label` hides and `.sync-pill` tightens to a status dot (`padding: 5px 6px`) to preserve single-row header space.
- **`<= 720px` (Mobile Thumb Workbench):** Header tightens (`padding: 7px 12px 5px`), hides `.brand-sub`, `.sync-pill`, `.hide-mobile`, desktop button labels, and tab icons while swapping to short tab labels (`סימולציה`, `טעויות`). `.main-container` tightens to `padding: 0 10px` and `gap: 8px`, option/strike controls expand to `min-height: 46px`, and `.q-nav-footer` converts into a sticky bottom thumb dock (`position: sticky; bottom: 0; padding: 9px 14px calc(9px + env(safe-area-inset-bottom))`).

## Elevation & Depth

Technion Monograph relies on a hybrid tonal-layering and crisp hairline-border model (`1px solid var(--border)`), reinforced by restrained ambient shadows rather than heavy drop-shadows or glassmorphism.

### Shadow Vocabulary
- **Resting Card Shadow** (`0 2px 8px rgba(17, 24, 39, 0.05), 0 1px 2px rgba(17, 24, 39, 0.04)` light; `0 4px 16px rgba(0, 0, 0, 0.35)` dark): Grounds `.card` and `.kpi-card` plates gently above the paper ground.
- **Elevated Overlay Shadow** (`0 10px 28px rgba(17, 24, 39, 0.12)` light; `0 12px 32px rgba(0, 0, 0, 0.55)` dark): Lifts `.modal-box` and `.toast` notifications above active overlays (`rgba(11, 18, 27, 0.82)`).
- **Sticky Edge Shadows**: `-2px 0 6px rgba(17, 24, 39, 0.06)` marks the sticky right-hand exam header column inside `.readiness-matrix`; `0 -4px 14px rgba(17, 24, 39, 0.07)` anchors the mobile sticky `.q-nav-footer` dock above scrolling content.

### Named Rules
**The Tonal Plate Rule.** Hierarchy inside a card is conveyed through surface tone (`--surface` `#FFFFFF` vs. `--surface-2` `#F2EFE6`) and `1px` solid or dashed rules—never nested shadows inside cards.

## Shapes

Corners step down deliberately from outer containers to inner controls so nested elements remain visually concentric:
- **Outer Containers (`12px`):** `.card`, `.kpi-card`, `.lightbox-stage`, and mobile dock bottom corners.
- **Interactive Inner Plates (`10px`):** `.option-btn`, `.strike-btn`, `.q-image-wrap`, `.q-feedback`, `.notes-toggle-btn`, `.notes-drawer`, and `.radio-card`.
- **Standard Controls (`8px`):** `.btn-*`, `.icon-btn`, `.brand-mark`, `.search-box input`, `.flag-btn`, `.community-note-card`, `.my-note-editor textarea`, `.note-send-btn`, `.form-select`, `.custom-sim-opts`, and `.toast`.
- **Micro Badges & Cells (`6px` / `5px` / `4px`):** `6px` on `.q-badge`, `.pdf-link`, `.q-image-hint`, `.appeal-note`, `.jump-box input`, `.note-card-action-btn`, `.sim-cell`; `7px` on `.tab-btn`; `5px` on `<kbd>`; `4px` on `.matrix-cell-btn`.
- **Pills & Status Dots (`999px` / `50%`):** Full pill radii on `.identity-pill-static`, `.sync-pill`, `.badge-pill`, `.filter-summary-pill`, `.chip`, `.drill-streak`, `.author-chip-mini`, `.community-note-mine-badge`, `.prog-bar-bg`, `.toggle-switch .slider`, and `.empty-icon`.

All inline icons share a single `1.75px`-stroke rounded-cap vector language (`viewBox="0 0 24 24"`, `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"`) at `16px × 16px` (`.ui-ico`), `17px × 17px` (`.brand-mark svg`), and `24px × 24px` (`.empty-icon svg`).

## Components

### Buttons
Tactile, flat-filled academic actions with crisp `1px` borders on secondary surfaces and subtle `0.15s ease` color transitions.
- **Shape:** `8px` (`--radius-sm`).
- **Primary (`.btn-primary`):** Haifa Cobalt (`#163A5F` / dark `#1D4ED8`) background, `#FFFFFF` text, `8px 14px` padding (`5px 10px` `.btn-sm`, `11px 20px` `.btn-lg`).
- **Hover / Focus:** Shifts to `#102B47` (dark `#1E40AF`); `:focus-visible` renders `2px solid var(--primary-ink)` with `2px` offset.
- **Secondary / Ghost / Semantic:** `.btn-secondary` uses `--surface-2` with `1px solid var(--border)` shifting to `--surface-hover` / `--border-strong`; `.btn-ghost` uses transparent fill over `--text-muted`; `.btn-danger` (`#B91C1C`) and `.btn-success` (`#15803D`) darken via `filter: brightness(0.92)` on hover; `.flag-btn` toggles into `--warning-soft` with `--warning` border and `--warning-ink` text when active.

### Chips
Compact pill filters and question metadata tags engineered for dense scanning without visual clutter.
- **Style:** `999px` pill radius on `.chip` (`4px 10px`, `0.8rem`, weight `500`), `--surface-2` background with `1px solid var(--border)`, `tabular-nums`. Question badges (`.q-badge`) use `6px` radius (`4px 10px`, `0.8rem`, weight `700`).
- **State:** Hover shifts `.chip` border to `--primary-ink` and fill to `--surface-hover`; `.chip.active` fills with `--primary` and `#FFFFFF` (`weight: 700`).

### Cards / Containers
Structured reading plates that isolate clinical content cleanly from the paper canvas.
- **Corner Style:** `12px` (`--radius`).
- **Background:** `--surface` (`#FFFFFF` light / `#131E2C` dark).
- **Shadow Strategy:** Resting `--shadow` at rest; `--shadow-elevated` on modal dialogs.
- **Border:** `1px solid var(--border)`.
- **Internal Padding:** `16px 20px` desktop; `12px 14px` on `<=720px`.

### Inputs / Fields
Recessed parchment fields that brighten onto pure surface focus for immediate typing clarity.
- **Style:** `1px solid var(--border)`, `--surface-2` fill, `8px` radius (`6px` on `.jump-box input`). Search box offsets `7px 34px 7px 30px` in RTL to house the right-aligned search SVG and left-aligned clear button.
- **Focus:** Shifts border to `--primary-ink` and search input background to `--surface` (`#FFFFFF` / `#131E2C`), paired with global `2px` `--primary-ink` focus-visible outline.
- **Toggles:** `.toggle-switch` uses a `36px × 20px` pill track (`--border-strong` off, `--primary` on) with a `14px` `#FFFFFF` circular thumb translating `-16px` in RTL.

### Navigation
High-contrast Haifa Cobalt topbar paired with thumb-anchored mobile question controls.
- **Topbar (`.topbar`):** Sticky `top: 0`, `z-index: 40`, `--shell-bg` (`#163A5F` / dark `#0F1F33`), `1px` `--shell-border` bottom rule. Mode tabs (`.tab-btn`) use `7px` radius, `6px 12px` padding, `--shell-muted` text, translucent `rgba(255,255,255,0.1)` hover, and inverted `--shell-text` / `#163A5F` active tab (dark `#1D4ED8` / `#FFFFFF`).
- **Mobile Navigation Dock:** Below `<=720px`, `.q-nav-footer` sticks to `bottom: 0` (`z-index: 50`) across the full card width (`margin: 4px -14px -12px`) with `--surface` background, `1px solid var(--border-strong)` top border, upward dock shadow, `env(safe-area-inset-bottom)` clearance, and `flex: 1` `42px`-tall Next/Prev buttons.

### Signature Component: Collapsible Exam Index Strip & MCQ Strike-Out Row
- **Exam Index Strip (`.filter-panel`):** Always opens collapsed to a single horizontal strip (`10px 14px` padding) containing live search, active summary pill (`#EBF1F6` / `#163A5F`), shuffle triggers, and the `סינון` drawer toggle (`aria-expanded`) with an amber active-filter dot (`--warning`) and rotating `180deg` chevron.
- **MCQ Option & Strike-Out Row (`.option-row`):** Pairs a flexible `1.5px`-bordered `.option-btn` (`9px 14px` desktop, `min-height: 46px` mobile) with an adjacent `.strike-btn` (`min-width: 42px` desktop / `44px` mobile). Clicking `.strike-btn` or right-clicking the option applies `.struck` (`opacity: 0.45`, `text-decoration: line-through`, crimson strike button).
- **Spoiler-Safe Peer Notes (`.q-notes-container`):** Separated by a `1px dashed var(--border)` divider, always collapsed on question entry (`notesExpanded = false`), previewing up to 5 anonymous student emoji chips before expanding the `.notes-drawer`.

## Do's and Don'ts

### Do:
- **Do** keep the Exam Index Strip collapsed by default in Practice and Flashcard modes so the Question Card leads above the fold.
- **Do** preserve `1px solid var(--border)` hairline framing and `#FFFFFF` clinical image backing (`#FFFFFF` even in dark mode) for ECGs, radiology, and pathology figures.
- **Do** apply `tabular-nums` (`tabular-text`) to every question counter, timer, badge count, percentage, and matrix cell.
- **Do** keep all UI icons as inline `1.75px`-stroke rounded-cap SVGs (`viewBox="0 0 24 24"`) and preserve playful Unicode emojis strictly for anonymous student identities.
- **Do** enforce `46px` minimum touch height on option/strike rows and the sticky safe-area bottom navigation dock below `<=720px`.

### Don't:
- **Don't** expand the filter drawer by default or insert marketing heroes, eyebrows, or kickers above the Question Card.
- **Don't** use hard offset shadows, glassmorphic blur backdrops, or nested box-shadows inside `.card` containers.
- **Don't** introduce secondary brand hues or decorative gradients that compete with the semantic clinical feedback states (`#15803D`, `#B91C1C`, `#B45309`).
- **Don't** auto-open the peer community notes drawer on question load; spoiler-safety requires explicit toggle expansion.
