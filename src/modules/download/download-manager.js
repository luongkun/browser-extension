// ============================================================
// Download Manager — inline button, URL box, multi-provider
// failover, MP4 + MP3
// NOTE: All provider fetches go through the service worker to
// avoid CORS restrictions in the page context.
// ============================================================
window.SK = window.SK || {};

SK.downloadManager = (() => {
  let toolbar = null;

  /**
   * Build a canonical page URL for the current video.
   * On TikTok feed pages (/foryou), location.href has no video id,
   * so we extract it from DOM anchors or the video element.
   */
  function getCanonicalUrl() {
    const platform = SK.platform.current();
    const id = platform?.getVideoId?.() || '';

    // TikTok: numeric video id found in path -> build clean URL
    if (platform?.id === 'tiktok') {
      if (/^\d+$/.test(id)) return `https://www.tiktok.com/@x/video/${id}`;
      // Feed page: try to read the active slide's link
      const link =
        document.querySelector('[data-e2e="feed-video"] a[href*="/video/"]') ||
        document.querySelector('a[href*="/video/"][data-e2e]') ||
        [...document.querySelectorAll('a[href*="/video/"]')]
          .find((a) => a.closest('[data-e2e="feed-active-video"], .css-1sbo6h3-DivWrapper, [class*="DivItemContainer"]'));
      if (link) {
        const m = link.href.match(/\/video\/(\d+)/);
        if (m) return `https://www.tiktok.com/@x/video/${m[1]}`;
      }
      // Fallback: any /video/ link on page
      const anyLink = document.querySelector('a[href*="/video/"]');
      if (anyLink) {
        const m = anyLink.href.match(/\/video\/(\d+)/);
        if (m) return `https://www.tiktok.com/@x/video/${m[1]}`;
      }
      // Last resort: current URL (works on detail pages)
      return location.href.split('?')[0];
    }

    // YouTube Shorts: id is enough for providers via watch URL
    if (platform?.id === 'youtube' && !id.startsWith('/')) {
      return `https://www.youtube.com/watch?v=${id}`;
    }

    // Instagram Reels
    if (platform?.id === 'instagram') {
      return location.href.split('?')[0];
    }

    return location.href.split('?')[0];
  }

  /** Ask the service worker to resolve a page URL via provider failover */
  async function resolve(pageUrl, format = 'mp4') {
    return new Promise((resolvePromise) => {
      chrome.runtime.sendMessage(
        { type: 'RESOLVE_URL', url: pageUrl },
        (res) => {
          if (chrome.runtime.lastError || !res || !res.ok || !res.data?.video) {
            SK.utils.log('Resolve failed:', chrome.runtime.lastError?.message || res);
            resolvePromise(null);
            return;
          }
          const d = res.data;
          const wantAudio = format === 'mp3';
          resolvePromise({
            video: d.video,
            audio: d.audio,
            final: wantAudio && d.audio ? d.audio : d.video,
          });
        }
      );
    });
  }

  /** Trigger browser download via service worker */
  function save(url, filename) {
    chrome.runtime.sendMessage({ type: 'SK_DOWNLOAD', url, filename });
  }

  /** Download current video (used by inline button + keyboard) */
  async function downloadCurrent(format = 'mp4') {
    const platform = SK.platform.current();
    if (!platform) return;
    const pageUrl = getCanonicalUrl();
    SK.utils.log(`Resolving ${pageUrl} (${format})...`);
    notify('Đang giải mã link…');
    const media = await resolve(pageUrl, format);
    if (!media) {
      notify('Không giải mã được video này. Thử dán link vào popup nhé.');
      return;
    }
    const id = platform.getVideoId().replace(/[^\w-]/g, '').slice(-16) || Date.now();
    save(media.final, `shortkit-${platform.id}-${id}.${format}`);
    notify(`Đang tải ${format.toUpperCase()}…`);
  }

  /** Non-blocking Vietnamese toast on page (replaces alert) */
  function notify(msg) {
    const t = document.getElementById('sk-toast');
    if (t) t.remove();
    const el = document.createElement('div');
    el.id = 'sk-toast';
    el.textContent = msg;
    el.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
      'background:#fe2c55;color:#fff;padding:10px 20px;border-radius:20px;' +
      'font-family:system-ui;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.35);white-space:nowrap';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  /** Screenshot: capture current frame as PNG */
  function screenshot() {
    const v = SK.utils.getVideo();
    if (!v) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d').drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      save(url, `shortkit-frame-${Date.now()}.png`);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
  }

  return { downloadCurrent, resolve, getCanonicalUrl, screenshot };
})();
