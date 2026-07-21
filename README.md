# ScreenFlow AI

ScreenFlow AI is a high-end Windows desktop alternative to Screen Studio, built with Electron, React (Vite), Node.js, a local JSON project store, and FFmpeg. It offers automated zoom easing, mouse cursor tracking, customizable canvas backgrounds, AI captions through OpenAI Whisper, and video export processing.

---

## Folder Structure

```text
ScreenFlowAI/
|-- package.json             # Node.js dependencies and scripts
|-- vite.config.js           # Vite compilation configuration
|-- index.html               # Entry HTML page
|-- electron/
|   |-- main.js              # Main process, IPC channels, media streaming, global mouse hook
|   |-- preload.js           # Secure context bridge between Electron and React
|   |-- database.js          # Local JSON project store operations
|   `-- renderer-engine.js   # FFmpeg exporter and compositor
`-- src/                     # React frontend application
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

## Build Instructions

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

## Deployment & Production Release Workflow

ScreenFlow AI uses `electron-builder` to package the Windows binary.

To build the executable installer:

```bash
npm run build
```

This script runs `vite build` to compile production React assets, then invokes `electron-builder` to package the app into the `/dist` directory.

---

## Testing Instructions

1. **Project store test**: Verify projects are created and read back correctly from the local JSON data file.
2. **Global hook test**: Record a clip and move/click the mouse outside the window. Verify cursor events are saved.
3. **FFmpeg export test**: Render a short video and confirm the exported file plays correctly.
