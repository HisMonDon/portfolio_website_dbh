# Portfolio Website (Detroit: Become Human Edition)

**Chenyu Lu's portfolio**, rebuilt in React, TypeScript and Three.js with an interface inspired by *Detroit: Become Human*. At its centre is a 3D android avatar that you can actually talk to: it answers questions in a branching dialogue using real recorded facial performances, captured with webcam face tracking and replayed frame by frame onto a morph-target model, complete with a temple LED ring, synced transcripts and choice markers straight out of the game. Live at [chenyu.lu](https://chenyu.lu).

## Core Philosophy: Let the Portfolio Introduce Itself

A list of projects cannot convey how someone talks about their work. Instead of a static About page, this site lets visitors ask the avatar questions and hear the answers in the owner's own voice and expressions. Everything else, from the drifting sensor-mesh background to the HUD sound effects, is there to make that conversation feel like an interface rather than a web page.

## Key Milestones Completed

- [x] **Conversational Avatar:** A 17-node dialogue state machine (intro, four openings, nine follow-ups, two closings and a loop back) where each branch works as a checklist, so closings unlock only after every follow-up in that branch has been heard.
- [x] **Recorded Facial Performances:** Each answer is a `.webm` audio track paired with per-frame MediaPipe blendshape scores and head and body pose, recorded with the companion `face_mapping_sandbox` project.
- [x] **Blendshape Calibration:** 60 neutral frames establish a resting baseline, then blink curves, per-shape exaggeration and mouth smoothing make the performance read clearly on the model.
- [x] **Seamless Clip Transitions:** Blendshapes and bone quaternions are interpolated (with slerp for rotations) over 320 ms with smoothstep easing, so switching answers never pops.
- [x] **Word-Synced Transcripts:** Offline Whisper word timestamps, aligned to the authoritative script, let the transcript type out each word exactly as it is spoken, with no speech recognition at runtime.
- [x] **Android HUD Styling:** A rim-lit synthetic skin shader, a rotating temple LED ring with blue, yellow and red (critical) states and in-game style choice markers.
- [x] **Scroll-Driven Rotation:** The avatar turns as you scroll between sections, about one full turn per viewport, then eases back to face the visitor.
- [x] **Sensor Mesh Background:** A canvas node network that drifts on its own and scatters away from the cursor.
- [x] **Case-Study Projects:** Project cards open into technical deep dives and Q&A for Vera, Chaos Roll, Distill and more, with the avatar's own idle clip playing live as one card's preview.
- [x] **Working Contact Form:** Messages are delivered through EmailJS directly from the browser.
- [x] **Cinematic Loading and Sound:** A video loading screen, hover and select interface sounds and a global mute.
- [x] **Tested Core:** 69 Vitest cases across dialogue flow, clip format, playback, transitions, calibration, transcripts, scroll rotation and section layout.
- [x] **Continuous Deployment:** Every push to `main` is built and deployed to GitHub Pages, with Cloudflare Web Analytics.

## Architecture

| Component | Description |
| --- | --- |
| `src/App.tsx` | Full-page scroll stage, section tracking with `IntersectionObserver`, navigation and loading state. |
| `src/LoadingScreen.tsx` | Intro video loading screen. |
| `src/components/NavBar.tsx` | Section navigation showing the previous, current and next section. |
| `src/components/NodeField.tsx` | Interactive drifting node-network background. |
| `src/components/PersistentAssistant.tsx` | Desktop dock that keeps the avatar's WebGL context and dialogue state alive across sections. |
| `src/features/faceChat/FaceChatWidget.tsx` | The conversation UI: choices, history, transcript, mute and help. |
| `src/features/faceChat/dialogueGraph.ts` / `dialogueFlow.ts` | Dialogue state machine and choice visibility rules. |
| `src/features/faceChat/ClipAvatar.tsx` | Three.js scene that loads `avatar.glb` and applies recorded frames. |
| `src/features/faceChat/clipFormat.ts` / `clipPlayback.ts` | Clip contract shared with `face_mapping_sandbox`, loading, caching and audio-synced playback. |
| `src/features/faceChat/blendshapeCalibration.ts` | Baseline removal, blink curves, exaggeration and smoothing. |
| `src/features/faceChat/frameTransition.ts` | Eased interpolation between clips. |
| `src/features/faceChat/avatarVisuals.ts` | Synthetic skin rim shader and the temple HUD ring. |
| `src/features/faceChat/liveTranscript.ts` | Word-timed transcript reveal. |
| `src/features/faceChat/scrollRotation.ts` | Scroll-to-rotation mapping with jump filtering. |
| `src/sections/` | Projects, honours, resume, skills and contact sections. |
| `src/data/` | Project case studies and honours. |
| `tools/generate-face-chat-timings.mjs` | Offline Whisper alignment that writes `transcriptTimings.json`. |

## Under the Hood

### From Webcam to Avatar

1. **Record:** In `face_mapping_sandbox`, MediaPipe tracks the face while the answer is spoken, exporting audio plus a JSON track of timestamped blendshape scores and pose.
2. **Convert:** `clipFormat.ts` maps the shared `CLIP_FORMAT.md` contract (seconds, `name` and `score`) to the player's internal frames (milliseconds, `categoryName` and `score`).
3. **Calibrate:** The same calibration constants as the recording harness are applied, keeping both repositories in lockstep.
4. **Play:** A frame cursor follows the audio's `currentTime`, so expressions stay locked to the voice even if rendering stutters.

### Transcripts Without Runtime Speech Recognition

`npm run align:transcripts` decodes each clip with `ffmpeg-static`, runs local Whisper word-timestamp inference through Transformers.js and aligns the recognised words to the authoritative text in `transcriptScript.ts`. The website only ships the resulting JSON. None of the model, FFmpeg or alignment code is imported by the site.

## Quick Start

### Requirements

- Node.js 22 or newer

### Setup

```bash
npm install
cp .env.example .env    # EmailJS service, template and public key for the contact form
npm run dev             # http://localhost:5173
```

### Other Scripts

```bash
npm run build           # type check and production build to dist/
npm run preview         # serve the build
npm test                # Vitest suite
npm run lint            # oxlint
npm run align:transcripts                   # regenerate all transcript timings
npm run align:transcripts -- --clip=1_0     # regenerate specific clips
```

See [tools/README.md](tools/README.md) for alignment options. Pushes to `main` deploy automatically through `.github/workflows/deploy.yml`.

*Detroit: Become Human* is a trademark of Quantic Dream. This is a fan-inspired personal site with no affiliation.
