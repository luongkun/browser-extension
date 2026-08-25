// ============================================================
// Instagram Reels adapter — detects the currently visible reel
// ============================================================
window.SK = window.SK || {};
SK.platform.register({
  id: 'instagram',

  /** The reel most visible in the viewport */
  getVideo() {
    const videos = document.querySelectorAll('video');
    let best = null;
    let bestArea = 0;
    for (const v of videos) {
      const rect = v.getBoundingClientRect();
      const visibleH = Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0);
      const visibleW = Math.min(rect.right, innerWidth) - Math.max(rect.left, 0);
      const area = Math.max(0, visibleH) * Math.max(0, visibleW);
      if (area > bestArea && v.videoWidth > 100) {
        bestArea = area;
        best = v;
      }
    }
    return best || document.querySelector('video');
  },

  getVideoId() {
    const m = location.pathname.match(/\/reels?\/([\w-]+)/);
    if (m) return m[1];
    // Feed: use current media element src as pseudo-id
    const v = this.getVideo();
    if (v?.currentSrc) {
      // hash-ish stable id from src
      let hash = 0;
      for (const ch of v.currentSrc) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
      return `ig_${hash.toString(36)}`;
    }
    return '';
  },

  isShortFeed() {
    return location.pathname.startsWith('/reels');
  },

  getCanonicalUrl() {
    const m = location.pathname.match(/\/reels?\/([\w-]+)/);
    if (m) return `https://www.instagram.com/reel/${m[1]}/`;
    return location.href.split('?')[0];
  },
});
