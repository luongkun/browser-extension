// ============================================================
// Audio Engine — 8-band EQ, adaptive volume normalizer,
// 360° spatial audio, playback speed
// Uses Web Audio API, hooks into <video> element
// ============================================================
window.SK = window.SK || {};

SK.audioEngine = (() => {
  let ctx = null;
  let sourceNode = null;
  let eqBands = [];
  let normalizerGain = null;
  let analyser = null;
  let pannerNode = null;
  let spatialTimer = null;
  let currentVideo = null;

  // Frequencies: 60, 150, 400, 1k, 2.4k, 6k, 12k, 16k
  const FREQS = [60, 150, 400, 1000, 2400, 6000, 12000, 16000];

  const PRESETS = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0],
    bassBoost: [8, 6, 4, 1, 0, 0, 0, 0],
    treble: [0, 0, 0, 0, 1, 3, 5, 7],
    vocal: [-2, -1, 0, 3, 4, 2, 0, -1],
    pop: [-1, 1, 3, 4, 3, 1, -1, -2],
    rock: [5, 3, -1, -2, 0, 3, 5, 5],
    electronic: [6, 4, 1, 0, -1, 1, 4, 6],
    jazz: [3, 2, 0, 1, -1, 0, 2, 3],
    classical: [4, 3, 2, 0, -1, -1, 2, 3],
    dance: [7, 5, 2, 0, -2, -2, 1, 3],
  };

  function ensureGraph(video) {
    if (ctx && currentVideo === video) return true;
    try {
      if (!ctx) ctx = new AudioContext();
      // Detach old graph
      if (sourceNode) {
        try { sourceNode.disconnect(); } catch (_) {}
      }
      sourceNode = ctx.createMediaElementSource(video);
      currentVideo = video;

      // EQ chain
      eqBands = FREQS.map((f, i) => {
        const biquad = ctx.createBiquadFilter();
        biquad.type = i === 0 ? 'lowshelf' : i === FREQS.length - 1 ? 'highshelf' : 'peaking';
        biquad.frequency.value = f;
        biquad.Q.value = 1;
        biquad.gain.value = 0;
        return biquad;
      });

      normalizerGain = ctx.createGain();
      pannerNode = ctx.createStereoPanner();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;

      // Chain: source -> EQ... -> normalizer -> panner -> analyser -> destination
      let node = sourceNode;
      for (const band of eqBands) {
        node.connect(band);
        node = band;
      }
      node.connect(normalizerGain);
      normalizerGain.connect(pannerNode);
      pannerNode.connect(analyser);
      analyser.connect(ctx.destination);

      SK.utils.log('Audio graph created');
      return true;
    } catch (err) {
      console.error('[ShortKit] audio graph failed:', err);
      return false;
    }
  }

  function setEqGains(gains) {
    if (eqBands.length === 0) return false;
    gains.forEach((g, i) => {
      if (eqBands[i]) eqBands[i].gain.value = g;
    });
    return true;
  }

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (preset) setEqGains(preset);
    return !!preset;
  }

  function enableEq(enabled) {
    if (enabled) {
      if (!ensureGraph(currentVideo || SK.utils.getVideo())) return;
      ctx.resume();
    }
  }

  // ---- Adaptive Volume Normalizer (real-time RMS) ----
  let normRAF = null;
  function startNormalizer() {
    if (!ensureGraph(SK.utils.getVideo())) return;
    ctx.resume();
    const buf = new Float32Array(analyser.fftSize);
    let smoothed = 1;

    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);

      // Target RMS ~0.15; clamp gain 0.3x – 3x
      const target = rms > 0.01 ? Math.min(3, Math.max(0.3, 0.15 / rms)) : smoothed;
      smoothed = smoothed * 0.9 + target * 0.1; // smooth to avoid pumping
      normalizerGain.gain.value = smoothed;
      normRAF = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(normRAF);
    normRAF = requestAnimationFrame(tick);
  }

  function stopNormalizer() {
    cancelAnimationFrame(normRAF);
    if (normalizerGain) normalizerGain.gain.value = 1;
  }

  // ---- 360° Spatial Audio ----
  function startSpatial() {
    if (!ensureGraph(SK.utils.getVideo())) return;
    ctx.resume();
    let angle = 0;
    clearInterval(spatialTimer);
    spatialTimer = setInterval(() => {
      angle += 0.05;
      pannerNode.pan.value = Math.sin(angle); // rotate LFO between -1 and 1
    }, 50);
  }

  function stopSpatial() {
    clearInterval(spatialTimer);
    if (pannerNode) pannerNode.pan.value = 0;
  }

  function setSpeed(v) {
    const video = SK.utils.getVideo();
    if (video) video.playbackRate = v;
  }

  async function applyAll(settings) {
    if (settings.eqEnabled || settings.normalizer || settings.spatial8d) {
      const video = SK.utils.getVideo();
      if (video) {
        ensureGraph(video);
        video.play().catch(() => {}); // unlock on user gesture
      }
    }
    settings.eqEnabled ? applyPreset(settings.eqPreset) : setEqGains(new Array(8).fill(0));
    settings.normalizer ? startNormalizer() : stopNormalizer();
    settings.spatial8d ? startSpatial() : stopSpatial();
    setSpeed(settings.speed || 1);
  }

  return {
    applyAll,
    applyPreset,
    setSpeed,
    startNormalizer,
    stopNormalizer,
    startSpatial,
    stopSpatial,
    PRESETS,
  };
})();
