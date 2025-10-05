// --- Tabs ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.target;
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-' + target).classList.add('active');
    });
});

// --- Calculator ---
const display = document.getElementById('display');
display.value = '0';

function appendToDisplay(input) {
    // Prevent multiple decimals in a number
    if (input === '.' && display.value.split(/\+|\-|\*|\//).pop().includes('.')) return;
    if (display.value === '0' && input !== '.') {
        display.value = input;
    } else {
        display.value += input;
    }
}

function clearDisplay() { display.value = '0'; }

function percent(){
    try{
        let val = parseFloat(display.value);
        display.value = (val/100).toString();
    }catch(e){display.value='Error'}
}

function squareLast(){
    try{
        let last = display.value.split(/\+|\-|\*|\//).pop();
        let sq = Math.pow(parseFloat(last),2);
        display.value = display.value.slice(0, -last.length) + sq;
    }catch(e){display.value='Error'}
}

function sqrtLast(){
    try{
        let last = display.value.split(/\+|\-|\*|\//).pop();
        let r = Math.sqrt(parseFloat(last));
        display.value = display.value.slice(0, -last.length) + r;
    }catch(e){display.value='Error'}
}

function toggleSign(){
    let last = display.value.split(/\+|\-|\*|\//).pop();
    if(!last) return;
    if(last.startsWith('-')) last = last.slice(1);
    else last = '-' + last;
    display.value = display.value.slice(0, -String(display.value.split(/\+|\-|\*|\//).pop()).length) + last;
}

function calculateResult(){
    try{
        let expression = display.value.replace(/x/g,'*');
        // Prevent dangerous eval by allowing only digits and operators
        if(!/^[0-9.+\-*/()% ]+$/.test(expression)) { display.value='Error'; return; }
        // eslint-disable-next-line no-eval
        let result = eval(expression);
        display.value = String(result);
    }catch(e){display.value='Error'}
}

// Keyboard support
document.addEventListener('keydown',(event)=>{
    const key = event.key;
    if(!isNaN(key)) appendToDisplay(key);
    else if(['+','-','*','/'].includes(key)) appendToDisplay(key);
    else if(key==='.') appendToDisplay('.');
    else if(key==='Enter' || key==='=') calculateResult();
    else if(key==='Backspace') display.value = display.value.length>1?display.value.slice(0,-1):'0';
    else if(key.toLowerCase()==='c') clearDisplay();
});

// Global keyboard shortcuts and feature keyboard controls
document.addEventListener('keydown',(e)=>{
    // ignore when typing in inputs or textarea
    const tag = (e.target && e.target.tagName) || '';
    if(tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

    // Ctrl+1..4 switch tabs
    if(e.ctrlKey && !e.shiftKey){
        if(e.key === '1') document.querySelector('[data-target="calc"]').click();
        if(e.key === '2') document.querySelector('[data-target="notes"]').click();
        if(e.key === '3') document.querySelector('[data-target="speed"]').click();
        if(e.key === '4') document.querySelector('[data-target="time"]').click();
    }

    // Ctrl+W or Ctrl+Q close app
    if((e.ctrlKey && e.key.toLowerCase()==='w') || (e.ctrlKey && e.key.toLowerCase()==='q')){
        // send close request via IPC for main to handle
        try{ const { ipcRenderer } = require('electron'); ipcRenderer.send('close-window'); }catch(_){ window.close(); }
    }

    // Ping toggle: P
    if(e.key.toLowerCase()==='p'){
        if(startPingBtn.disabled) { stopPingBtn.click(); } else { startPingBtn.click(); }
    }

    // Run download: D or R
    if(e.key.toLowerCase()==='d' || e.key.toLowerCase()==='r'){
        runDownloadBtn.click();
    }

    // Stopwatch: Space toggles start/stop, R resets
    if(e.key === ' ' && document.querySelector('.tab-btn.active').dataset.target === 'time'){
        e.preventDefault();
        if(!swRunning) swStartBtn.click(); else swStopBtn.click();
    }
    if(e.key.toLowerCase()==='r' && document.querySelector('.tab-btn.active').dataset.target === 'time'){
        swResetBtn.click();
    }

});

// close button handler
const closeBtn = document.getElementById('close-btn');
if(closeBtn){
    closeBtn.addEventListener('click', ()=>{
        try{ const { ipcRenderer } = require('electron'); ipcRenderer.send('close-window'); }catch(_){ window.close(); }
    });
}

// --- Notes ---
const notesEl = document.getElementById('notes');
const clearNotesBtn = document.getElementById('clear-notes');
const NOTES_KEY = 'mintool_notes_v1';
function loadNotes(){ notesEl.value = localStorage.getItem(NOTES_KEY) || ''; }
// auto-save on input
notesEl.addEventListener('input', ()=>{ localStorage.setItem(NOTES_KEY, notesEl.value); });
clearNotesBtn.addEventListener('click', ()=>{ notesEl.value=''; localStorage.removeItem(NOTES_KEY); notesEl.focus(); });
loadNotes();

// --- Speed test / Ping loop ---
const startPingBtn = document.getElementById('start-ping');
const stopPingBtn = document.getElementById('stop-ping');
const endpointInput = document.getElementById('speed-endpoint');
const pingLast = document.getElementById('ping-last');
const pingAvg = document.getElementById('ping-avg');
const pingMin = document.getElementById('ping-min');
const pingMax = document.getElementById('ping-max');
const canvas = document.getElementById('ping-canvas');
const ctx = canvas.getContext('2d');
let pingTimer = null; let pingData = [];

// Speed meter elements
const runDownloadBtn = document.getElementById('run-download');
const speedBar = document.getElementById('speed-bar');
const speedFill = document.getElementById('speed-fill');
const speedValue = document.getElementById('speed-value');
const avgLine = document.getElementById('avg-line');

// Placeholder for regional average (Mbps). In a real app, use a geolocation + dataset.
let regionalAverageMbps = 100; // default

function setAvgLine(posMbps){
    const pct = Math.max(0, Math.min(100, (posMbps/1000)*100));
    avgLine.style.left = pct + '%';
}

// animate fill to target percent
function setSpeedFill(mbps){
    const pct = Math.max(0, Math.min(100, (mbps/1000)*100));
    speedFill.style.width = pct + '%';
    speedValue.textContent = Math.round(mbps) + ' Mbps';
}

function drawPing(){
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = canvas.clientHeight || 140;
    ctx.clearRect(0,0,w,h);
    if(pingData.length===0) return;
    const max = Math.max(...pingData,100);
    // draw grid lines subtle
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0;i<4;i++){ const y = 5 + i*(h-10)/3; ctx.moveTo(0,y); ctx.lineTo(w,y); }
    ctx.stroke();
    // draw ping line stark white
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath();
    pingData.forEach((v,i)=>{
        const x = (i/(Math.max(1,pingData.length-1)))*w;
        const y = h - 5 - (v/max)*(h-10);
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
}

async function doPing(){
    const url = endpointInput.value || 'https://www.google.com/generate_204';
    try{
        const t0 = performance.now();
        // add cache buster
        const r = await fetch(url + '?_=' + Date.now(), {method:'GET', mode:'no-cors'});
        const t1 = performance.now();
        const ms = Math.round(t1-t0);
        pingData.push(ms);
        if(pingData.length>60) pingData.shift();
        pingLast.textContent = ms;
        pingAvg.textContent = Math.round(pingData.reduce((a,b)=>a+b,0)/pingData.length);
        pingMin.textContent = Math.min(...pingData);
        pingMax.textContent = Math.max(...pingData);
        drawPing();
    }catch(e){
        // network error show as -
        pingLast.textContent='-';
    }
}

startPingBtn.addEventListener('click', ()=>{
    startPingBtn.disabled = true; stopPingBtn.disabled=false; pingData=[];
    doPing(); pingTimer = setInterval(doPing, 1000);
});
stopPingBtn.addEventListener('click', ()=>{ startPingBtn.disabled=false; stopPingBtn.disabled=true; if(pingTimer) clearInterval(pingTimer); pingTimer = null; });

// --- Download speed test (simple) ---
// We'll request a large resource or repeated chunk requests and measure bytes/time.
async function measureDownload(url, timeout = 8000){
    // If running inside Electron with Node, use node http/https for a reliable stream
    if(typeof require === 'function'){
        try{
            const { URL } = require('url');
            const http = require('http');
            const https = require('https');
            const u = new URL(url);
            const lib = u.protocol === 'https:' ? https : http;
            return await new Promise((resolve) => {
                const req = lib.get(u, {headers:{'Cache-Control':'no-cache'}}, (res) => {
                    let bytes = 0; const start = performance.now();
                    res.on('data', (chunk) => { bytes += chunk.length; });
                    res.on('end', () => {
                        const seconds = Math.max(0.001, (performance.now() - start) / 1000);
                        // bytes -> bits, divide by seconds to get bits/sec, then convert to megabits (/1e6)
                        const mbps = (bytes * 8) / (seconds * 1000 * 1000);
                        resolve(Math.abs(mbps));
                    });
                });
                req.setTimeout(timeout, ()=>{ req.abort(); resolve(null); });
                req.on('error', ()=>{ resolve(null); });
            });
        }catch(e){ /* fall back to fetch below */ }
    }
    // browser fallback
    try{
        const controller = new AbortController();
        const signal = controller.signal;
        const t0 = performance.now();
        const res = await fetch(url, {method:'GET', cache:'no-store', signal});
        if(!res.ok && res.type !== 'opaque') {
            controller.abort();
            return null;
        }
        // Read body as a stream if available
        const reader = res.body && res.body.getReader ? res.body.getReader() : null;
        let bytes = 0;
        if(reader){
            const start = performance.now();
            while(true){
                const {done, value} = await reader.read();
                if(done) break;
                bytes += value.byteLength;
                // stop early if too long
                if(performance.now() - start > timeout) { controller.abort(); break; }
            }
        }else{
            // fallback: blob
            const blob = await res.blob();
            bytes = blob.size;
        }
        const t1 = performance.now();
    const seconds = Math.max(0.001, (t1 - t0) / 1000);
    // proper conversion to megabits per second
    const mbps = (bytes * 8) / (seconds * 1000 * 1000);
        return Math.abs(mbps);
    }catch(e){
        return null;
    }
}

runDownloadBtn.addEventListener('click', async ()=>{
    runDownloadBtn.disabled = true; speedValue.textContent = 'Testing...'; speedFill.style.width='0%';
    const url = endpointInput.value || 'https://www.google.com/';
    // Try a quick measurement; note: browsers and CORS may limit accuracy
    const tryUrls = [url, url + '?_=' + Date.now()];
    let best = 0;
    for(const u of tryUrls){
        const m = await measureDownload(u, 4000);
        if(m && m > best) best = m;
    }
    const mbps = best || 0;
    setSpeedFill(Math.min(1000, mbps));
    setAvgLine(regionalAverageMbps);
    speedValue.textContent = (mbps? Math.round(mbps) + ' Mbps' : 'N/A');
    runDownloadBtn.disabled = false;
});

// initialize avg line
setAvgLine(regionalAverageMbps);

// --- Time / Clock / Stopwatch / Countdown ---
const localTime = document.getElementById('local-time');
function updateClock(){ const d = new Date(); localTime.textContent = d.toLocaleTimeString(); }
setInterval(updateClock, 500); updateClock();

// Stopwatch
let swRunning=false, swStart=0, swElapsed=0, swInterval=null;
const swDisplay = document.getElementById('sw-display');
const swStartBtn = document.getElementById('sw-start');
const swStopBtn = document.getElementById('sw-stop');
const swResetBtn = document.getElementById('sw-reset');

function formatStopwatch(ms){ const total = Math.floor(ms); const cent = Math.floor((total%1000)/10); const s = Math.floor(total/1000)%60; const m = Math.floor(total/60000); return String(m).padStart(2,'0')+":"+String(s).padStart(2,'0')+"."+String(cent).padStart(2,'0'); }

swStartBtn.addEventListener('click', ()=>{
    if(swRunning) return; swRunning=true; swStart = performance.now()-swElapsed; swInterval=setInterval(()=>{ swElapsed = performance.now()-swStart; swDisplay.textContent = formatStopwatch(swElapsed); }, 50); swStartBtn.disabled=true; swStopBtn.disabled=false;
});
swStopBtn.addEventListener('click', ()=>{ if(!swRunning) return; swRunning=false; clearInterval(swInterval); swInterval=null; swStartBtn.disabled=false; swStopBtn.disabled=true; });
swResetBtn.addEventListener('click', ()=>{ swRunning=false; clearInterval(swInterval); swInterval=null; swElapsed=0; swDisplay.textContent='00:00.00'; swStartBtn.disabled=false; swStopBtn.disabled=true; });

// Countdown
let cdTimer=null, cdRemaining=0, cdRunning=false;
const cdDisplay = document.getElementById('cd-display');
const cdMin = document.getElementById('cd-min');
const cdSec = document.getElementById('cd-sec');
const cdStart = document.getElementById('cd-start');
const cdStop = document.getElementById('cd-stop');
const cdReset = document.getElementById('cd-reset');

function formatCountdown(sec){ const m = Math.floor(sec/60); const s = Math.floor(sec%60); return String(m).padStart(2,'0')+":"+String(s).padStart(2,'0'); }

cdStart.addEventListener('click', ()=>{
    const total = Number(cdMin.value||0)*60 + Number(cdSec.value||0);
    if(total<=0) return; cdRemaining = total; cdRunning=true; cdStart.disabled=true; cdStop.disabled=false; cdReset.disabled=false;
    cdDisplay.textContent = formatCountdown(cdRemaining);
    cdTimer = setInterval(()=>{
        cdRemaining--; if(cdRemaining<=0){ clearInterval(cdTimer); cdRunning=false; cdDisplay.textContent='00:00'; cdStart.disabled=false; cdStop.disabled=true; return; }
        cdDisplay.textContent = formatCountdown(cdRemaining);
    },1000);
});
cdStop.addEventListener('click', ()=>{ if(cdTimer) clearInterval(cdTimer); cdRunning=false; cdStart.disabled=false; cdStop.disabled=true; });
cdReset.addEventListener('click', ()=>{ if(cdTimer) clearInterval(cdTimer); cdRunning=false; cdRemaining=0; cdDisplay.textContent='00:00'; cdStart.disabled=false; cdStop.disabled=true; });

