// ============================================================
// Instagram Reels adapter
// ============================================================
window.SK = window.SK || {};
SK.platform.register({
  id: 'instagram',

  getVideo() {
    return (
      document.querySelector('video[playsinline]') ||
      document.querySelector('video')
    );
  },

  getVideoId() {
    // /reels/<code> or /reel/<code>
    const m = location.pathname.match(/\/reels?\/([\w-]+)/);
    if (m) return m[1];
    return location.pathname;
  },

  isShortFeed() {
    return location.pathname.startsWith('/reels');
  },

  getDownloadUrl() {
    const videoEl = this.getVideo();
    if (videoEl && videoEl.src) return videoEl.src;
    const source = document.querySelector('source[src]');
    return source ? source.src : null;
  },
});
