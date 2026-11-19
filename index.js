const express = require('express');
const app = express();
app.use(express.json());

let InstagrapiClient;
try {
  ({ InstagrapiClient } = require('instagrapi-js'));
} catch (e) {
  console.error('instagrapi-js yüklenemedi:', e.message);
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
        <thead><tr><th>Grup</th><th>Hedef</th><th>Durum</th><th>Saat</th></tr></thead>
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

document.getElementById('sendBtn').addEventListener('click', async () => {
  const text = document.getElementById('messageText').value.trim();
  if (!text) return alert('Mesaj boş olamaz');
  
  const selectedCheckboxes = document.querySelectorAll('.thread-checkbox:checked');
  const selectedThreads = Array.from(selectedCheckboxes).map(cb => ({
    recipient: cb.getAttribute('data-recipient'), // username veya pk
    title: cb.getAttribute('data-title'),
    account: cb.getAttribute('data-account')
  })).filter(t => t.recipient);

  if (selectedThreads.length === 0) return alert('Lütfen en az bir grup seçin (hedefi olan)');

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
          '<td style="font-size:.75rem;color:#aaa">' + (log.recipient || '-') + '</td>' +
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
    const recipient = t.username || t.pk;
    const label = recipient ? recipient : 'Hedef yok';
    const disabled = recipient ? '' : 'disabled';
    return '<div class="account-item">' +
      '<label class="thread-label">' +
        '<input type="checkbox" class="thread-checkbox" ' +
          'data-recipient="' + (recipient || '') + '" ' +
          'data-title="' + t.title + '" ' +
          'data-account="' + t.account + '" ' +
          (recipient ? 'checked' : disabled) + '>' +
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

app.post('/api/add-account', asyncHandler(async (req, res) => {
  if (!InstagrapiClient) return res.json({ success: false, error: 'instagrapi-js yüklenemedi' });
  const { sessionid } = req.body;
  if (!sessionid || sessionid.length < 20) return res.json({ success: false, error: 'Geçersiz sessionid' });
  
  const client = new InstagrapiClient({ sessionPath: null });
  await client.loginBySessionId(sessionid); 
  const username = client.user?.username || 'unknown';
  
  if (accounts.find(a => a.username === username)) return res.json({ success: false, error: 'Bu hesap zaten ekli' });
  
  accounts.push({ client, username });
  res.json({ success: true, accounts: accounts.map(a => ({ username: a.username })) });
}));

app.get('/api/fetch-threads', asyncHandler(async (req, res) => {
  if (!accounts.length) return res.json({ success: false, error: 'Hesap yok' });
  const all = [];
  
  for (const acc of accounts) {
    try {
      const inbox = await acc.client.getDirectInbox();
      const threads = inbox.threads || inbox || [];
      for (const t of threads) {
        // Karşı tarafın kullanıcı adını veya sayısal ID'sini al
        const users = t.users || [];
        // Kendi hesabımızı hariç tut, karşı tarafı bul
        const targetUser = users.find(u => u.username !== acc.username) || users[0];
        const username = targetUser?.username || null;
        const pk = targetUser?.pk || null;
        
        all.push({
          id: t.thread_id || t.id,
          title: t.thread_title || username || 'İsimsiz',
          account: acc.username,
          username: username, // sendDM için
          pk: pk             // username yoksa yedek
        });
      }
    } catch (e) {
      console.error('Grup çekme hatası (' + acc.username + '):', e.message);
    }
  }
  res.json({ success: true, threads: all });
}));

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
      if (!targetAccount) {
        sendLogs.unshift({ title: thread.title, recipient: thread.recipient, success: false, status: 'Hesap bulunamadı', time: new Date().toLocaleTimeString() });
        continue;
      }

      if (!thread.recipient) {
        sendLogs.unshift({ title: thread.title, recipient: '-', success: false, status: 'Hedef yok', time: new Date().toLocaleTimeString() });
        continue;
      }

      try {
        // sendDM metoduna username veya pk gönderiyoruz [citation:1]
        await targetAccount.client.sendDM(thread.recipient, text);
        totalSent++;
        sendLogs.unshift({ title: thread.title, recipient: thread.recipient, success: true, status: 'Gönderildi', time: new Date().toLocaleTimeString() });
        console.log('[' + new Date().toLocaleTimeString() + '] Başarılı: ' + thread.title + ' -> ' + thread.recipient);
      } catch (e) {
        sendLogs.unshift({ title: thread.title, recipient: thread.recipient, success: false, status: e.message, time: new Date().toLocaleTimeString() });
        console.error('[' + new Date().toLocaleTimeString() + '] Hata (' + thread.title + '):', e.message);
      }

      if (sendLogs.length > 50) sendLogs = sendLogs.slice(0, 50);

      if (!stopSignal) {
        await new Promise(r => setTimeout(r, delay * 1000));
      }
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