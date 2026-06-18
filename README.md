```text
 /\_/\   /\_/\
( o.o ) ( -.- )   * DUET *
 > ^ <   > ^ <    two souls, one model, spoken aloud
```

# Duet — 5-inch Two-Persona LLM Dialogue (voice edition)

A glanceable 5-inch dashboard (1440×2560 portrait, Electron) where **two characters —
Tsuki 🛰️ and Selene 🌙 — take turns dissecting whatever you give them**, out loud.

It's a *single-actor theatre*: **one** LM Studio model plays both personas, alternating over a
shared, expanding transcript. The persona/lingo is theatre; the substance comes entirely from
the **role + task** the chosen mode assigns. Each line is synthesized to speech on the fly
(via WaifuVoice), revealed novel-style as it's spoken, and the next turn waits until **both** the
text has finished typing **and** the audio has finished playing.

## What it does
- **Drop a source** — paste a "Copy as path" file (doc / code / image-with-vision) or raw text.
- **Pick a mode** — 🔥 Roast · ⚖️ Academic Duel · 🎬 Comedy Skit · 🔍 Deep Dive. Each assigns the
  two roles and frames the turns (Duel & Deep Dive also enforce staying on-thread).
- **Watch them talk** — Tsuki & Selene animate, speak in distinct voices, and type their lines
  in a VS-Code-styled log.

## Requirements
- **Node.js** (Electron app).
- **[LM Studio](https://lmstudio.ai)** — start the local server and load one model. For image
  sources, load a **vision** model.
- **WaifuVoice** (VoxCPM) running locally (default `http://localhost:3113`) for voice. Without it,
  Duet **falls back to text-only** automatically.

## Run
```bash
npm install
npm start            # full-screen on the 5-inch panel
npm run dev          # normal resizable window
```
Set the LM Studio + WaifuVoice URLs (and toggle voice) in ⚙ settings. Press **Esc** to quit.

## How it works
- **Turn-gating:** per turn → LLM line → WaifuVoice synth → typewriter + audio play together →
  next turn only fires after text-end **and** audio-end.
- **Distinct voices:** Tsuki and Selene each carry their own `voice_design` prompt.
- **VRAM safety:** a live gauge polls WaifuVoice's `/api/vram`, warns before a run if a big LLM +
  voice model won't fit your GPU, and offers one-tap **unload voice** to free VRAM.

## Credits
- **Concept, design & development:** **Cesar Borgenkrans** — conceptual author and developer.
- **Part of [SparkleSnap](https://sparklesnap.dev)** · [github.com/cesarborgenkrans-gif](https://github.com/cesarborgenkrans-gif)
- **Characters:** Tsuki Hoshi & Selene Moonlight (SparkleSnap).
- **Code co-author:** **Claude Opus 4.8-senpai** 🤖
- **Voice:** [WaifuVoice](https://github.com/cesarborgenkrans-gif) (VoxCPM).

© 2026 Cesar Borgenkrans / SparkleSnap. Original concept & characters are the author's
intellectual property. **Private repository — all rights reserved.** Do not redistribute the
code, the characters (Tsuki & Selene), or the SparkleSnap identity.

```text
 /\_/\
( ^.^ )   thanks for visiting~
 > ^ <    one model, two souls, spoken into being
```
