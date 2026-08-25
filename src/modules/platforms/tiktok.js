// ============================================================
// TikTok adapter
// ============================================================
window.SK = window.SK || {};
SK.platform.register({
  id: 'tiktok',

  getVideo() {
    return (
      document.querySelector('video.html-main-media-player') ||
      document.querySelector('#app-container video') ||
      document.querySelector('video')
    );
  },

  getVideoId() {
    const m = location.pathname.match(/\/video\/(\d+)/);
    if (m) return m[1];
    return location.pathname; // /@user/live, feed paths
  },

  isShortFeed() {
    return (
      location.pathname === '/foryou' ||
      location.pathname.startsWith('/following') ||
      document.querySelector('[data-e2e="feed-video"]') !== null
    );
  },

  getDownloadUrl() {
    // Public web API used by several open-source downloaders
    const id = this.getVideoId().match(/^\d+$/)
      ? this.getVideoId()
      : null;
    if (!id) return null;
    return `https://www.tikwm.com/api/?url=https://www.tiktok.com/video/${id}`;
  },
});
