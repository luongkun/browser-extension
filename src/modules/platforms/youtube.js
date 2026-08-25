// ============================================================
// YouTube Shorts adapter
// ============================================================
window.SK = window.SK || {};
SK.platform.register({
  id: 'youtube',

  getVideo() {
    return (
      document.querySelector('#shorts-player video') ||
      document.querySelector('video.html5-main-video') ||
      document.querySelector('video')
    );
  },

  getVideoId() {
    // /shorts/<id>
    const m = location.pathname.match(/\/shorts\/([\w-]+)/);
    if (m) return m[1];
    const w = new URLSearchParams(location.search).get('v');
    return w || location.pathname;
  },

  isShortFeed() {
    return location.pathname.startsWith('/shorts');
  },

  getDownloadUrl() {
    const id = this.getVideoId();
    if (!id || id.startsWith('/')) return null;
    return `https://www.youtube.com/watch?v=${id}`;
  },
});
