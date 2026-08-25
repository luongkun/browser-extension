// ============================================================
// In-page Download Button — injects next to each video's
// share/more menu on TikTok (and other platforms).
// On click: dropdown with MP4 / MP3 / Screenshot.
// ============================================================
window.SK = window.SK || {};

SK.downloadButton = (() => {
  let styleInjected = false;
  let menuObserver = null;
  const attachedContainers = new WeakSet();

  // Inject shared CSS once
  function injectStyles() {
    if (styleInjected) return;
    styleInjected = true;
    const style = document.createElement('style');
    style.id = 'sk-dl-btn-styles';
    style.textContent = `
      /* Download button matching TikTok action buttons */
      .sk-dl-btn {
        display: flex !important;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: transparent;
        border: none;
        cursor: pointer;
        color: #fff;
        padding: 0;
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease;
        z-index: 10;
        flex-shrink: 0;
      }
      .sk-dl-btn:hover {
        background: rgba(255, 255, 255, 0.15);
      }
      .sk-dl-btn:active {
        background: rgba(255, 255, 255, 0.25);
      }
      .sk-dl-btn svg {
        width: 22px;
        height: 22px;
        stroke: #fff;
        stroke-width: 2.5;
      }

      /* Show on hover of parent action bar or video */
      .sk-dl-action-bar:hover .sk-dl-btn,
      [data-e2e*="browse"]:hover .sk-dl-btn,
      [data-e2e*="video-"]:hover .sk-dl-btn,
      [class*="DivActionBar"]:hover .sk-dl-btn,
      [class*="action-bar"]:hover .sk-dl-btn {
        opacity: 1;
        transform: translateY(0);
      }

      /* Dropdown menu */
      .sk-dl-menu {
        position: fixed;
        background: #1a1a1a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 6px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
        z-index: 2147483647;
        display: none;
        flex-direction: column;
        gap: 2px;
        min-width: 140px;
      }
      .sk-dl-menu.show {
        display: flex;
        animation: sk-fade-in 0.12s ease;
      }
      @keyframes sk-fade-in {
        from { opacity: 0; transform: translateY(-6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .sk-dl-menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 8px;
        color: #fff;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13.5px;
        font-weight: 500;
        cursor: pointer;
        background: transparent;
        border: none;
        width: 100%;
        text-align: left;
        transition: background 0.1s;
      }
      .sk-dl-menu-item:hover {
        background: rgba(254, 44, 85, 0.18);
      }
      .sk-dl-menu-item svg {
        width: 18px;
        height: 18px;
        stroke: #fe2c55;
        stroke-width: 2.5;
        flex-shrink: 0;
      }
      .sk-dl-menu-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.08);
        margin: 4px 8px;
      }
    `;
    document.head.appendChild(style);
  }

  // Create download button element
  function createDownloadBtn(videoEl) {
    const btn = document.createElement('button');
    btn.className = 'sk-dl-btn';
    btn.setAttribute('aria-label', 'Tải video / nhạc');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `;

    let menu = null;

    function createMenu() {
      if (menu) return menu;
      menu = document.createElement('div');
      menu.className = 'sk-dl-menu';
      menu.innerHTML = `
        <button class="sk-dl-menu-item" data-act="mp4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Tải MP4
        </button>
        <button class="sk-dl-menu-item" data-act="mp3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          Tải MP3
        </button>
        <div class="sk-dl-menu-divider"></div>
        <button class="sk-dl-menu-item" data-act="shot">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          Chụp khung hình
        </button>
      `;
      document.body.appendChild(menu);

      menu.querySelectorAll('.sk-dl-menu-item').forEach(item => {
        item.addEventListener('click', async () => {
          const act = item.dataset.act;
          hideMenu();
          if (act === 'mp4') await SK.downloadManager.downloadCurrent('mp4');
          else if (act === 'mp3') await SK.downloadManager.downloadCurrent('mp3');
          else if (act === 'shot') SK.downloadManager.screenshot();
        });
      });

      // Close menu on outside click
      document.addEventListener('click', onDocClick);
      return menu;
    }

    function onDocClick(e) {
      if (!menu.contains(e.target) && e.target !== btn) hideMenu();
    }

    function showMenu() {
      if (!menu) createMenu();
      const rect = btn.getBoundingClientRect();
      // Position below button, centered
      menu.style.left = (rect.left + rect.width / 2 - 140 / 2) + 'px';
      menu.style.top = (rect.bottom + 6) + 'px';
      menu.classList.add('show');
    }

    function hideMenu() {
      if (menu) menu.classList.remove('show');
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu?.classList.contains('show')) hideMenu();
      else showMenu();
    });

    // Keyboard navigation: ESC to close
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideMenu();
    });

    return btn;
  }

  // Find the action bar container for a video
  function findActionBar(videoEl) {
    // TikTok feed: the right-side action bar with like/comment/share
    const selectors = [
      '[data-e2e="browse-action"]',        // browse page
      '[data-e2e="video-action"]',         // feed page
      '[class*="DivActionBar"]',           // generic
      '[class*="action-bar"]',             // generic
      '[class*="ActionBar"]',              // variant
    ];

    // Try data-e2e based action bars
    for (const sel of selectors) {
      const bar = videoEl.closest(sel);
      if (bar) {
        // Find the share button area to insert before
        const shareBtn = bar.querySelector('[data-e2e*="share"], [data-e2e*="more"], button:last-child');
        if (shareBtn) return { bar, anchor: shareBtn };
      }
    }

    // Fallback: find any bar-like sibling with multiple buttons
    const parent = videoEl.parentElement;
    if (parent) {
      const buttons = parent.querySelectorAll('button');
      if (buttons.length >= 2) {
        const lastBtn = buttons[buttons.length - 1];
        return { bar: parent, anchor: lastBtn };
      }
    }

    return null;
  }

  // Attach download button to a video's action bar
  function attachToVideo(videoEl) {
    if (!videoEl || attachedContainers.has(videoEl)) return;

    const found = findActionBar(videoEl);
    if (!found) return;

    const { bar, anchor } = found;
    if (!bar || !anchor) return;

    // Check if already has our button
    if (bar.querySelector('.sk-dl-btn')) return;

    injectStyles();
    const btn = createDownloadBtn(videoEl);

    // Insert before share/more button
    bar.insertBefore(btn, anchor);
    attachedContainers.add(videoEl);

    // Track video element for cleanup if needed
    videoEl.dataset.skDlBtnAttached = '1';
    SK.utils.log('Download button attached to', videoEl);
  }

  // Scan for all visible videos and attach buttons
  function scanAndAttach() {
    const videos = document.querySelectorAll('video');
    for (const v of videos) {
      // Only attach to substantial videos (not tiny previews/ads)
      if (v.videoWidth >= 200 && v.videoHeight >= 200) {
        attachToVideo(v);
      }
    }
  }

  // Watch for new videos added to feed (SPA navigation)
  function observe() {
    if (menuObserver) return;
    menuObserver = new MutationObserver(SK.utils.debounce(() => {
      scanAndAttach();
    }, 500));
    menuObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Initialize
  function init() {
    injectStyles();
    scanAndAttach();
    observe();

    // Also re-scan on scroll (new videos enter viewport)
    let scrollTimer = null;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(scanAndAttach, 300);
    }, { passive: true });

    SK.utils.log('Download button module initialized');
  }

  // Cleanup on unload (not strictly needed but good practice)
  function destroy() {
    if (menuObserver) {
      menuObserver.disconnect();
      menuObserver = null;
    }
    const menus = document.querySelectorAll('.sk-dl-menu');
    menus.forEach(m => m.remove());
    document.querySelectorAll('.sk-dl-btn').forEach(b => b.remove());
  }

  return { init, destroy, scanAndAttach };
})();

// Auto-initialize on TikTok/Shorts/Reels
if (SK.platform.current()) {
  // Wait a bit for DOM to settle
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => SK.downloadButton.init(), 500));
  } else {
    setTimeout(() => SK.downloadButton.init(), 500);
  }
}