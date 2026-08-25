// ============================================================
// Service worker — downloads + URL resolving + cross-tab media
// ============================================================

// ---- Provider failover for resolving media URLs ----
const PROVIDERS = [
  (url) => `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
  (url) => `https://douyin.wtf/api/hybrid/video_data?url=${encodeURIComponent(url)}`,
  (url) => `https://tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
];

async function resolveUrl(pageUrl) {
  for (const build of PROVIDERS) {
    try {
      const res = await fetch(build(pageUrl));
      if (!res.ok) continue;
      const data = await res.json();

      // tikwm shape: { data: { play, hdplay, music, ... } }
      const d = data?.data || {};
      if (d.play || d.hdplay || data?.video?.noWatermark) {
        return {
          ok: true,
          data: {
            video: d.hdplay || d.play || data.video.noWatermark,
            videoSize: d.hd_size || d.size,
            audio: d.music,
            audioSize: null,
            cover: d.cover,
          },
        };
      }

      // douyin.wtf shape
      const vd = data?.video_data?.play_addr?.url_list?.[0];
      if (vd) {
        return {
          ok: true,
          data: { video: vd, videoSize: null, audio: data?.music, cover: null },
        };
      }
    } catch (_) {
      /* try next provider */
    }
  }
  return { ok: false, error: 'Không hỗ trợ link này' };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Direct download request
  if (msg.type === 'DOWNLOAD_FILE' || msg.type === 'SK_DOWNLOAD') {
    chrome.downloads.download({ url: msg.url, filename: msg.filename }, (id) => {
      sendResponse({ ok: !chrome.runtime.lastError, id });
    });
    return true; // async
  }

  // Resolve a page URL to direct media URLs (from popup URL box)
  if (msg.type === 'RESOLVE_URL') {
    resolveUrl(msg.url).then(sendResponse);
    return true; // async
  }

  // Smart auto-pause: pause videos in other tabs
  if (msg.type === 'SK_MEDIA_PLAY') {
    (async () => {
      const tabs = await chrome.tabs.query({ active: false });
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: 'SK_PAUSE_OTHER' }).catch(() => {});
      }
      sendResponse({ ok: true });
    })();
    return true;
  }
});
