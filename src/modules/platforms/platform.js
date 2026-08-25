// ============================================================
// Platform abstraction — each platform adapter implements:
//   id, getVideo(), getVideoId(), isShortFeed(), getDownloadUrl()
// ============================================================
window.SK = window.SK || {};

SK.platform = {
  adapters: {},

  register(adapter) {
    this.adapters[adapter.id] = adapter;
  },

  current() {
    const name = SK.utils.detectPlatform();
    return this.adapters[name] || null;
  },
};
