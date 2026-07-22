# Husain Watermark Studio — Phase 1

A private, in-browser watermarking studio. No image is ever uploaded — every
render happens on-device using Fabric.js canvas + IndexedDB.

## Run it
Open `index.html` via a local server (service workers and file:// don't mix well):
```
npx serve .
# or
python3 -m http.server 8080
```
Then visit the printed local URL on desktop or your phone (same Wi-Fi).

## What's fully working in this phase
- Splash → Home → Editor → Batch → Settings routing, mobile bottom nav + FAB
- Upload via drag-drop, file picker, or camera capture
- Infinite zoom (10%–1000%), pan, pinch-zoom on touch, grid toggle, center-snap guides
- Text watermark: fonts, size/weight, solid or gradient fill, stroke, drop shadow, glow,
  letter spacing, rotation, opacity, blend mode, and `{date} {time} {camera} {lens} {iso}
  {aperture} {shutter} {gps} {filename}` variables resolved from real EXIF (exif-js)
- Logo/PNG/SVG watermark: scale, rotate, opacity, corner radius, shadow/glow
- Freehand signature pad → auto-trimmed transparent PNG watermark
- QR code watermark generated fully offline (qrcodejs)
- EXIF/date stamp presets (badge / plain / mono)
- Repeat/tile pattern generator (diagonal, horizontal, vertical, grid) from any selected layer
- Unlimited layers panel: select, lock, hide, duplicate, delete; mobile quick-bar for the
  selected layer
- Undo/redo history, autosave to IndexedDB, "Recent projects" grid on Home
- Non-destructive brightness/contrast/saturation/temperature/vignette + rotate/flip
- Export to PNG/JPEG/WEBP with quality + resolution multiplier, optional ZIP
- Batch queue: add many images, apply the current watermark template to all of them,
  pause/resume/cancel, progress + ETA, export-all as ZIP
- Installable PWA with an offline app-shell service worker
- Dark/light theme, settings persisted locally, "clear all local data"

## Known, honestly-stated gaps (not silently faked)
- **EXIF re-embedding on export**: canvas re-encoding strips binary metadata by nature of
  `toBlob`/`toDataURL`. Watermark text can *display* EXIF values, but the exported file's own
  metadata isn't currently rewritten — that needs a metadata-writer library (e.g. piexif.js),
  not yet wired in.
- **Batch processing** runs on the main thread with cooperative yielding, not a dedicated
  Web Worker/OffscreenCanvas pipeline — it stays responsive but a true off-thread renderer
  is the right next step for very large (500+) batches.
- **AI features** (face/object detection, smart placement, AI upscale via TensorFlow.js/
  OpenCV.js), **curves/levels/LUTs**, **HEIC/AVIF/TIFF decode**, and **PDF contact sheets**
  are not implemented yet — they're substantial subsystems of their own and are the planned
  Phase 3/4 work.

## File map
```
index.html
css/  tokens.css base.css components.css editor.css responsive.css
js/   app.js canvas-editor.js history.js storage.js exif-reader.js
      watermark-text.js watermark-logo.js watermark-signature.js
      watermark-qr.js watermark-exif.js watermark-repeat.js
      adjustments.js layers-panel.js export.js batch.js settings.js utils.js
manifest.json  sw.js  assets/icons/
```
