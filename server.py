#!/usr/bin/env python3
"""Winamp-style MP3 player — local web app."""

import http.server
import json
import os
import sys
import urllib.parse
import mimetypes

PORT = 8888
MUSIC_DIR = None

HTML_PAGE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Winamp Player</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: #1a1a2e;
    display: flex; justify-content: center; align-items: center;
    min-height: 100vh;
    font-family: 'Arial', sans-serif;
    overflow: hidden;
  }

  #winamp {
    width: 520px;
    background: linear-gradient(180deg, #2a2a3a 0%, #1e1e2e 100%);
    border: 2px solid #555;
    border-top-color: #888;
    border-left-color: #888;
    border-radius: 2px;
    box-shadow: 4px 4px 12px rgba(0,0,0,0.8), inset 0 0 1px #666;
    user-select: none;
  }

  /* ── Title Bar ── */
  .title-bar {
    background: linear-gradient(90deg, #4a2c6a, #2c1a4a, #4a2c6a);
    padding: 3px 6px;
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid #333;
  }
  .title-bar span {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #c8b8e8;
    letter-spacing: 1px;
  }
  .title-dots { display: flex; gap: 3px; }
  .title-dots div {
    width: 8px; height: 8px; border-radius: 50%;
  }
  .dot-min { background: #e8c840; }
  .dot-max { background: #48c848; }
  .dot-close { background: #e84848; }

  /* ── Display ── */
  .display {
    background: #0a0a12;
    margin: 6px 8px;
    padding: 10px 12px;
    border: 2px inset #333;
    border-radius: 2px;
    min-height: 70px;
    position: relative;
    overflow: hidden;
  }
  .display-row { display: flex; justify-content: space-between; align-items: center; }
  #track-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: #00e800;
    white-space: nowrap;
    text-shadow: 0 0 6px #00e800;
    overflow: hidden;
    max-width: 360px;
  }
  #track-title.scrolling {
    animation: marquee 10s linear infinite;
  }
  @keyframes marquee {
    0%   { transform: translateX(100%); }
    100% { transform: translateX(-100%); }
  }
  .time-display {
    font-family: 'Press Start 2P', monospace;
    font-size: 16px;
    color: #00e800;
    text-shadow: 0 0 8px #00e800;
    letter-spacing: 2px;
  }
  .bitrate-info {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #008800;
    margin-top: 6px;
  }
  .viz-bar {
    position: absolute; bottom: 4px; right: 8px;
    display: flex; gap: 2px; align-items: flex-end; height: 30px;
  }
  .viz-bar div {
    width: 3px;
    background: linear-gradient(to top, #00e800, #e8e800, #e84800);
    transition: height 0.08s;
  }

  /* ── Seek Bar ── */
  .seek-section { margin: 4px 8px; }
  .seek-bar {
    -webkit-appearance: none; appearance: none;
    width: 100%; height: 8px;
    background: #1a1a2a;
    border: 1px inset #333;
    border-radius: 1px;
    outline: none;
    cursor: pointer;
  }
  .seek-bar::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 14px; height: 14px;
    background: linear-gradient(135deg, #bbb, #666);
    border: 1px solid #888;
    border-radius: 2px;
    cursor: pointer;
  }

  /* ── Controls ── */
  .controls {
    display: flex; justify-content: center; align-items: center;
    gap: 4px; padding: 8px;
  }
  .ctrl-btn {
    background: linear-gradient(180deg, #555 0%, #333 100%);
    border: 1px outset #666;
    color: #ddd;
    font-size: 14px;
    width: 38px; height: 26px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    border-radius: 2px;
  }
  .ctrl-btn:active {
    border-style: inset;
    background: linear-gradient(180deg, #333 0%, #555 100%);
  }
  .ctrl-btn.play-btn {
    background: linear-gradient(180deg, #4a6a4a 0%, #2a4a2a 100%);
    width: 44px;
  }
  .ctrl-btn.stop-btn {
    background: linear-gradient(180deg, #6a4a4a 0%, #4a2a2a 100%);
  }

  /* ── Volume ── */
  .volume-section {
    display: flex; align-items: center; gap: 6px;
    padding: 0 8px 4px;
    font-family: 'Press Start 2P', monospace;
    font-size: 7px; color: #888;
  }
  .volume-bar {
    -webkit-appearance: none; appearance: none;
    width: 100px; height: 6px;
    background: #1a1a2a; border: 1px inset #333;
    outline: none; cursor: pointer;
  }
  .volume-bar::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 10px; height: 12px;
    background: linear-gradient(135deg, #bbb, #666);
    border: 1px solid #888; border-radius: 1px;
    cursor: pointer;
  }

  /* ── Audio Device ── */
  .device-section {
    padding: 4px 8px 6px;
    display: flex; align-items: center; gap: 6px;
    font-family: 'Press Start 2P', monospace;
    font-size: 7px; color: #888;
  }
  #device-select {
    flex: 1;
    background: #0a0a12; color: #00cc00;
    border: 1px inset #333;
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    padding: 3px;
    outline: none;
    cursor: pointer;
  }

  /* ── Playlist ── */
  .playlist-header {
    background: linear-gradient(90deg, #4a2c6a, #2c1a4a, #4a2c6a);
    padding: 3px 8px;
    font-family: 'Press Start 2P', monospace;
    font-size: 7px; color: #c8b8e8;
    letter-spacing: 1px;
    border-top: 1px solid #555;
  }
  .playlist {
    background: #0a0a12;
    margin: 0 8px 8px;
    border: 2px inset #333;
    max-height: 320px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #4a2c6a #0a0a12;
  }
  .playlist::-webkit-scrollbar { width: 12px; }
  .playlist::-webkit-scrollbar-track { background: #0a0a12; }
  .playlist::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #4a2c6a, #2c1a4a);
    border: 1px solid #555;
  }
  .pl-item {
    padding: 4px 8px;
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #00cc00;
    cursor: pointer;
    display: flex; gap: 8px;
    border-bottom: 1px solid #111;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pl-item:hover { background: #1a1a3a; color: #00ff00; }
  .pl-item.active { background: #2a1a4a; color: #e8e800; }
  .pl-num { color: #666; min-width: 30px; text-align: right; }
  .pl-name { overflow: hidden; text-overflow: ellipsis; }
</style>
</head>
<body>

<div id="winamp">
  <!-- Title Bar -->
  <div class="title-bar">
    <span>WINAMP 2.95</span>
    <div class="title-dots">
      <div class="dot-min"></div>
      <div class="dot-max"></div>
      <div class="dot-close"></div>
    </div>
  </div>

  <!-- Display -->
  <div class="display">
    <div class="display-row">
      <div id="track-title">No track loaded</div>
    </div>
    <div class="display-row" style="margin-top:8px">
      <div class="time-display"><span id="elapsed">00:00</span></div>
      <div class="viz-bar" id="viz"></div>
    </div>
    <div class="bitrate-info">MP3 &bull; STEREO &bull; LOCAL</div>
  </div>

  <!-- Seek -->
  <div class="seek-section">
    <input type="range" class="seek-bar" id="seek" min="0" max="100" value="0">
  </div>

  <!-- Controls -->
  <div class="controls">
    <button class="ctrl-btn" onclick="prevTrack()" title="Previous">&#9198;</button>
    <button class="ctrl-btn play-btn" id="play-btn" onclick="togglePlay()" title="Play">&#9654;</button>
    <button class="ctrl-btn" onclick="pauseTrack()" title="Pause">&#9208;</button>
    <button class="ctrl-btn stop-btn" onclick="stopTrack()" title="Stop">&#9632;</button>
    <button class="ctrl-btn" onclick="nextTrack()" title="Next">&#9197;</button>
  </div>

  <!-- Volume -->
  <div class="volume-section">
    <span>VOL</span>
    <input type="range" class="volume-bar" id="volume" min="0" max="100" value="80">
  </div>

  <!-- Audio Device -->
  <div class="device-section">
    <span>OUT</span>
    <select id="device-select"><option>Default</option></select>
  </div>

  <!-- Playlist -->
  <div class="playlist-header">PLAYLIST</div>
  <div class="playlist" id="playlist"></div>
</div>

<audio id="audio" preload="auto"></audio>

<script>
const audio = document.getElementById('audio');
const playlistEl = document.getElementById('playlist');
const seekBar = document.getElementById('seek');
const volumeBar = document.getElementById('volume');
const elapsedEl = document.getElementById('elapsed');
const titleEl = document.getElementById('track-title');
const vizEl = document.getElementById('viz');
const deviceSelect = document.getElementById('device-select');

let tracks = [];
let currentIndex = -1;
let seeking = false;
let audioCtx, analyser, source, vizBars = [];

// ── Init visualizer bars ──
for (let i = 0; i < 16; i++) {
  const bar = document.createElement('div');
  bar.style.height = '2px';
  vizEl.appendChild(bar);
  vizBars.push(bar);
}

// ── Load tracks ──
fetch('/api/tracks')
  .then(r => r.json())
  .then(data => {
    tracks = data;
    tracks.forEach((t, i) => {
      const div = document.createElement('div');
      div.className = 'pl-item';
      div.innerHTML = `<span class="pl-num">${i + 1}.</span><span class="pl-name">${t.replace(/\.mp3$/i, '')}</span>`;
      div.onclick = () => loadTrack(i);
      playlistEl.appendChild(div);
    });
  });

// ── Audio device enumeration ──
async function loadDevices() {
  try {
    // Need permission first
    await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter(d => d.kind === 'audiooutput');
    deviceSelect.innerHTML = '';
    outputs.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Device ${d.deviceId.slice(0,8)}`;
      deviceSelect.appendChild(opt);
    });
  } catch(e) {
    console.log('Audio device enumeration not supported or denied:', e);
  }
}
loadDevices();

deviceSelect.onchange = async () => {
  if (audio.setSinkId) {
    try {
      await audio.setSinkId(deviceSelect.value);
    } catch(e) { console.error('setSinkId failed:', e); }
  }
};

// ── Playback ──
function loadTrack(idx) {
  currentIndex = idx;
  const name = tracks[idx];
  audio.src = '/music/' + encodeURIComponent(name);
  audio.play();
  titleEl.textContent = name.replace(/\.mp3$/i, '');
  titleEl.classList.toggle('scrolling', titleEl.textContent.length > 40);
  highlightActive();
  initAnalyser();
}

function togglePlay() {
  if (currentIndex < 0 && tracks.length > 0) { loadTrack(0); return; }
  if (audio.paused) audio.play(); else audio.pause();
}
function pauseTrack() { audio.pause(); }
function stopTrack() { audio.pause(); audio.currentTime = 0; }
function prevTrack() { if (tracks.length === 0) return; loadTrack((currentIndex - 1 + tracks.length) % tracks.length); }
function nextTrack() { if (tracks.length === 0) return; loadTrack((currentIndex + 1) % tracks.length); }

audio.onended = () => nextTrack();

// ── Seek ──
audio.ontimeupdate = () => {
  if (!seeking && audio.duration) {
    seekBar.value = (audio.currentTime / audio.duration) * 100;
    const m = Math.floor(audio.currentTime / 60);
    const s = Math.floor(audio.currentTime % 60);
    elapsedEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
};
seekBar.oninput = () => { seeking = true; };
seekBar.onchange = () => {
  if (audio.duration) audio.currentTime = (seekBar.value / 100) * audio.duration;
  seeking = false;
};

// ── Volume ──
audio.volume = 0.8;
volumeBar.oninput = () => { audio.volume = volumeBar.value / 100; };

// ── Highlight ──
function highlightActive() {
  document.querySelectorAll('.pl-item').forEach((el, i) => {
    el.classList.toggle('active', i === currentIndex);
  });
}

// ── Visualizer ──
function initAnalyser() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    source = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    animateViz();
  }
}

function animateViz() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  vizBars.forEach((bar, i) => {
    const val = data[i] || 0;
    bar.style.height = Math.max(2, (val / 255) * 30) + 'px';
  });
  requestAnimationFrame(animateViz);
}
</script>
</body>
</html>"""


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/" or path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode())

        elif path == "/api/tracks":
            files = sorted(
                f for f in os.listdir(MUSIC_DIR)
                if f.lower().endswith(".mp3")
            )
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(files).encode())

        elif path.startswith("/music/"):
            filename = urllib.parse.unquote(path[7:])
            # Prevent path traversal
            if "/" in filename or "\\" in filename or ".." in filename:
                self.send_error(403)
                return
            filepath = os.path.join(MUSIC_DIR, filename)
            if not os.path.isfile(filepath):
                self.send_error(404)
                return
            self.send_response(200)
            mime = mimetypes.guess_type(filepath)[0] or "audio/mpeg"
            self.send_header("Content-Type", mime)
            size = os.path.getsize(filepath)
            self.send_header("Content-Length", str(size))
            self.end_headers()
            with open(filepath, "rb") as f:
                while chunk := f.read(65536):
                    self.wfile.write(chunk)
        else:
            self.send_error(404)

    def log_message(self, fmt, *args):
        pass  # quiet


def main():
    global MUSIC_DIR
    if len(sys.argv) < 2:
        print("Usage: python server.py /path/to/mp3/folder")
        sys.exit(1)
    MUSIC_DIR = os.path.abspath(sys.argv[1])
    if not os.path.isdir(MUSIC_DIR):
        print(f"Error: '{MUSIC_DIR}' is not a directory")
        sys.exit(1)

    mp3s = [f for f in os.listdir(MUSIC_DIR) if f.lower().endswith(".mp3")]
    print(f"Serving {len(mp3s)} MP3 files from: {MUSIC_DIR}")
    print(f"Open http://localhost:{PORT} in your browser")

    server = http.server.HTTPServer(("127.0.0.1", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
