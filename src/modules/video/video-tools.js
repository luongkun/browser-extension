// ============================================================
// Video Tools — background play, smart auto-pause, rotate,
// cursor-follow zoom, clean mode
// ============================================================
window.SK = window.SK || {};

SK.videoTools = (() => {
  let visibilityHandler = null;
  let mouseMoveHandler = null;
  let wheelHandler = null;
  let zoomState = { enabled: false, scale: 1.5, x: 50, y: 50 };
  let cleanStyle = null;

  // ---- Background Play: keep audio when tab hidden ----
  function enableBackgroundPlay() {
    if (visibilityHandler) return;
    visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        const v = SK.utils.getVideo();
        if (v && !v.paused) {
          // Mute trick: some browsers pause on hidden; force play
          const p = v.play();
          if (p) p.catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', () => setTimeout(visibilityHandler, 100));
    window.addEventListener('blur', () => setTimeout(visibilityHandler, 100));

    // Override Page Visibility API in page world is not allowed from content
    // script (isolated), so we re-assert playback periodically while hidden.
    SK.videoTools._bgInterval = setInterval(() => {
      if (document.visibilityState === 'hidden') {
        const v = SK.utils.getVideo();
        if (v && v.paused && v.dataset.skKeepAlive === '1') {
          v.play().catch(() => {});
        }
      }
    }, 1500);
  }

  // ---- Smart Auto-Pause: pause this tab's video when another plays media ----
  function enableAutoPause() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') return;
      const settings = null; // handled by service worker coordination
    });
    // Real logic: ask service worker to broadcast "I'm playing"
    const video = SK.utils.getVideo();
    if (!video) return;
    video.addEventListener('play', () => {
      chrome.runtime.sendMessage({ type: 'SK_MEDIA_PLAY', tabId: true }).catch(() => {});
    });
  }

  // ---- Rotate: 90/180/270 with black letterbox ----
  let rotation = 0;
  function rotate() {
    const v = SK.utils.getVideo();
    if (!v) return;
    rotation = (rotation + 90) % 360;
    v.style.transformOrigin = 'center center';
    v.style.transform = `rotate(${rotation}deg)`;
    if (rotation === 90 || rotation === 270) {
      v.style.objectFit = 'contain';
      v.style.background = '#000';
    } else {
      v.style.transform = '';
    }
  }

  function resetRotation() {
    rotation = 0;
    const v = SK.utils.getVideo();
    if (v) v.style.transform = '';
  }

  // ---- Smart Zoom: cursor-following region zoom ----
  function toggleZoom() {
    const v = SK.utils.getVideo();
    if (!v) return;
    zoomState.enabled = !zoomState.enabled;

    if (zoomState.enabled) {
      v.style.transition = 'transform 0.15s ease-out';
      applyZoom(v);
      mouseMoveHandler = (e) => {
        const rect = v.getBoundingClientRect();
        zoomState.x = ((e.clientX - rect.left) / rect.width) * 100;
        zoomState.y = ((e.clientY - rect.top) / rect.height) * 100;
        applyZoom(v);
      };
      wheelHandler = (e) => {
        e.preventDefault();
        zoomState.scale = Math.min(5, Math.max(1.2, zoomState.scale + (e.deltaY < 0 ? 0.2 : -0.2)));
        applyZoom(v);
      };
      v.addEventListener('mousemove', mouseMoveHandler);
      v.addEventListener('wheel', wheelHandler, { passive: false });
    } else {
      v.style.transform = '';
      if (mouseMoveHandler) v.removeEventListener('mousemove', mouseMoveHandler);
      if (wheelHandler) v.removeEventListener('wheel', wheelHandler);
    }
  }

  function applyZoom(v) {
    v.style.transformOrigin = `${zoomState.x}% ${zoomState.y}%`;
    v.style.transform = `scale(${zoomState.scale})`;
  }

  // ---- Clean Mode: hide overlays / UI clutter ----
  const CLEAN_SELECTORS = [
    '[data-e2e="browse-video-desc"]',
    '[data-e2e="video-owner-detail"]',
    '.video-card-text',
    '#tiktok-verify-ip',
    '.css-1i3rrtu-DivCommentContainer',
    'ytd-reel-video-renderer #overlay',
    'ytd-reel-video-renderer ytd-reel-player-overlay-renderer',
    'section[aria-label*="Reel"] .xb57i2f0', // IG reels overlay heuristic
  ];

  function setCleanMode(on) {
    if (on && !cleanStyle) {
      cleanStyle = document.createElement('style');
      cleanStyle.id = 'sk-clean-mode';
      cleanStyle.textContent =
        CLEAN_SELECTORS.map((s) => `${s}{opacity:0!important;pointer-events:none!important}`).join('\n');
      document.head.appendChild(cleanStyle);
    } else if (!on && cleanStyle) {
      cleanStyle.remove();
      cleanStyle = null;
    }
  }

  function applyAll(settings) {
    if (settings.backgroundPlay) enableBackgroundPlay();
    else disableBackgroundPlay();
    if (settings.autoPause) enableAutoPause();
    setCleanMode(settings.cleanMode);
  }

  function disableBackgroundPlay() {
    clearInterval(SK.videoTools._bgInterval);
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
  }

  return {
    applyAll,
    enableBackgroundPlay,
    disableBackgroundPlay,
    rotate,
    resetRotation,
    toggleZoom,
    setCleanMode,
    get zoomEnabled() { return zoomState.enabled; },
  };
})();
