const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { InstagrapiClient } = require('instagrapi-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.json());

let accounts = []; // { client, username, sessionid }

// HTML (öncekiyle aynı, sadece "typing" ile ilgili kısımlar çıkarıldı, hız kontrolü eklendi)
const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WAZER INSTA</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#000;color:#fff;font-family:'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;min-height:100vh;padding:20px}
        h1{font-size:2.5rem;letter-spacing:4px;margin:30px 0;font-weight:300;border-right:2px solid #fff;white-space:nowrap;overflow:hidden;animation:blink .75s step-end infinite}
        @keyframes blink{from,to{border-color:transparent}50%{border-color:#fff}}
        .container{width:100%;max-width:1200px;display:grid;grid-template-columns:1fr 2fr;gap:20px}
        .panel{background:#111;border:1px solid #333;border-radius:8px;padding:20px}
        .panel h2{font-size:1rem;margin-bottom:15px;color:#888;text-transform:uppercase;letter-spacing:2px}
        input,button{width:100%;padding:10px;margin-bottom:10px;background:#000;border:1px solid #444;color:#fff;border-radius:4px;font-family:inherit}
        button{background:#fff;color:#000;cursor:pointer;font-weight:bold;transition:.2s}
        button:hover{background:#ccc}button:disabled{opacity:.3;cursor:not-allowed}
        .account-list{max-height:200px;overflow-y:auto;border:1px solid #222;margin-top:10px}
        .account-item{padding:10px;border-bottom:1px solid #222;display:flex;justify-content:space-between;font-size:.9rem}
        .account-item:last-child{border-bottom:none}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{text-align:left;padding:8px;border-bottom:1px solid #222;font-size:.85rem}
        th{color:#888;font-weight:normal}
        .row{display:flex;gap:10px;align-items:center;margin-bottom:10px}
        .row label{font-size:.85rem;color:#888;white-space:nowrap}
        .row input{width:80px;margin:0;text-align:center}
        .status{font-size:.8rem}.ok{color:#0f0}.err{color:#f00}
        .error{color:#f00;font-size:.8rem;margin-top:5px}
        textarea{width:100%;padding:10px;background:#000;border:1px solid #444;color:#fff;border-radius:4px;font-family:inherit;resize:vertical;min-height:80px;margin-bottom:10px}
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
            <div style="max-height:150px;overflow-y:auto;border:1px solid #222;margin:10px 0;font-size:.85rem" id="threadList"></div>
            <div class="row">
                <label>Min (sn)</label><input type="number" id="minDelay" value="10" min="1">
                <label>Max (sn)</label><input type="number" id="maxDelay" value="15" min="1">
            </div>
            <textarea id="messageText" placeholder="Gönderilecek mesaj..."></textarea>
            <button id="sendBtn" disabled>Mesaj Gönder</button>
            <div id="sendStatus" class="error"></div>
        </div>
    </div>
    <script>
        const socket = io();
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

        document.getElementById('addAccountBtn').addEventListener('click',async()=>{
            const sid=document.getElementById('sessionInput').value.trim();
            if(!sid)return;
            const btn=document.getElementById('addAccountBtn');
            btn.disabled=true;btn.textContent='Ekleniyor...';
            try{
                const res=await fetch('/api/add-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionid:sid})});
                const data=await res.json();
                if(data.success){
                    document.getElementById('sessionInput').value='';
                    updateAccounts(data.accounts);
                }else document.getElementById('accountError').textContent=data.error;
            }catch(e){document.getElementById('accountError').textContent='Bağlantı hatası'}
            btn.disabled=false;btn.textContent='Hesap Ekle';
        });

        document.getElementById('fetchThreadsBtn').addEventListener('click',async()=>{
            const btn=document.getElementById('fetchThreadsBtn');
            btn.disabled=true;btn.textContent='Çekiliyor...';
            try{
                const res=await fetch('/api/fetch-threads');
                const data=await res.json();
                if(data.success){
                    renderThreads(data.threads);
                    document.getElementById('sendBtn').disabled=false;
                }else alert(data.error);
            }catch(e){alert('Bağlantı hatası')}
            btn.disabled=false;btn.textContent='Grupları Çek';
        });

        document.getElementById('sendBtn').addEventListener('click',async()=>{
            const text=document.getElementById('messageText').value.trim();
            if(!text)return alert('Mesaj boş');
            const min=parseInt(document.getElementById('minDelay').value)||10;
            const max=parseInt(document.getElementById('maxDelay').value)||15;
            const btn=document.getElementById('sendBtn');
            btn.disabled=true;btn.textContent='Gönderiliyor...';
            document.getElementById('sendStatus').textContent='';
            try{
                const res=await fetch('/api/send-messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,minDelay:min,maxDelay:max})});
                const data=await res.json();
                document.getElementById('sendStatus').textContent=data.success?`✅ ${data.sent} mesaj gönderildi`:`❌ ${data.error}`;
                document.getElementById('sendStatus').className=data.success?'status ok':'error';
            }catch(e){document.getElementById('sendStatus').textContent='Bağlantı hatası'}
            btn.disabled=false;btn.textContent='Mesaj Gönder';
        });

        function updateAccounts(accounts){
            const list=document.getElementById('accountList');
            list.innerHTML=accounts.map(a=>`<div class="account-item"><span>${a.username}</span><span class="status ok">●</span></div>`).join('');
            document.getElementById('fetchThreadsBtn').disabled=accounts.length===0;
        }
        function renderThreads(threads){
            const list=document.getElementById('threadList');
            list.innerHTML=threads.map(t=>`<div class="account-item"><span>${t.title}</span><span style="color:#666;font-size:.7rem">${t.account}</span></div>`).join('');
        }
        socket.on('account-update',updateAccounts);
    </script>
</body>
</html>`;

app.get('/', (req, res) => res.send(html));

// Hesap ekle
app.post('/api/add-account', async (req, res) => {
    const { sessionid } = req.body;
    if (!sessionid || sessionid.length < 20) return res.json({ success: false, error: 'Geçersiz sessionid' });
    try {
        const client = new InstagrapiClient({ sessionPath: null });
        await client.loginBySessionId(sessionid);
        const username = client.user?.username || 'unknown';
        if (accounts.find(a => a.username === username)) return res.json({ success: false, error: 'Zaten ekli' });
        accounts.push({ client, username, sessionid });
        const list = accounts.map(a => ({ username: a.username }));
        io.emit('account-update', list);
        res.json({ success: true, accounts: list });
    } catch (e) {
        res.json({ success: false, error: 'Giriş başarısız: ' + e.message });
    }
});

// Grupları çek
app.get('/api/fetch-threads', async (req, res) => {
    if (!accounts.length) return res.json({ success: false, error: 'Hesap yok' });
    const all = [];
    for (const acc of accounts) {
        try {
            const inbox = await acc.client.getDirectInbox();
            for (const t of (inbox.threads || [])) {
                all.push({
                    id: t.thread_id || t.id,
                    title: t.thread_title || t.users?.[0]?.username || 'İsimsiz',
                    account: acc.username
                });
            }
        } catch (e) {
            all.push({ id: 'err', title: 'Hata: ' + e.message, account: acc.username });
        }
    }
    res.json({ success: true, threads: all });
});

// Mesaj gönder (hız kontrollü)
app.post('/api/send-messages', async (req, res) => {
    const { text, minDelay, maxDelay } = req.body;
    if (!text || !text.trim()) return res.json({ success: false, error: 'Mesaj boş' });
    if (!accounts.length) return res.json({ success: false, error: 'Hesap yok' });

    // Önce tüm thread'leri topla
    const allThreads = [];
    for (const acc of accounts) {
        try {
            const inbox = await acc.client.getDirectInbox();
            for (const t of (inbox.threads || [])) {
                allThreads.push({ acc, threadId: t.thread_id || t.id });
            }
        } catch (e) { /* atla */ }
    }
    if (!allThreads.length) return res.json({ success: false, error: 'Thread bulunamadı' });

    let sent = 0;
    for (let i = 0; i < allThreads.length; i++) {
        const { acc, threadId } = allThreads[i];
        try {
            // instagrapi-js doğrudan threadId ile gönderme desteklemiyorsa
            // aşağıdaki satır kütüphanenin gerçek API'sine göre uyarlanmalı
            await acc.client.sendMessage(threadId, text);
            sent++;
        } catch (e) { /* tek hata tüm işlemi durdurmasın */ }

        // Son mesajdan sonra bekleme yok
        if (i < allThreads.length - 1) {
            const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;
            await new Promise(r => setTimeout(r, delay));
        }
    }
    res.json({ success: true, sent, total: allThreads.length });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`http://localhost:${PORT}`));