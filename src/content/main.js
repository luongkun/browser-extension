// ============================================================
// Content script entry — wires all modules together
// ============================================================
window.SK = window.SK || {};

(async function init() {
  SK.utils.log(`Initializing on ${SK.utils.detectPlatform()}...`);

  const settings = await SK.storage.getSettings();

  // Apply everything that runs inside the page
  SK.audioEngine.applyAll(settings);
  SK.videoTools.applyAll(settings);
  SK.downloadManager.injectToolbar();
  SK.watchTracker.startTracking();

  // ---- Keyboard shortcuts (act on current video) ----
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

    const v = SK.utils.getVideo();
    switch (e.key) {
      case 'ArrowLeft': if (v) v.currentTime = Math.max(0, v.currentTime - 3); break;
      case 'ArrowRight': if (v) v.currentTime += 3; break;
      case ',': if (v) v.playbackRate = Math.max(0.25, v.playbackRate - 0.25); break;
      case '.': if (v) v.playbackRate = Math.min(4, v.playbackRate + 0.25); break;
      case 'z': case 'Z': SK.videoTools.toggleZoom(); break;
      case 's': case 'S': SK.downloadManager.screenshot(); break;
    }
  });

  // ---- React to settings changes from popup ----
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'sync' && changes.settings) {
      const next = await SK.storage.getSettings();
      SK.audioEngine.applyAll(next);
      SK.videoTools.applyAll(next);
      SK.utils.log('Settings updated', next);
    }
  });

  // ---- Direct messages from popup (UPDATE_SETTINGS / PING) ----
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'PING') {
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'UPDATE_SETTINGS' && msg.settings) {
      SK.storage.saveSettings(msg.settings).then((next) => {
        SK.audioEngine.applyAll(next);
        SK.videoTools.applyAll(next);
        sendResponse({ ok: true });
      });
      return true;
    }
  });

  // ---- Handle SPA navigations (feed swipes change video element) ----
  SK.utils.onVideoReady((video) => {
    // re-assert speed on new videos
    SK.storage.getSettings().then((s) => {
      if (s.speed && s.speed !== 1) video.playbackRate = s.speed;
    });
    // keep-alive flag for background play
    if (settings.backgroundPlay) video.dataset.skKeepAlive = '1';
  });

  SK.utils.log('Ready ✔');
})();
