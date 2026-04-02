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
<title>WinDJ</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0e0e1a;
    display: flex; justify-content: center; align-items: flex-start;
    min-height: 100vh; padding: 20px;
    font-family: Arial, sans-serif;
  }

  #dj-booth {
    display: flex; gap: 0; user-select: none;
    background: linear-gradient(180deg, #1a1a2a 0%, #12121e 100%);
    border: 2px solid #555; border-top-color: #888; border-left-color: #888;
    border-radius: 3px;
    box-shadow: 6px 6px 20px rgba(0,0,0,0.9), inset 0 0 2px #555;
    overflow: hidden;
  }

  /* ── Deck ── */
  .deck { width: 420px; padding: 0; flex-shrink: 0; }

  .deck-header {
    background: linear-gradient(90deg, #4a2c6a, #2c1a4a, #4a2c6a);
    padding: 4px 8px;
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid #333;
  }
  .deck-header span {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px; color: #c8b8e8; letter-spacing: 1px;
  }
  .deck-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 10px; font-weight: bold;
  }
  .deck-a .deck-label { color: #4488ff; }
  .deck-b .deck-label { color: #ff6644; }

  .display {
    background: #0a0a12; margin: 6px 8px; padding: 8px 10px;
    border: 2px inset #333; border-radius: 2px;
    min-height: 58px; position: relative; overflow: hidden;
  }
  .display-row { display: flex; justify-content: space-between; align-items: center; }
  .track-title {
    font-family: 'Press Start 2P', monospace; font-size: 8px;
    white-space: nowrap; text-shadow: 0 0 6px currentColor;
    overflow: hidden; max-width: 280px;
  }
  .deck-a .track-title { color: #4488ff; }
  .deck-b .track-title { color: #ff6644; }
  .track-title.scrolling { animation: marquee 10s linear infinite; }
  @keyframes marquee { 0%{transform:translateX(100%)} 100%{transform:translateX(-100%)} }
  .time-display {
    font-family: 'Press Start 2P', monospace; font-size: 14px;
    text-shadow: 0 0 8px currentColor; letter-spacing: 2px;
  }
  .deck-a .time-display { color: #4488ff; }
  .deck-b .time-display { color: #ff6644; }
  .bitrate-info {
    font-family: 'Press Start 2P', monospace; font-size: 6px;
    color: #444; margin-top: 4px;
  }
  .bpm-display {
    font-family: 'Press Start 2P', monospace; font-size: 10px;
    text-shadow: 0 0 6px currentColor; letter-spacing: 1px;
  }
  .deck-a .bpm-display { color: #4488ff; }
  .deck-b .bpm-display { color: #ff6644; }
  .bpm-label {
    font-family: 'Press Start 2P', monospace; font-size: 5px;
    color: #555;
  }
  .pitch-display {
    font-family: 'Press Start 2P', monospace; font-size: 7px;
    color: #888;
  }
  .viz-bar {
    position: absolute; bottom: 4px; right: 8px;
    display: flex; gap: 2px; align-items: flex-end; height: 24px;
    pointer-events: none;
  }
  .deck-a .viz-bar div {
    width: 3px; background: linear-gradient(to top, #4488ff, #88ccff, #ffffff);
    transition: height 0.08s;
  }
  .deck-b .viz-bar div {
    width: 3px; background: linear-gradient(to top, #ff6644, #ffaa66, #ffffff);
    transition: height 0.08s;
  }

  /* Waveform */
  .waveform-section {
    margin: 4px 8px; position: relative; height: 50px;
    background: #050510; border: 2px inset #333;
    cursor: pointer; overflow: hidden;
  }
  .waveform-section canvas { width: 100%; height: 100%; display: block; }
  .waveform-loading {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Press Start 2P', monospace; font-size: 7px;
    color: #335; pointer-events: none;
  }

  /* Controls */
  .controls {
    display: flex; justify-content: center; align-items: center;
    gap: 3px; padding: 6px 8px;
  }
  .ctrl-btn {
    background: linear-gradient(180deg, #555 0%, #333 100%);
    border: 1px outset #666; color: #ddd; font-size: 12px;
    width: 34px; height: 24px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    border-radius: 2px;
  }
  .ctrl-btn:active { border-style: inset; background: linear-gradient(180deg, #333 0%, #555 100%); }
  .ctrl-btn.play-btn { background: linear-gradient(180deg, #4a6a4a 0%, #2a4a2a 100%); width: 40px; }
  .ctrl-btn.stop-btn { background: linear-gradient(180deg, #6a4a4a 0%, #4a2a2a 100%); }
  .ctrl-btn.sync-btn {
    background: linear-gradient(180deg, #6a5a2a 0%, #4a3a1a 100%);
    font-family: 'Press Start 2P', monospace; font-size: 6px;
    width: 44px; color: #ee0;
  }
  .ctrl-btn.sync-btn.active {
    background: linear-gradient(180deg, #8a7a2a 0%, #6a5a1a 100%);
    box-shadow: 0 0 6px #ee0; color: #ff0;
  }
  .pitch-section {
    display: flex; align-items: center; gap: 6px;
    padding: 2px 8px 4px;
    font-family: 'Press Start 2P', monospace; font-size: 6px; color: #666;
  }
  .pitch-slider {
    -webkit-appearance: none; appearance: none;
    flex: 1; height: 6px;
    background: #1a1a2a; border: 1px inset #333;
    outline: none; cursor: pointer;
  }
  .pitch-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 8px; height: 12px;
    background: linear-gradient(135deg, #bbb, #666);
    border: 1px solid #888; border-radius: 1px; cursor: pointer;
  }

  /* Playlist */
  .playlist-header {
    background: linear-gradient(90deg, #4a2c6a, #2c1a4a, #4a2c6a);
    padding: 3px 8px;
    font-family: 'Press Start 2P', monospace; font-size: 6px;
    color: #c8b8e8; letter-spacing: 1px; border-top: 1px solid #555;
  }
  .playlist {
    background: #0a0a12; margin: 0 8px 8px; border: 2px inset #333;
    max-height: 180px; overflow-y: auto;
    scrollbar-width: thin; scrollbar-color: #4a2c6a #0a0a12;
  }
  .playlist::-webkit-scrollbar { width: 10px; }
  .playlist::-webkit-scrollbar-track { background: #0a0a12; }
  .playlist::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #4a2c6a, #2c1a4a); border: 1px solid #555; }
  .pl-item {
    padding: 3px 6px; font-family: 'Press Start 2P', monospace; font-size: 7px;
    color: #00cc00; cursor: pointer; display: flex; gap: 6px;
    border-bottom: 1px solid #111; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  }
  .pl-item:hover { background: #1a1a3a; color: #00ff00; }
  .pl-item.active { background: #2a1a4a; color: #e8e800; }
  .pl-num { color: #666; min-width: 24px; text-align: right; }
  .pl-name { overflow: hidden; text-overflow: ellipsis; }

  /* ── Mixer ── */
  .mixer {
    width: 160px; flex-shrink: 0;
    background: linear-gradient(180deg, #222233 0%, #181828 100%);
    border-left: 1px solid #444; border-right: 1px solid #444;
    display: flex; flex-direction: column; align-items: center;
    padding: 0;
  }
  .mixer-header {
    background: linear-gradient(90deg, #6a2c4a, #4a1a2c, #6a2c4a);
    padding: 4px 8px; width: 100%; text-align: center;
    border-bottom: 1px solid #333;
    font-family: 'Press Start 2P', monospace; font-size: 8px;
    color: #e8b8c8; letter-spacing: 1px;
  }

  .mixer-channels {
    display: flex; gap: 12px; padding: 10px 8px; flex: 1;
    justify-content: center; align-items: stretch;
  }
  .mixer-ch {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
  }
  .mixer-ch-label {
    font-family: 'Press Start 2P', monospace; font-size: 7px;
  }
  .ch-a-label { color: #4488ff; }
  .ch-b-label { color: #ff6644; }
  .ch-fader {
    -webkit-appearance: slider-vertical; appearance: slider-vertical;
    width: 20px; height: 120px;
    background: #0a0a12; border: 1px inset #333;
    outline: none; cursor: pointer;
    writing-mode: vertical-lr;
    direction: rtl;
  }
  .ch-fader::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 24px; height: 10px;
    background: linear-gradient(180deg, #bbb, #666);
    border: 1px solid #888; border-radius: 2px; cursor: pointer;
  }
  .vu-meter {
    width: 12px; height: 120px; background: #0a0a12;
    border: 1px inset #333; position: relative; overflow: hidden;
  }
  .vu-fill {
    position: absolute; bottom: 0; left: 0; right: 0;
    background: linear-gradient(to top, #00cc00, #cccc00, #cc0000);
    transition: height 0.08s;
  }

  .mixer-section {
    width: 100%; padding: 6px 10px;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
  }
  .mixer-label {
    font-family: 'Press Start 2P', monospace; font-size: 6px;
    color: #888; letter-spacing: 1px;
  }

  /* Crossfader */
  .crossfader-section {
    width: 100%; padding: 8px 10px 10px;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    border-top: 1px solid #333;
  }
  .crossfader {
    -webkit-appearance: none; appearance: none;
    width: 130px; height: 10px;
    background: #0a0a12; border: 1px inset #333;
    border-radius: 1px; outline: none; cursor: pointer;
  }
  .crossfader::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 18px; height: 18px;
    background: linear-gradient(135deg, #ddd, #888);
    border: 1px solid #aaa; border-radius: 2px; cursor: pointer;
  }
  .cf-labels {
    display: flex; justify-content: space-between; width: 130px;
    font-family: 'Press Start 2P', monospace; font-size: 6px;
  }
  .cf-labels .cf-a { color: #4488ff; }
  .cf-labels .cf-b { color: #ff6644; }

  /* Device select */
  .device-section {
    width: 100%; padding: 6px 10px 8px;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    border-top: 1px solid #333;
  }
  .device-select {
    width: 100%;
    background: #0a0a12; color: #00cc00;
    border: 1px inset #333;
    font-family: 'Press Start 2P', monospace; font-size: 6px;
    padding: 3px; outline: none; cursor: pointer;
  }
</style>
</head>
<body>

<div id="dj-booth">
  <!-- DECK A -->
  <div class="deck deck-a" id="deck-a">
    <div class="deck-header">
      <span class="deck-label">DECK A</span>
      <span>WinDJ</span>
    </div>
    <div class="display">
      <div class="display-row">
        <div class="track-title" data-el="title">No track loaded</div>
        <div><span class="bpm-display" data-el="bpm">---</span> <span class="bpm-label">BPM</span></div>
      </div>
      <div class="display-row" style="margin-top:6px">
        <div class="time-display"><span data-el="elapsed">00:00</span></div>
        <div class="pitch-display" data-el="pitch-display">0.0%</div>
        <div class="viz-bar" data-el="viz"></div>
      </div>
      <div class="bitrate-info">MP3 &bull; STEREO</div>
    </div>
    <div class="waveform-section" data-el="waveform-section">
      <canvas data-el="waveform"></canvas>
      <div class="waveform-loading" data-el="waveform-loading"></div>
    </div>
    <div class="controls">
      <button class="ctrl-btn" data-action="prev" title="Previous">&#9198;</button>
      <button class="ctrl-btn play-btn" data-action="play" title="Play">&#9654;</button>
      <button class="ctrl-btn" data-action="pause" title="Pause">&#9208;</button>
      <button class="ctrl-btn stop-btn" data-action="stop" title="Stop">&#9632;</button>
      <button class="ctrl-btn" data-action="next" title="Next">&#9197;</button>
      <button class="ctrl-btn sync-btn" data-action="sync" title="Sync BPM">SYNC</button>
    </div>
    <div class="pitch-section">
      <span>PITCH</span>
      <input type="range" class="pitch-slider" data-el="pitch" min="-8" max="8" value="0" step="0.1">
      <span>RST</span>
    </div>
    <div class="playlist-header">PLAYLIST</div>
    <div class="playlist" data-el="playlist"></div>
  </div>

  <!-- MIXER -->
  <div class="mixer">
    <div class="mixer-header">MIXER</div>
    <div class="mixer-channels">
      <div class="mixer-ch">
        <span class="mixer-ch-label ch-a-label">A</span>
        <div class="vu-meter"><div class="vu-fill" id="vu-a"></div></div>
        <input type="range" class="ch-fader" id="fader-a" min="0" max="100" value="80">
      </div>
      <div class="mixer-ch">
        <span class="mixer-ch-label ch-b-label">B</span>
        <div class="vu-meter"><div class="vu-fill" id="vu-b"></div></div>
        <input type="range" class="ch-fader" id="fader-b" min="0" max="100" value="80">
      </div>
    </div>
    <div class="crossfader-section">
      <span class="mixer-label">CROSSFADER</span>
      <input type="range" class="crossfader" id="crossfader" min="0" max="100" value="50">
      <div class="cf-labels"><span class="cf-a">A</span><span class="cf-b">B</span></div>
    </div>
    <div class="device-section">
      <span class="mixer-label">OUTPUT</span>
      <select class="device-select" id="device-select"><option>Default</option></select>
    </div>
  </div>

  <!-- DECK B -->
  <div class="deck deck-b" id="deck-b">
    <div class="deck-header">
      <span class="deck-label">DECK B</span>
      <span>WinDJ</span>
    </div>
    <div class="display">
      <div class="display-row">
        <div class="track-title" data-el="title">No track loaded</div>
        <div><span class="bpm-display" data-el="bpm">---</span> <span class="bpm-label">BPM</span></div>
      </div>
      <div class="display-row" style="margin-top:6px">
        <div class="time-display"><span data-el="elapsed">00:00</span></div>
        <div class="pitch-display" data-el="pitch-display">0.0%</div>
        <div class="viz-bar" data-el="viz"></div>
      </div>
      <div class="bitrate-info">MP3 &bull; STEREO</div>
    </div>
    <div class="waveform-section" data-el="waveform-section">
      <canvas data-el="waveform"></canvas>
      <div class="waveform-loading" data-el="waveform-loading"></div>
    </div>
    <div class="controls">
      <button class="ctrl-btn" data-action="prev" title="Previous">&#9198;</button>
      <button class="ctrl-btn play-btn" data-action="play" title="Play">&#9654;</button>
      <button class="ctrl-btn" data-action="pause" title="Pause">&#9208;</button>
      <button class="ctrl-btn stop-btn" data-action="stop" title="Stop">&#9632;</button>
      <button class="ctrl-btn" data-action="next" title="Next">&#9197;</button>
      <button class="ctrl-btn sync-btn" data-action="sync" title="Sync BPM">SYNC</button>
    </div>
    <div class="pitch-section">
      <span>PITCH</span>
      <input type="range" class="pitch-slider" data-el="pitch" min="-8" max="8" value="0" step="0.1">
      <span>RST</span>
    </div>
    <div class="playlist-header">PLAYLIST</div>
    <div class="playlist" data-el="playlist"></div>
  </div>
</div>

<audio id="audio-a" preload="auto" crossorigin="anonymous"></audio>
<audio id="audio-b" preload="auto" crossorigin="anonymous"></audio>

<script>
// ── Utility ──
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmt(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

// ── Deck class ──
function Deck(id, audioEl, color) {
  const root = document.getElementById(id);
  const el = (sel) => root.querySelector('[data-el="' + sel + '"]');

  this.audio = audioEl;
  this.color = color;
  this.titleEl = el('title');
  this.elapsedEl = el('elapsed');
  this.vizEl = el('viz');
  this.waveformCanvas = el('waveform');
  this.waveformCtx = el('waveform').getContext('2d');
  this.waveformSection = el('waveform-section');
  this.waveformLoading = el('waveform-loading');
  this.playlistEl = el('playlist');
  this.bpmEl = el('bpm');
  this.pitchSlider = el('pitch');
  this.pitchDisplayEl = el('pitch-display');
  this.tracks = [];
  this.currentIndex = -1;
  this.seeking = false;
  this.waveformData = null;
  this.waveformAnimId = null;
  this.analyser = null;
  this.audioCtx = null;
  this.vizBars = [];
  this.channelVol = 0.8;
  this.mixVol = 1;
  this.bpm = 0;
  this.originalBpm = 0;
  this.pitchPct = 0;
  this.otherDeck = null;

  // Viz bars
  for (let i = 0; i < 12; i++) {
    const bar = document.createElement('div');
    bar.style.height = '2px';
    this.vizEl.appendChild(bar);
    this.vizBars.push(bar);
  }

  // Controls
  const self = this;
  root.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.getAttribute('data-action');
      if (a === 'play') self.togglePlay();
      else if (a === 'pause') self.audio.pause();
      else if (a === 'stop') { self.audio.pause(); self.audio.currentTime = 0; }
      else if (a === 'prev') self.skipTrack(-1);
      else if (a === 'next') self.skipTrack(1);
      else if (a === 'sync') self.syncToOther();
    });
  });

  // Pitch slider
  this.pitchSlider.addEventListener('input', () => {
    self.pitchPct = parseFloat(self.pitchSlider.value);
    self.applyPitch();
  });
  this.pitchSlider.addEventListener('dblclick', () => {
    self.pitchSlider.value = 0;
    self.pitchPct = 0;
    self.applyPitch();
  });

  // Time update
  this.audio.ontimeupdate = () => {
    if (!self.seeking && self.audio.duration) {
      self.elapsedEl.textContent = fmt(self.audio.currentTime);
    }
  };
  this.audio.onended = () => self.skipTrack(1);
  this.audio.volume = this.channelVol;

  // Waveform seek
  this.waveformSection.addEventListener('pointerdown', (e) => { self.seeking = true; self.seekFromWaveform(e); });
  this.waveformSection.addEventListener('pointermove', (e) => { if (self.seeking && e.buttons > 0) self.seekFromWaveform(e); });
  this.waveformSection.addEventListener('pointerup', () => { self.seeking = false; });
}

Deck.prototype.populatePlaylist = function(tracks) {
  this.tracks = tracks;
  const self = this;
  this.playlistEl.innerHTML = '';
  tracks.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'pl-item';
    div.innerHTML = '<span class="pl-num">' + (i+1) + '.</span><span class="pl-name">' + escapeHtml(t.replace(/\\.mp3$/i,'')) + '</span>';
    div.onclick = () => self.loadTrack(i);
    self.playlistEl.appendChild(div);
  });
};

Deck.prototype.loadTrack = async function(idx) {
  this.currentIndex = idx;
  const name = this.tracks[idx];
  const url = '/music/' + encodeURIComponent(name);
  this.audio.src = url;
  if (selectedDeviceId && typeof this.audio.setSinkId === 'function') {
    try { await this.audio.setSinkId(selectedDeviceId); } catch(e) {}
  }
  this.audio.play();
  this.titleEl.textContent = name.replace(/\\.mp3$/i,'');
  this.titleEl.classList.toggle('scrolling', this.titleEl.textContent.length > 30);
  this.highlightActive();
  this.initViz();
  this.generateWaveform(url);
  this.applyVolume();
};

Deck.prototype.togglePlay = function() {
  if (this.currentIndex < 0 && this.tracks.length > 0) { this.loadTrack(0); return; }
  if (this.audio.paused) this.audio.play(); else this.audio.pause();
};

Deck.prototype.skipTrack = function(dir) {
  if (this.tracks.length === 0) return;
  this.loadTrack((this.currentIndex + dir + this.tracks.length) % this.tracks.length);
};

Deck.prototype.highlightActive = function() {
  this.playlistEl.querySelectorAll('.pl-item').forEach((el, i) => {
    el.classList.toggle('active', i === this.currentIndex);
  });
};

Deck.prototype.applyVolume = function() {
  this.audio.volume = this.channelVol * this.mixVol;
};

Deck.prototype.initViz = function() {
  if (this.analyser) return;
  try {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = this.audio.captureStream ? this.audio.captureStream() : this.audio.mozCaptureStream();
    const source = this.audioCtx.createMediaStreamSource(stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 64;
    source.connect(this.analyser);
    this.animateViz();
  } catch(e) { console.log('Viz init failed:', e); }
};

Deck.prototype.animateViz = function() {
  const self = this;
  if (!self.analyser) return;
  const data = new Uint8Array(self.analyser.frequencyBinCount);
  self.analyser.getByteFrequencyData(data);
  self.vizBars.forEach((bar, i) => {
    bar.style.height = Math.max(2, (data[i] || 0) / 255 * 24) + 'px';
  });
  requestAnimationFrame(() => self.animateViz());
};

Deck.prototype.generateWaveform = async function(url) {
  this.waveformData = null;
  this.bpm = 0;
  this.originalBpm = 0;
  this.bpmEl.textContent = '...';
  this.waveformLoading.textContent = 'ANALYZING...';
  this.drawWaveform();
  try {
    const resp = await fetch(url);
    const buf = await resp.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await ctx.decodeAudioData(buf);
    ctx.close();
    const raw = decoded.getChannelData(0);

    // Waveform peaks
    const bars = 800;
    const blockSize = Math.floor(raw.length / bars);
    const peaks = new Float32Array(bars);
    for (let i = 0; i < bars; i++) {
      let max = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize; j++) {
        const v = Math.abs(raw[start + j]);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    this.waveformData = peaks;

    // BPM detection
    this.originalBpm = detectBPM(raw, decoded.sampleRate);
    this.bpm = this.originalBpm;
    this.bpmEl.textContent = this.bpm > 0 ? this.bpm.toFixed(1) : '---';

    // Reset pitch on new track
    this.pitchPct = 0;
    this.pitchSlider.value = 0;
    this.applyPitch();

    this.waveformLoading.textContent = '';
    this.drawWaveform();
    this.startWaveformAnim();
  } catch(e) {
    console.error('Waveform failed:', e);
    this.waveformLoading.textContent = '';
  }
};

Deck.prototype.applyPitch = function() {
  const rate = 1 + (this.pitchPct / 100);
  this.audio.playbackRate = rate;
  this.bpm = this.originalBpm * rate;
  this.bpmEl.textContent = this.bpm > 0 ? this.bpm.toFixed(1) : '---';
  const sign = this.pitchPct >= 0 ? '+' : '';
  this.pitchDisplayEl.textContent = sign + this.pitchPct.toFixed(1) + '%';
};

Deck.prototype.syncToOther = function() {
  const other = this.otherDeck;
  if (!other || !other.bpm || !this.originalBpm) return;
  // Calculate what playback rate we need to match the other deck's current BPM
  const targetRate = other.bpm / this.originalBpm;
  // Clamp to slider range (-8% to +8%)
  const pitchPct = (targetRate - 1) * 100;
  const clamped = Math.max(-8, Math.min(8, pitchPct));
  this.pitchPct = clamped;
  this.pitchSlider.value = clamped;
  this.applyPitch();
};

// ── BPM Detection ──
// Energy-based onset detection with autocorrelation
function detectBPM(samples, sampleRate) {
  // Downsample to ~11kHz for speed
  const ds = 4;
  const len = Math.floor(samples.length / ds);
  const mono = new Float32Array(len);
  for (let i = 0; i < len; i++) mono[i] = samples[i * ds];

  const dsSR = sampleRate / ds;

  // Compute energy in windows
  const winSize = Math.floor(dsSR * 0.02); // 20ms windows
  const hopSize = Math.floor(winSize / 2);
  const numWindows = Math.floor((len - winSize) / hopSize);
  const energy = new Float32Array(numWindows);
  for (let i = 0; i < numWindows; i++) {
    let sum = 0;
    const off = i * hopSize;
    for (let j = 0; j < winSize; j++) {
      sum += mono[off + j] * mono[off + j];
    }
    energy[i] = sum / winSize;
  }

  // Onset detection: first-order difference, half-wave rectify
  const onset = new Float32Array(numWindows);
  for (let i = 1; i < numWindows; i++) {
    onset[i] = Math.max(0, energy[i] - energy[i - 1]);
  }

  // Autocorrelation of onset signal
  // Search BPM range 60-200
  const windowsPerSec = dsSR / hopSize;
  const minLag = Math.floor(windowsPerSec * 60 / 200); // 200 BPM
  const maxLag = Math.floor(windowsPerSec * 60 / 60);  // 60 BPM
  const corrLen = Math.min(onset.length, maxLag * 4);

  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= maxLag && lag < corrLen; lag++) {
    let sum = 0;
    const n = Math.min(corrLen - lag, corrLen);
    for (let i = 0; i < n; i++) {
      sum += onset[i] * onset[i + lag];
    }
    if (sum > bestCorr) {
      bestCorr = sum;
      bestLag = lag;
    }
  }

  const bpm = (windowsPerSec * 60) / bestLag;

  // Normalize to 70-180 range (halve or double)
  let result = bpm;
  while (result > 180) result /= 2;
  while (result < 70) result *= 2;
  return Math.round(result * 10) / 10;
}

Deck.prototype.drawWaveform = function() {
  const canvas = this.waveformCanvas;
  const ctx = this.waveformCtx;
  const dpr = window.devicePixelRatio || 1;
  const rect = this.waveformSection.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);
  if (!this.waveformData) return;

  const pct = (this.audio.duration && isFinite(this.audio.duration))
    ? this.audio.currentTime / this.audio.duration : 0;
  const playX = pct * w;
  const bars = this.waveformData.length;
  const midY = h / 2;
  const baseColor = this.color;

  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * bars);
    const peak = this.waveformData[idx] || 0;
    const barH = peak * midY * 0.95;
    if (x < playX) {
      ctx.fillStyle = 'rgba(' + baseColor + ',0.25)';
    } else {
      const b = 0.4 + peak * 0.6;
      ctx.fillStyle = 'rgba(' + baseColor + ',' + b + ')';
    }
    ctx.fillRect(x, midY - barH, 1, barH * 2);
  }
  if (pct > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.floor(playX), 0, 1, h);
  }
};

Deck.prototype.startWaveformAnim = function() {
  if (this.waveformAnimId) cancelAnimationFrame(this.waveformAnimId);
  const self = this;
  function tick() { self.drawWaveform(); self.waveformAnimId = requestAnimationFrame(tick); }
  tick();
};

Deck.prototype.seekFromWaveform = function(e) {
  const rect = this.waveformSection.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  if (this.audio.duration && isFinite(this.audio.duration)) {
    this.audio.currentTime = pct * this.audio.duration;
  }
};

// ── Init decks ──
const deckA = new Deck('deck-a', document.getElementById('audio-a'), '68,136,255');
const deckB = new Deck('deck-b', document.getElementById('audio-b'), '255,102,68');
deckA.otherDeck = deckB;
deckB.otherDeck = deckA;

fetch('/api/tracks').then(r => r.json()).then(data => {
  deckA.populatePlaylist(data);
  deckB.populatePlaylist(data);
});

// ── Mixer ──
const faderA = document.getElementById('fader-a');
const faderB = document.getElementById('fader-b');
const crossfader = document.getElementById('crossfader');
const vuA = document.getElementById('vu-a');
const vuB = document.getElementById('vu-b');
const deviceSelect = document.getElementById('device-select');
let selectedDeviceId = '';

function updateMix() {
  deckA.channelVol = faderA.value / 100;
  deckB.channelVol = faderB.value / 100;
  // Crossfader: 0=full A, 50=center, 100=full B
  const cf = crossfader.value / 100;
  deckA.mixVol = Math.min(1, (1 - cf) * 2);
  deckB.mixVol = Math.min(1, cf * 2);
  deckA.applyVolume();
  deckB.applyVolume();
}
faderA.oninput = updateMix;
faderB.oninput = updateMix;
crossfader.oninput = updateMix;
updateMix();

// VU meters
function updateVU() {
  if (deckA.analyser) {
    const d = new Uint8Array(deckA.analyser.frequencyBinCount);
    deckA.analyser.getByteFrequencyData(d);
    const avg = d.reduce((a,b) => a+b, 0) / d.length;
    vuA.style.height = (avg / 255 * 100) + '%';
  }
  if (deckB.analyser) {
    const d = new Uint8Array(deckB.analyser.frequencyBinCount);
    deckB.analyser.getByteFrequencyData(d);
    const avg = d.reduce((a,b) => a+b, 0) / d.length;
    vuB.style.height = (avg / 255 * 100) + '%';
  }
  requestAnimationFrame(updateVU);
}
updateVU();

// ── Audio device ──
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
  } catch(e) { console.log('Device enum failed:', e); }
}
loadDevices();

deviceSelect.onchange = async () => {
  selectedDeviceId = deviceSelect.value;
  for (const deck of [deckA, deckB]) {
    if (typeof deck.audio.setSinkId === 'function') {
      try { await deck.audio.setSinkId(selectedDeviceId); } catch(e) {}
    }
  }
};
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
