# Implementation Plan: Horizontal Cursive Line Journey & Character-by-Character Ink Typography

Transforming the Decenter Worry Map into a **100% full-screen horizontal left-to-right canvas** (removing the right panel) that faithfully mirrors your two reference images: long, flowy, cursive horizontal ink lines with small, delicate inline text nodes nestled right in the break of the line, curved text riding along the branching fork, and a character-by-character typewriter reveal synchronized with the ink drawing animation.

---

## 1. Full-Screen Horizontal Canvas & Auto-Panning (`App.tsx` & `WorryTreeCanvas.tsx`)

- **Remove Right Panel**:
  - Eliminate the 30% right summary sidebar so the snow-white paper canvas (`#faf9f6`) occupies **100% of the viewport**.
  - Move "Past Journals" and "New Entry" into a whisper-quiet, minimal top-right header bar so nothing crowds the paper.
- **Left-to-Right Horizontal Flow**:
  - Instead of stacking vertically, the entire journey flows **horizontally from left to right** (`flex-row items-center`), with smooth automatic horizontal panning (`scrollTo({ left, behavior: 'smooth' })`) as each new cursive line sketches forward.
  - Users can also freely pan horizontally or drag nodes with subtle elastic spring physics.

---

## 2. Visual Language: Inline Nodes "In Between" the Line & Over the Line

- **Nestled Inline Nodes (Matching Reference Image 2)**:
  - Each thought node is compact (`max-w-[260px]` to `300px`), unboxed, and sits **directly in the gap between an incoming horizontal cursive line on its left and an outgoing cursive line on its right**—just like:
    `~~~~~~~ "Something needs to change." / But I can't quite put my finger on what. ~~~~~~~`
  - Typography is delicate, small (`13px–15px` serif & italic subline), intimate, and never bulky.
- **Long, Flowy Horizontal Cursive Lines**:
  - Generous horizontal SVG paths (`width="260"` to `"360"`) featuring organic waves, gentle hills, and cursive loops that draw from left to right using Framer Motion `pathLength: 0 → 1`.
- **Curved Text Over the Forking Lines (Matching Reference Image 1)**:
  - When the horizontal line reaches the decision fork, it splits smoothly into an **upper sweeping curve** and a **lower sweeping curve** opening to the right.
  - Using SVG `<textPath>`, the choice text literally curves and rests **along the ink line itself**:
    - Upper curve: *"are you able to take a small step on this?"*
    - Lower curve: *"or is it outside your hands today?"*
  - Clicking either curved line (or its subtle endpoint) selects that path and continues the horizontal line along that branch.

---

## 3. Character-by-Character Typewriter Animation

- **`CharacterTypewriter` Component**:
  - A custom Framer Motion component that splits quotes, reframes, and prompts into individual characters (`<span>` elements) and reveals them sequentially (`staggerChildren: 0.022s`) right as the incoming horizontal ink line finishes drawing.
  - Also supports character-by-character reveal inside SVG `<textPath>` so the text along the upper and lower fork curves writes itself along the curve right after the fork lines draw.

---

## 4. The Horizontal Step-by-Step Flow

1. **Lead-in Line → Node 1 (The Worry)**:
   - A horizontal wavy line with a cursive loop draws in from the left edge and pauses at a small inline space:
     - *“Something is occupying my mind.”* (Character-animated)
     - Compact underlined input for the worry + tiny lowercase context words (`work`, `health`, `relationships`, etc.) + `follow the line →`.
2. **Long Cursive Wave Line → Node 2 (Comforting Reframe)**:
   - A 300px horizontal cursive wave with a loop sketches rightward, pausing for a small inline text block nestled in the line:
     - *“I know this feels heavy right now.”*
     - *But you don't have to carry the whole future today—one gentle breath is enough.* (Revealed character-by-character, with a tiny shuffle icon and `continue →`).
3. **Horizontal Diverging Fork (Image 1 Exact Style)**:
   - The single horizontal line splits rightward into two long sweeping Bézier curves (Upper & Lower) with `<textPath>` character-animated labels riding directly on the curves:
     - **Upper Curve**: *“I can take a small step on this”*
     - **Lower Curve**: *“or is it outside my hands today?”*
4. **Upper Branch (Actionable Path — Horizontal Continuation)**:
   - **Compact 3-in-a-Row Journal Notes (`What?`, `When?`, `How?`)**: Three small, delicate borderless/underlined note columns nestled along the horizontal line with a `done →` trigger.
   - **Mini Timing Split (`do it now` / `schedule for later`)** along the line.
   - **Final Positive Meaning & Note**: A final long cursive line draws into the warm closing reflection (*what this worry positively says about you* + *a positive note to carry forward*).
5. **Lower Branch (Outside Control Path — Horizontal Continuation)**:
   - A long, soothing horizontal wave draws directly from the lower fork into the **Positive Meaning & Note** (*“This worry only exists because you care deeply...”* + *“Breathe out; you are safe right now.”*).
