// ============================================================
// Popup controller — binds UI <-> chrome.storage.sync
// ============================================================
const $ = (id) => document.getElementById(id);
const FIELDS = [
  'eqEnabled', 'eqPreset', 'normalizer', 'spatial8d',
  'backgroundPlay', 'autoPause', 'cleanMode',
  'dailyLimitVideos', 'dailyLimitMinutes', 'limitMode',
];

(async () => {
  const settings = await chrome.storage.sync.get('settings');
  const s = { ...SK_DEFAULTS, ...(settings.settings || {}) };

  // populate
  for (const f of FIELDS) {
    const el = $(f);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!s[f];
    else el.value = s[f];
  }
  $('speed').value = s.speed || 1;
  $('speedVal').textContent = `${s.speed || 1}×`;

  // show current platform
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const host = tab?.url ? new URL(tab.url).hostname : '';
  $('platform').textContent = host.includes('tiktok')
    ? '· TikTok'
    : host.includes('youtube')
      ? '· YouTube'
      : host.includes('instagram')
        ? '· Instagram'
        : '';

  // save helper
  async function patch(partial) {
    const cur = await chrome.storage.sync.get('settings');
    await chrome.storage.sync.set({
      settings: { ...SK_DEFAULTS, ...(cur.settings || {}), ...partial },
    });
  }

  // bind
  for (const f of FIELDS) {
    $(f)?.addEventListener('change', (e) => {
      const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      // numeric inputs
      if (e.target.type === 'number') patch({ [f]: Number(v) });
      else patch({ [f]: v });
    });
  }

  $('speed').addEventListener('input', (e) => {
    $('speedVal').textContent = `${e.target.value}×`;
    patch({ speed: Number(e.target.value) });
  });

  // Quick actions — message the active tab's content script
  async function sendToTab(msg) {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!t?.id) return;
    try {
      return await chrome.tabs.sendMessage(t.id, msg);
    } catch {
      $('status').textContent = 'Open a TikTok/Shorts/Reels page first.';
    }
  }

  $('btnMp4').onclick = () => sendToTab({ type: 'SK_DL', format: 'mp4' });
  $('btnMp3').onclick = () => sendToTab({ type: 'SK_DL', format: 'mp3' });
  $('btnShot').onclick = () => sendToTab({ type: 'SK_SHOT' });

  $('btnUrl').onclick = () => {
    const box = $('urlBox');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
  };
  $('urlBox').addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    $('status').textContent = 'Resolving…';
    try {
      // resolve via content script of any open platform tab; fallback to popup fetch
      const res = await resolveInPopup(e.target.value.trim());
      $('status').textContent = res ? 'Download started ✔' : 'Failed ✖';
      if (res) chrome.downloads.download({ url: res, filename: `shortkit-${Date.now()}.mp4` });
    } catch {
      $('status').textContent = 'Failed ✖';
    }
  });

  async function resolveInPopup(pageUrl) {
    const providers = [
      (u) => `https://www.tikwm.com/api/?url=${encodeURIComponent(u)}`,
      (u) => `https://tiklydown.eu.org/api/download?url=${encodeURIComponent(u)}`,
    ];
    for (const build of providers) {
      try {
        const r = await fetch(build(pageUrl));
        if (!r.ok) continue;
        const d = await r.json();
        const play = d?.data?.play || d?.video?.noWatermark || d?.data?.hdplay;
        if (play) return play.startsWith('//') ? `https:${play}` : play;
      } catch { /* next */ }
    }
    return null;
  }
})();

// Shared defaults (mirrors src/core/storage.js)
const SK_DEFAULTS = {
  backgroundPlay: true,
  autoPause: true,
  speed: 1,
  eqEnabled: false,
  eqPreset: 'flat',
  normalizer: false,
  spatial8d: false,
  cleanMode: false,
  dailyLimitVideos: 0,
  dailyLimitMinutes: 0,
  limitMode: 'remind',
};
