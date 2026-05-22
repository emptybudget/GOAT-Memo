// 🐐 오디오 편집기 — 파형 시각화 + 트림 핸들
const AudioEditor = (() => {
  let canvas, ctx;
  let buffer = null;
  let trimStart = 0;
  let trimEnd = 1;
  let dragging = null;
  let previewSource = null;
  let playhead = -1; // 재생 중 표시 위치 (초)
  let playheadRaf = null;
  let playStartTime = 0;
  let playStartAudioTime = 0;

  const HANDLE_ZONE = 14; // px, 핸들 감지 반경
  const COLORS = {
    bg: '#0d1117',
    waveInactive: '#2a3344',
    waveActive: '#f5c842',
    dimOverlay: 'rgba(0,0,0,0.55)',
    handleStart: '#4ade80',
    handleEnd: '#f87171',
    playhead: 'rgba(255,255,255,0.7)',
  };

  // ───── 초기화 ─────
  function init() {
    canvas = document.getElementById('waveform-canvas');
    ctx = canvas.getContext('2d');

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('touchmove', onPointerMove, { passive: false });
    canvas.addEventListener('touchend', onPointerUp);
  }

  // ───── 열기 ─────
  function open(buf) {
    if (!buf) return;
    buffer = buf;
    trimStart = GoatSound.getTrimStart();
    trimEnd = GoatSound.getTrimEnd();
    if (trimEnd > buffer.duration) trimEnd = buffer.duration;

    resizeCanvas();
    render();
    updateInfo();
    document.getElementById('modal-editor').classList.remove('hidden');
  }

  function resizeCanvas() {
    const wrap = document.getElementById('waveform-wrap');
    const W = wrap.clientWidth || 460;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = 100 * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = '100px';
    ctx.scale(dpr, dpr);
  }

  // ───── 파형 렌더링 ─────
  function render() {
    const W = canvas.width / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);
    const c = ctx;

    c.clearRect(0, 0, W, H);

    // 배경
    c.fillStyle = COLORS.bg;
    c.fillRect(0, 0, W, H);

    if (!buffer) return;

    // 파형 데이터 (멀티채널 평균)
    const numCh = buffer.numberOfChannels;
    const totalSamples = buffer.length;
    const step = Math.max(1, Math.floor(totalSamples / W));

    for (let x = 0; x < W; x++) {
      let min = 0, max = 0;
      for (let ch = 0; ch < numCh; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < step; i++) {
          const s = data[x * step + i] || 0;
          if (s > max) max = s;
          if (s < min) min = s;
        }
      }
      const t = (x / W) * buffer.duration;
      const inTrim = t >= trimStart && t <= trimEnd;
      c.fillStyle = inTrim ? COLORS.waveActive : COLORS.waveInactive;
      const yTop = ((1 - max) / 2) * H;
      const yBot = ((1 - min) / 2) * H;
      c.fillRect(x, yTop, 1, Math.max(1, yBot - yTop));
    }

    // 트림 바깥 어둡게
    c.fillStyle = COLORS.dimOverlay;
    c.fillRect(0, 0, timeToX(trimStart), H);
    c.fillRect(timeToX(trimEnd), 0, W - timeToX(trimEnd), H);

    // 재생 헤드
    if (playhead >= 0) {
      const px = timeToX(playhead);
      c.strokeStyle = COLORS.playhead;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(px, 0);
      c.lineTo(px, H);
      c.stroke();
    }

    // 핸들 그리기
    drawHandle(timeToX(trimStart), COLORS.handleStart, 'start');
    drawHandle(timeToX(trimEnd), COLORS.handleEnd, 'end');
  }

  function drawHandle(x, color, side) {
    const c = ctx;
    const H = canvas.height / (window.devicePixelRatio || 1);

    // 세로선
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, H);
    c.stroke();

    // 위쪽 삼각형
    c.fillStyle = color;
    c.beginPath();
    if (side === 'start') {
      c.moveTo(x, 0);
      c.lineTo(x + 12, 0);
      c.lineTo(x, 14);
    } else {
      c.moveTo(x, 0);
      c.lineTo(x - 12, 0);
      c.lineTo(x, 14);
    }
    c.closePath();
    c.fill();

    // 아래쪽 삼각형
    c.beginPath();
    if (side === 'start') {
      c.moveTo(x, H);
      c.lineTo(x + 12, H);
      c.lineTo(x, H - 14);
    } else {
      c.moveTo(x, H);
      c.lineTo(x - 12, H);
      c.lineTo(x, H - 14);
    }
    c.closePath();
    c.fill();
  }

  // ───── 좌표 변환 ─────
  function timeToX(t) {
    const W = canvas.width / (window.devicePixelRatio || 1);
    return (t / buffer.duration) * W;
  }

  function xToTime(x) {
    const W = canvas.width / (window.devicePixelRatio || 1);
    return Math.max(0, Math.min(buffer.duration, (x / W) * buffer.duration));
  }

  function getCanvasX(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return clientX - rect.left;
  }

  function nearHandle(x, t) {
    return Math.abs(x - timeToX(t)) < HANDLE_ZONE;
  }

  // ───── 포인터 이벤트 ─────
  function onPointerDown(e) {
    e.preventDefault();
    const x = getCanvasX(e);
    if (nearHandle(x, trimStart)) dragging = 'start';
    else if (nearHandle(x, trimEnd)) dragging = 'end';
    else {
      // 클릭 위치가 어느 핸들에 더 가까운지
      const t = xToTime(x);
      dragging = Math.abs(t - trimStart) <= Math.abs(t - trimEnd) ? 'start' : 'end';
    }
  }

  function onPointerMove(e) {
    e.preventDefault();
    const x = getCanvasX(e);

    // 커서
    if (nearHandle(x, trimStart) || nearHandle(x, trimEnd)) {
      canvas.style.cursor = 'ew-resize';
    } else {
      canvas.style.cursor = 'default';
    }

    if (!dragging) return;
    const t = xToTime(x);
    const MIN_DUR = 0.05;

    if (dragging === 'start') {
      trimStart = Math.max(0, Math.min(t, trimEnd - MIN_DUR));
    } else {
      trimEnd = Math.min(buffer.duration, Math.max(t, trimStart + MIN_DUR));
    }

    render();
    updateInfo();
  }

  function onPointerUp() {
    dragging = null;
  }

  // ───── 정보 표시 ─────
  function updateInfo() {
    const dur = trimEnd - trimStart;
    document.getElementById('trim-start-val').textContent = trimStart.toFixed(2) + 's';
    document.getElementById('trim-end-val').textContent = trimEnd.toFixed(2) + 's';
    document.getElementById('trim-dur-val').textContent = dur.toFixed(2) + 's';
    document.getElementById('trim-total-val').textContent = buffer ? buffer.duration.toFixed(2) + 's' : '-';
  }

  // ───── 미리듣기 ─────
  function preview() {
    stopPreview();
    const buf = GoatSound.getBuffer();
    if (!buf) return;

    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const source = ac.createBufferSource();
    source.buffer = buf;
    const gain = ac.createGain();
    gain.gain.value = 0.8;
    source.connect(gain);
    gain.connect(ac.destination);

    const dur = trimEnd - trimStart;
    source.start(0, trimStart, dur);
    previewSource = source;

    // 재생 헤드 애니메이션
    playhead = trimStart;
    playStartTime = performance.now();
    playStartAudioTime = trimStart;

    function animatePlayhead() {
      const elapsed = (performance.now() - playStartTime) / 1000;
      playhead = playStartAudioTime + elapsed;
      if (playhead > trimEnd) {
        playhead = -1;
        cancelAnimationFrame(playheadRaf);
        previewSource = null;
        render();
        return;
      }
      render();
      playheadRaf = requestAnimationFrame(animatePlayhead);
    }
    playheadRaf = requestAnimationFrame(animatePlayhead);

    source.onended = () => {
      playhead = -1;
      previewSource = null;
      cancelAnimationFrame(playheadRaf);
      render();
    };
  }

  function stopPreview() {
    if (previewSource) {
      try { previewSource.stop(); } catch (_) {}
      previewSource = null;
    }
    cancelAnimationFrame(playheadRaf);
    playhead = -1;
  }

  // ───── 적용 ─────
  function apply() {
    GoatSound.setTrim(trimStart, trimEnd);
    stopPreview();
    document.getElementById('modal-editor').classList.add('hidden');

    const dur = (trimEnd - trimStart).toFixed(2);
    const startStr = trimStart.toFixed(2);
    // toast는 app.js에서 호출
    if (typeof toast === 'function') toast(`✂️ 트림 적용: ${startStr}s ~ ${trimEnd.toFixed(2)}s (${dur}s)`);
  }

  function close() {
    stopPreview();
    document.getElementById('modal-editor').classList.add('hidden');
  }

  return { init, open, preview, apply, close };
})();
