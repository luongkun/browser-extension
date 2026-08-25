// ============================================================
// Download Manager — detects the currently PLAYING video,
// resolves via direct src first, then provider failover
// NOTE: All provider fetches go through the service worker to
// avoid CORS restrictions in the page context.
// ============================================================
window.SK = window.SK || {};

SK.downloadManager = (() => {

  /**
   * Try to grab a downloadable URL straight from the active <video>
   * element (works when platform serves plain mp4 to the player).
   */
  function extractDirectSrc() {
    const v = SK.utils.getVideo();
    if (!v) return null;
    const src = v.currentSrc || v.src;
    if (src && /^https?:/.test(src) && !src.startsWith('blob:')) {
      return src;
    }
    return null;
  }

  /**
   * Build a canonical page URL for the currently visible video.
   * Delegates to platform adapters which detect feed position.
   */
  function getCanonicalUrl() {
    const platform = SK.platform.current();
    if (platform?.getCanonicalUrl) return platform.getCanonicalUrl();
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

  /** Download the currently playing video */
  async function downloadCurrent(format = 'mp4') {
    const platform = SK.platform.current();
    if (!platform) {
      notify('Không nhận diện được nền tảng.');
      return;
    }

    // 1. Direct extraction from the playing <video> element (no API needed)
    const direct = extractDirectSrc();
    if (direct && format === 'mp4') {
      SK.utils.log('Using direct video src');
      save(direct, `shortkit-${platform.id}-${Date.now()}.mp4`);
      notify('Đang tải MP4…');
      return;
    }

    // 2. Resolve via canonical URL + providers
    const pageUrl = getCanonicalUrl();
    SK.utils.log(`Resolving ${pageUrl} (${format})...`);
    notify('Đang giải mã link…');

    // Don't even try providers with a feed URL that has no video id
    if (/tiktok\.com\/(foryou|following)\/?$/.test(pageUrl)) {
      SK.utils.log('Feed URL without video ID — aborting resolve');
      notify('Không tìm thấy ID video. Cuộn trang một chút rồi thử lại.');
      return;
    }

    const media = await resolve(pageUrl, format);
    if (!media) {
      notify('Không giải mã được. Thử copy link từ thanh địa chỉ dán vào popup.');
      return;
    }

    const vidId = String(platform.getVideoId() || '').replace(/[^\w-]/g, '').slice(-16) || Date.now();
    save(media.final, `shortkit-${platform.id}-${vidId}.${format}`);
    notify(`Đang tải ${format.toUpperCase()}…`);
  }

  /** Non-blocking Vietnamese toast on page */
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

  /** Screenshot: capture frame from the currently VISIBLE video */
  function screenshot() {
    const v = SK.utils.getVideo();
    if (!v || !v.videoWidth) {
      notify('Không tìm thấy video đang phát.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d').drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      save(url, `shortkit-frame-${Date.now()}.png`);
      notify('Đã chụp khung hình ✔');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
  }

  return { downloadCurrent, resolve, getCanonicalUrl, screenshot };
})();
