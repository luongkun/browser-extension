// ============================================================
// Shared utilities
// ============================================================
const SK = (window.SK = window.SK || {});

SK.utils = {
  /** Query a single video element, platform-agnostic */
  getVideo() {
    return (
      document.querySelector('video.html-main-media-player') ||
      document.querySelector('#c-video-wrap video') ||
      document.querySelector('video')
    );
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
