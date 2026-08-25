# 🎬 ShortKit Multi — TikTok, Shorts & Reels Toolkit

A browser extension (Chrome, Manifest V3) that supercharges short-video platforms:
**TikTok**, **YouTube Shorts**, and **Instagram Reels**.

> 100% local · zero tracking · no build step

## ✨ Features

### 🔊 Audio
- **8-Band Equalizer** — presets: Bass Boost, Treble, Vocal, Pop, Rock, Electronic, Jazz, Classical, Dance
- **Adaptive Volume Normalizer** — real-time RMS-based loudness balancing
- **360° Spatial Audio (8D)**
- **Playback Speed** — 0.25×–4×

### 📺 Video
- **Background Play** — audio continues when the tab is hidden
- **Smart Auto-Pause** — pauses videos when another tab plays media
- **Rotate Video** — 90°/180°/270° with letterbox
- **Smart Zoom** — cursor-follow zoom, scroll to adjust (1.2×–5×)
- **Clean Mode** — hide UI overlays and clutter

### 📥 Download
- Inline toolbar: MP4 / MP3 / frame screenshot on every video
- Paste-any-URL download box in the popup
- Multi-provider failover for reliability
- Keyboard shortcut `S` captures the current frame

### ⌨️ Keyboard Shortcuts
| Key | Action |
|---|---|
| ← / → | seek −3s / +3s |
| , / . | slower / faster playback |
| Z | toggle Smart Zoom |
| S | screenshot current frame |

### ⏱ Productivity
- Watch-time tracking per day (videos + minutes)
- Daily limits with **remind** or **block** mode
- Watch history (last 200 items)

## 🚀 Installation (Developer Mode)

1. Clone or download this repo
2. Open `chrome://extensions/` → enable **Developer mode**
3. Click **Load unpacked** → select the project folder
4. Open TikTok / YouTube Shorts / Instagram Reels

## 🗂 Project Structure

```
manifest.json                  # MV3 manifest, minimal permissions
src/
  core/                        # utils + storage wrapper
  background/service-worker.js # downloads + cross-tab media coordination
  content/                     # entry point + message router
  modules/
    platforms/                 # TikTok / YouTube / Instagram adapters
    audio/audio-engine.js      # Web Audio API: EQ, normalizer, 8D, speed
    video/video-tools.js       # bg play, rotate, zoom, clean mode
    download/download-manager.js
    productivity/watch-tracker.js
  popup/                       # control center UI
```

## 🔒 Privacy

- No analytics, no telemetry
- Settings stored in `chrome.storage.sync`; history/stats in `chrome.storage.local`
- Third-party download APIs are contacted **only when you click download**

## 🛠 Tech Stack

Manifest V3 · vanilla JavaScript · Web Audio API · Canvas API · Chrome Storage API

## 📜 License

MIT
