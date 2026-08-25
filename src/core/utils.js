// ============================================================
// Shared utilities
// ============================================================
const SK = (window.SK = window.SK || {});

SK.utils = {
  /**
   * Pick the video element currently visible/playing.
   * SPA feeds (TikTok/Shorts/Reels) render multiple <video> nodes;
   * the active one has the largest intersection with the viewport
   * and/or is actually playing.
   */
  getVideo() {
    // Prefer platform adapter's detection if registered
    const adapter = SK.platform?.current?.();
    if (adapter?.getVideo) {
      const v = adapter.getVideo();
      if (v) return v;
    }

    // Generic fallback: most-visible non-tiny video, prefer playing
    const videos = [...document.querySelectorAll('video')];
    if (!videos.length) return null;

    let best = null;
    let bestScore = -1;
    for (const v of videos) {
      const rect = v.getBoundingClientRect();
      const vh = Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0);
      const vw = Math.min(rect.right, innerWidth) - Math.max(rect.left, 0);
      const area = Math.max(0, vh) * Math.max(0, vw);
      if (!area) continue;
      // playing videos win ties; scale area a bit for them
      const score = v.paused ? area : area * 1.5;
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }
    return best || videos[0];
  },

  /** Debounce helper */
  debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  },

  /** Observe DOM for new videos being mounted (SPA navigation) */
  onVideoReady(cb) {
    const check = () => {
      const v = this.getVideo();
      if (v) cb(v);
    };
    check();
    const mo = new MutationObserver(SK.utils.debounce(check, 300));
    mo.observe(document.body, { childList: true, subtree: true });
    return mo;
  },

  /** Detect current platform from hostname */
  detectPlatform() {
    const h = location.hostname;
    if (h.includes('tiktok.com')) return 'tiktok';
    if (h.includes('youtube.com')) return 'youtube';
    if (h.includes('instagram.com')) return 'instagram';
    return 'unknown';
  },

  /** Human-readable log with prefix */
  log(...args) {
    console.log('%c[ShortKit]', 'color:#fe2c55;font-weight:bold', ...args);
  },

  /** Random delay for human-like interactions */
  humanDelay(minMs = 400, maxMs = 1200) {
    return new Promise((r) =>
      setTimeout(r, minMs + Math.random() * (maxMs - minMs))
    );
  },
};
