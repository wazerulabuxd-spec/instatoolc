const express = require('express');
const app = express();
app.use(express.json());

// instagrapi-js'i güvenli şekilde içe aktar
let InstagrapiClient;
try {
  ({ InstagrapiClient } = require('instagrapi-js'));
} catch (e) {
  console.error('instagrapi-js yüklenemedi:', e.message);
}

let accounts = [];
// Sunucu tarafında döngü kontrolü için global değişkenler
let isSendingLoop = false;
let stopSignal = false;

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
.account-item{padding:8px 10px;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;font-size:.85rem}
.account-item:last-child{border-bottom:none}
.account-list{max-height:200px;overflow-y:auto;border:1px solid #222;margin-top:10px}
/* Checkbox özel stili */
input[type="checkbox"]{width:auto;margin:0 10px 0 0;cursor:pointer;accent-color:#fff}
.row{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.row label{font-size:.85rem;color:#888;white-space:nowrap}
.row input[type="number"]{width:100px;margin:0;text-align:center}
.error{color:#f00;font-size:.8rem;margin-top:5px}
.ok{color:#0f0}
textarea{resize:vertical;min-height:70px}
.thread-label{display:flex;align-items:center;width:100%;cursor:pointer}
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
<h2>Gruplar (Mesaj atılacakları seç)</h2>
<button id="fetchThreadsBtn" disabled>Grupları Çek</button>
<div style="max-height:200px;overflow-y:auto;border:1px solid #222;margin:10px 0;font-size:.85rem" id="threadList">
  <div style="padding:10px;color:#666">Lütfen önce grupları çekin...</div>
</div>
</div>

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

// Hesap Ekleme
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

// Grupları Çekme
document.getElementById('fetchThreadsBtn').addEventListener('click', async () => {
  const btn = document.getElementById('fetchThreadsBtn');
  btn.disabled = true; btn.textContent = 'Çekiliyor...';
  try {
    const res = await fetch('/api/fetch-threads');
    const data = await res.json();
    if (data.success) { 
      renderThreads(data.threads); 
      document.getElementById('sendBtn').disabled = false; 
    }
    else alert(data.error);
  } catch (e) { alert('Bağlantı hatası'); }
  btn.disabled = false; btn.textContent = 'Grupları Çek';
});

// Mesaj Gönderme
document.getElementById('sendBtn').addEventListener('click', async () => {
  const text = document.getElementById('messageText').value.trim();
  if (!text) return alert('Mesaj boş olamaz');
  
  // Seçilen grupları topla
  const selected = Array.from(document.querySelectorAll('.thread-checkbox:checked')).map(cb => cb.value);
  if (selected.length === 0) return alert('Lütfen en az bir grup seçin');

  const delay = parseInt(document.getElementById('delaySec').value) || 30;
  const loop = document.getElementById('loopMode').checked;
  
  const btn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  btn.disabled = true; 
  btn.textContent = 'Gönderiliyor...';
  if(loop) { stopBtn.style.display = 'block'; }
  
  document.getElementById('sendStatus').textContent = 'İşlem başlatıldı...';

  try {
    const res = await fetch('/api/send-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, delay, threads: selected, loop })
    });
    const data = await res.json();
    
    if (data.success) {
      document.getElementById('sendStatus').textContent = loop 
        ? '✅ Döngü tamamlandı, yeniden başlıyor...' 
        : '✅ ' + data.sent + ' mesaj başarıyla gönderildi';
    } else {
      document.getElementById('sendStatus').textContent = '❌ ' + data.error;
    }
  } catch (e) { 
    document.getElementById('sendStatus').textContent = 'Bağlantı hatası: ' + e.message; 
  }
  
  btn.disabled = false; 
  btn.textContent = 'Mesaj Gönder';
  stopBtn.style.display = 'none';
});

// Durdurma Butonu
document.getElementById('stopBtn').addEventListener('click', async () => {
  await fetch('/api/stop-loop', { method: 'POST' });
  document.getElementById('sendStatus').textContent = 'Durduruluyor... (Mevcut mesajın bitmesini bekliyor)';
  document.getElementById('stopBtn').style.display = 'none';
});

// Hesap Listesi Güncelleme
function updateAccounts(accounts){
  document.getElementById('accountList').innerHTML = accounts.map(a =>
    '<div class="account-item"><span>' + a.username + '</span><span class="ok">●</span></div>'
  ).join('');
  document.getElementById('fetchThreadsBtn').disabled = accounts.length === 0;
}

// Grupları Listeleme (Checkbox ile)
function renderThreads(threads){
  document.getElementById('threadList').innerHTML = threads.map(t => 
    '<div class="account-item">' +
      '<label class="thread-label">' +
        '<input type="checkbox" class="thread-checkbox" value="' + t.id + '" checked>' +
        '<span style="flex:1">' + t.title + '</span>' +
      '</label>' +
      '<span style="color:#666;font-size:.7rem">' + t.account + '</span>' +
    '</div>'
  ).join('');
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
  if (!InstagrapiClient) return res.json({ success: false, error: 'instagrapi-js modülü yüklenemedi' });
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
  // Tüm hesapların gruplarını çek
  for (const acc of accounts) {
    try {
      const inbox = await acc.client.getDirectInbox();
      const threads = inbox.threads || inbox || [];
      for (const t of threads) {
        all.push({
          id: t.thread_id || t.id,
          title: t.thread_title || (t.users?.[0]?.username) || 'İsimsiz',
          account: acc.username
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
  if (!accounts.length) return res.json({ success: false, error: 'Hesap yok' });

  isSendingLoop = true;
  stopSignal = false;
  let totalSent = 0;

  // Sonsuz döngü mantığı
  do {
    if (stopSignal) break;

    // Seçilen her bir thread için mesaj at
    for (const threadId of threads) {
      if (stopSignal) break;

      // Hangi hesabın bu thread'e sahip olduğunu bul
      let targetAccount = null;
      for (const acc of accounts) {
        try {
          // Gelen kutusunu kontrol ederek bu thread'in hangi hesaba ait olduğunu bulabiliriz
          // Ancak daha hızlı olması için direkt tüm hesapları deneyebiliriz veya bir eşleştirme yapabiliriz.
          // Şimdilik tüm hesapları deneyelim, hata verirse geçeriz.
          await acc.client.sendDM(threadId, text);
          targetAccount = acc;
          totalSent++;
          break; // Başarılıysa bu thread için döngüden çık
        } catch (e) {
          // Eğer bu hesap gönderemiyorsa, bir sonraki hesabı dener
        }
      }

      // Eğer döngü kırılmadıysa bekle
      if (!stopSignal) {
        await new Promise(r => setTimeout(r, delay * 1000));
      }
    }
    
    // Eğer loop false ise döngüyü kır
    if (!loop) break;
    
  } while (isSendingLoop && !stopSignal);

  isSendingLoop = false;
  res.json({ success: true, sent: totalSent, stopped: stopSignal });
}));

// Döngüyü durdurma endpoint'i
app.post('/api/stop-loop', (req, res) => {
  stopSignal = true;
  res.json({ success: true });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('Listening on ' + PORT));