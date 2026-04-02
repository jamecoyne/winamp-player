# Winamp Player

A local web app that plays MP3 files from a folder on your computer, themed after 90s Winamp. Zero dependencies — just Node.js.

![Node.js](https://img.shields.io/badge/Node.js-14%2B-green)

## Features

- Classic Winamp 2.x look and feel
- Playlist auto-populated from a folder of MP3s
- Seek bar with full HTTP range request support
- Real-time frequency visualizer
- Audio output device selector
- Volume control
- Auto-advance to next track

## Usage

```bash
node server.js /path/to/your/mp3s
```

Then open http://localhost:8888 in your browser.

## Requirements

- Node.js 14+
- A modern browser (Chrome/Edge recommended for audio device selection)

## Audio Device Selection

The output device dropdown uses the Web Audio `setSinkId` API. Your browser will prompt for microphone permission on first load — this is only needed to enumerate output devices, no recording occurs.
