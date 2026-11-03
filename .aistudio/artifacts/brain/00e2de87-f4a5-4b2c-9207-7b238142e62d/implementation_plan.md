# Canvas Visual Polish, Auto-Zoom, Somatic Care & Closure Ending

A comprehensive upgrade to elevate the metacognitive worry canvas into a calming, reassuring, and completely resolved user experience for people experiencing anxiety and overthinking.

> [!IMPORTANT]
> **Confirmed Choices**:
> 1. **Closure Ending**: Dedicated calming **"Let the worry go" closure node with hand-drawn ink seal stamp** connecting all branch outcomes (Immediate Action, Scheduled Sign-off, and Cognitive Release).
> 2. **Somatic Distress Intervention**: When keywords like *"not feeling well"*, *"want to cry"*, or somatic stress appear, an **unobtrusive inline pill button with a quick 3-breath counter** appears right under the text input.
> 3. **Affirmation Presentation**: Removed dark card box completely; rendered as **pure floating text with subtle opacity (`opacity-70`) and organic cursive slant** beside the situation.
> 4. **Mobile & Keyboard Usability**: Pressing `Enter` commits and advances to the next node; mobile inputs include a small ink **`Done ✓`** button in the bottom right corner.
> 5. **Camera Auto-Zoom**: The canvas dynamically centers and zooms in on whichever node is currently active so users never have to search or manually pan.

---

### 1. User Experience & Visual Design

#### A. Typography Scaling
- Scale up the `Gaegu` font across the entire canvas so all text is boldly legible:
  - Textarea inputs: `text-xl` to `text-2xl` with generous line-height (`leading-relaxed`).
  - Line labels: `text-[16px]` step names and `text-[14px]` action labels.
  - Decision buttons: `text-base` to `text-lg` with tactile hand-drawn border padding.

#### B. Camera Auto-Framing & Dynamic Auto-Zoom
- Maintain smooth camera transitions (`transition: transform 450ms cubic-bezier(0.16, 1, 0.3, 1)`).
- When a user unlocks or focuses on a node (Node 0, Category, Situation, Agency, Action Ladder, or Final Ending), compute the node's canvas $(X, Y)$ coordinate and auto-center it in the visible viewport at a comfortable reading zoom ($1.05\times$ to $1.15\times$).

#### C. Floating Unboxed Cursive Affirmation Note
- Discard the black box container.
- Render the constructive reframing question as pure floating typography directly on the textured canvas:
  - Stylized cursive slant with gentle reduced opacity (`opacity-75`).
  - Subtle ink refresh control (`Try another angle ↺`) styled as unboxed ink lettering.

#### D. Input Commit: Enter Key & Mobile "Done" Button
- Typing in textareas supports pressing `Enter` (without Shift) to lock in the input, auto-scroll to, and activate the next node.
- Display a small hand-drawn **`Done ✓`** button in the corner of active text inputs for mobile/touchscreen users.

#### E. Inline Somatic Distress Detection
- Monitor typed text for distress cues: `not feeling well`, `want to cry`, `crying`, `physically sick`, `exhausted`, `shaking`, `chest tight`, `can't breathe`.
- Automatically show a gentle inline pill button:
  `🌿 Take a grounding breath (0/3)`
- Clicking guides a calm 3-second inhale/exhale sequence directly within the node to soothe the nervous system before problem-solving.

#### F. "Let the Worry Go" Terminal Closure Node
- Every path (Immediate Action, Scheduled Sign-off, and Cognitive Release) now draws an arrow into a definitive final terminal node:
  ```
  ┌────────────────────────────────────────────────────────┐
  │                                                        │
  │                  LET THE WORRY GO.                     │
  │                                                        │
  │   "You have externalized the thought and determined   │
  │    what is within your control. Your mind can put     │
  │    this down now. Take a deep breath."                 │
  │                                                        │
  │                ╭──────────────────────╮                │
  │                │  ✓ WORRY RELEASED   │  (Ink Seal)     │
  │                ╰──────────────────────╯                │
  │                                                        │
  │            [ Start fresh worry / Reset ]               │
  └────────────────────────────────────────────────────────┘
  ```

---

### 2. Technical Architecture & Component Mapping

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             WorryTreeCanvas                              │
│  - Tracks activeStage ('seed' -> 'category' -> 'situation' -> 'agency'  │
│                       -> 'action/release' -> 'closure')                 │
│  - viewportCenterOnNode(x, y, zoom) auto-frames active node             │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐     ┌──────────────────┐
│   Node Textarea  │    │ Floating Cursive │     │ Terminal Closure │
│ - text-xl font   │    │ - Pure text      │     │ - "LET IT GO"    │
│ - Enter to done  │    │ - Opacity-70     │     │ - Ink seal stamp │
│ - Mobile [Done✓] │    │ - No box frame   │     │ - Clean finale   │
│ - Somatic pill   │    └──────────────────┘     └──────────────────┘
└──────────────────┘
```

---

### 3. Implementation Steps
1. **Camera Zoom & Pan Controller**: Implement automated bounding-box centering for each step transition.
2. **Input Enter & Mobile Done Handlers**: Add keyboard `onKeyDown` listener and mobile `Done ✓` trigger to text inputs.
3. **Floating Cursive Affirmation**: Restyle companion note from a dark box into pure floating cursive with `opacity-75`.
4. **Somatic Distress Watcher**: Add regex detector for somatic distress phrases with an inline 3-breath pill.
5. **Closure Terminal Node**: Build the "LET THE WORRY GO" node with connecting SVG bezier arrows and circular hand-drawn ink stamp.
6. **Verification**: Run `lint_applet` and `compile_applet` to confirm flawless build.
