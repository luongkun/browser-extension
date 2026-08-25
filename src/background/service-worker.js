// ============================================================
// Service worker — downloads + cross-tab media coordination
// ============================================================

// Download requests from content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SK_DOWNLOAD') {
    chrome.downloads.download({ url: msg.url, filename: msg.filename }, (id) => {
      sendResponse({ ok: !chrome.runtime.lastError, id });
    });
    return true; // async response
  }

  if (msg.type === 'SK_MEDIA_PLAY') {
    // Smart auto-pause: pause videos in other tabs
    (async () => {
      const tabs = await chrome.tabs.query({ active: false });
      for (const tab of tabs) {
        chrome.tabs
          .sendMessage(tab.id, { type: 'SK_PAUSE_OTHER' })
          .catch(() => {}); // tab may have no content script
      }
      sendResponse({ ok: true });
    })();
    return true;
  }
});

// Note: SK_PAUSE_OTHER is handled in main.js listener below via runtime message
