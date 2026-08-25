// ============================================================
// Download Manager — inline button, URL box, multi-provider
// failover (tikwm -> douyin.wtf -> tiklydown), MP4 + MP3
// ============================================================
window.SK = window.SK || {};

SK.downloadManager = (() => {
  const PROVIDERS = [
    (url) => `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
    (url) => `https://douyin.wtf/api/hybrid/video_data?url=${encodeURIComponent(url)}`,
    (url) => `https://tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
  ];

  let toolbar = null;

  /** Resolve a page URL to a direct media URL via provider failover */
  async function resolve(pageUrl, format = 'mp4') {
    for (const build of PROVIDERS) {
      try {
        const res = await fetch(build(pageUrl), { credentials: 'omit' });
        if (!res.ok) continue;
        const data = await res.json();

        // tikwm shape
        const play =
          data?.data?.play ||
          data?.data?.hdplay ||
          // tiklydown shape
          data?.video?.noWatermark ||
          data?.video?.hd ||
          // douyin.wtf shape
          data?.video_data?.play_addr?.url_list?.[0];

        const music = data?.data?.music || data?.music;
        if (!play) continue;

        return {
          video: play.startsWith('//') ? `https:${play}` : play,
          audio: music,
          final: format === 'mp3' && music ? (music.startsWith('//') ? `https:${music}` : music) : (play.startsWith('//') ? `https:${play}` : play),
        };
      } catch (_) {
        /* try next provider */
      }
    }
    return null;
  }

  /** Trigger browser download via service worker */
  function save(url, filename) {
    chrome.runtime.sendMessage({ type: 'SK_DOWNLOAD', url, filename });
  }

  /** Download current video (used by inline button + keyboard) */
  async function downloadCurrent(format = 'mp4') {
    const platform = SK.platform.current();
    if (!platform) return SK.utils.log('Unknown platform');
    const pageUrl = location.href.split('?')[0];
    SK.utils.log(`Resolving ${pageUrl} (${format})...`);
    const media = await resolve(pageUrl, format);
    if (!media) {
      alert('ShortKit: could not resolve this video. Try the URL box in the popup.');
      return;
    }
    const id = platform.getVideoId();
    save(media.final, `shortkit-${platform.id}-${id}.${format}`);
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

  // ---- Inline toolbar injected on each video ----
  function injectToolbar() {
    if (toolbar || !SK.platform.current()) return;
    toolbar = document.createElement('div');
    toolbar.id = 'sk-toolbar';
    toolbar.innerHTML = `
      <button data-act="dl-mp4" title="Download MP4">⬇ MP4</button>
      <button data-act="dl-mp3" title="Download MP3">🎵 MP3</button>
      <button data-act="shot" title="Screenshot frame">📷</button>
      <button data-act="rot" title="Rotate video">🔄</button>
      <button data-act="zoom" title="Smart zoom (scroll to adjust)">🔍</button>
    `;
    toolbar.style.cssText = `
      position:fixed;left:12px;bottom:80px;z-index:2147483647;display:flex;gap:4px;
      background:#1a1a1a;border-radius:10px;padding:6px;box-shadow:0 2px 12px rgba(0,0,0,.5);
      font-family:system-ui;font-size:12px;
    `;
    toolbar.querySelectorAll('button').forEach((b) => {
      b.style.cssText =
        'background:#2c2c2c;color:#fff;border:none;border-radius:6px;padding:6px 8px;cursor:pointer';
      b.addEventListener('click', async () => {
        switch (b.dataset.act) {
          case 'dl-mp4': await downloadCurrent('mp4'); break;
          case 'dl-mp3': await downloadCurrent('mp3'); break;
          case 'shot': screenshot(); break;
          case 'rot': SK.videoTools.rotate(); break;
          case 'zoom': SK.videoTools.toggleZoom(); break;
        }
      });
    });
    document.body.appendChild(toolbar);
  }

  /** Download from arbitrary pasted URL (called from popup) */
  async function downloadFromUrl(pageUrl, format) {
    const media = await resolve(pageUrl, format);
    if (!media) throw new Error('Could not resolve URL');
    save(media.final, `shortkit-${Date.now()}.${format}`);
    return true;
  }

  return { downloadCurrent, downloadFromUrl, screenshot, injectToolbar };
})();
