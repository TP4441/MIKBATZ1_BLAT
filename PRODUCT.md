# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary users:** Technion medical students (the creator's cohort and close study group) preparing for Cluster 1 (מקבץ 1) integrative medicine exams, practicing across desktop/laptop and mobile devices (on the go or from bed) via GitHub Pages.
- **Creator local workflow:** The project maintainer running `server.py` locally alongside their Technion Integrative Medicine Obsidian vault (`אינטגרטיבי 2.0`) to rebuild question data and export mistakes.

## Product Purpose

Provide an interactive, zero-friction past-exam practice, simulation, and peer-annotation web app for Cluster 1 (951 questions across 12 exams, 2014–2026). Success means fast active recall, realistic timed exam simulation, systematic drilling of mistakes and weak pockets, frictionless sharing of peer clinical pearls, and clear exam readiness visibility across subjects and years.

## Positioning

Unlike static past-exam PDF booklets or isolated personal flashcard decks, this app combines full-bank filtering, timed exam simulation, mistake-driven drill loops, clinical image zoom/pan, and instant anonymous peer notes in a single static web app requiring zero login and no dedicated backend.

## Operating Context

- **Primary deployment:** Static site on GitHub Pages (`TP4441/MIKBATZ1_BLAT`), configured with `.nojekyll`, `robots.txt` (`Disallow: /`), and `<meta name="robots" content="noindex, nofollow">` to remain private and unindexed.
- **Client state & backup:** Attempts, flags, personal notes, theme preference, and device-locked identity persist automatically in browser `localStorage`, with JSON export/import for manual backup or transfer between devices.
- **Shared community notes:** Synced via `textdb.dev` (`CLOUD_NOTES_URL`) with local caching, using 100 auto-assigned, device-locked anonymous identities across 4 categories (fruits, vegetables, kitchen tools, biblical figures).
- **Optional local server:** `server.py` (and `הפעל אתר תרגול.bat`) serves locally on port `8765`, auto-rebuilds `questions_data.js` from Obsidian (`build_exam_app.py`), persists `user_progress.json` and `community_notes.json` to disk, and exports mistakes/notes to Obsidian (`מחברת טעויות - מקבץ 1.md`).

## Capabilities and Constraints

- **Study modes:** Practice (`תרגול`), Exam Simulation (`סימולציית מבחן` — full past exam or custom timed simulation with question map HUD), Mistake Drill (`תיקון טעויות`), Flashcards (`כרטיסיות`), and Analytics (`אנליטיקה` — KPIs, per-subject accuracy/progress, and year×subject readiness matrix).
- **Practice & review tooling:** Free-text search across stems/options/notes; multi-axis filtering (exam/year, subject with optional pathology-merge toggle, attempt/flag/note status); question and distractor shuffling; distractor strike-out (`Shift+1–5`); appeal indicators (`⚖️ שאלת ערעור`); links to original exam PDFs (`assets/pdfs/`); pan-and-zoom clinical image lightbox (`assets/images/`); and spoiler-safe collapsible notes drawer with explicit send/edit/delete for own notes.
- **Hard constraints:**
  - Zero-friction access: no accounts, passwords, or authentication gates.
  - Pure static hosting compatibility: must work on GitHub Pages without a custom backend server (relying on `localStorage` + `textdb.dev`).
  - Search privacy: keep `noindex, nofollow` and unindexed posture.
  - Bilingual RTL/LTR integrity: Hebrew RTL primary UI with clean LTR rendering for English/Latin medical terms, abbreviations, and lab values.

## Brand Commitments

- **Product identity:** `מבחני עבר – מקבץ 1` (`תרגול מבחני עבר – מקבץ 1 🩺`).
- **Voice & tone:** Lighthearted, friendly, peer-to-peer student tone (playful anonymous identities and emojis) paired with high medical and clinical precision in questions, feedback, and study notes.

## Evidence on Hand

- `questions_data.js` and `questions_data.json`: 951 past-exam questions across 12 exams (2014–2026) and 8 subjects (`אונקולוגיה`, `מבואות`, `נוירולוגיה`, `פתולוגיה`, `פתולוגיית קרדיולוגיה`, `פתולוגיית ריאות`, `קרדיולוגיה`, `ריאות`).
- `assets/images/`: Clinical figures (ECGs, imaging, pathology slides) organized under `exam_1_2014` through `exam_1_2026`.
- `assets/pdfs/`: Original past-exam PDFs (`2022`, `2024`, `2025`, `2026`, and `מקבץ 1 - חוברת מבחנים מעודכנת ל-23-24.pdf`).
- **Absences:** No external marketing testimonials or third-party benchmarks; live community notes reside in `textdb.dev` rather than in git.

## Product Principles

1. **Zero-friction start:** Open the link and solve immediately — no registration, setup wizard, or login wall.
2. **Mistake-first mastery:** Surface wrong answers, unsure flags, and weak year×subject pockets so study effort targets what moves exam readiness.
3. **Desktop speed, mobile comfort:** Support rapid keyboard-only practice on desktop while remaining effortless and thumb-friendly on phones and tablets.
4. **Clinical precision without visual fatigue:** Keep clinical images crisp and zoomable, medical terms exact, and late-night dark-mode study comfortable.
5. **Peer pearls without spoilers:** Share classmate explanations right on each question while keeping notes tucked away until needed.

## Accessibility & Inclusion

- **Bilingual medical text:** Full Hebrew RTL structure supporting embedded English/Latin clinical terminology, drug names, and numeric lab values without bidirectional scrambling.
- **Keyboard-first workflow:** Complete practice navigation and flagging via keyboard (`1–5`/`א–ה`, `Shift+1–5`, `←`/`→`, `Space`/`Enter`, `S`/`F`, `N`, `R`, `Esc`).
- **Visual comfort:** Light and Dark themes for long or late-night study sessions, plus pan/zoom lightbox inspection for dense ECGs and diagnostic images.
