// ============================================================
// Popup message handler additions to content script
// (loaded after main.js via content script list)
// ============================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SK_DL') {
    SK.downloadManager.downloadCurrent(msg.format || 'mp4').then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'SK_SHOT') {
    SK.downloadManager.screenshot();
    sendResponse({ ok: true });
    return;
  }
  if (msg.type === 'SK_PAUSE_OTHER') {
    const v = SK.utils.getVideo();
    if (v) v.pause();
    sendResponse({ ok: true });
    return;
  }
});
