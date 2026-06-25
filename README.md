# ScreenFlow AI

ScreenFlow AI is a high-end Windows desktop alternative to Screen Studio, built with Electron, React (Vite), Node.js, SQLite, and FFmpeg. It offers automated zoom easing, mouse cursor tracking, customizable canvas backgrounds, AI captions (OpenAI Whisper), and multi-threaded video processing.

---

## Folder Structure

```
ScreenFlowAI/
├── package.json        # Node.js dependencies & scripts
├── vite.config.js      # Vite compilation configuration
├── index.html          # Entry HTML page
├── electron/
│   ├── main.js         # Main process (App lifecycle, IPC channels, global mouse hook)
│   ├── preload.js      # Secure context bridge between electron and React
│   ├── database.js     # SQLite schema, migration and storage operations
│   └── renderer-engine.js # Canvas-based frame-by-frame exporter and compositor
└── src/                # React Frontend application
    ├── main.jsx        # Routing and entrypoint mount
    ├── index.css       # Core layout styling & visual tokens
    ├── components/     # Frameless TitleBar, Sidebar navigation
    └── pages/          # Dashboard, Recording Studio, Project Editor, Settings, Templates
```

---

## Database Schema

ScreenFlow AI uses SQLite via `better-sqlite3`. The database file is stored locally in the OS application data folder under `%APPDATA%/screenflow-ai/screenflow_ai.db`.

1. **`projects`**: Tracks metadata for recorded clips.
   - `id` (TEXT PRIMARY KEY): Unique project hash.
   - `name` (TEXT): Visual project label.
   - `video_path` / `audio_path` / `webcam_path` (TEXT): File system paths to raw inputs.
   - `duration` (INTEGER): Clip duration in seconds.
2. **`project_settings`**: Styles applied to the video.
   - `zoom_level` (REAL), `cursor_scale` (REAL), `cursor_highlight` (TEXT)
   - `background_type` / `background_value` (TEXT)
   - `webcam_size` / `webcam_position` (TEXT)
3. **`cursor_events`**: Time-stamped global mouse positions.
   - `timestamp` (REAL), `x` (REAL), `y` (REAL), `event_type` (TEXT)
4. **`captions`**: Text blocks generated via Whisper.
   - `start_time` / `end_time` (REAL), `text` (TEXT)
5. **`exports`**: Exporter task registry.
   - `export_path` (TEXT), `status` (TEXT), `progress` (REAL)

---

## Build Instructions

### Prerequisites
1. **Node.js** (v18.x or v20.x recommended)
2. **C++ Build Tools** (Required for native bindings compilation of `better-sqlite3` and `canvas`)
   - Run `npm install --global --production windows-build-tools` in an admin shell, or install VS Build Tools.
3. **FFmpeg** installed and accessible in the system path environment variables.

### Local Development Setup
1. Clone the project.
2. Install packages:
   ```bash
   npm install
   ```
3. Start the Vite server:
   ```bash
   npm run dev
   ```
4. In a separate shell, start the Electron application:
   ```bash
   npm run start
   ```

---

## Deployment & Production Release Workflow

### Packaging the Installer
ScreenFlow AI uses `electron-builder` to package the Windows binary.

To build the executable installer:
```bash
npm run build
```
This script triggers `vite build` to compile production React assets, and then invokes `electron-builder` to package them into an `.exe` file under the `/dist` directory.

### Auto-Update Configuration
To configure automatic updates:
1. Ensure the `publish` field in `electron-builder` configuration in `package.json` points to your distribution server (e.g. S3 bucket, GitHub releases).
2. The application checks for updates using `electron-updater` package during startup.

---

## Testing Instructions

To perform validation:
1. **Database test**: Verify projects are created and read back correctly from the SQLite database.
2. **Global Hook test**: Record a clip and move/click the mouse outside the window. Verify events are logged in the `cursor_events` table.
3. **FFmpeg process test**: Render a 10s video. Confirm that the input stream is read frame-by-frame, composited onto the canvas with scaling, and exported to the chosen directory.
