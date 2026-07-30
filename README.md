# ScreenFlow AI

ScreenFlow AI is a shared video workspace delivered as an installable mobile web app, a Chrome tab-capture extension, and a full Electron desktop application. The product includes recording, editing, live calls, screen annotation, whiteboarding, AI notes, and football analysis.

---

## Folder Structure

```text
ScreenFlowAI/
|-- package.json             # Node.js dependencies and scripts
|-- vite.config.js           # Vite compilation configuration
|-- index.html               # Entry HTML page
|-- public/                  # PWA manifest, service worker, offline shell, icons
|-- extension/               # Chrome Manifest V3 capture companion
|-- electron/
|   |-- main.js              # Main process, IPC channels, media streaming, global mouse hook
|   |-- preload.js           # Secure context bridge between Electron and React
|   |-- database.js          # Local JSON project store operations
|   `-- renderer-engine.js   # FFmpeg exporter and compositor
|-- scripts/                 # Health, icon, and platform build tools
`-- src/                     # Shared React application
    |-- main.jsx             # Routing and entrypoint mount
    |-- index.css            # Core layout styling and visual tokens
    |-- components/          # Frameless TitleBar, Sidebar navigation
    `-- pages/               # Dashboard, Recording Studio, Project Editor, Settings, Templates
```

---

## Local Data Store

ScreenFlow AI currently stores project data in a JSON file named `screenflow_ai_db.json` inside Electron's user data folder.

1. **`projects`**: Tracks metadata for recorded clips.
   - `id`: Unique project hash.
   - `name`: Visual project label.
   - `video_path` / `audio_path` / `webcam_path`: File system paths to raw inputs.
   - `duration`: Clip duration in seconds.
2. **`project_settings`**: Styles applied to the video.
   - `zoom_level`, `cursor_scale`, `cursor_highlight`
   - `background_type` / `background_value`
   - `webcam_size` / `webcam_position`
3. **`cursor_events`**: Time-stamped global mouse positions.
   - `timestamp`, `x`, `y`, `event_type`
4. **`captions`**: Text blocks generated via Whisper.
   - `start_time`, `end_time`, `text`
5. **`exports`**: Exporter task registry.
   - `export_path`, `status`, `progress`

---

## Platform Builds

### Prerequisites

1. **Node.js** v18.x or v20.x recommended.
2. **FFmpeg** installed and accessible in the system path environment variables.

### Local Development Setup

1. Install packages:
   ```bash
   npm install
   ```
2. Start the Vite server:
   ```bash
   npm run dev
   ```
3. In a separate shell, start the Electron application:
   ```bash
   npm run start
   ```

---

### Web and Mobile PWA

```bash
npm run build:web
```

Deploy `dist/app` over HTTPS. Android Chrome, desktop Chrome, and Edge can install the app directly. iPhone and iPad users can add it to the Home Screen from Safari.

### Chrome Extension

```bash
npm run build:extension
```

Load `dist/extension` from `chrome://extensions` using **Load unpacked**. Chrome 116 or newer is required.

### Windows App

```bash
npm run dist:win
```

The NSIS installer is written to `release/`.

### Build Web and Extension Together

```bash
npm run build:platforms
```

Tagged GitHub releases matching `v*` run `.github/workflows/release-platforms.yml`, which packages the Chrome extension and publishes the Windows installer.

See [docs/PLATFORMS.md](docs/PLATFORMS.md) for installation, release, capability, and security details.

---

## Testing Instructions

1. **Project store test**: Verify projects are created and read back correctly from the local JSON data file.
2. **Global hook test**: Record a clip and move/click the mouse outside the window. Verify cursor events are saved.
3. **FFmpeg export test**: Render a short video and confirm the exported file plays correctly.
4. **PWA test**: Confirm the manifest, service worker, offline page, and standalone install prompt load over HTTPS.
5. **Extension test**: Record a normal Chrome tab with audio, stop it, and verify the complete WebM download.
