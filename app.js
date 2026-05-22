// GOAT 메모장 - 메인 앱 로직
const editor = document.getElementById('editor');

// ───── 상태 ─────
let fileName = null;
let isModified = false;
let wordWrap = true;
let showStatusBar = true;
let zoom = 100;
let superGoatMode = false;
let findIndex = 0;

// ───── 유틸 ─────
function toast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), duration);
}

function setTitle(name, modified) {
  const base = name ? name : '제목 없음';
  document.getElementById('title-text').textContent =
    (modified ? '● ' : '') + base + ' - GOAT 메모장 🐐';
  document.title = base + ' - GOAT 메모장 🐐';
}

function markModified() {
  if (!isModified) {
    isModified = true;
    setTitle(fileName, true);
  }
}

// ───── 상태바 업데이트 ─────
function updateStatus() {
  const text = editor.value;
  const pos = editor.selectionStart;
  const lines = text.substring(0, pos).split('\n');
  const ln = lines.length;
  const col = lines[lines.length - 1].length + 1;
  const chars = text.length;

  document.getElementById('status-ln').textContent = ln + '행';
  document.getElementById('status-col').textContent = col + '열';
  document.getElementById('status-chars').textContent = chars + '자';
  document.getElementById('status-goat').textContent =
    GoatSound.isEnabled() ? (GoatSound.isSuperMode() ? '🐐✨ 슈퍼 고트' : '🐐 염소 ON') : '🔇 염소 OFF';
}

// ───── 키 입력 처리 ─────
editor.addEventListener('keydown', (e) => {
  // 편집 단축키는 소리 안 냄 (Ctrl 조합)
  if (e.ctrlKey || e.metaKey) return;

  // 출력 가능한 키 및 특수키
  const printable = e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace' || e.key === ' ';
  if (printable) {
    GoatSound.play(e.key);
  }
});

editor.addEventListener('input', () => {
  markModified();
  updateStatus();
});

editor.addEventListener('keyup', updateStatus);
editor.addEventListener('click', updateStatus);
editor.addEventListener('select', updateStatus);

// ───── 메뉴 시스템 ─────
const menuItems = document.querySelectorAll('.menu-item');

menuItems.forEach(item => {
  const trigger = item.querySelector('span');
  trigger.addEventListener('click', (e) => {
    const wasOpen = item.classList.contains('open');
    closeAllMenus();
    if (!wasOpen) item.classList.add('open');
    e.stopPropagation();
  });
});

document.addEventListener('click', closeAllMenus);

function closeAllMenus() {
  menuItems.forEach(m => m.classList.remove('open'));
}

// 드롭다운 버튼 이벤트
document.querySelectorAll('.dropdown button[data-action]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    closeAllMenus();
    handleAction(btn.dataset.action);
  });
});

// ───── 액션 핸들러 ─────
function handleAction(action) {
  switch (action) {

    // 파일
    case 'new':
      if (isModified && !confirm('저장하지 않은 변경사항이 있습니다. 새로 만드시겠습니까?')) return;
      editor.value = '';
      fileName = null;
      isModified = false;
      setTitle(null, false);
      updateStatus();
      break;

    case 'open':
      document.getElementById('open-file').click();
      break;

    case 'save':
      doSave();
      break;

    case 'saveas':
      doSaveAs();
      break;

    case 'print':
      window.print();
      break;

    // 편집
    case 'undo':
      document.execCommand('undo');
      break;

    case 'cut':
      document.execCommand('cut');
      GoatSound.play('cut');
      break;

    case 'copy':
      document.execCommand('copy');
      toast('📋 복사됨');
      break;

    case 'paste':
      navigator.clipboard.readText().then(text => {
        insertAtCursor(text);
      }).catch(() => document.execCommand('paste'));
      break;

    case 'delete':
      document.execCommand('delete');
      break;

    case 'selectall':
      editor.select();
      break;

    case 'datetime': {
      const now = new Date();
      const str = now.toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      insertAtCursor(str);
      break;
    }

    case 'find':
      openModal('modal-find');
      document.getElementById('find-input').focus();
      break;

    case 'replace':
      openModal('modal-replace');
      document.getElementById('replace-find-input').focus();
      break;

    case 'goto':
      openModal('modal-goto');
      document.getElementById('goto-input').focus();
      break;

    // 서식
    case 'wordwrap':
      wordWrap = !wordWrap;
      editor.style.whiteSpace = wordWrap ? 'pre-wrap' : 'pre';
      editor.style.overflowX = wordWrap ? 'hidden' : 'auto';
      toast(wordWrap ? '자동 줄 바꿈 ON' : '자동 줄 바꿈 OFF');
      break;

    case 'font':
      openModal('modal-font');
      break;

    // 보기
    case 'zoom-in':
      setZoom(zoom + 10);
      break;

    case 'zoom-out':
      setZoom(zoom - 10);
      break;

    case 'zoom-reset':
      setZoom(100);
      break;

    case 'statusbar':
      showStatusBar = !showStatusBar;
      document.getElementById('statusbar').style.display = showStatusBar ? 'flex' : 'none';
      break;

    // 🐐 고트
    case 'goat-toggle':
      GoatSound.setEnabled(!GoatSound.isEnabled());
      updateStatus();
      toast(GoatSound.isEnabled() ? '🐐 염소가 돌아왔다!' : '🔇 염소가 잠들었다...');
      break;

    case 'goat-volume':
      openModal('modal-volume');
      break;

    case 'goat-mode':
      toggleSuperGoat();
      break;
  }
}

// ───── 슈퍼 고트 모드 ─────
function toggleSuperGoat() {
  superGoatMode = !superGoatMode;
  GoatSound.setSuperMode(superGoatMode);
  document.body.classList.toggle('super-goat', superGoatMode);
  updateStatus();
  if (superGoatMode) {
    toast('✨🐐 슈퍼 고트 모드 활성화! GOAT는 짱이니까! 🐐✨', 3000);
    GoatSound.test();
  } else {
    toast('슈퍼 고트 모드 해제');
  }
}

// ───── 줌 ─────
function setZoom(z) {
  zoom = Math.max(50, Math.min(200, z));
  editor.style.fontSize = (16 * zoom / 100) + 'px';
  toast('확대/축소: ' + zoom + '%');
}

// ───── 커서 위치에 삽입 ─────
function insertAtCursor(text) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const before = editor.value.substring(0, start);
  const after = editor.value.substring(end);
  editor.value = before + text + after;
  editor.selectionStart = editor.selectionEnd = start + text.length;
  editor.dispatchEvent(new Event('input'));
}

// ───── 저장 ─────
function doSave() {
  if (!fileName) {
    doSaveAs();
    return;
  }
  downloadFile(fileName, editor.value);
  isModified = false;
  setTitle(fileName, false);
  toast('💾 저장됨: ' + fileName);
}

function doSaveAs() {
  const name = prompt('저장할 파일 이름:', fileName || '메모.txt');
  if (!name) return;
  fileName = name.endsWith('.txt') ? name : name + '.txt';
  downloadFile(fileName, editor.value);
  isModified = false;
  setTitle(fileName, false);
  toast('💾 저장됨: ' + fileName);
}

function downloadFile(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.getElementById('save-link');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ───── 파일 열기 ─────
document.getElementById('open-file').addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    editor.value = e.target.result;
    fileName = file.name;
    isModified = false;
    setTitle(fileName, false);
    updateStatus();
    toast('📂 열림: ' + fileName);
  };
  reader.readAsText(file, 'utf-8');
  this.value = '';
});

// ───── 찾기 ─────
let lastFindQuery = '';
let findPositions = [];

function doFind(backwards) {
  const query = document.getElementById('find-input').value;
  const caseSensitive = document.getElementById('find-case').checked;
  const wrap = document.getElementById('find-wrap').checked;
  if (!query) return;

  const text = caseSensitive ? editor.value : editor.value.toLowerCase();
  const q = caseSensitive ? query : query.toLowerCase();

  if (query !== lastFindQuery) {
    findPositions = [];
    let i = 0;
    while ((i = text.indexOf(q, i)) !== -1) {
      findPositions.push(i);
      i++;
    }
    findIndex = 0;
    lastFindQuery = query;
  }

  if (findPositions.length === 0) {
    toast('찾을 수 없습니다: "' + query + '"');
    return;
  }

  if (backwards) {
    findIndex = (findIndex - 1 + findPositions.length) % findPositions.length;
  } else {
    findIndex = (findIndex + 1) % findPositions.length;
  }

  if (!wrap && findIndex === 0 && !backwards) {
    toast('마지막 항목입니다.');
    return;
  }

  const pos = findPositions[findIndex - 1 < 0 ? findPositions.length - 1 : findIndex - 1] ?? findPositions[findIndex];
  editor.focus();
  editor.setSelectionRange(pos, pos + query.length);
  editor.blur();
  editor.focus();

  // 실제 위치로 스크롤
  const linesBefore = editor.value.substring(0, pos).split('\n');
  const lineH = parseInt(getComputedStyle(editor).lineHeight) || 27;
  editor.scrollTop = Math.max(0, (linesBefore.length - 3) * lineH);

  toast(`${findIndex === 0 ? findPositions.length : findIndex}/${findPositions.length} 찾음`);
}

document.getElementById('find-next').addEventListener('click', () => doFind(false));
document.getElementById('find-prev').addEventListener('click', () => doFind(true));
document.getElementById('find-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doFind(e.shiftKey);
});

// ───── 바꾸기 ─────
document.getElementById('replace-one').addEventListener('click', () => {
  const find = document.getElementById('replace-find-input').value;
  const replace = document.getElementById('replace-input').value;
  const caseSensitive = document.getElementById('replace-case').checked;
  if (!find) return;

  const text = editor.value;
  const flags = caseSensitive ? 'g' : 'gi';
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, flags);
  const match = re.exec(text);
  if (!match) { toast('찾을 수 없습니다.'); return; }

  editor.setSelectionRange(match.index, match.index + match[0].length);
  document.execCommand('insertText', false, replace);
  toast('1개 바뀜');
});

document.getElementById('replace-all').addEventListener('click', () => {
  const find = document.getElementById('replace-find-input').value;
  const replace = document.getElementById('replace-input').value;
  const caseSensitive = document.getElementById('replace-case').checked;
  if (!find) return;

  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
  const count = (editor.value.match(re) || []).length;
  editor.value = editor.value.replace(re, replace);
  editor.dispatchEvent(new Event('input'));
  toast(count + '개 모두 바뀜');
});

// ───── 이동 ─────
document.getElementById('goto-go').addEventListener('click', () => {
  const line = parseInt(document.getElementById('goto-input').value);
  if (!line || line < 1) return;
  const lines = editor.value.split('\n');
  if (line > lines.length) { toast('범위를 벗어난 줄 번호입니다.'); return; }
  let pos = 0;
  for (let i = 0; i < line - 1; i++) pos += lines[i].length + 1;
  editor.focus();
  editor.setSelectionRange(pos, pos);
  const lineH = parseInt(getComputedStyle(editor).lineHeight) || 27;
  editor.scrollTop = Math.max(0, (line - 3) * lineH);
  closeModal('modal-goto');
  updateStatus();
});

// ───── 글꼴 ─────
document.getElementById('font-apply').addEventListener('click', () => {
  editor.style.fontFamily = document.getElementById('font-family').value;
  editor.style.fontSize = (parseInt(document.getElementById('font-size').value) * zoom / 100) + 'px';
  editor.style.fontWeight = document.getElementById('font-bold').checked ? 'bold' : 'normal';
  editor.style.fontStyle = document.getElementById('font-italic').checked ? 'italic' : 'normal';
  closeModal('modal-font');
  toast('글꼴 적용됨');
});

// ───── 볼륨 ─────
const volSlider = document.getElementById('volume-slider');
const volLabel = document.getElementById('volume-label');

volSlider.addEventListener('input', () => {
  GoatSound.setVolume(parseInt(volSlider.value));
  volLabel.textContent = volSlider.value + '%';
});

document.getElementById('volume-test').addEventListener('click', () => {
  GoatSound.setType(document.getElementById('goat-type').value);
  GoatSound.test();
});

document.getElementById('goat-type').addEventListener('change', function() {
  GoatSound.setType(this.value);
});

// ───── 모달 열기/닫기 ─────
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.modal));
});

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal.id);
  });
});

// ───── 글로벌 단축키 ─────
document.addEventListener('keydown', (e) => {
  if (!e.ctrlKey && !e.metaKey) return;

  switch (e.key.toLowerCase()) {
    case 'n': e.preventDefault(); handleAction('new'); break;
    case 'o': e.preventDefault(); handleAction('open'); break;
    case 's': e.preventDefault(); handleAction('save'); break;
    case 'f': e.preventDefault(); handleAction('find'); break;
    case 'h': e.preventDefault(); handleAction('replace'); break;
    case 'g': e.preventDefault(); handleAction('goto'); break;
    case 'a': e.preventDefault(); editor.select(); break;
    case '+':
    case '=': e.preventDefault(); handleAction('zoom-in'); break;
    case '-': e.preventDefault(); handleAction('zoom-out'); break;
    case '0': e.preventDefault(); handleAction('zoom-reset'); break;
    case 'p': e.preventDefault(); handleAction('print'); break;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'F5') { e.preventDefault(); handleAction('datetime'); }
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal:not(.hidden)').forEach(m => closeModal(m.id));
    closeAllMenus();
  }
});

// ───── 상태바 염소 클릭 ─────
document.getElementById('status-goat').addEventListener('click', () => {
  handleAction('goat-toggle');
});

// ───── 저장 전 경고 ─────
window.addEventListener('beforeunload', (e) => {
  if (isModified) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ───── 초기화 ─────
updateStatus();
setTitle(null, false);
editor.focus();
