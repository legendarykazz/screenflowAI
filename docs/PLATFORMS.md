# ScreenFlow AI Platforms

ScreenFlow AI uses one React product core and three platform shells. This keeps calls, analysis data, and core workflows consistent while allowing each platform to use the capabilities it handles best.

## Capability Matrix

| Capability | Mobile PWA | Chrome Extension | Windows App |
| --- | --- | --- | --- |
| Join and host LiveKit calls | Yes | Opens web workspace | Yes |
| Camera and microphone | Yes, with browser permission | Tab audio only | Yes |
| Share the full phone screen | No, requires a native mobile app | No | N/A |
| Football Lab and whiteboard | Yes | Opens web workspace | Yes |
| Record active Chrome tab | Browser share dialog | Yes, one click | Yes |
| Record other applications | Platform-limited | No | Yes |
| Local project editing and FFmpeg export | Limited | No | Full |
| Offline launch | App shell and saved local state | Extension UI | Full |

## Mobile Installation

The deployed Vercel app is an installable Progressive Web App.

### Android

1. Open `https://screenflow-ai.vercel.app` in Chrome.
2. Choose the browser install action or the in-app **Install** button.
3. Launch ScreenFlow AI from the home screen.

### iPhone and iPad

1. Open `https://screenflow-ai.vercel.app` in Safari.
2. Open the Share menu.
3. Choose **Add to Home Screen**.

Mobile operating systems restrict capturing other applications and system audio from a browser. Live calls, participant camera and microphone, whiteboarding, screen viewing, and Football Lab remain available. Full desktop capture and production export stay in the Windows app.

## Chrome Extension

The extension requires Chrome 116 or newer because background tab recording uses `chrome.tabCapture` with an offscreen document.

### Local Installation

```bash
npm run build:extension
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `dist/extension`.

The popup records the active normal web tab and its audio. Recording continues after the popup closes. Stopping flushes the final media chunk before Chrome saves a WebM file.

The workspace URL defaults to `https://screenflow-ai.vercel.app` and can be changed from the extension settings page.

### Chrome Web Store Package

Run the GitHub Actions workflow or zip the contents of `dist/extension` so `manifest.json` is at the root of the archive. Store signing and publishing require a Chrome Web Store developer account.

## Windows App

Run locally:

```bash
npm start
```

Build the x64 NSIS installer:

```bash
npm run dist:win
```

The installer is written to `release/ScreenFlowAI-Setup-<version>-x64.exe`.

To publish a GitHub release, create and push a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The release workflow builds the web app and extension, uploads the Chrome package as a workflow artifact, and publishes the Windows installer plus update metadata to GitHub Releases.

## LiveKit Security

Keep these values only in Vercel environment variables or the Electron secure settings bridge:

```text
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
```

Never place the LiveKit API secret in the PWA manifest, Chrome extension, React source, or any `VITE_` environment variable. Browser and extension clients receive short-lived room tokens from `/api/livekit-token`.
