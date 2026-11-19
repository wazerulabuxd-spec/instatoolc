const express = require('express');
const app = express();
app.use(express.json());

// Kütüphaneyi doğru isimle ve hata yakalayarak yükle
let IgApiClient;
try {
  ({ IgApiClient } = require('nodejs-insta-private-api-mqt'));
} catch (e) {
  console.error('Paket yüklenemedi. package.json kontrol edin:', e.message);
}

let accounts = [];
let isSendingLoop = false;
let stopSignal = false;
let sendLogs = [];

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
.container{width:100%;max-width:1000px;display:grid;grid-template-columns:1fr 1fr;gap:20px}
.panel{background:#111;border:1px solid #333;border-radius:8px;padding:20px}
.panel h2{font-size:.9rem;margin-bottom:15px;color:#888;text-transform:uppercase;letter-spacing:2px}
input,button,textarea{width:100%;padding:10px;margin-bottom:10px;background:#000;border:1px solid #444;color:#fff;border-radius:4px;font-family:inherit}
button{background:#fff;color:#000;cursor:pointer;font-weight:bold;transition:.2s}
button:hover{background:#ccc}button:disabled{opacity:.3;cursor:not-allowed}
.account-item{padding:8px 10px;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;font-size:.85rem}
.account-list{max-height:200px;overflow-y:auto;border:1px solid #222;margin-top:10px}
input[type="checkbox"]{width:auto;margin:0 10px 0 0;cursor:pointer;accent-color:#fff}
.row{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.row label{font-size:.85rem;color:#888;white-space:nowrap}
.row input[type="number"]{width:100px;margin:0;text-align:center}
.error{color:#f00;font-size:.8rem;margin-top:5px}
.ok{color:#0f0}
textarea{resize:vertical;min-height:70px}
.thread-label{display:flex;align-items:center;width:100%;cursor:pointer}
.message-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:0.8rem}
.message-table th,.message-table td{text-align:left;padding:6px;border-bottom:1px solid #222}
.message-table th{color:#888;font-weight:normal}
.message-table tr:hover{background:#1a1a1a}
.status-success{color:#0f0}
.status-error{color:#f00}
.select-btns{display:flex;gap:10px;margin-bottom:10px}
.select-btns button{padding:5px 10px;font-size:0.8rem;margin:0;background:#333;color:#fff;border:1px solid #555}
.select-btns button:hover{background:#555}
</style>
</head>
<body>
<h1 id="title">WAZER INSTA</h1>
<div class="container">
  <div style="display:flex;flex-direction:column;gap:20px">
    <div class="panel">
      <h2>Hesap Ekle (Session ID)</h2>
      <input type="text" id="sessionInput" placeholder="sessionid yapıştır...">
      <button id="addAccountBtn">Hesap Ekle</button>
      <div id="accountError" class="error"></div>
      <div class="account-list" id="accountList"></div>
    </div>
    <div class="panel">
      <h2>Gruplar (Seç)</h2>
      <div class="select-btns">
        <button id="selectAllBtn">Tümünü Seç</button>
        <button id="deselectAllBtn">Seçimi Kaldır</button>
      </div>
      <button id="fetchThreadsBtn" disabled>Grupları Çek</button>
      <div style="max-height:200px;overflow-y:auto;border:1px solid #222;margin-top:10px" id="threadList">
        <div style="padding:10px;color:#666">Lütfen önce grupları çekin...</div>
      </div>
    </div>
  </div>

  <div style="display:flex;flex-direction:column;gap:20px">
    <div class="panel">
      <h2>Mesaj Gönder</h2>
      <div class="row">
        <label>Gecikme (sn)</label>
        <input type="number" id="delaySec" value="30" min="5">
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;margin-left:15px">
          <input type="checkbox" id="loopMode"> Sonsuz Döngü
        </label>
      </div>
      <textarea id="messageText" placeholder="Gönderilecek mesaj..."></textarea>
      <button id="sendBtn" disabled>Mesaj Gönder</button>
      <button id="stopBtn" style="background:#f00;color:#fff;display:none;">DÖNGÜYÜ DURDUR</button>
      <div id="sendStatus" class="error"></div>
    </div>

    <div class="panel">
      <h2>Mesaj Kayıtları</h2>
      <table class="message-table">
        <thead><tr><th>Grup</th><th>Thread ID</th><th>Durum</th><th>Saat</th></tr></thead>
        <tbody id="logTableBody">
          <tr><td colspan="4" style="text-align:center;color:#666">Henüz mesaj gönderilmedi.</td></tr>
        </tbody>
      </table>
    </div>
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
  btn.disabled = true; btn.textContent = 'Ekleniyor...';
  try {
    const res = await fetch('/api/add-account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionid: sid })
    });
    const data = await res.json();
    if (data.success) { document.getElementById('sessionInput').value = ''; updateAccounts(data.accounts); }
    else { errEl.textContent = data.error || 'Bilinmeyen hata'; }
  } catch (e) { errEl.textContent = 'Sunucuya ulaşılamadı: ' + e.message; }
  btn.disabled = false; btn.textContent = 'Hesap Ekle';
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

document.getElementById('selectAllBtn').addEventListener('click', () => {
  document.querySelectorAll('.thread-checkbox:not(:disabled)').forEach(cb => cb.checked = true);
});
document.getElementById('deselectAllBtn').addEventListener('click', () => {
  document.querySelectorAll('.thread-checkbox').forEach(cb => cb.checked = false);
});

document.getElementById('sendBtn').addEventListener('click', async () => {
  const text = document.getElementById('messageText').value.trim();
  if (!text) return alert('Mesaj boş olamaz');
  
  const selectedCheckboxes = document.querySelectorAll('.thread-checkbox:checked');
  const selectedThreads = Array.from(selectedCheckboxes).map(cb => ({
    threadId: cb.getAttribute('data-threadid'),
    title: cb.getAttribute('data-title'),
    account: cb.getAttribute('data-account')
  })).filter(t => t.threadId);

  if (selectedThreads.length === 0) return alert('Lütfen en az bir grup seçin');

  const delay = parseInt(document.getElementById('delaySec').value) || 30;
  const loop = document.getElementById('loopMode').checked;
  const btn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  btn.disabled = true; btn.textContent = 'Gönderiliyor...';
  if(loop) { stopBtn.style.display = 'block'; }
  document.getElementById('sendStatus').textContent = 'İşlem başlatıldı...';
  document.getElementById('logTableBody').innerHTML = '';

  try {
    const res = await fetch('/api/send-messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, delay, threads: selectedThreads, loop })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('sendStatus').textContent = loop ? '✅ Döngü tamamlandı, yeniden başlıyor...' : '✅ İşlem tamamlandı';
    } else { document.getElementById('sendStatus').textContent = '❌ ' + data.error; }
  } catch (e) { document.getElementById('sendStatus').textContent = 'Bağlantı hatası: ' + e.message; }
  
  btn.disabled = false; btn.textContent = 'Mesaj Gönder';
  stopBtn.style.display = 'none';
});

document.getElementById('stopBtn').addEventListener('click', async () => {
  await fetch('/api/stop-loop', { method: 'POST' });
  document.getElementById('sendStatus').textContent = 'Durduruluyor...';
  document.getElementById('stopBtn').style.display = 'none';
});

setInterval(async () => {
  try {
    const res = await fetch('/api/get-logs');
    const data = await res.json();
    if (data.success && data.logs) {
      const tbody = document.getElementById('logTableBody');
      if (data.logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#666">Henüz mesaj gönderilmedi.</td></tr>';
      } else {
        tbody.innerHTML = data.logs.map(log => 
          '<tr><td>' + log.title + '</td>' +
          '<td style="font-size:.75rem;color:#aaa">' + (log.threadId ? log.threadId.substring(0,10) + '...' : '-') + '</td>' +
          '<td class="' + (log.success ? 'status-success' : 'status-error') + '">' + log.status + '</td>' +
          '<td>' + log.time + '</td></tr>'
        ).join('');
      }
    }
  } catch (e) {}
}, 1000);

function updateAccounts(accounts){
  document.getElementById('accountList').innerHTML = accounts.map(a =>
    '<div class="account-item"><span>' + a.username + '</span><span class="ok">●</span></div>'
  ).join('');
  document.getElementById('fetchThreadsBtn').disabled = accounts.length === 0;
}

function renderThreads(threads){
  document.getElementById('threadList').innerHTML = threads.map(t => {
    const threadId = t.id;
    const label = threadId ? threadId.substring(0, 10) + '...' : 'Yok';
    const disabled = threadId ? '' : 'disabled';
    
    return '<div class="account-item">' +
      '<label class="thread-label">' +
        '<input type="checkbox" class="thread-checkbox" ' +
          'data-threadid="' + (threadId || '') + '" ' +
          'data-title="' + t.title + '" ' +
          'data-account="' + t.account + '" ' +
          disabled + '>' +
        '<span style="flex:1">' + t.title + ' <span style="color:#666;font-size:.7rem">(' + label + ')</span></span>' +
      '</label>' +
    '</div>';
  }).join('');
}
</script>
</body>
</html>`;

app.get('/', (req, res) => res.send(html));

const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(e => {
    console.error('API Hatası:', e.message);
    res.status(500).json({ success: false, error: e.message || 'Sunucu hatası' });
  });

// Hesap ekleme - nodejs-insta-private-api-mqt login yapısına uygun
app.post('/api/add-account', asyncHandler(async (req, res) => {
  if (!IgApiClient) return res.json({ success: false, error: 'Paket yüklenemedi. package.json kontrol edin.' });
  const { sessionid } = req.body;
  if (!sessionid || sessionid.length < 20) return res.json({ success: false, error: 'Geçersiz sessionid' });

  try {
    const ig = new IgApiClient();
    ig.state.usePresetDevice('Samsung Galaxy S25 Ultra');

    // sessionid'yi cookie olarak state'e enjekte etmeyi dene
    // Not: Bu kütüphane doğrudan sessionid kabul etmiyor, state import gerekiyor [citation:11][citation:19]
    const fakeState = {
      cookies: { sessionid: sessionid },
      device: ig.state.device,
      uuid: ig.state.uuid,
      phoneId: ig.state.phoneId,
      advertisingId: ig.state.advertisingId,
    };
    await ig.importState(JSON.stringify(fakeState));

    // Kullanıcıyı doğrula
    const user = await ig.user.info(ig.state.cookieUserId);
    const username = user.username || 'unknown';

    if (accounts.find(a => a.username === username)) {
      return res.json({ success: false, error: 'Bu hesap zaten ekli' });
    }

    accounts.push({ ig, username, sessionid });
    res.json({ success: true, accounts: accounts.map(a => ({ username: a.username })) });
  } catch (e) {
    res.json({ success: false, error: 'Giriş başarısız: ' + e.message });
  }
}));

// Grupları çek
app.get('/api/fetch-threads', asyncHandler(async (req, res) => {
  if (!accounts.length) return res.json({ success: false, error: 'Hesap yok' });
  const all = [];

  for (const acc of accounts) {
    try {
      const inbox = await acc.ig.direct.getInbox();
      const threads = inbox.threads || inbox || [];
      for (const t of threads) {
        all.push({
          id: t.thread_id || t.id,
          title: t.thread_title || 'İsimsiz Grup',
          account: acc.username
        });
      }
    } catch (e) {
      console.error('Grup çekme hatası (' + acc.username + '):', e.message);
    }
  }
  res.json({ success: true, threads: all });
}));

// Mesaj gönder - threadId ile gruba gönder
app.post('/api/send-messages', asyncHandler(async (req, res) => {
  const { text, delay, threads, loop } = req.body;
  if (!text || !text.trim()) return res.json({ success: false, error: 'Mesaj boş' });
  if (!threads || threads.length === 0) return res.json({ success: false, error: 'Seçili grup yok' });

  isSendingLoop = true;
  stopSignal = false;
  sendLogs = [];
  let totalSent = 0;

  do {
    if (stopSignal) break;

    for (const thread of threads) {
      if (stopSignal) break;

      const targetAccount = accounts.find(a => a.username === thread.account);
      if (!targetAccount || !thread.threadId) {
        sendLogs.unshift({ title: thread.title, threadId: thread.threadId || '-', success: false, status: 'Hesap/Thread ID yok', time: new Date().toLocaleTimeString() });
        continue;
      }

      try {
        // Doğru yöntem: ig.direct.sendText({ thread_ids: [threadId], text: '...' }) [citation:18]
        await targetAccount.ig.direct.sendText({
          thread_ids: [thread.threadId],
          text: text
        });

        totalSent++;
        sendLogs.unshift({ title: thread.title, threadId: thread.threadId, success: true, status: 'Gruba Gönderildi', time: new Date().toLocaleTimeString() });
      } catch (e) {
        sendLogs.unshift({ title: thread.title, threadId: thread.threadId, success: false, status: e.message, time: new Date().toLocaleTimeString() });
        console.error('[' + new Date().toLocaleTimeString() + '] Hata (' + thread.title + '):', e.message);
      }

      if (sendLogs.length > 50) sendLogs = sendLogs.slice(0, 50);
      if (!stopSignal) await new Promise(r => setTimeout(r, delay * 1000));
    }
    if (!loop) break;
  } while (isSendingLoop && !stopSignal);

  isSendingLoop = false;
  res.json({ success: true, sent: totalSent, stopped: stopSignal });
}));

app.get('/api/get-logs', (req, res) => {
  res.json({ success: true, logs: sendLogs });
});

app.post('/api/stop-loop', (req, res) => {
  stopSignal = true;
  res.json({ success: true });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('Listening on ' + PORT));