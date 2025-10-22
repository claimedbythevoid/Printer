import '/socket.io/socket.io.js'
const socket = io()

// CONFIG
const WORDS = ['VOID','EMERALD','BUTTERFLY','NEBULA','PIXEL','CYBER','AETHER']
const COST_PER_REVEAL = 5 // diamonds per letter reveal
const stage = document.getElementById('stage')
const ctx = stage.getContext('2d')
const beep = document.getElementById('beep')
const roundEl = document.getElementById('round')
const maskedEl = document.getElementById('masked')

let W,H; function resize(){ W=stage.width=window.innerWidth*2; H=stage.height=window.innerHeight*2 } window.addEventListener('resize',resize); resize()

// Game state
let round = 1
let word = pick(WORDS)
let revealed = new Set()
let coinBank = 0
updateMasked()

// Print queue of tickets
const queue = []
let printing = false

socket.on('gift', async g => {
  const diamonds = Number(g.diamondCount || giftToDiamonds(g.giftName, g.repeatCount))
  coinBank += diamonds
  while (coinBank >= COST_PER_REVEAL && unrevealedLetters().length){
    coinBank -= COST_PER_REVEAL
    revealRandom()
  }
  queue.push({
    title: `${g.giftName} x${g.repeatCount||1}`,
    user: g.nickname || g.uniqueId,
    avatar: g.profilePictureUrl || null,
    diamonds
  })
  if (!printing) runPrinter()
})

function pick(a){ return a[Math.floor(Math.random()*a.length)] }
function unrevealedLetters(){ return [...new Set(word.split(''))].filter(ch => !revealed.has(ch)) }
function revealRandom(){ const pool = unrevealedLetters(); if (!pool.length) return; revealed.add(pool[Math.floor(Math.random()*pool.length)]); updateMasked(); if (!unrevealedLetters().length){ setTimeout(nextRound, 1200) } }
function updateMasked(){ maskedEl.textContent = word.split('').map(ch => revealed.has(ch) ? ch : '_').join(' ') }
function nextRound(){ round++; roundEl.textContent = String(round); word = pick(WORDS); revealed.clear(); coinBank = 0; updateMasked(); queue.unshift({ title:'ROUND WON!', user:'CHAT', avatar:null, diamonds:0, golden:true }) }

// fallback gift→diamonds map (tune as needed)
const diamondMap = { 'rose':1,'perfume':20,'galaxy':1000,'lion':2999,'planet':150,'finger heart':5,'love you':20 }
function giftToDiamonds(name, repeat=1){ const val = diamondMap[(name||'').toLowerCase()] || 1; return val * (repeat||1) }

// Thermal printer visuals
const mm = v => Math.round(v)
async function runPrinter(){ printing = true; while(queue.length){ await printTicket(queue.shift()) } printing = false }

async function printTicket({ title, user, avatar, diamonds, golden }){
  const w = W*0.36, x = W*0.5 - w/2, top = H*0.12, lineH = mm(44); let y = top
  let paperH = 0, targetH = H*0.62
  let img = null; if (avatar){ img = await loadImage(avatar).catch(()=>null) }

  for (let i=0;i<22;i++){ paperH = targetH*(i/21); drawPrinterBody(); drawPaper(x,y,w,paperH); await wait(16) }

  const lines = [
    'VOID PRINTER',
    golden ? '★ GOLDEN TICKET ★' : title.toUpperCase(),
    '',
    `USER  : ${user}`,
    `COINS : ${diamonds}`,
    '',
    'WORD  : ' + word,
    'MASK  : ' + maskedEl.textContent.replace(/\s+/g,''),
    '',
    'THANKS FOR SUPPORTING THE STREAM ❤'
  ]

  if (img){ for (let s=0;s<5;s++){ drawPrinterBody(); drawPaper(x,y,w,paperH); drawAvatar(img, x + w/2 - mm(80), top + mm(110), mm(160), mm(160)); await stepper() } }
  for (const L of lines){ drawPrinterBody(); drawPaper(x,y,w,paperH); if (img) drawAvatar(img, x + w/2 - mm(80), top + mm(110), mm(160), mm(160)); drawLine(x + mm(40), top + mm(320) + lineH * 0.8, L); await stepper() }
  for (let i=0;i<18;i++){ y += mm(8); drawPrinterBody(); drawPaper(x,y,w,paperH); if (img) drawAvatar(img, x + w/2 - mm(80), top + mm(110), mm(160), mm(160)); await wait(16) }
}

function drawPrinterBody(){ ctx.clearRect(0,0,W,H); roundRect(W*0.5- W*0.22, H*0.07, W*0.44, H*0.12, 24, 'rgba(0,0,0,.25)'); roundRect(W*0.5- W*0.20, H*0.06, W*0.40, H*0.10, 24, 'rgba(12,16,20,.85)'); roundRect(W*0.5- W*0.18, H*0.115, W*0.36, H*0.02, 8, '#0f1418') }
function drawPaper(x,y,w,h){ ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.96)'; roundRect(x,y,w,h,14, ctx.fillStyle); ctx.strokeStyle = 'rgba(0,0,0,0.06)'; for(let gy=y+20; gy<y+h; gy+=24){ line(x+18, gy, x+w-18, gy) } ctx.restore() }
function drawLine(x,y,text){ ctx.save(); ctx.fillStyle = '#0b0f12'; ctx.font = `${mm(28)}px ui-monospace,Menlo,Consolas,monospace`; if (!text) { ctx.restore(); return } ctx.fillText(text, x, y); ctx.restore() }
function drawAvatar(img,x,y,w,h){ ctx.save(); roundRectPath(x,y,w,h,12); ctx.clip(); ctx.drawImage(img,x,y,w,h); ctx.restore() }
function roundRect(x,y,w,h,r,fill){ roundRectPath(x,y,w,h,r); if (fill){ ctx.fillStyle = fill; ctx.fill() } }
function roundRectPath(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y, x+w,y+h, r); ctx.arcTo(x+w,y+h, x,y+h, r); ctx.arcTo(x,y+h, x,y, r); ctx.arcTo(x,y, x+w,y, r); ctx.closePath() }
function line(x1,y1,x2,y2){ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke() }
function wait(ms){ return new Promise(r=>setTimeout(r,ms)) }
async function stepper(){ try{ beep.currentTime=0; await beep.play() }catch{} await wait(42) }
function loadImage(src){ return new Promise((res,rej)=>{ const i = new Image(); i.crossOrigin='anonymous'; i.onload=()=>res(i); i.onerror=rej; i.src=src }) }
