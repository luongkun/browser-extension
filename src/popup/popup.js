document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const setText = (id, v) => { const e = $(id); if (e) e.textContent = v; };

  // --- Collapsible Features ---
  const featuresToggleRow = $('features-toggle-row');
  const featuresGridContent = $('features-grid-content');
  const featuresArrow = $('features-arrow');

  if (featuresToggleRow && featuresGridContent && featuresArrow) {
    chrome.storage.local.get({featuresExpanded: true}, res => {
      const isExp = res.featuresExpanded;
      featuresGridContent.style.display = isExp ? 'grid' : 'none';
      featuresArrow.style.transform = isExp ? 'rotate(180deg)' : 'rotate(0deg)';
    });

    featuresToggleRow.addEventListener('click', () => {
      const isCurrentlyExpanded = featuresGridContent.style.display !== 'none';
      const nextState = !isCurrentlyExpanded;
      featuresGridContent.style.display = nextState ? 'grid' : 'none';
      featuresArrow.style.transform = nextState ? 'rotate(180deg)' : 'rotate(0deg)';
      chrome.storage.local.set({featuresExpanded: nextState});
    });
  }

  // --- Toast ---
  function toast(msg) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  // --- Send message to content script ---
  function sendToTab(msg, cb) {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
      const tab = tabs[0];
      if (!tab?.id) return;
      chrome.tabs.sendMessage(tab.id, msg)
        .then(cb)
        .catch(err => {
          if (err.message.includes('context invalidated') || err.message.includes('Receiving end does not exist')) {
            const w = $('reload-warning');
            if (w) w.style.display = 'block';
          }
        });
    });
  }

  // --- Theme logic ---
  const isDarkOS = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  let currentTheme = localStorage.getItem('sk_theme') || (isDarkOS ? 'dark' : 'light');
  if (currentTheme === 'dark') document.documentElement.classList.add('dark-theme');
  else document.documentElement.classList.add('light-theme');

  const thToggle = $('theme-toggle');
  if (thToggle) {
    thToggle.addEventListener('click', () => {
      if (document.documentElement.classList.contains('dark-theme')) {
        document.documentElement.classList.remove('dark-theme');
        document.documentElement.classList.add('light-theme');
        localStorage.setItem('sk_theme', 'light');
      } else {
        document.documentElement.classList.remove('light-theme');
        document.documentElement.classList.add('dark-theme');
        localStorage.setItem('sk_theme', 'dark');
      }
    });
  }

  // --- Speed buttons helper ---
  function updateSpeedBtns(val) {
    document.querySelectorAll('.ps-btn').forEach(b => {
      if (+b.dataset.v === +val) b.classList.add('on');
      else b.classList.remove('on');
    });
  }

  // --- Load settings from storage ---
  chrome.storage.sync.get(null, data => {
    const s = {
      backgroundPlay: true,
      autoPause: true,
      speed: 1,
      eqEnabled: false,
      eqPreset: 'normal',
      normalizer: false,
      spatial8d: false,
      cleanMode: false,
      dailyLimitVideos: 0,
      dailyLimitMinutes: 0,
      limitMode: 'remind',
      ...data,
      ...(data.settings || {})
    };

    // Checkboxes
    const checks = {
      'c-bg': s.backgroundPlay,
      'c-autopause': s.autoPause,
      'c-clean': s.cleanMode,
      'c-volnorm': s.normalizer,
      'c-audio360': s.spatial8d
    };
    Object.entries(checks).forEach(([id, val]) => {
      const el = $(id);
      if (el) el.checked = !!val;
    });

    // Speed
    const ss = $('s-speed');
    if (ss) {
      ss.value = s.speed || 1;
      ss.style.setProperty('--fill', ((s.speed / 4) * 100) + '%');
    }
    setText('d-speed', (s.speed || 1) + 'x');
    updateSpeedBtns(s.speed || 1);

    // EQ preset
    const seq = $('s-eq');
    if (seq) seq.value = s.eqPreset || 'normal';

    // Limits
    const limV = $('i-limit-videos');
    if (limV) limV.value = s.dailyLimitVideos || 0;
    const limM = $('i-limit-minutes');
    if (limM) limM.value = s.dailyLimitMinutes || 0;
    const limMode = $('s-limit-mode');
    if (limMode) limMode.value = s.limitMode || 'remind';

    // Check active tab platform
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
      const tab = tabs[0];
      const url = tab?.url || '';
      let platformText = 'Không hỗ trợ trang này';
      let isSupported = false;
      if (url.includes('tiktok.com')) { platformText = 'TikTok đang mở'; isSupported = true; }
      else if (url.includes('youtube.com')) { platformText = 'YouTube đang mở'; isSupported = true; }
      else if (url.includes('instagram.com')) { platformText = 'Instagram đang mở'; isSupported = true; }

      const st = $('status');
      if (st) st.className = 'status' + (isSupported ? ' on' : '');
      setText('stext', platformText);
    });

    // Load today stats
    loadTodayStats();
  });

  // --- Load today stats from local storage ---
  async function loadTodayStats() {
    try {
      const stats = await chrome.storage.local.get('stats');
      const day = new Date().toISOString().slice(0, 10);
      const today = stats.stats?.[day] || { seconds: 0, videos: 0 };
      const mins = Math.round(today.seconds / 60);
      setText('d-stats', `${today.videos} video · ${mins} phút`);
    } catch {
      setText('d-stats', 'Không tải được');
    }
  }

  // --- Apply settings to storage and notify content script ---
  function apply() {
    const settings = {
      backgroundPlay: $('c-bg')?.checked ?? true,
      autoPause: $('c-autopause')?.checked ?? true,
      speed: +($('s-speed')?.value ?? 1),
      eqPreset: $('s-eq')?.value ?? 'normal',
      normalizer: $('c-volnorm')?.checked ?? false,
      spatial8d: $('c-audio360')?.checked ?? false,
      cleanMode: $('c-clean')?.checked ?? false,
      dailyLimitVideos: +($('i-limit-videos')?.value ?? 0),
      dailyLimitMinutes: +($('i-limit-minutes')?.value ?? 0),
      limitMode: $('s-limit-mode')?.value ?? 'remind'
    };

    chrome.storage.sync.set({ settings }, () => {
      if (chrome.runtime.lastError) return;
      sendToTab({ type: 'UPDATE_SETTINGS', settings }, undefined);
      loadTodayStats(); // refresh stats display
    });
  }

  // --- Bind events ---
  // Speed slider
  const ss = $('s-speed');
  if (ss) {
    ss.addEventListener('input', e => {
      const v = +e.target.value;
      setText('d-speed', v + 'x');
      updateSpeedBtns(v);
      ss.style.setProperty('--fill', ((v / 4) * 100) + '%');
      apply();
    });
  }

  // Speed preset buttons
  document.querySelectorAll('.ps-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const v = +e.target.dataset.v;
      if (ss) {
        ss.value = v;
        ss.style.setProperty('--fill', ((v / 4) * 100) + '%');
      }
      setText('d-speed', v + 'x');
      updateSpeedBtns(v);
      apply();
    });
  });

  // Checkboxes
  ['c-bg', 'c-autopause', 'c-clean', 'c-volnorm', 'c-audio360'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', apply);
  });

  // EQ preset
  const seq = $('s-eq');
  if (seq) seq.addEventListener('change', apply);

  // Limits
  ['i-limit-videos', 'i-limit-minutes', 's-limit-mode'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', apply);
  });

  // --- Screenshot ---
  const btnSs = $('btn-screenshot');
  if (btnSs) btnSs.addEventListener('click', () => {
    sendToTab({ type: 'SK_SHOT' }, undefined);
    toast('Đang chụp khung hình...');
  });

  // --- Download from URL ---
  const urlGo = $('f-url-go');
  const urlEl = $('f-url');
  const dlStatus = $('dl-status');
  const dlResult = $('dl-result');

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
  }

  function fmtSize(b) {
    if (!b || b <= 0) return '';
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
    return b + ' B';
  }

  if (urlGo && urlEl) {
    const handleGo = async () => {
      const url = urlEl.value.trim();
      if (!url) {
        dlStatus.textContent = 'Dán link trước nhé';
        dlStatus.style.display = 'block';
        dlStatus.style.color = 'var(--mt)';
        return;
      }
      const full = url.startsWith('http') ? url : 'https://' + url;
      dlStatus.textContent = 'Đang giải mã link...';
      dlStatus.style.display = 'block';
      dlStatus.style.color = 'var(--mt)';
      dlResult.innerHTML = '';
      urlGo.disabled = true;

      try {
        const res = await chrome.runtime.sendMessage({ type: 'RESOLVE_URL', url: full });
        urlGo.disabled = false;

        if (!res || !res.ok) {
          dlStatus.textContent = 'Lỗi: ' + (res?.error || 'Không giải mã được');
          dlStatus.style.color = '#ff3b30';
          return;
        }

        const d = res.data;
        const rows = [];
        if (d.video) rows.push({ label: 'Video MP4', size: d.videoSize, href: d.video, file: 'video.mp4' });
        if (d.audio) rows.push({ label: 'Nhạc MP3', size: d.audioSize, href: d.audio, file: 'audio.mp3' });
        if (d.cover) rows.push({ label: 'Ảnh bìa', size: null, href: d.cover, file: 'cover.jpg' });

        if (!rows.length) {
          dlStatus.textContent = 'Không tìm thấy file';
          dlStatus.style.color = '#ff3b30';
          return;
        }

        dlStatus.textContent = `${rows.length} file sẵn sàng`;
        dlStatus.style.color = '#34c759';

        dlResult.innerHTML = rows.map((r, i) => `
          <button class="dl-action-btn" data-url="${escapeHtml(r.href)}" data-file="${escapeHtml(r.file)}"
            style="display:flex; justify-content:space-between; padding:8px 12px; background:var(--btn-bg); border:1px solid var(--btn-bd); border-radius:8px; color:var(--tx); text-decoration:none; font-size:11.5px; font-weight:500; align-items:center; cursor:pointer; transition:all .2s;">
            <span style="display:flex; align-items:center; gap:6px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              ${escapeHtml(r.label)}
            </span>
            ${r.size ? `<span style="color:var(--mt);font-size:10.5px;">${escapeHtml(fmtSize(r.size))}</span>` : ''}
          </button>`).join('');

        dlResult.querySelectorAll('.dl-action-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const u = btn.getAttribute('data-url');
            const f = btn.getAttribute('data-file');
            btn.style.opacity = '0.5';
            chrome.runtime.sendMessage({ type: 'DOWNLOAD_FILE', url: u, filename: f }, () => {
              setTimeout(() => { btn.style.opacity = '1'; toast('Đang tải xuống...'); }, 300);
            });
          });
        });
      } catch (err) {
        urlGo.disabled = false;
        dlStatus.textContent = 'Lỗi: ' + err.message;
        dlStatus.style.color = '#ff3b30';
      }
    };

    urlGo.addEventListener('click', handleGo);
    urlEl.addEventListener('keydown', e => { if (e.key === 'Enter') handleGo(); });
  }
});