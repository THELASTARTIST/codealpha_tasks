/* ===================== Sidebar navigation ===================== */
const navBtns = document.querySelectorAll('.nav-btn');
const panels = document.querySelectorAll('.mode-panel');
const accentMap = { basic:'#8fb8de', scientific:'#f2b84b', graphing:'#74c69d', financial:'#c1666b', about:'#9aa0a8' };

navBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    navBtns.forEach(b=>b.classList.remove('active'));
    panels.forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.mode;
    document.getElementById('panel-'+mode).classList.add('active');
    document.documentElement.style.setProperty('--accent', accentMap[mode] || '#8fb8de');
    if(mode === 'graphing'){ requestAnimationFrame(drawGraph); }
  });
});

/* ===================== Shared: press animation ===================== */
function animatePress(el){
  el.classList.add('pressed','ripple');
  setTimeout(()=>el.classList.remove('pressed','ripple'), 140);
}
function flashKeyByLabel(container, matchFn){
  const keys = container.querySelectorAll('.key');
  for(const k of keys){ if(matchFn(k)){ animatePress(k); break; } }
}

/* ===================== BASIC calculator ===================== */
(function(){
  const displayEl = document.getElementById('basic-display');
  const previewEl = document.getElementById('basic-preview');
  let expr = '';

  function toEvalString(s){
    return s.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/%/g,'/100');
  }
  function safeEval(s){
    if(!s) return '';
    if(!/^[0-9+\-×÷−.() %]*$/.test(s)) return '';
    try{
      const val = Function('"use strict"; return (' + toEvalString(s) + ')')();
      if(typeof val !== 'number' || !isFinite(val)) return '';
      return Math.round(val * 1e10) / 1e10;
    }catch(e){ return ''; }
  }
  function render(){
    displayEl.textContent = expr === '' ? '0' : expr;
    const preview = safeEval(expr);
    previewEl.textContent = (preview === '' || String(preview) === expr) ? '\u00A0' : '= ' + preview;
  }
  function lastCharIsOperator(){
    return /[+\-×÷]$/.test(expr);
  }
  function appendNum(n){
    if(expr === '0') expr = '';
    expr += n;
    render();
  }
  function appendOp(op){
    if(expr === '') { if(op==='−'){ expr='−'; render(); } return; }
    if(lastCharIsOperator()) expr = expr.slice(0,-1) + op;
    else expr += op;
    render();
  }
  function appendDecimal(){
    const parts = expr.split(/[+\-×÷]/);
    const last = parts[parts.length-1];
    if(last.includes('.')) return;
    expr += (last === '' ? '0.' : '.');
    render();
  }
  function negate(){
    const val = safeEval(expr);
    if(val === '') return;
    expr = String(-val);
    render();
  }
  function percent(){
    const val = safeEval(expr);
    if(val === '') return;
    expr = String(val/100);
    render();
  }
  function clearAll(){ expr=''; render(); }
  function backspace(){ expr = expr.slice(0,-1); render(); }
  function equals(){
    const val = safeEval(expr);
    if(val === '') return;
    expr = String(val);
    render();
  }

  document.getElementById('basic-keys').addEventListener('click', (e)=>{
    const btn = e.target.closest('.key');
    if(!btn) return;
    animatePress(btn);
    if(btn.dataset.num !== undefined) appendNum(btn.dataset.num);
    else if(btn.dataset.op !== undefined) appendOp(btn.dataset.op);
    else if(btn.dataset.action === 'clear') clearAll();
    else if(btn.dataset.action === 'negate') negate();
    else if(btn.dataset.action === 'percent') percent();
    else if(btn.dataset.action === 'decimal') appendDecimal();
    else if(btn.dataset.action === 'equals') equals();
  });

  // keyboard support — active only when Basic panel is visible
  document.addEventListener('keydown', (e)=>{
    if(!document.getElementById('panel-basic').classList.contains('active')) return;
    const keyMap = { '+':'+','-':'−','*':'×','/':'÷' };
    if(/[0-9]/.test(e.key)){ appendNum(e.key); flashKeyByLabel(document.getElementById('basic-keys'), k=>k.dataset.num===e.key); }
    else if(keyMap[e.key]){ appendOp(keyMap[e.key]); flashKeyByLabel(document.getElementById('basic-keys'), k=>k.dataset.op===keyMap[e.key]); }
    else if(e.key === '.'){ appendDecimal(); }
    else if(e.key === 'Enter' || e.key === '='){ e.preventDefault(); equals(); }
    else if(e.key === 'Backspace'){ backspace(); }
    else if(e.key === 'Escape'){ clearAll(); }
    else if(e.key === '%'){ percent(); }
  });

  render();
})();

/* ===================== SCIENTIFIC calculator ===================== */
(function(){
  const displayEl = document.getElementById('sci-display');
  const previewEl = document.getElementById('sci-preview');
  const screenEl = document.querySelector('#panel-scientific .screen');
  let expr = '';
  let degMode = true;

  document.getElementById('deg-btn').addEventListener('click', ()=>{
    degMode = true;
    document.getElementById('deg-btn').classList.add('active');
    document.getElementById('rad-btn').classList.remove('active');
    render();
  });
  document.getElementById('rad-btn').addEventListener('click', ()=>{
    degMode = false;
    document.getElementById('rad-btn').classList.add('active');
    document.getElementById('deg-btn').classList.remove('active');
    render();
  });

  function toEvalString(s){
    let out = s
      .replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-')
      .replace(/\^/g,'**')
      .replace(/PI/g,'Math.PI').replace(/\bE\b/g,'Math.E')
      .replace(/sqrt\(/g,'Math.sqrt(')
      .replace(/log\(/g,'Math.log10(')
      .replace(/ln\(/g,'Math.log(');
    const trigWrap = (name, fn) => {
      out = out.split(name+'(').join(fn+'(');
    };
    if(degMode){
      trigWrap('sin','__sin'); trigWrap('cos','__cos'); trigWrap('tan','__tan');
    } else {
      trigWrap('sin','Math.sin'); trigWrap('cos','Math.cos'); trigWrap('tan','Math.tan');
    }
    return out;
  }
  function safeEval(s){
    if(!s) return '';
    if(!/^[0-9A-Za-z+\-×÷−*/.^() ]*$/.test(s)) return '';
    try{
      const __sin = x => Math.sin(x*Math.PI/180);
      const __cos = x => Math.cos(x*Math.PI/180);
      const __tan = x => Math.tan(x*Math.PI/180);
      const val = Function('Math','__sin','__cos','__tan', '"use strict"; return (' + toEvalString(s) + ')')(Math, __sin, __cos, __tan);
      if(typeof val !== 'number' || !isFinite(val)) return '';
      return Math.round(val * 1e10) / 1e10;
    }catch(e){ return ''; }
  }
  function render(){
    displayEl.textContent = expr === '' ? '0' : expr;
    screenEl.setAttribute('data-mode', degMode ? 'DEG' : 'RAD');
    screenEl.classList.add('deg-mode');
    const preview = safeEval(expr);
    previewEl.textContent = (preview === '' || String(preview) === expr) ? '\u00A0' : '= ' + preview;
  }
  function append(str){ if(expr==='0') expr=''; expr += str; render(); }
  function appendDecimal(){
    const parts = expr.split(/[+\-×÷^(),]/);
    const last = parts[parts.length-1];
    if(last.includes('.')) return;
    expr += (last === '' ? '0.' : '.');
    render();
  }
  function clearAll(){ expr=''; render(); }
  function backspace(){ expr = expr.slice(0,-1); render(); }
  function equals(){
    const val = safeEval(expr);
    if(val === '') return;
    expr = String(val);
    render();
  }

  document.getElementById('sci-keys').addEventListener('click', (e)=>{
    const btn = e.target.closest('.key');
    if(!btn) return;
    animatePress(btn);
    if(btn.dataset.numSci !== undefined) append(btn.dataset.numSci);
    else if(btn.dataset.opSci !== undefined) append(btn.dataset.opSci);
    else if(btn.dataset.op !== undefined) append(btn.dataset.op);
    else if(btn.dataset.fn !== undefined) append(btn.dataset.fn);
    else if(btn.dataset.const !== undefined) append(btn.dataset.const);
    else if(btn.dataset.action === 'clear-sci') clearAll();
    else if(btn.dataset.action === 'decimal-sci') appendDecimal();
    else if(btn.dataset.action === 'del-sci') backspace();
    else if(btn.dataset.action === 'equals-sci') equals();
  });

  document.addEventListener('keydown', (e)=>{
    if(!document.getElementById('panel-scientific').classList.contains('active')) return;
    const keyMap = { '+':'+','-':'−','*':'×','/':'÷' };
    if(/[0-9]/.test(e.key)) append(e.key);
    else if(keyMap[e.key]) append(keyMap[e.key]);
    else if(e.key === '.'){ appendDecimal(); }
    else if(e.key === '('||e.key===')'){ append(e.key); }
    else if(e.key === 'Enter' || e.key === '='){ e.preventDefault(); equals(); }
    else if(e.key === 'Backspace'){ backspace(); }
    else if(e.key === 'Escape'){ clearAll(); }
  });

  render();
})();

/* ===================== GRAPHING calculator ===================== */
let graphRange = 10;
function evalFn(expr, x){
  const cleaned = expr
    .replace(/\^/g,'**')
    .replace(/\bpi\b/gi,'Math.PI')
    .replace(/\be\b/gi,'Math.E');
  try{
    // Explicitly bring common Math functions/constants into scope instead of
    // using `with(Math)`, which is disallowed in strict mode.
    const fn = new Function(
      'x',
      'sin','cos','tan','asin','acos','atan',
      'sqrt','abs','log','log10','log2','exp','pow','floor','ceil','round','min','max',
      '"use strict"; return (' + cleaned + ');'
    );
    return fn(
      x,
      Math.sin, Math.cos, Math.tan, Math.asin, Math.acos, Math.atan,
      Math.sqrt, Math.abs, Math.log, Math.log10, Math.log2, Math.exp, Math.pow,
      Math.floor, Math.ceil, Math.round, Math.min, Math.max
    );
  }catch(e){ return NaN; }
}
function drawGraph(){
  const canvas = document.getElementById('graphCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  const range = graphRange;
  const originX = w/2, originY = h/2;
  const scale = (w/2) / range;

  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  const step = range <= 5 ? 1 : (range <= 20 ? 2 : 5);
  for(let gx = -range; gx <= range; gx += step){
    const px = originX + gx*scale;
    ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px,h); ctx.stroke();
  }
  const vertRange = range * (h/w);
  for(let gy = -vertRange; gy <= vertRange; gy += step){
    const py = originY - gy*scale;
    ctx.beginPath(); ctx.moveTo(0,py); ctx.lineTo(w,py); ctx.stroke();
  }

  // axes
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0,originY); ctx.lineTo(w,originY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(originX,0); ctx.lineTo(originX,h); ctx.stroke();

  // curve
  const exprStr = document.getElementById('graph-fn').value || 'x';
  ctx.strokeStyle = '#74c69d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  let started = false;
  for(let px = 0; px <= w; px++){
    const x = (px - originX) / scale;
    const y = evalFn(exprStr, x);
    if(typeof y !== 'number' || !isFinite(y)){ started = false; continue; }
    const py = originY - y*scale;
    if(py < -h*3 || py > h*4){ started = false; continue; }
    if(!started){ ctx.moveTo(px,py); started = true; }
    else ctx.lineTo(px,py);
  }
  ctx.stroke();

  document.getElementById('graph-range').textContent = `x: −${range} to ${range}`;
}
document.getElementById('graph-plot').addEventListener('click', (e)=>{
  const btn = e.target;
  btn.style.transform='scale(0.94)'; setTimeout(()=>btn.style.transform='',120);
  drawGraph();
});
document.getElementById('graph-fn').addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') drawGraph();
});
document.getElementById('zoom-in').addEventListener('click', ()=>{ graphRange = Math.max(1, graphRange - 2); drawGraph(); });
document.getElementById('zoom-out').addEventListener('click', ()=>{ graphRange += 2; drawGraph(); });
document.getElementById('zoom-reset').addEventListener('click', ()=>{ graphRange = 10; drawGraph(); });
document.querySelectorAll('.preset-chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    document.getElementById('graph-fn').value = chip.dataset.fn;
    drawGraph();
  });
});

/* ===================== FINANCIAL calculator ===================== */
function formatCurrency(n){
  return '₹' + n.toLocaleString('en-IN', {maximumFractionDigits:0});
}
function calcLoan(){
  const P = parseFloat(document.getElementById('fin-principal').value) || 0;
  const annualRate = parseFloat(document.getElementById('fin-rate').value) || 0;
  const years = parseFloat(document.getElementById('fin-years').value) || 0;
  const n = Math.round(years * 12);
  const r = (annualRate/100)/12;

  let monthly;
  if(r === 0){ monthly = n > 0 ? P / n : 0; }
  else{ monthly = P * r * Math.pow(1+r, n) / (Math.pow(1+r, n) - 1); }

  document.getElementById('fin-monthly').textContent = isFinite(monthly) ? formatCurrency(monthly) : '—';
  const totalPaid = monthly * n;
  const totalInterest = totalPaid - P;
  document.getElementById('fin-interest').textContent = isFinite(totalInterest) ? formatCurrency(totalInterest) : '—';
  document.getElementById('fin-total').textContent = isFinite(totalPaid) ? formatCurrency(totalPaid) : '—';

  // yearly amortization summary
  let balance = P;
  const rows = [];
  for(let yr = 1; yr <= Math.ceil(years); yr++){
    let yearPrincipal = 0, yearInterest = 0;
    const monthsThisYear = Math.min(12, n - (yr-1)*12);
    for(let m = 0; m < monthsThisYear; m++){
      const interestPortion = balance * r;
      const principalPortion = monthly - interestPortion;
      balance -= principalPortion;
      yearPrincipal += principalPortion;
      yearInterest += interestPortion;
    }
    rows.push({yr, yearPrincipal, yearInterest, balance: Math.max(balance,0)});
  }
  const tbody = document.getElementById('fin-table-body');
  tbody.innerHTML = rows.map(row => `
    <tr>
      <td>Year ${row.yr}</td>
      <td>${formatCurrency(row.yearPrincipal)}</td>
      <td>${formatCurrency(row.yearInterest)}</td>
      <td>${formatCurrency(row.balance)}</td>
    </tr>`).join('');
}
document.getElementById('fin-calc').addEventListener('click', (e)=>{
  const btn = e.target;
  btn.style.transform='scale(0.94)'; setTimeout(()=>btn.style.transform='',120);
  calcLoan();
});

/* Initial paint */
window.addEventListener('load', ()=>{ drawGraph(); });