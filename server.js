#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = 8888;

const musicDir = (() => {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: node server.js /path/to/mp3/folder");
    process.exit(1);
  }
  const resolved = path.resolve(arg);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    console.error(`Error: '${resolved}' is not a directory`);
    process.exit(1);
  }
  return resolved;
})();

const HTML_PAGE = `<!DOCTYPE html>
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

  /* Title Bar */
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
  .title-dots div { width: 8px; height: 8px; border-radius: 50%; }
  .dot-min { background: #e8c840; }
  .dot-max { background: #48c848; }
  .dot-close { background: #e84848; }

  /* Display */
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
  #track-title.scrolling { animation: marquee 10s linear infinite; }
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
    pointer-events: none;
  }
  .viz-bar div {
    width: 3px;
    background: linear-gradient(to top, #00e800, #e8e800, #e84800);
    transition: height 0.08s;
  }

  /* Seek Bar */
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

  /* Controls */
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

  /* Volume */
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

  /* Audio Device */
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

  /* Playlist */
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
  <div class="title-bar">
    <span>WINAMP 2.95</span>
    <div class="title-dots">
      <div class="dot-min"></div>
      <div class="dot-max"></div>
      <div class="dot-close"></div>
    </div>
  </div>

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

  <div class="seek-section">
    <input type="range" class="seek-bar" id="seek" min="0" max="100" value="0">
  </div>

  <div class="controls">
    <button class="ctrl-btn" onclick="prevTrack()" title="Previous">&#9198;</button>
    <button class="ctrl-btn play-btn" id="play-btn" onclick="togglePlay()" title="Play">&#9654;</button>
    <button class="ctrl-btn" onclick="pauseTrack()" title="Pause">&#9208;</button>
    <button class="ctrl-btn stop-btn" onclick="stopTrack()" title="Stop">&#9632;</button>
    <button class="ctrl-btn" onclick="nextTrack()" title="Next">&#9197;</button>
  </div>

  <div class="volume-section">
    <span>VOL</span>
    <input type="range" class="volume-bar" id="volume" min="0" max="100" value="80">
  </div>

  <div class="device-section">
    <span>OUT</span>
    <select id="device-select"><option>Default</option></select>
  </div>

  <div class="playlist-header">PLAYLIST</div>
  <div class="playlist" id="playlist"></div>
</div>

<audio id="audio" preload="auto" crossorigin="anonymous"></audio>

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
let selectedDeviceId = '';
let audioCtx, analyser, source, vizBars = [];

for (let i = 0; i < 16; i++) {
  const bar = document.createElement('div');
  bar.style.height = '2px';
  vizEl.appendChild(bar);
  vizBars.push(bar);
}

fetch('/api/tracks')
  .then(r => r.json())
  .then(data => {
    tracks = data;
    tracks.forEach((t, i) => {
      const div = document.createElement('div');
      div.className = 'pl-item';
      div.innerHTML = '<span class="pl-num">' + (i + 1) + '.</span><span class="pl-name">' + escapeHtml(t.replace(/\\.mp3$/i, '')) + '</span>';
      div.onclick = () => loadTrack(i);
      playlistEl.appendChild(div);
    });
  });

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function loadDevices() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter(d => d.kind === 'audiooutput');
    deviceSelect.innerHTML = '';
    outputs.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || ('Device ' + d.deviceId.slice(0,8));
      deviceSelect.appendChild(opt);
    });
  } catch(e) {
    console.log('Audio device enumeration not supported or denied:', e);
  }
}
loadDevices();

deviceSelect.onchange = async () => {
  selectedDeviceId = deviceSelect.value;
  if (typeof audio.setSinkId === 'function') {
    try {
      await audio.setSinkId(selectedDeviceId);
      console.log('Output device set to:', deviceSelect.options[deviceSelect.selectedIndex].textContent);
    } catch(e) { console.error('setSinkId failed:', e); }
  }
};

async function loadTrack(idx) {
  currentIndex = idx;
  const name = tracks[idx];
  audio.src = '/music/' + encodeURIComponent(name);
  // Re-apply selected output device — must be set before play()
  if (selectedDeviceId && typeof audio.setSinkId === 'function') {
    try { await audio.setSinkId(selectedDeviceId); }
    catch(e) { console.error('setSinkId on load failed:', e); }
  }
  audio.play();
  titleEl.textContent = name.replace(/\\.mp3$/i, '');
  titleEl.classList.toggle('scrolling', titleEl.textContent.length > 40);
  highlightActive();
  initViz();
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

audio.ontimeupdate = () => {
  if (!seeking && audio.duration) {
    seekBar.value = (audio.currentTime / audio.duration) * 100;
    const m = Math.floor(audio.currentTime / 60);
    const s = Math.floor(audio.currentTime % 60);
    elapsedEl.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }
};
seekBar.addEventListener('pointerdown', () => { seeking = true; });
seekBar.addEventListener('input', () => { seeking = true; });
seekBar.addEventListener('change', () => {
  if (audio.duration && isFinite(audio.duration)) {
    audio.currentTime = (seekBar.value / 100) * audio.duration;
  }
  seeking = false;
});

audio.volume = 0.8;
volumeBar.oninput = () => { audio.volume = volumeBar.value / 100; };

function highlightActive() {
  document.querySelectorAll('.pl-item').forEach((el, i) => {
    el.classList.toggle('active', i === currentIndex);
  });
}

// Use captureStream() for visualization so the <audio> element keeps
// full control of output routing via setSinkId. We do NOT use
// createMediaElementSource — that hijacks the element's output and
// routes it through AudioContext.destination, breaking setSinkId.
function initViz() {
  if (analyser) return; // already set up
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // captureStream() taps the audio without taking over output
    const stream = audio.captureStream ? audio.captureStream() : audio.mozCaptureStream();
    source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    // Do NOT connect analyser to audioCtx.destination — that would
    // double-play the audio through the default device.
    animateViz();
  } catch(e) {
    console.log('Visualizer init failed (captureStream not supported):', e);
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
</html>`;

const MIME_TYPES = {
  ".mp3": "audio/mpeg",
  ".html": "text/html",
  ".json": "application/json",
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const pathname = decodeURIComponent(parsed.pathname);

  if (pathname === "/" || pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML_PAGE);
    return;
  }

  if (pathname === "/api/tracks") {
    const files = fs
      .readdirSync(musicDir)
      .filter((f) => f.toLowerCase().endsWith(".mp3"))
      .sort();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(files));
    return;
  }

  if (pathname.startsWith("/music/")) {
    const filename = pathname.slice(7);
    // Prevent path traversal
    if (
      filename.includes("/") ||
      filename.includes("\\") ||
      filename.includes("..")
    ) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const filepath = path.join(musicDir, filename);
    if (!fs.existsSync(filepath) || !fs.statSync(filepath).isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const stat = fs.statSync(filepath);
    const ext = path.extname(filepath).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    const total = stat.size;
    const range = req.headers.range;

    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : total - 1;
      res.writeHead(206, {
        "Content-Type": mime,
        "Content-Range": "bytes " + start + "-" + end + "/" + total,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Access-Control-Allow-Origin": "*",
      });
      fs.createReadStream(filepath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": total,
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
      });
      fs.createReadStream(filepath).pipe(res);
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

const mp3Count = fs
  .readdirSync(musicDir)
  .filter((f) => f.toLowerCase().endsWith(".mp3")).length;

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Serving ${mp3Count} MP3 files from: ${musicDir}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
