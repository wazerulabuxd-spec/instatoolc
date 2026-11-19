const express = require('express');
const { InstagrapiClient } = require('instagrapi-js');

const app = express();
app.use(express.json());

let accounts = [];

// String.raw kullanarak içerideki \ ve ${} ifadelerinin bozulmasını engelliyoruz
const html = String.raw`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WAZER INSTA</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#fff;font-family:'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;min-height:100vh;padding:20px}
h1{font-size:2.2rem;letter-spacing:4px;margin:30px 0;font-weight:300;border-right:2px solid #fff;white-space:nowrap;overflow:hidden;animation:blink .75s step-end infinite}
@keyframes blink{from,to{border-color:transparent}50%{border-color:#fff}}
.container{width:100%;max-width:900px;display:flex;flex-direction:column;gap:20px}
.panel{background:#111;border:1px solid #333;border-radius:8px;padding:20px}
.panel h2{font-size:.9rem;margin-bottom:15px;color:#888;text-transform:uppercase;letter-spacing:2px}
input,button,textarea{width:100%;padding:10px;margin-bottom:10px;background:#000;border:1px solid #444;color:#fff;border-radius:4px;font-family:inherit}
button{background:#fff;color:#000;cursor:pointer;font-weight:bold;transition:.2s}
button:hover{background:#ccc}button:disabled{opacity:.3;cursor:not-allowed}
.account-item{padding:8px 10px;border-bottom:1px solid #222;display:flex;justify-content:space-between;font-size:.85rem}
.account-item:last-child{border-bottom:none}
.account-list{max-height:150px;overflow-y:auto;border:1px solid #222;margin-top:10px}
.row{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.row label{font-size:.85rem;color:#888;white-space:nowrap}
.row input{width:100px;margin:0;text-align:center}
.error{color:#f00;font-size:.8rem;margin-top:5px}
.ok{color:#0f0}
textarea{resize:vertical;min-height:70px}
</style>
</head>
<body>
<h1 id="title">WAZER INSTA</h1>
<div class="container">
<div class="panel">
<h2>Hesap Ekle (Session ID)</h2>
<input type="text" id="sessionInput" placeholder="sessionid yapıştır...">
<button id="addAccountBtn">Hesap Ekle</button>
<div id="accountError" class="error"></div>
<div class="account-list" id="accountList"></div>
</div>
<div class="panel">
<h2>Mesaj Gönder</h2>
<button id="fetchThreadsBtn" disabled>Grupları Çek</button>
<div style="max-height:120px;overflow-y:auto;border:1px solid #222;margin:10px 0;font-size:.85rem" id="threadList"></div>
<div class="row">
<label>Gecikme (sn)</label>
<input type="number" id="delaySec" value="30" min="5">
</div>
<textarea id="messageText" placeholder="Gönderilecek mesaj..."></textarea>
<button id="sendBtn" disabled>Mesaj Gönder</button>
<div id="sendStatus" class="error"></div>
</div>
</div>
<script>
const titleEl = document.getElementById('title');
const originalText = 'WAZER INSTA';
let typingTimeout;
function startTypingEffect(){
  clearTimeout(typingTimeout);
  titleEl.textContent='';
  let i=0;
  const iv=setInterval(()=>{
    if(i<originalText.length){titleEl.textContent+=originalText[i];i++}
    else{clearInterval(iv);typingTimeout=setTimeout(startTypingEffect,3000)}
  },100);
}
startTypingEffect();

document.getElementById('addAccountBtn').addEventListener('click', async () => {
  const sid = document.getElementById('sessionInput').value.trim();
  const errEl = document.getElementById('accountError');
  errEl.textContent = '';
  if(!sid){ errEl.textContent = 'Session ID boş olamaz'; return; }
  const btn = document.getElementById('addAccountBtn');
  btn.disabled = true;
  btn.textContent = 'Ekleniyor...';
  try {
    const res = await fetch('/api/add-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionid: sid })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('sessionInput').value = '';
      updateAccounts(data.accounts);
    } else {
      errEl.textContent = data.error || 'Bilinmeyen hata';
    }
  } catch (e) {
    errEl.textContent = 'Sunucuya ulaşılamadı: ' + e.message;
  }
  btn.disabled = false;
  btn.textContent = 'Hesap Ekle';
});

document.getElementById('fetchThreadsBtn').addEventListener('click', async () => {
  const btn = document.getElementById('fetchThreadsBtn');
  btn.disabled = true; btn.textContent = 'Çekiliyor...';
  try {
    const res = await fetch('/api/fetch-threads');
    const data = await res.json();
    if (data.success) { renderThreads(data.threads); document.getElementById('sendBtn').disabled = false; }
    else alert(data.error);
  } catch (e) { alert('Bağlantı hatası'); }
  btn.disabled = false; btn.textContent = 'Grupları Çek';
});

document.getElementById('sendBtn').addEventListener('click', async () => {
  const text = document.getElementById('messageText').value.trim();
  if (!text) return alert('Mesaj boş');
  const delay = parseInt(document.getElementById('delaySec').value) || 30;
  const btn = document.getElementById('sendBtn');
  btn.disabled = true; btn.textContent = 'Gönderiliyor...';
  document.getElementById('sendStatus').textContent = '';
  try {
    const res = await fetch('/api/send-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, delay })
    });
    const data = await res.json();
    document.getElementById('sendStatus').textContent = data.success ? '✅ ' + data.sent + '/' + data.total + ' gönderildi' : '❌ ' + data.error;
    document.getElementById('sendStatus').className = data.success ? 'ok' : 'error';
  } catch (e) { document.getElementById('sendStatus').textContent = 'Bağlantı hatası'; }
  btn.disabled = false; btn.textContent = 'Mesaj Gönder';
});

function updateAccounts(accounts){
  document.getElementById('accountList').innerHTML = accounts.map(a =>
    '<div class="account-item"><span>' + a.username + '</span><span class="ok">●</span></div>'
  ).join('');
  document.getElementById('fetchThreadsBtn').disabled = accounts.length === 0;
}
function renderThreads(threads){
  document.getElementById('threadList').innerHTML = threads.map(t =>
    '<div class="account-item"><span>' + t.title + '</span><span style="color:#666;font-size:.7rem">' + t.account + '</span></div>'
  ).join('');
}
</script>
</body>
</html>`;

app.get('/', (req, res) => res.send(html));

// ... (API rotaları aynı kalacak) ...

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('Listening on ' + PORT));