// Cppify app logic. The UI markup is in index.html; styling is in styles.css.
let currentCompiledWasmBytes = null;
let cppCompilerModule = null;
let cppCompilerLoadAttempted = false;

// If built with Emscripten, the C++ analyzer is used. Without generated compiler.js,
// the app keeps its original JavaScript analyzer so the UI remains usable.
async function loadCppCompiler() {
  if (cppCompilerLoadAttempted) return cppCompilerModule;
  cppCompilerLoadAttempted = true;
  if (typeof window.createCppifyCompiler === 'function') {
    try { cppCompilerModule = await window.createCppifyCompiler(); } catch (err) { console.warn('C++ WebAssembly module could not load:', err); }
  }
  return cppCompilerModule;
}

async function analyzeSource(sourceCode) {
  const module = await loadCppCompiler();
  if (module && typeof module.analyzeSource === 'function') {
    return JSON.parse(module.analyzeSource(sourceCode));
  }
  return lexer(sourceCode);
}

function showToast(msg, isError = false) {
  const existing = document.getElementById('cppify-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'cppify-toast';
  toast.className = `fixed bottom-12 right-6 px-4 py-2.5 rounded-xl font-mono text-xs font-bold border shadow-2xl z-50 flex items-center space-x-2 transition-all transform translate-y-0 ${isError ? 'bg-red-950 text-red-300 border-red-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'}`;
  const icon = document.createElement('i');
  icon.className = `fa-solid ${isError ? 'fa-circle-xmark' : 'fa-circle-check'}`;
  const span = document.createElement('span');
  span.textContent = msg;
  toast.append(icon, span);
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function playBeep(freq = 520, type = 'sine') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch (_) {}
}

function loadSelectedTemplate() {
  const val = document.getElementById('template-select').value;
  const cmdSelect = document.getElementById('cmd-select');
  const textInput = document.getElementById('cmd-text-arg');
  const numA = document.getElementById('cmd-num-a');
  const numB = document.getElementById('cmd-num-b');
  if (val === 'hello') { cmdSelect.value = 'cout'; textInput.value = 'Hello World from Cppify!'; }
  else if (val === 'add') { cmdSelect.value = 'add'; numA.value = 42; numB.value = 58; }
  else if (val === 'sub') { cmdSelect.value = 'sub'; numA.value = 100; numB.value = 35; }
  else if (val === 'mult') { cmdSelect.value = 'mult'; numA.value = 12; numB.value = 12; }
  else if (val === 'div') { cmdSelect.value = 'div'; numA.value = 144; numB.value = 12; }
  else if (val === 'complex') { cmdSelect.value = 'cout'; textInput.value = 'CPPIFY_BUFFER_STRING_0x4F89'; }
  handleCommandChange();
  executeCompilePipeline();
  showToast(`Loaded Template: ${val.toUpperCase()}`);
}

function handleCommandChange() {
  const cmd = document.getElementById('cmd-select').value;
  const textContainer = document.getElementById('param-container-text');
  const mathContainer = document.getElementById('param-container-math');
  if (cmd === 'cout') {
    textContainer.classList.remove('hidden');
    mathContainer.classList.add('hidden');
    mathContainer.classList.remove('grid');
  } else {
    textContainer.classList.add('hidden');
    mathContainer.classList.remove('hidden');
    mathContainer.classList.add('grid');
  }
  syncCodeFromInputs();
}

function syncCodeFromInputs() {
  const cmd = document.getElementById('cmd-select').value;
  const editor = document.getElementById('source-editor');
  if (cmd === 'cout') {
    const val = document.getElementById('cmd-text-arg').value;
    editor.value = `std::cout << "${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}";`;
  } else {
    const a = document.getElementById('cmd-num-a').value;
    const b = document.getElementById('cmd-num-b').value;
    editor.value = `int result = ${cmd}(${a || 0}, ${b || 0});`;
  }
  updateLineNumbers();
}

function handleManualCodeInput() { updateLineNumbers(); }

function updateLineNumbers() {
  const editor = document.getElementById('source-editor');
  const lines = editor.value.split('\n').length;
  const lineBox = document.getElementById('line-numbers');
  lineBox.replaceChildren();
  for (let i = 1; i <= Math.max(lines, 5); i++) {
    if (i > 1) lineBox.appendChild(document.createElement('br'));
    lineBox.appendChild(document.createTextNode(String(i)));
  }
}

function clearEditor() {
  document.getElementById('source-editor').value = '';
  updateLineNumbers();
  showToast('Editor cleared');
}

function switchTab(tabName) {
  ['cpu', 'lexer', 'bytecode', 'disasm'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('active', t === tabName);
    document.getElementById(`panel-${t}`).classList.toggle('hidden', t !== tabName);
  });
}

function lexer(sourceCode) {
  const code = sourceCode.trim();
  if (!code) return [];
  if (code.includes('std::cout') || /\bcout\b/.test(code)) {
    const quoteMatch = code.match(/"((?:\\.|[^"\\])*)"/);
    const strVal = quoteMatch ? quoteMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : '';
    return [
      { type: 'NAMESPACE', value: 'std' }, { type: 'OPERATOR', value: '::' },
      { type: 'COMMAND', value: 'cout' }, { type: 'STREAM_OP', value: '<<' },
      { type: 'STRING_LITERAL', value: strVal }
    ];
  }
  const mathMatch = code.match(/\b(add|sub|mult|div)\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/);
  if (mathMatch) return [
    { type: 'COMMAND', value: mathMatch[1] },
    { type: 'ARG_INT', value: mathMatch[2] }, { type: 'ARG_INT', value: mathMatch[3] }
  ];
  return code.split(/\s+/).filter(Boolean).map(p => ({ type: isNaN(p) ? 'IDENTIFIER' : 'NUMBER_LITERAL', value: p }));
}

function encodeLeb128(value) {
  const bytes = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return bytes;
}
function makeSection(id, payload) { return [id, ...encodeLeb128(payload.length), ...payload]; }

function encodeSignedLeb128(value) {
  const bytes = [];
  let more = true;
  while (more) {
    let byte = value & 0x7f;
    value >>= 7;
    const signBit = (byte & 0x40) !== 0;
    more = !((value === 0 && !signBit) || (value === -1 && signBit));
    if (more) byte |= 0x80;
    bytes.push(byte);
  }
  return bytes;
}

function compileToWasmBinary(tokens) {
  if (!tokens.length) throw new Error('Empty code stream.');
  const magic = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  const disassemblyLog = [{ section: 'Header', desc: 'WASM Magic Header (\\0asm) & Version 0x01' }];
  const strObj = tokens.find(t => t.type === 'STRING_LITERAL');
  if (strObj) {
    const textBytes = Array.from(new TextEncoder().encode(strObj.value));
    // Valid module exports run() and stores UTF-8 bytes at memory offset 0.
    const typeSec = makeSection(1, [1, 0x60, 0, 0]);
    const importSec = makeSection(2, [1, 3, 101, 110, 118, 6, 109, 101, 109, 111, 114, 121, 2, 0, 1]);
    const funcSec = makeSection(3, [1, 0]);
    const exportSec = makeSection(7, [2, 3, 114, 117, 110, 0, 0, 6, 109, 101, 109, 111, 114, 121, 2, 0]);
    const codeSec = makeSection(10, [1, 2, 0, 0x0b]);
    const dataSegment = [0, 0x41, 0, 0x0b, ...encodeLeb128(textBytes.length), ...textBytes];
    const dataSec = makeSection(11, [1, ...dataSegment]);
    const binaryBytes = new Uint8Array([...magic, ...typeSec, ...importSec, ...funcSec, ...exportSec, ...codeSec, ...dataSec]);
    disassemblyLog.push(
      { section: 'Type Section (1)', desc: 'type 0: () -> ()' },
      { section: 'Import Section (2)', desc: 'import env.memory (1 page)' },
      { section: 'Export Section (7)', desc: "export func 'run' and memory" },
      { section: 'Code Section (10)', desc: 'func 0: return void' },
      { section: 'Data Section (11)', desc: `data offset 0x0: "${strObj.value}" (${textBytes.length} bytes)` }
    );
    return { type: 'cout', binaryBytes, length: textBytes.length, disassemblyLog };
  }

  const cmdToken = tokens.find(t => ['add', 'sub', 'mult', 'div'].includes(t.value));
  const opMap = { add: 0x6a, sub: 0x6b, mult: 0x6c, div: 0x6d };
  if (cmdToken) {
    const args = tokens.filter(t => t.type === 'ARG_INT' || t.type === 'NUMBER_LITERAL');
    const a = Number.parseInt(args[0]?.value ?? '0', 10);
    const b = Number.parseInt(args[1]?.value ?? '0', 10);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < -2147483648 || a > 2147483647 || b < -2147483648 || b > 2147483647) {
      throw new Error('Arguments must be valid signed 32-bit integers.');
    }
    if (cmdToken.value === 'div' && b === 0) throw new Error('Division by zero is not allowed.');
    if (cmdToken.value === 'div' && a === -2147483648 && b === -1) throw new Error('Signed i32 division overflow.');
    const typeSec = makeSection(1, [1, 0x60, 2, 0x7f, 0x7f, 1, 0x7f]);
    const funcSec = makeSection(3, [1, 0]);
    const exportSec = makeSection(7, [1, 3, 114, 117, 110, 0, 0]);
    const body = [0, 0x20, 0, 0x20, 1, opMap[cmdToken.value], 0x0b];
    const codeSec = makeSection(10, [1, ...encodeLeb128(body.length), ...body]);
    const binaryBytes = new Uint8Array([...magic, ...typeSec, ...funcSec, ...exportSec, ...codeSec]);
    disassemblyLog.push(
      { section: 'Type Section (1)', desc: 'type 0: (i32, i32) -> i32' },
      { section: 'Export Section (7)', desc: "export func 'run'" },
      { section: 'Code Section (10)', desc: `local.get 0\nlocal.get 1\n0x${opMap[cmdToken.value].toString(16).toUpperCase()} (i32.${cmdToken.value === 'mult' ? 'mul' : cmdToken.value === 'div' ? 'div_s' : cmdToken.value})\nend` }
    );
    return { type: 'math', binaryBytes, a, b, command: cmdToken.value, disassemblyLog };
  }
  throw new Error('Unable to parse supported C++ std::cout or math function call.');
}

async function executeCompilePipeline() {
  playBeep(650, 'triangle');
  const startTime = performance.now();
  const sourceCode = document.getElementById('source-editor').value;
  const visualTokenBox = document.getElementById('visual-tokens-container');
  const jsonTokenBox = document.getElementById('token-json-out');
  const tokenCountBadge = document.getElementById('token-count-badge');
  const hexMatrixBox = document.getElementById('wasm-hex-matrix');
  const disasmViewBox = document.getElementById('disassembly-view');
  try {
    const tokens = await analyzeSource(sourceCode);
    tokenCountBadge.textContent = `${tokens.length} Tokens`;
    jsonTokenBox.textContent = JSON.stringify(tokens, null, 2);
    visualTokenBox.replaceChildren();
    tokens.forEach(t => {
      const pill = document.createElement('span');
      pill.className = `px-2.5 py-1 rounded-md text-xs font-mono font-bold flex items-center space-x-1.5 border shadow-sm ${t.type === 'COMMAND' || t.type === 'NAMESPACE' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : t.type === 'STRING_LITERAL' ? 'bg-cyan-950 text-cyan-300 border-cyan-800' : 'bg-purple-950 text-purple-300 border-purple-800'}`;
      const typeSpan = document.createElement('span');
      typeSpan.className = 'opacity-50 text-[10px]';
      typeSpan.textContent = `${t.type}:`;
      const valueSpan = document.createElement('span');
      valueSpan.textContent = `"${t.value}"`;
      pill.append(typeSpan, valueSpan);
      visualTokenBox.appendChild(pill);
    });
    const compiled = compileToWasmBinary(tokens);
    currentCompiledWasmBytes = compiled.binaryBytes;
    document.getElementById('metric-bytes').textContent = `${compiled.binaryBytes.length} Bytes`;
    hexMatrixBox.replaceChildren();
    compiled.binaryBytes.forEach((b, i) => {
      const span = document.createElement('span');
      span.className = i < 8 ? 'text-emerald-400 font-bold' : 'text-purple-300';
      span.textContent = `0x${b.toString(16).padStart(2, '0').toUpperCase()}`;
      hexMatrixBox.append(span, document.createTextNode(' '));
    });
    disasmViewBox.replaceChildren();
    compiled.disassemblyLog.forEach(item => {
      const row = document.createElement('div');
      row.className = 'flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 hover:border-emerald-500/50 transition';
      const title = document.createElement('span'); title.className = 'text-emerald-400 font-bold'; title.textContent = `${item.section}:`;
      const desc = document.createElement('span'); desc.className = 'text-slate-300 whitespace-pre-line'; desc.textContent = item.desc;
      row.append(title, desc); disasmViewBox.appendChild(row);
    });
    const timestamp = new Date().toLocaleTimeString();
    if (compiled.type === 'cout') {
      const memory = new WebAssembly.Memory({ initial: 1 });
      const module = await WebAssembly.instantiate(compiled.binaryBytes, { env: { memory } });
      module.instance.exports.run();
      const printed = new TextDecoder().decode(new Uint8Array(memory.buffer, 0, compiled.length));
      appendConsoleLog(`[${timestamp}] [stdout]: ${printed}`);
      appendConsoleLog(`[${timestamp}] [Cpu VM]: Read ${compiled.length} bytes from Wasm Page Memory 0x0`);
    } else {
      const module = await WebAssembly.instantiate(compiled.binaryBytes);
      const result = module.instance.exports.run(compiled.a, compiled.b);
      appendConsoleLog(`[${timestamp}] [stdout]: ${compiled.command}(${compiled.a}, ${compiled.b}) = ${result}`);
      appendConsoleLog(`[${timestamp}] [Cpu VM]: Register evaluation completed.`);
    }
    document.getElementById('editor-status-badge').textContent = 'Compiled';
    document.getElementById('execution-time-badge').textContent = `${(performance.now() - startTime).toFixed(2)} ms execution time`;
    showToast('Compiled & Executed Natively!');
    playBeep(850, 'sine');
  } catch (err) {
    currentCompiledWasmBytes = null;
    document.getElementById('editor-status-badge').textContent = 'Error';
    appendConsoleLog(`[Cppify Compile Error]: ${err.message}`, true);
    showToast('Compilation Failed', true);
    playBeep(220, 'sawtooth');
  }
}

function appendConsoleLog(message, isError = false) {
  const consoleBox = document.getElementById('cpu-terminal-out');
  const entry = document.createElement('div');
  entry.className = `p-2.5 rounded-lg border font-mono text-xs whitespace-pre-wrap break-words ${isError ? 'bg-red-950/40 border-red-800/80 text-red-300' : 'bg-slate-900/60 border-slate-800 text-slate-200'}`;
  entry.textContent = message;
  consoleBox.appendChild(entry);
  consoleBox.scrollTop = consoleBox.scrollHeight;
}
function clearConsole() {
  document.getElementById('cpu-terminal-out').replaceChildren();
  const line = document.createElement('div'); line.className = 'text-slate-500'; line.textContent = '[Cppify Engine]: Console cleared.';
  document.getElementById('cpu-terminal-out').appendChild(line);
}
async function copyWasmHex() {
  if (!currentCompiledWasmBytes) { showToast('Compile code first!', true); return; }
  const hexStr = Array.from(currentCompiledWasmBytes).map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  try {
    await navigator.clipboard.writeText(hexStr);
  } catch (_) {
    const textarea = document.createElement('textarea'); textarea.value = hexStr;
    document.body.appendChild(textarea); textarea.select();
    const ok = document.execCommand('copy'); textarea.remove();
    if (!ok) { showToast('Clipboard copy failed', true); return; }
  }
  showToast('WASM Hex copied to clipboard!');
}
function downloadWasm() {
  if (!currentCompiledWasmBytes) { showToast('Compile code first!', true); return; }
  const blob = new Blob([currentCompiledWasmBytes], { type: 'application/wasm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'cppify_module.wasm';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Downloaded cppify_module.wasm');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('template-select').addEventListener('change', loadSelectedTemplate);
  document.getElementById('cmd-select').addEventListener('change', handleCommandChange);
  document.getElementById('cmd-text-arg').addEventListener('input', syncCodeFromInputs);
  document.getElementById('cmd-num-a').addEventListener('input', syncCodeFromInputs);
  document.getElementById('cmd-num-b').addEventListener('input', syncCodeFromInputs);
  document.getElementById('source-editor').addEventListener('input', handleManualCodeInput);
  document.getElementById('clear-editor-btn').addEventListener('click', clearEditor);
  document.getElementById('compile-btn').addEventListener('click', executeCompilePipeline);
  document.getElementById('clear-console-btn').addEventListener('click', clearConsole);
  document.getElementById('copy-hex-btn').addEventListener('click', copyWasmHex);
  document.getElementById('download-wasm-btn').addEventListener('click', downloadWasm);
  document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  handleCommandChange();
  executeCompilePipeline();
});