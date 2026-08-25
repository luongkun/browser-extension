// ============================================================
// Storage wrapper — chrome.storage.sync for settings,
// chrome.storage.local for history/stats
// ============================================================
window.SK = window.SK || {};

SK.storage = {
  DEFAULTS: {
    backgroundPlay: true,
    autoPause: true,
    speed: 1,
    eqEnabled: false,
    eqPreset: 'flat',
    eqGains: [0, 0, 0, 0, 0, 0, 0, 0],
    normalizer: false,
    spatial8d: false,
    cleanMode: false,
    dailyLimitVideos: 0, // 0 = disabled
    dailyLimitMinutes: 0,
    limitMode: 'remind', // 'remind' | 'block'
  },

  async getSettings() {
    const result = await chrome.storage.sync.get('settings');
    return { ...this.DEFAULTS, ...(result.settings || {}) };
  },

  async saveSettings(patch) {
    const current = await this.getSettings();
    const next = { ...current, ...patch };
    await chrome.storage.sync.set({ settings: next });
    return next;
  },

  async getLocal(key, fallback) {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? fallback;
  },

  async setLocal(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },
};
