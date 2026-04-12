# How to Record the Demo GIF

## What to show (10-15 seconds)

1. Home page with starfield animation (~2s)
2. Drag the year slider to 1969 (~2s)
3. Events appear — toggle one off (~3s)
4. Scenario starts streaming with text appearing in real-time (~4s)
5. AI image appears (~2s)

This flow shows the full user journey: pick a year → see events → generate alternative history.

## Option A: Kap (recommended, free)

[Kap](https://getkap.co/) is a free, lightweight screen recorder for macOS that exports directly to GIF.

1. Install: `brew install --cask kap` (or download from getkap.co)
2. Open your app at http://localhost:3000 (or use the live site)
3. Open Kap → click the record button
4. Select the browser window area (crop to just the app, no browser chrome)
5. Record the 10-15 second flow above
6. Stop recording → Export as GIF
7. Settings: FPS 10, Width 800px (keeps file size under 5MB)
8. Save as `demo.gif` in the project root

## Option B: macOS built-in + ffmpeg

1. Press `Cmd + Shift + 5` → select "Record Selected Portion"
2. Draw a box around the browser content area
3. Record the flow, press `Cmd + Shift + 5` again to stop
4. The .mov file saves to Desktop
5. Convert to GIF:

```bash
ffmpeg -i ~/Desktop/demo.mov \
  -vf "fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  -loop 0 \
  demo.gif
```

This gives you a high-quality GIF with proper color palette at ~800px wide.

## Option C: QuickTime + online converter

1. Open QuickTime Player → File → New Screen Recording
2. Record the flow
3. Upload the .mov to ezgif.com/video-to-gif
4. Set width to 800, FPS to 10
5. Download the GIF

## Adding to README

Once you have `demo.gif`, add it to the README right after the badges:

```markdown
[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://time-machine-mu.vercel.app/)

![Time Machine Demo](demo.gif)

An AI-powered Progressive Web App...
```

## Adding to Medium

Medium supports GIF uploads directly — just drag the file into the editor where you want it. Best placement: right after "What it does" section so readers see the app in action before the technical deep-dive.

## Tips

- Use the live site (time-machine-mu.vercel.app) for recording — it's faster and has real data
- Pick year 1969 — the Moon landing events are visually striking and everyone recognizes them
- Make sure the browser window has no extra tabs or bookmarks visible
- If the GIF is over 5MB, reduce FPS to 8 or width to 640px
