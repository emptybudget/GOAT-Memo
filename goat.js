// 🐐 GOAT Sound Engine — Web Audio API로 염소 울음소리 합성 + 커스텀 오디오 지원
const GoatSound = (() => {
  let ctx = null;
  let volume = 0.7;
  let enabled = true;
  let goatType = 'classic';
  let superMode = false;
  let defaultBuffer = null;  // goat-default.mp3 (내장 기본 소리)
  let customBuffer = null;   // 사용자가 업로드한 오디오
  let customFileName = null;
  let trimStart = 0;
  let trimEnd = Infinity;

  // 현재 활성 버퍼 (커스텀 > 기본 > null)
  function activeBuffer() { return customBuffer || defaultBuffer; }

  // AudioContext를 처음 사용할 때 생성 (브라우저 정책 대응)
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 염소 울음 파라미터 프리셋
  const presets = {
    classic: {
      freq: 320,
      freqEnd: 200,
      vibratoRate: 7,
      vibratoDepth: 30,
      duration: 0.18,
      noiseLevel: 0.08,
      wavetype: 'sawtooth',
    },
    baby: {
      freq: 520,
      freqEnd: 400,
      vibratoRate: 10,
      vibratoDepth: 20,
      duration: 0.12,
      noiseLevel: 0.04,
      wavetype: 'sine',
    },
    angry: {
      freq: 200,
      freqEnd: 110,
      vibratoRate: 5,
      vibratoDepth: 45,
      duration: 0.25,
      noiseLevel: 0.18,
      wavetype: 'sawtooth',
    },
    happy: {
      freq: 440,
      freqEnd: 380,
      vibratoRate: 12,
      vibratoDepth: 25,
      duration: 0.14,
      noiseLevel: 0.06,
      wavetype: 'square',
    },
  };

  function bleat(type) {
    if (!enabled) return;
    const ac = getCtx();
    const p = presets[type || goatType] || presets.classic;
    const now = ac.currentTime;
    const dur = p.duration;

    // 메인 마스터 게인
    const master = ac.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(volume * 0.5, now + 0.01);
    master.gain.exponentialRampToValueAtTime(0.001, now + dur);
    master.connect(ac.destination);

    // 주 오실레이터 (염소 목소리)
    const osc = ac.createOscillator();
    osc.type = p.wavetype;
    osc.frequency.setValueAtTime(p.freq, now);
    osc.frequency.exponentialRampToValueAtTime(p.freqEnd, now + dur);

    // 바이브라토 (떨림) — LFO로 주파수 변조
    const lfo = ac.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(p.vibratoRate, now);

    const lfoGain = ac.createGain();
    lfoGain.gain.setValueAtTime(0, now);
    lfoGain.gain.linearRampToValueAtTime(p.vibratoDepth, now + 0.03);
    lfoGain.gain.linearRampToValueAtTime(0, now + dur);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // 화이트 노이즈 (거친 텍스처)
    const bufSize = ac.sampleRate * dur;
    const noiseBuffer = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);

    const noise = ac.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ac.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = p.freq * 1.5;
    noiseFilter.Q.value = 2;

    const noiseGain = ac.createGain();
    noiseGain.gain.setValueAtTime(volume * p.noiseLevel, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);

    // 오실레이터 연결
    const oscGain = ac.createGain();
    oscGain.gain.value = 1;
    osc.connect(oscGain);
    oscGain.connect(master);

    // 시작 / 종료
    osc.start(now);
    lfo.start(now);
    noise.start(now);

    osc.stop(now + dur + 0.05);
    lfo.stop(now + dur + 0.05);
    noise.stop(now + dur + 0.05);
  }

  // 슈퍼 고트 모드: 훨씬 더 강렬한 울음
  function superBleat() {
    if (!enabled) return;
    const ac = getCtx();
    const now = ac.currentTime;

    // 두 개의 오실레이터를 화음으로
    [0, 5, 10].forEach((offset, i) => {
      setTimeout(() => bleat('angry'), offset * 20);
    });
  }

  // 오디오 버퍼 재생 (빠른 중첩 재생 가능)
  function playBuffer(buf, offsetSec, durationSec) {
    const ac = getCtx();
    const source = ac.createBufferSource();
    source.buffer = buf;
    const gain = ac.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ac.destination);
    source.start(0, offsetSec, durationSec);
  }

  function playCustom() {
    const buf = activeBuffer();
    if (!buf) return;
    const start = trimStart;
    const end = Math.min(trimEnd, buf.duration);
    playBuffer(buf, start, end - start);
  }

  return {
    play(key) {
      if (!enabled) return;
      if (activeBuffer()) {
        playCustom();
        return;
      }
      if (superMode) {
        if (key === 'Enter' || key === ' ') {
          superBleat();
        } else {
          bleat();
        }
      } else {
        if (key === 'Enter') {
          const saved = goatType;
          goatType = 'angry';
          bleat();
          goatType = saved;
        } else {
          bleat();
        }
      }
    },
    setVolume(v) { volume = Math.max(0, Math.min(1, v / 100)); },
    getVolume() { return Math.round(volume * 100); },
    setEnabled(v) { enabled = v; },
    isEnabled() { return enabled; },
    setType(t) { goatType = t; },
    setSuperMode(v) { superMode = v; },
    isSuperMode() { return superMode; },
    test() {
      if (activeBuffer()) { playCustom(); return; }
      bleat(goatType);
    },

    // 앱 시작 시 기본 소리 로드
    async loadDefault() {
      try {
        const ac = getCtx();
        const res = await fetch('goat-default.mp3');
        const arrayBuffer = await res.arrayBuffer();
        defaultBuffer = await ac.decodeAudioData(arrayBuffer);
        trimStart = 0;
        trimEnd = defaultBuffer.duration;
      } catch (_) { /* 파일 없으면 합성음 사용 */ }
    },

    // 사용자 오디오 파일 업로드
    async loadAudio(file) {
      const ac = getCtx();
      const arrayBuffer = await file.arrayBuffer();
      customBuffer = await ac.decodeAudioData(arrayBuffer);
      customFileName = file.name;
      trimStart = 0;
      trimEnd = customBuffer.duration;
      return file.name;
    },

    // 사용자 업로드 제거 → 기본 소리로 복귀
    clearAudio() {
      customBuffer = null;
      customFileName = null;
      trimStart = 0;
      trimEnd = defaultBuffer ? defaultBuffer.duration : Infinity;
    },

    setTrim(s, e) { trimStart = s; trimEnd = e; },
    getTrimStart() { return trimStart; },
    getTrimEnd() { return trimEnd; },
    getBuffer() { return activeBuffer(); },
    getCustomFileName() { return customFileName; },
    hasCustomAudio() { return customBuffer !== null; },
    hasDefaultAudio() { return defaultBuffer !== null; },
  };
})();
