// ============================================================
// YouTube Shorts adapter — detects the currently visible
// short in the shorts reel (SPA, multiple <video> elements)
// ============================================================
window.SK = window.SK || {};
SK.platform.register({
  id: 'youtube',

  /** The short currently on screen (yt renders 3 at once) */
  getVideo() {
    // Find which shorts player is most visible in viewport
    const players = document.querySelectorAll('#shorts-player video, ytd-reel-video-renderer video');
    let best = null;
    let bestArea = 0;
    for (const v of players) {
      const rect = v.getBoundingClientRect();
      const visibleH = Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0);
      const visibleW = Math.min(rect.right, innerWidth) - Math.max(rect.left, 0);
      const area = Math.max(0, visibleH) * Math.max(0, visibleW);
      if (area > bestArea) {
        bestArea = area;
        best = v;
      }
    }
    if (best) return best;
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  },

  /** ID of the short currently on screen */
  getVideoId() {
    // Watch/shorts detail page
    const m = location.pathname.match(/\/shorts\/([\w-]+)/);
    if (m) return m[1];

    // Feed: find the active short via aria subset / visible player
    const active =
      document.querySelector('ytd-reel-video-renderer[is-active] video') ||
      document.querySelector('ytd-reel-video-renderer[active] video');

    let el = active || this.getVideo();
    // walk up to the renderer element and read its link
    for (let i = 0; i < 6 && el; i++, el = el.parentElement) {
      if (el.tagName === 'YTD-REEL-VIDEO-RENDERER') {
        const a = el.querySelector('a[href*="/shorts/"]');
        const m2 = a?.href.match(/\/shorts\/([\w-]+)/);
        if (m2) return m2[1];
        const idAttr = el.getAttribute('id') || '';
        if (/^shorts/.test(idAttr)) {
          const m3 = idAttr.match(/([\w-]{11})/);
          if (m3) return m3[1];
        }
      }
    }
    return '';
  },

  isShortFeed() {
    return location.pathname.startsWith('/shorts');
  },

  getCanonicalUrl() {
    const id = this.getVideoId();
    if (id && !id.startsWith('/')) return `https://www.youtube.com/watch?v=${id}`;
    return location.href.split('?')[0];
  },
});
