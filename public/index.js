<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>HD Upscaler by Ningen</title>
<style>
:root{--bg:#fffaee;--ink:#111;--card:#fff;--mut:#555;--tsh:#111;--yellow:#ffe94d;--blue:#3d5afe;--red:#ff5c7a}
:root[data-theme=dark]{--bg:#15130e;--ink:#f5f1e6;--card:#201d15;--mut:#b8b2a2;--tsh:#000}
*{box-sizing:border-box;margin:0}
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;padding:env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0)}
.wrap{max-width:640px;margin:0 auto;padding:64px 16px 48px}
#theme{position:fixed;top:calc(12px + env(safe-area-inset-top,0px));left:12px;z-index:5;width:46px;height:46px;border-radius:50%;border:3px solid var(--ink);background:var(--yellow);font-size:1.2rem;cursor:pointer;box-shadow:3px 3px 0 var(--ink)}
.title{display:block;text-align:center;font-size:clamp(2rem,10vw,3rem);font-weight:900;letter-spacing:-.02em;line-height:1.1;margin-bottom:6px;background:linear-gradient(90deg,#6d83ff,#c084fc,#ff6fa5,#ffb347,#4fe3f5,#6d83ff);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(2px 2px 0 var(--tsh)) drop-shadow(0 0 6px rgba(192,132,252,.7));animation:flow 5s linear infinite,pulse 1.8s ease-in-out infinite}
@keyframes flow{to{background-position:300% 50%}}
@keyframes pulse{0%,100%{filter:drop-shadow(2px 2px 0 var(--tsh)) drop-shadow(0 0 4px rgba(192,132,252,.5))}50%{filter:drop-shadow(2px 2px 0 var(--tsh)) drop-shadow(0 0 16px rgba(255,111,165,.95)) drop-shadow(0 0 28px rgba(61,90,254,.8))}}
@media (prefers-reduced-motion:reduce){.title{animation:none}}
.sub{text-align:center;color:var(--mut);margin-bottom:22px}
.card{background:var(--card);border:3px solid var(--ink);border-radius:26px;padding:20px;box-shadow:6px 6px 0 var(--ink);margin-bottom:20px}
.drop{display:block;text-align:center;padding:34px 16px;border:3px dashed var(--ink);border-radius:18px;cursor:pointer;font-weight:700}
.drop img{max-width:100%;max-height:260px;border-radius:12px;display:block;margin:0 auto 10px}
.chips{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}
.chip{font:inherit;font-weight:800;color:var(--ink);border:3px solid var(--ink);border-radius:999px;padding:6px 18px;background:var(--card);cursor:pointer}
.chip.on{background:var(--yellow);color:#111;box-shadow:3px 3px 0 var(--ink)}
.btn{width:100%;font:inherit;font-weight:800;font-size:1.05rem;color:#fff;background:var(--blue);border:3px solid var(--ink);border-radius:18px;padding:14px;cursor:pointer;box-shadow:4px 4px 0 var(--ink)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn.dl{background:var(--yellow);color:#111;display:block;text-align:center;text-decoration:none;margin-top:14px}
.bar{height:16px;border:3px solid var(--ink);border-radius:999px;overflow:hidden;margin-top:14px;display:none}
.bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#6d83ff,#ff6fa5);transition:width .4s}
.msg{margin-top:12px;font-weight:700;text-align:center}
.msg.err{color:var(--red)}
#out{display:none}
#out img{width:100%;border-radius:14px;border:3px solid var(--ink)}
</style>
</head>
<body>
<button id="theme" aria-label="Ganti tema">🌙</button>
<div class="wrap">
  <h1 class="title">HD Upscaler</h1>
  <p class="sub">by Ningen · perbesar dan pertajam gambar dengan AI</p>

  <div class="card">
    <label class="drop" id="drop" for="file">
      <span id="hint">Ketuk untuk pilih gambar<br><small>JPG, PNG, WEBP · gambar besar dikecilkan otomatis</small></span>
    </label>
    <input type="file" id="file" accept="image/jpeg,image/png,image/webp" hidden>
    <div class="chips" id="chips"></div>
    <button class="btn" id="go" disabled>Tingkatkan Kualitas</button>
    <div class="bar" id="bar"><i id="fill"></i></div>
    <div class="msg" id="msg"></div>
  </div>

  <div class="card" id="out">
    <img id="res" alt="Hasil upscale">
    <a class="btn dl" id="dl" href="#">Unduh Hasil</a>
  </div>
</div>

<script>
const $=id=>document.getElementById(id);
let file=null, scale=4, timer=null, resultUrl=null;
const MAX_BYTES=2.4*1024*1024;

const root=document.documentElement;
function setTheme(t){root.dataset.theme=t;$('theme').textContent=t==='dark'?'\u2600\ufe0f':'\ud83c\udf19';try{localStorage.setItem('theme',t)}catch(e){}}
let saved=null;try{saved=localStorage.getItem('theme')}catch(e){}
setTheme(saved||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'));
$('theme').onclick=()=>setTheme(root.dataset.theme==='dark'?'light':'dark');

[2,4,8,16].forEach(s=>{
  const b=document.createElement('button');b.className='chip'+(s===scale?' on':'');b.textContent=s+'x';
  b.onclick=()=>{scale=s;[...$('chips').children].forEach(c=>c.classList.toggle('on',c===b))};
  $('chips').append(b);
});

$('file').onchange=e=>{
  file=e.target.files[0]||null;
  $('go').disabled=!file;$('out').style.display='none';setMsg('');
  if(!file)return;
  const h=$('drop');h.replaceChildren();
  const img=document.createElement('img');img.src=URL.createObjectURL(file);
  const t=document.createElement('span');t.textContent=file.name;
  h.append(img,t);
};

function setMsg(t,err){$('msg').textContent=t;$('msg').className='msg'+(err?' err':'')}
function busy(on){$('go').disabled=on||!file;$('bar').style.display=on?'block':'none'}

// Vercel membatasi body ~4,5 MB, jadi gambar besar dikecilkan dulu di browser
async function prepare(f){
  if(f.size<=MAX_BYTES)return {blob:f,mime:f.type};
  const bmp=await createImageBitmap(f);
  let w=bmp.width,h=bmp.height,max=Math.max(w,h);
  for(let dim=Math.min(max,3000);dim>=600;dim=Math.floor(dim*0.8)){
    const k=dim/max,c=document.createElement('canvas');
    c.width=Math.round(w*k);c.height=Math.round(h*k);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    for(const q of [0.92,0.85,0.75]){
      const b=await new Promise(r=>c.toBlob(r,'image/jpeg',q));
      if(b&&b.size<=MAX_BYTES)return {blob:b,mime:'image/jpeg'};
    }
  }
  throw new Error('Gambar terlalu besar untuk diproses.');
}
function toBase64(blob){
  return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]);r.onerror=no;r.readAsDataURL(blob)});
}

$('go').onclick=async()=>{
  if(!file)return;
  busy(true);$('fill').style.width='5%';setMsg('Menyiapkan gambar\u2026');$('out').style.display='none';
  try{
    const p=await prepare(file);
    setMsg('Mengunggah\u2026');
    const data=await toBase64(p.blob);
    const r=await fetch('/api/upscale',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({filename:file.name,mime:p.mime,scale,data})});
    let d={};try{d=await r.json()}catch(e){}
    if(!r.ok)throw new Error(d.error||(r.status===413?'Gambar terlalu besar.':'Gagal ('+r.status+')'));
    poll(d.taskId);
  }catch(e){busy(false);setMsg(e.message,true)}
};

function poll(id){
  clearInterval(timer);
  let tries=0,inflight=false;
  timer=setInterval(async()=>{
    if(inflight)return;inflight=true;
    try{
      if(++tries>90)throw new Error('Terlalu lama, coba lagi.');
      const r=await fetch('/api/status?id='+encodeURIComponent(id));
      const d=await r.json();
      if(!r.ok)return; // coba lagi di putaran berikutnya
      if(d.state==='processing'){
        $('fill').style.width=Math.max(10,Math.min(95,d.progress||10))+'%';
        setMsg('Memproses\u2026 '+(d.progress||0)+'%');
      }else if(d.state==='done'&&d.url){
        clearInterval(timer);busy(false);$('fill').style.width='100%';setMsg('Selesai!');
        resultUrl=d.url;$('res').src=d.url;$('out').style.display='block';$('out').scrollIntoView({behavior:'smooth'});
      }else if(d.state==='failed')throw new Error(d.error||'Proses gagal');
    }catch(e){clearInterval(timer);busy(false);setMsg(e.message,true)}
    finally{inflight=false}
  },3000);
}

$('dl').onclick=async e=>{
  e.preventDefault();if(!resultUrl)return;
  const name='hd_'+scale+'x_'+file.name.replace(/\.\w+$/,'')+'.png';
  try{
    const b=await (await fetch(resultUrl)).blob();
    const u=URL.createObjectURL(b),a=document.createElement('a');
    a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
  }catch(err){window.open(resultUrl,'_blank')} // fallback: buka gambar, tahan lalu simpan
};
</script>
</body>
</html>
                                                                                                                                  
