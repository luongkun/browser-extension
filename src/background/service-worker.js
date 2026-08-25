// ============================================================
// Service worker — URL resolving with provider failover,
// downloads, cross-tab media coordination
// Runs with extension privileges: no CORS restrictions
// for hosts listed in manifest host_permissions.
// ============================================================

// ---- TikTok providers ----
// tikwm is the only reliably-working public API (tested 2026-08);
// douyin.wtf and tiklydown are kept as last-resort with short timeouts.
function fetchWithTimeout(url, ms = 8000) {
  return Promise.race([
    fetch(url),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

const TIKTOK_PROVIDERS = [
  async (url) => {
    const res = await fetchWithTimeout(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.code !== 0) {
      console.log('[ShortKit SW] tikwm error:', data?.msg);
      return null;
    }
    const d = data?.data;
    if (!d?.play && !d?.hdplay) return null;
    const fix = (u) => (u?.startsWith('//') ? `https:${u}` : u);
    console.log('[ShortKit SW] resolved via tikwm');
    return {
      video: fix(d.hdplay || d.play),
      videoSize: d.hd_size || d.size,
      audio: fix(d.music),
      cover: fix(d.cover),
      provider: 'tikwm',
    };
  },
  async (url) => {
    const res = await fetchWithTimeout(`https://douyin.wtf/api/hybrid/video_data?url=${encodeURIComponent(url)}`, 5000);
    if (!res.ok) return null;
    const data = await res.json();
    const vd = data?.video_data?.play_addr?.url_list?.[0];
    if (!vd) return null;
    console.log('[ShortKit SW] resolved via douyin.wtf');
    return { video: vd, audio: data?.music, provider: 'douyin.wtf' };
  },
  async (url) => {
    const res = await fetchWithTimeout(`https://tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, 5000);
    if (!res.ok) return null;
    const data = await res.json();
    const v = data?.video?.noWatermark || data?.video?.hd || data?.url;
    if (!v) return null;
    console.log('[ShortKit SW] resolved via tiklydown');
    return { video: v, audio: data?.music, provider: 'tiklydown' };
  },
];

// ---- YouTube providers (Invidious / Piped public instances) ----
const YOUTUBE_PROVIDERS = [
  async (url) => {
    const videoId = url.match(/[?&]v=([\w-]+)/)?.[1];
    if (!videoId) return null;
    const instances = [
      'https://inv.nadeko.net',
      'https://yewtu.be',
      'https://pipedapi.kavin.rocks',
      'https://pipedapi.adminforge.de',
    ];
    for (const base of instances) {
      try {
        const res = await fetch(`${base}/api/v1/videos/${videoId}`);
        if (!res.ok) continue;
        const data = await res.json();

        // Invidious shape
        if (Array.isArray(data?.formatStreams)) {
          // prefer progressive mp4 (has both audio+video)
          const best =
            data.formatStreams.find((f) => f.itag === '18') ||
            data.formatStreams.find((f) => f.container === 'mp4') ||
            data.formatStreams[0];
          if (best?.url) {
            return {
              video: best.url,
              audio: data.adaptiveFormats?.find((f) => f.type?.includes('audio'))?.url || null,
              cover: data.videoThumbnails?.[0]?.url,
              provider: `inv:${base}`,
            };
          }
        }

        // Piped shape
        if (Array.isArray(data?.audioStreams) || Array.isArray(data?.videoStreams)) {
          const vBest =
            data.videoStreams?.filter((s) => s.videoOnly === false).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] ||
            data.videoStreams?.[0];
          const aBest =
            data.audioStreams?.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
          if (vBest?.url) {
            return {
              video: vBest.url,
              audio: aBest?.url,
              cover: data.thumbnailUrl,
              provider: `piped:${base}`,
            };
          }
        }
      } catch (_) { /* next instance */ }
    }
    return null;
  },
];

// ---- Instagram: direct src extraction happens in content script ----
const INSTAGRAM_PROVIDERS = [
  async (url) => {
    // Instagram needs the page context; content script passes direct src via
    // SK_DIRECT message. This provider just signals unsupported.
    return null;
  },
];

function pickProviders(pageUrl) {
  if (pageUrl.includes('tiktok.com')) return TIKTOK_PROVIDERS;
  if (pageUrl.includes('youtube.com') || pageUrl.includes('youtu.be')) return YOUTUBE_PROVIDERS;
  if (pageUrl.includes('instagram.com')) return INSTAGRAM_PROVIDERS;
  return [];
}

async function resolveUrl(pageUrl) {
  console.log('[ShortKit SW] Resolving:', pageUrl);
  const providers = pickProviders(pageUrl);
  for (const provider of providers) {
    try {
      const result = await provider(pageUrl);
      if (result?.video) return { ok: true, data: result };
    } catch (err) {
      console.log('[ShortKit SW] provider failed:', err.message);
    }
  }
  return {
    ok: false,
    error: 'Không giải mã được. Thử link khác hoặc copy link từ thanh địa chỉ.',
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DOWNLOAD_FILE' || msg.type === 'SK_DOWNLOAD') {
    chrome.downloads.download({ url: msg.url, filename: msg.filename }, (id) => {
      sendResponse({ ok: !chrome.runtime.lastError, id });
    });
    return true;
  }

  if (msg.type === 'RESOLVE_URL') {
    resolveUrl(msg.url).then(sendResponse);
    return true;
  }

  // Content script sends an already-extracted direct media URL (Instagram)
  if (msg.type === 'SK_DIRECT_MEDIA') {
    chrome.downloads.download(
      { url: msg.url, filename: msg.filename },
      (id) => sendResponse({ ok: !chrome.runtime.lastError, id })
    );
    return true;
  }

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
