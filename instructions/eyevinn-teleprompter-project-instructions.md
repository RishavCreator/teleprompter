# Eyevinn/teleprompter — Project Instructions & Extension Guardrails

**Purpose of this file:** working rules for extending the [Eyevinn/teleprompter](https://github.com/Eyevinn/teleprompter) repo for Strange Sphere without breaking the core sync/scroll logic as you layer in custom features over time. Treat this as the file you (or any AI coding assistant, e.g. Claude Code) reads before touching anything.

---

## 1. What This Repo Actually Is (confirmed from source)

Apache-2.0 licensed, Node.js + WebSocket app. No build step, no framework — plain JS/HTML/CSS.

```
open-teleprompter/
├── server.js           # Node.js WebSocket server — THE STATE OWNER, be careful here
├── package.json         # Node deps (mammoth.js is the only notable one — docx parsing)
├── controller.html/.css/.js   # phone/tablet remote — this IS your "remote app," already built
├── display.html/.css/.js      # the actual teleprompter screen
├── index.html
├── Dockerfile / .dockerignore
```

**Architecture:** `server.js` holds session state (script text, scroll position, WPM, playing/paused) and broadcasts it over WebSocket to every connected `display.html` client. `controller.html` is the phone-facing remote — it already does what §5 of the earlier build spec asked for (QR-free, just open the URL on your phone over LAN). Multiple displays can sync off one controller.

**Built-in features you don't need to rebuild:** WPM-based auto-scroll (60–300 wpm), .docx/.txt manuscript upload via mammoth.js, segment timer with countdown, scheduled start time, mirror mode, on-air indicator, live text editing, multi-display sync, fullscreen (F11/F).

**What it does NOT have (things from your spec you'd still need to add):** voice-activated scrolling, recording (ffmpeg/4K), captions, live streaming (RTMP), external mic selection, clean-audio filtering, script library/SQLite storage (currently single in-memory session, no persistence), Devanagari-aware font handling.

---

## 2. Golden Rule: Protect the WebSocket State Contract

`server.js` is the single source of truth. Every bug that will bite you later comes from one place: **inconsistent state shape between server.js, controller.js, and display.js.**

Before adding any feature:
1. Read the message schema `server.js` currently broadcasts (state object fields: script text, position, wpm, playing, mirror, on-air, etc.) and write it down in `docs/protocol.md` in your fork. There is no formal schema in the repo today — you are the one introducing discipline here.
2. **Never repurpose an existing field for a new meaning.** If you need a new piece of state (e.g. `voiceScrollEnabled`, `recordingActive`), add a new field with a clear name — don't overload `mirror` or `playing` to mean two things.
3. **New fields must have safe defaults.** Old controller/display code (or a stale browser tab that didn't reload) must not crash if a field is missing. Guard every new field read with `?? defaultValue`.
4. Any state change should flow through the server, never client-to-client. If you add a feature where the display needs to tell the controller something (e.g. "recording started"), it still goes display → server → controller, keeping server.js the only place that owns truth.

---

## 3. Git Workflow (so changes don't compound into a mess)

- **Fork, don't PR-blind.** Fork `Eyevinn/teleprompter` into your own repo (e.g. `sonu/strange-sphere-teleprompter`) so you're not blocked by upstream review cycles, but keep `upstream` as a remote so you can pull bugfixes.
  ```bash
  git remote add upstream https://github.com/Eyevinn/teleprompter.git
  git fetch upstream
  git merge upstream/main   # periodically, to pick up their fixes
  ```
- **Branch per feature, always.** Never commit new features directly to `main`. Suggested branch names: `feature/voice-scroll`, `feature/ffmpeg-recording`, `feature/devanagari-fonts`, `feature/script-library`.
- **main must always be the version you'd actually use on a shoot.** If a feature branch isn't finished, it stays a branch. Don't merge half-working recording code into main the night before you need to shoot an episode.
- **Tag before big changes.** `git tag pre-voice-scroll` before starting a risky feature, so rollback is one command: `git checkout pre-voice-scroll`.
- **Commit messages describe *why*, not just *what*** — e.g. `fix: guard missing wpm field to prevent display crash on stale reconnect` not `fix bug`.

---

## 4. Safe Order to Add Your Planned Features

Add in this order — each one is close to self-contained and low-risk to the existing sync logic. Don't jump ahead; each layer assumes the previous one is stable and tested on an actual shoot, not just localhost.

1. **Devanagari font handling (lowest risk)** — pure CSS. Edit `display.css` and `controller.css` font-family stacks to include a Devanagari-capable font (Noto Sans Devanagari) as fallback. Test with a real Strange Sphere script (mixed Hindi/English), not lorem ipsum. This cannot break WebSocket logic — it's presentation-only.
2. **Script persistence (SQLite)** — currently the app holds one script in memory per server run. Add a `scripts` table and two new HTTP routes (`GET/POST /api/scripts`) in `server.js`, separate from the WebSocket state broadcast. Keep this additive: the existing "paste text into controller" flow must keep working even if the database is empty or unavailable.
3. **External mic + clean audio filter** — this lives entirely in `display.html`/`display.js` (or a new page) using `navigator.mediaDevices` and the Web Audio API / an ffmpeg pass on the recorded file. Does not touch server.js state at all — build it as an isolated module first, wire in a menu toggle after it works standalone.
4. **Recording (ffmpeg, 4K, no watermark)** — add as a new backend endpoint (`/api/record/start`, `/api/record/stop`) that shells out to ffmpeg, independent of the scroll WebSocket. Test recording and scrolling separately before testing them together.
5. **Voice-activated scrolling (highest risk, do last)** — this is the one most likely to fight you, especially with Hinglish code-switching (you already hit this exact problem with phrase-matching in the Premiere pipeline). Build it as an *optional override* on top of the existing WPM auto-scroll, not a replacement:
   - Add a `voiceScrollEnabled` boolean to state.
   - When off (default), existing WPM auto-scroll behaves exactly as today — untouched.
   - When on, whisper.cpp streaming output nudges the scroll position, but WPM auto-scroll stays as the fallback/safety net if transcription confidence drops or the narrator goes off-script — mirror the "advisory phrase string" fallback pattern you already designed for the Premiere bad-take detector.
   - Never let a voice-scroll bug silently freeze the display — if in doubt, keep scrolling at the last known WPM rather than stopping.

---

## 5. Testing Checklist Before Trusting Any Change on a Real Shoot

Run this manually every time you merge a feature branch into `main`, before an actual recording session:

- [ ] Fresh `npm install && npm start` from a clean clone — confirms you didn't leave an undocumented dependency
- [ ] Load `controller.html` from the phone over LAN (not localhost) — confirms Wi-Fi/network config still works
- [ ] Load `display.html` on the recording machine — confirms sync still works end-to-end
- [ ] Paste a real Strange Sphere script with mixed Devanagari/Roman text and em-dash-free formatting — confirms rendering doesn't break on real content
- [ ] Start/pause/reset from the controller — confirms WebSocket round-trip still works
- [ ] Reload the display mid-session (simulates a crash) — confirms it re-syncs to current state instead of showing stale/blank content
- [ ] If recording/voice-scroll features are enabled: run a full 2–3 minute take end to end, don't just smoke-test in isolation

If any of these fail, **do not shoot with that branch** — revert to the last tagged working commit.

---

## 6. Environment / Config Notes

- `PORT` env var controls both HTTP and WebSocket port (default 8080) — keep this consistent if you add a reverse proxy or firewall rule for phone access.
- For LAN phone access, the desktop machine's local IP (not `localhost`) is what goes on the controller URL — worth scripting a small `npm run show-ip` helper that prints `http://<local-ip>:<port>/controller.html` so you're not hunting for `ipconfig` output before every shoot.
- Docker deployment is available (`Dockerfile` in repo) if you ever want this running on a small dedicated box rather than your main editing machine — useful once you have ffmpeg recording in the mix and don't want it competing for resources with Premiere/After Effects.

---

## 7. Anti-Patterns to Avoid (things that will bite you in 3 months)

- ❌ Adding feature-specific state fields directly into the existing scroll-state broadcast object without namespacing — namespace new features, e.g. `state.recording = { active, startedAt }` instead of flat top-level fields, so it's obvious what belongs to what.
- ❌ Testing only on localhost — LAN behavior (phone ↔ desktop) is where this class of app actually breaks.
- ❌ Merging a "mostly working" voice-scroll build into `main` the day before a shoot — this is exactly the kind of feature that needs its own stable branch until proven across several real sessions.
- ❌ Hardcoding your current Wi-Fi network's IP range anywhere — you'll change routers eventually.
- ❌ Skipping the `docs/protocol.md` schema doc — six months from now you won't remember which state field means what, and neither will an AI assistant picking the project back up.
