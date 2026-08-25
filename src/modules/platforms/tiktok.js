// ============================================================
// TikTok adapter — improved to detect the currently
// visible/playing video on feed pages (SPA navigation)
// ============================================================
window.SK = window.SK || {};
SK.platform.register({
  id: 'tiktok',

  /** Return the <video> element that is currently playing/visible */
  getVideo() {
    // Primary: the main feed video player
    const main = document.querySelector('video.html-main-media-player');
    if (main && !main.paused) return main;

    // Feed: the video inside the active/visible feed container
    const feedContainers = [
      '[data-e2e="feed-video"]',       // foryou/following
      '[data-e2e="video-player"]',     // generic
      '.DivItemContainer',             // common wrapper class
      '[class*="DivItemContainer"]',
      '[data-e2e="recommend-video"]',  // related videos
    ];
    for (const sel of feedContainers) {
      const container = document.querySelector(sel);
      if (container) {
        const v = container.querySelector('video');
        if (v && (v.currentTime > 0 || !v.paused || v.readyState >= 2)) return v;
      }
    }

    // Fallback: first video that's not a tiny preview
    const all = document.querySelectorAll('video');
    for (const v of all) {
      if (v.videoWidth >= 200 && v.videoHeight >= 200 && !v.paused) return v;
    }

    return main || document.querySelector('video');
  },

  /** Extract video ID from the currently visible video element's context */
  getVideoId() {
    // Detail page: /video/123456789
    const pathMatch = location.pathname.match(/\/video\/(\d+)/);
    if (pathMatch) {
      SK.utils.log('TikTok ID from pathname:', pathMatch[1]);
      return pathMatch[1];
    }

    // Feed page: find the active video's link
    const v = this.getVideo();
    if (v) {
      SK.utils.log('TikTok: found video element, searching for ID...');
      // Try parent link
      const link = v.closest('a[href*="/video/"]');
      if (link) {
        const m = link.href.match(/\/video\/(\d+)/);
        if (m) {
          SK.utils.log('TikTok ID from video ancestor link:', m[1]);
          return m[1];
        }
      }

      // Try data attributes on video or wrapper
      const dataId = v.dataset?.videoId || v.getAttribute('data-video-id');
      if (dataId && /^\d+$/.test(dataId)) {
        SK.utils.log('TikTok ID from video data attr:', dataId);
        return dataId;
      }

      // Check wrapper elements
      let el = v.parentElement;
      for (let i = 0; i < 4 && el; i++, el = el?.parentElement) {
        const id = el.dataset?.videoId || el.getAttribute('data-video-id');
        if (id && /^\d+$/.test(id)) {
          SK.utils.log('TikTok ID from wrapper data attr:', id);
          return id;
        }
        const a = el.querySelector('a[href*="/video/"]');
        if (a) {
          const m = a.href.match(/\/video\/(\d+)/);
          if (m) {
            SK.utils.log('TikTok ID from wrapper link:', m[1]);
            return m[1];
          }
        }
      }
    }

    // Last resort: any visible /video/ link on screen
    const links = document.querySelectorAll('a[href*="/video/"]');
    for (const a of links) {
      const rect = a.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50 &&
          rect.top >= 0 && rect.left >= 0 &&
          rect.bottom <= window.innerHeight && rect.right <= window.innerWidth) {
        const m = a.href.match(/\/video\/(\d+)/);
        if (m) {
          SK.utils.log('TikTok ID from visible link fallback:', m[1]);
          return m[1];
        }
      }
    }

    // Nothing found
    SK.utils.log('TikTok: NO video ID found');
    return '';
  },

  isShortFeed() {
    return (
      location.pathname === '/foryou' ||
      location.pathname.startsWith('/following') ||
      document.querySelector('[data-e2e="feed-video"]') !== null
    );
  },

    /** Build canonical URL for the currently visible video */
  getCanonicalUrl() {
    const id = this.getVideoId();
    if (/^\d+$/.test(id)) return `https://www.tiktok.com/@x/video/${id}`;

    // ShortKit original strategy: feed item container link
    const v = this.getVideo();
    const container = v?.closest(
      '[data-e2e="recommend-list-item-container"], [class*="DivItemContainer"], [class*="DivVideoItemContainer"]'
    );
    if (container) {
      const aTag = container.querySelector('a[href*="/video/"], a[href*="/v/"]');
      if (aTag) {
        SK.utils.log('TikTok URL from feed container:', aTag.href);
        return aTag.href;
      }
    }

    SK.utils.log('TikTok getCanonicalUrl: no ID, falling back to', location.pathname);
    return location.href.split('?')[0];
  },
});