// ============================================================
// Watch Tracker — history, watch-time dashboard, daily limits
// ============================================================
window.SK = window.SK || {};

SK.watchTracker = (() => {
  let currentVideoId = null;
  let tickTimer = null;
  const TICK_SEC = 5;

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Grab a small thumbnail from the playing video (may fail silently) */
  function captureThumb() {
    try {
      const v = SK.utils.getVideo();
      if (!v || !v.videoWidth) return null;
      const c = document.createElement('canvas');
      c.width = 120;
      c.height = Math.round((v.videoHeight / v.videoWidth) * 120) || 160;
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.6);
    } catch (_) {
      return null; // cross-origin taint or no frame yet
    }
  }

  async function recordTick(platform, videoId, seconds) {
    // --- stats per day ---
    const stats = (await SK.storage.getLocal('stats', {})) || {};
    const day = todayKey();
    stats[day] = stats[day] || { seconds: 0, videos: 0 };
    stats[day].seconds += seconds;

    // count a new video when id changes
    if (videoId !== currentVideoId) stats[day].videos += 1;
    // prune to last 30 days
    const keys = Object.keys(stats).sort();
    while (keys.length > 30) delete stats[keys.shift()];
    await SK.storage.setLocal('stats', stats);

    // --- history (last 200) ---
    const history = (await SK.storage.getLocal('history', [])) || [];
    if (videoId && !history.some((h) => h.id === videoId)) {
      history.unshift({
        id: videoId,
        platform,
        url: SK.downloadManager.getCanonicalUrl(),
        title: document.title.slice(0, 120),
        thumb: captureThumb(),
        at: Date.now(),
      });
      await SK.storage.setLocal('history', history.slice(0, 200));
    }

    await checkDailyLimit(stats[day]);
  }

  async function checkDailyLimit(dayStat) {
    const s = await SK.storage.getSettings();
    const overVideos = s.dailyLimitVideos > 0 && dayStat.videos >= s.dailyLimitVideos;
    const overMinutes = s.dailyLimitMinutes > 0 && dayStat.seconds >= s.dailyLimitMinutes * 60;
    if (!overVideos && !overMinutes) return;

    if (s.limitMode === 'block') {
      showBlockOverlay();
      const v = SK.utils.getVideo();
      if (v) v.pause();
    } else {
      showToast(
        `Bạn đã đạt giới hạn hôm nay (${dayStat.videos} video, ${Math.round(dayStat.seconds / 60)} phút). Nghỉ một chút nhé! 🙂`
      );
    }
  }

  function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText =
      'position:fixed;top:20px;right:20px;z-index:2147483647;background:#fe2c55;color:#fff;' +
      'padding:14px 18px;border-radius:10px;font-family:system-ui;font-size:14px;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.4);max-width:340px';
    const btn = document.createElement('button');
    btn.textContent = 'Đóng';
    btn.style.cssText = 'margin-left:10px;background:#fff;color:#fe2c55;border:none;border-radius:6px;padding:4px 10px;cursor:pointer';
    btn.onclick = () => t.remove();
    t.appendChild(btn);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 15000);
  }

  function showBlockOverlay() {
    if (document.getElementById('sk-block-overlay')) return;
    const o = document.createElement('div');
    o.id = 'sk-block-overlay';
    o.innerHTML = `
      <div style="text-align:center">
        <h2 style="font-size:28px;margin-bottom:12px">⏰ Đã đạt giới hạn hôm nay</h2>
        <p style="opacity:.85">Bạn đã xem đủ mức giới hạn tự đặt. Hẹn gặp lại ngày mai!</p>
        <button id="sk-unblock" style="margin-top:18px;padding:10px 22px;border:none;border-radius:8px;
          background:#fff;color:#111;font-size:15px;cursor:pointer">Tôi hiểu — mở khóa tạm thời</button>
      </div>`;
    o.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:rgba(10,10,10,.96);color:#fff;' +
      'display:flex;align-items:center;justify-content:center;font-family:system-ui';
    o.querySelector('#sk-unblock').onclick = () => o.remove();
    document.body.appendChild(o);
  }

  function startTracking() {
    clearInterval(tickTimer);
    currentVideoId = null;
    const platform = SK.platform.current()?.id || SK.utils.detectPlatform();

    tickTimer = setInterval(() => {
      const v = SK.utils.getVideo();
      if (v && !v.paused && !v.ended) {
        const id = SK.platform.current()?.getVideoId() || location.pathname;
        recordTick(platform, id, TICK_SEC);
        currentVideoId = id;
      }
    }, TICK_SEC * 1000);
  }

  return { startTracking };
})();
