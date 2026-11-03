# Hand-Drawn Journal Flowchart & Paper Focus Planner

Transform the Decenter worry journal into an authentic hand-drawn sketchbook flowchart experience inspired by personal graphic journalism, featuring an ungridded lavender-blush paper canvas, hand-inked monochrome cards, organic hand-drawn arrow paths, and an icon-only paper modal focus planner.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following directions have been confirmed based on your design selections and reference imagery:

- **Confirmed Canvas Atmosphere**: Soft lavender-blush paper canvas (`#eee5e9`) with **no background grid**, creating a clean, tactile sketchbook feeling.
- **Confirmed Card Styling**: Monochrome white paper cards framed with authentic thick sketch-ink borders and subtle paper elevation.
- **Confirmed Connector Routing**: Organic hand-drawn ink arrows with loose casual bezier curves, complete with hand-lettered branch labels (*Yes*, *No*, *Breathe*, *Action*).
- **Confirmed Typography**: Expressive hand-drawn journal lettering for prompts, user reflections, reframes, and cards, paired with clean humanist body text.
- **Confirmed Focus Planner**: Redesigned from a standard side panel into a physical **paper sheet modal** displaying key user reflection highlights, with **icon-only action buttons** (calendar, checkmark, trash, export, close) with clean hover tooltips.

---

## 1. Overview & Core Concept

- **What It Does**: Guides individuals through CBT (Cognitive Behavioral Therapy) worry-tree processing using a visually disarming, deeply personal hand-drawn journal flowchart. Users write down heavy thoughts, identify triggers, challenge cognitive distortions, choose agency pathways, and commit to actions or mindful release.
- **Target Audience**: Anyone managing overthinking, anxiety, or decision fatigue who finds clinical or sterile tech interfaces cold or intimidating.
- **Key Value**: The tactile, hand-drawn comic/journal visual language removes clinical resistance and makes emotional regulation feel like gentle, honest sketching in a personal notebook.

---

## 2. User Experience & Visual Design

### A. Canvas & Atmosphere
- **Canvas Plane**: Pure, ungridded soft lavender-blush paper (`#eee5e9`). Removed all dotted and square grids to match the raw paper sheets of the reference flowcharts.
- **Fluid Panning & Zoom**: Infinite 2D panning with organic easing; auto-focus smoothly tracks each active node as the user progresses down the vertical decision ladder.

### B. Hand-Inked Card Architecture
- **Structure**: Clean white paper cards (`#ffffff`) with hand-inked black outlines (`border-[2.5px] border-black` with slightly softened, organic hand-drawn contours).
- **Typography Pairings**:
  - *Display & Prompts*: Journal handwriting font (`Patrick Hand` / `Caveat` / `Architects Daughter`) for all titles, questions, decision badges, and user reflection inputs.
  - *Quotes & Reframes*: Expressive hand-lettered calligraphy with natural ink contrast.
  - *Secondary Metadata*: Quiet humanist sans (`DM Sans`) for precise dates and timestamps.

### C. Organic Hand-Drawn Connectors
- **Curved Ink Paths**: Organic cubic bezier splines with gentle directional drift mimicking hand-drawn ballpoint/felt-pen lines rather than rigid computer geometry.
- **Handwritten Decision Badges**: Centered along connector curves (*Yes*, *No*, *Where from?*, *Can I act?*) rendered as clean unboxed hand-inked annotations.
- **Hand-Drawn Arrowheads**: Distinctive angled pen strokes pointing directly to the receiving card.

### D. Paper Focus Planner Modal
- **Physical Sheet Metaphor**: Floats as an authentic journal memo pad / tear-off paper sheet with gentle drop shadow (`shadow-[8px_8px_0px_#000]`), paper texture, and subtle torn/ruled line details.
- **Key User Insights Display**:
  - The heavy thought (Root Worry) highlighted in prominent ink script.
  - Context & trigger categorization (Work, Health, Personal, etc.).
  - Agency verdict (*Actionable* vs *Release & Let Go*).
  - Concrete Next Steps (What, How, When).
  - Somatic breathwork & emotional release closure status.
- **Icon-Only Control Bar**: All actions rendered strictly as sleek, high-intent icons with tooltip assistance:
  - 📅 **Add to Calendar**
  - ✓ **Mark Completed**
  - ✎ **Edit Thought**
  - ⎘ **Copy Summary**
  - ✕ **Close Paper Sheet**

---

## 3. Key Product Decisions & Trade-Offs

- **No Canvas Grid vs. Subtle Dot Grid**:
  - *Decision*: Complete removal of background grid in favor of clean lavender-blush sketchbook paper.
  - *Why*: The reference images specifically succeed because of their raw white/colored paper simplicity, which gives full focus to the hand-drawn ink cards without visual static.
- **Icon-Only Action Bar in Focus Planner**:
  - *Decision*: Replace long text buttons (*"Schedule in Google Calendar"*, *"Mark Completed"*) with high-contrast icon buttons with clear tooltips.
  - *Why*: Direct user request; keeps the paper modal focused on the content of the worry while preventing button text crowding.
- **Vertical Decision Flow with Organic Branching**:
  - *Decision*: Maintain the natural top-to-bottom user flow (Stem -> Perspective Reframe -> Agency Check -> Left/Right Decision Branch -> Closure) connected by organic curves.
  - *Why*: Directly emulates the beloved "Someone has an opinion about you" and "Do I have time to be lazy" flowcharts from the user's reference images.

---

## 4. Technical Architecture & Component Mapping

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Decenter App Root                             │
├────────────────────────────────┬───────────────────────────────────────┤
│ Top Minimal Bar                │ Floating Journal Dock                 │
│ • Title & Session Time         │ • New Page · Past Journals · Plan     │
└────────────────────────────────┴───────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  WorryTreeCanvas (No-Grid Canvas)                      │
│                                                                        │
│   [STEP 0: Seed Thought Card (Hand-Inked White Card)]                 │
│                       │                                                │
│                  (Organic Ink S-Curve)                                 │
│                       ▼                                                │
│   [STEP 1: Context Category Card]                                      │
│                       │                                                │
│                  (Organic Ink S-Curve)                                 │
│                       ▼                                                │
│   [STEP 2: Sparking Situation Card]                                    │
│                       │                                                │
│                  (Organic Ink S-Curve)                                 │
│                       ▼                                                │
│   [STEP 3: Perspective Check / Mindful Reframe]                        │
│                       │                                                │
│                  (Organic Ink S-Curve)                                 │
│                       ▼                                                │
│   [STEP 4: Agency Check Card (YES / NO)]                               │
│            /                                  \                        │
│     (Curved Left Arrow)                 (Curved Right Arrow)           │
│           ▼                                    ▼                       │
│   [NO Branch: Emotional Freedom]        [YES Branch: Action Ladder]    │
│           │                                    │                       │
│   [Grounding Breath Node]               [What / How / When Steps]      │
│           │                                    │                       │
│           └────────────────┬───────────────────┘                       │
│                            ▼                                           │
│               [TERMINAL: Let Worry Go Card]                            │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Focus Planner Paper Modal (Icon-Only Actions)              │
│  • Authentic paper sheet overlay with sketch drop shadow               │
│  • Important user thought digest: Root, Trigger, Ladder, Verdict       │
│  • Icon controls: [📅 Calendar] [✓ Done] [✎ Edit] [⎘ Copy] [✕ Close]   │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Modules & Files to Update
1. `src/components/WorryTreeCanvas.tsx`:
   - Remove `bg-bauhaus-grid` background; apply clean `#eee5e9` lavender-blush paper canvas.
   - Update SVG connector curves to organic hand-drawn splines (`C` and `Q` paths with natural ink wave).
   - Style card boxes with hand-inked borders and handwriting fonts.
2. `src/components/ActionPlanSidebar.tsx`:
   - Redesign as a centered / docked **Paper Sheet Modal**.
   - Render key user details in authentic journal layout.
   - Replace wordy buttons with an **icon-only** action bar with rich tooltips.
3. `src/index.css`:
   - Ensure Google Fonts for journal handwriting (`Patrick Hand`, `Caveat`) are loaded and applied across headings and cards.
4. `src/components/FloatingDiaryDock.tsx`:
   - Ensure clean dock styling matching the new aesthetic.
