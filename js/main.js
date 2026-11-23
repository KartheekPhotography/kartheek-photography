const $=s=>document.querySelector(s);
/* Gallery categories. Folder for each album: src/gallery/<id>/carousel-1, carousel-2, ...
   Add or rename albums by editing the subs list (one title per carousel folder). */
const CATS=[
 {id:'weddings',title:'Weddings',subs:['Wedding story 1','Wedding story 2','Wedding story 3','Wedding story 4','Wedding story 5','Wedding story 6']},
 {id:'pre-weddings',title:'Pre-weddings',subs:['Pre-wedding 1','Pre-wedding 2','Pre-wedding 3','Pre-wedding 4','Pre-wedding 5']},
 {id:'engagement',title:'Engagement',subs:['Engagement 1','Engagement 2','Engagement 3','Engagement 4','Engagement 5']},
 {id:'haldi',title:'Haldi',subs:['Haldi 1','Haldi 2','Haldi 3','Haldi 4','Haldi 5']},
 {id:'sangeeth',title:'Sangeeth',subs:['Sangeeth 1','Sangeeth 2','Sangeeth 3','Sangeeth 4','Sangeeth 5']},
 {id:'mahendi',title:'Mahendi',subs:['Mahendi 1','Mahendi 2','Mahendi 3','Mahendi 4','Mahendi 5']}
];
/* Finds photos named 01, 02, 03... (jpg, jpeg, png or webp) in a folder. Stops at the first missing number. */
const EXT=['jpg','jpeg','png','webp'];
/* Checks whether a file exists WITHOUT downloading it (a tiny HEAD request). When the page is opened as a local file it falls back to loading the image. */
const probe=async u=>{try{const r=await fetch(u,{method:'HEAD'});return r.ok}catch(e){return new Promise(res=>{const i=new Image();i.onload=()=>res(true);i.onerror=()=>res(false);i.src=u})}};
async function findImages(folder){const out=[];for(let n=1;n<=60;n++){const nn=String(n).padStart(2,'0');let f=null;
 for(const e of EXT){const u=`${folder}/${nn}.${e}`;if(await probe(u)){f=u;break}}if(!f)break;out.push(f)}return out}
/* auto-changing carousel with arrows, clickable dots and swipe.
   Speed-ups: a carousel loads nothing until it is on screen, then loads only its first photo, and each next photo is loaded just before it is shown. */
function carousel(root,urls,o={}){
 const N=urls.length;let cu=0,timer,sx=null,hov=false,dead=false,vis=false,started=false,io;
 root.innerHTML='<div class="car"><div class="sls"></div><button class="ar l" aria-label="Previous photo">‹</button><button class="ar r" aria-label="Next photo">›</button></div><div class="dots"></div>';
 const car=root.querySelector('.car'),box=root.querySelector('.sls'),dots=root.querySelector('.dots'),slides=[];
 urls.forEach((u,i)=>{const d=document.createElement('div');d.className='slide';box.appendChild(d);slides.push(d);
  const b=document.createElement('button');b.setAttribute('aria-label','Show photo '+(i+1));b.onclick=()=>go(i);dots.appendChild(b)});
 const load=i=>{const d=slides[i];if(d&&!d.style.backgroundImage)d.style.backgroundImage=`url("${urls[i]}")`};
 function play(){clearInterval(timer);if(!dead&&N>1&&!matchMedia('(prefers-reduced-motion:reduce)').matches)timer=setInterval(()=>{if(!document.hidden&&!hov&&vis)go(cu+1)},o.interval||5000)}
 function go(n,quiet){cu=(n+N)%N;load(cu);load((cu+1)%N);[...box.children].forEach((d,i)=>d.classList.toggle('on',i===cu));[...dots.children].forEach((d,i)=>d.classList.toggle('on',i===cu));if(!quiet)play()}
 root.querySelector('.l').onclick=()=>go(cu-1);root.querySelector('.r').onclick=()=>go(cu+1);
 car.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')hov=true});car.addEventListener('pointerleave',()=>hov=false);
 car.addEventListener('pointerdown',e=>{sx=e.clientX});
 car.addEventListener('pointerup',e=>{if(sx===null)return;const dx=e.clientX-sx;sx=null;
  if(Math.abs(dx)>50)go(cu+(dx<0?1:-1));else if(o.open&&!e.target.closest('button'))o.open(urls,cu)});
 /* wait for the first photo, then start from the zoomed-out state so it fades and zooms in */
 const start=()=>{if(started||dead)return;started=true;const im=new Image();
  im.onload=im.onerror=()=>{load(0);requestAnimationFrame(()=>requestAnimationFrame(()=>{if(dead)return;go(0,true);setTimeout(play,o.delay||0)}))};im.src=urls[0]};
 if('IntersectionObserver' in window){io=new IntersectionObserver(es=>{vis=es[es.length-1].isIntersecting;if(vis)start()},{rootMargin:'200px'});io.observe(root)}else{vis=true;start()}
 return()=>{dead=true;clearInterval(timer);if(io)io.disconnect()}}
/* main carousel */
findImages('src/carousel').then(u=>{if(u.length)carousel($('#heroCar'),u,{interval:3500}) /* main carousel: milliseconds between photos (3500 = 3.5 seconds) */;else $('#heroCar').innerHTML='<p class="empty">Add photos named 01.jpg, 02.jpg... to src/carousel</p>'});
/* headline focus lens */
const hl=$('#hl'),cur=$('#cur');let moved=false;
function lens(x,y){const r=hl.getBoundingClientRect();hl.style.setProperty('--x',(x-r.left)+'px');hl.style.setProperty('--y',(y-r.top)+'px')}
addEventListener('pointermove',e=>{cur.style.transform=`translate(${e.clientX}px,${e.clientY}px)`;
 const r=hl.getBoundingClientRect(),p=70,inH=e.clientX>=r.left-p&&e.clientX<=r.right+p&&e.clientY>=r.top-p&&e.clientY<=r.bottom+p;
 const mouse=e.pointerType==='mouse',show=mouse&&(inH||!!e.target.closest('.car'));
 cur.classList.toggle('show',show);document.body.classList.toggle('nc',show);
 cur.classList.toggle('lens',inH&&mouse);if(inH){moved=true;lens(e.clientX,e.clientY)}},{passive:true});
document.documentElement.addEventListener('mouseleave',()=>{cur.classList.remove('show');document.body.classList.remove('nc')});
hl.addEventListener('pointerdown',e=>{moved=true;lens(e.clientX,e.clientY)});
if(matchMedia('(pointer:coarse)').matches)$('#hint').textContent='Wedding photography and films from Hyderabad. Touch and drag over the headline to bring it into focus.';
(function loop(t){if(!moved){const r=hl.getBoundingClientRect();hl.style.setProperty('--x',(r.width*.5+Math.sin(t/1100)*r.width*.4)+'px');hl.style.setProperty('--y',(r.height*.5+Math.cos(t/800)*r.height*.15)+'px')}requestAnimationFrame(loop)})(0);
document.addEventListener('pointerover',e=>{cur.classList.toggle('big',!!e.target.closest('a,button,.card,.chip,.dots button,.opt,select,.consent'))});
const words=['Some moments are too precious to fade, some emotions too beautiful to express, and every love story deserves to be remembered forever.'];
$('#mq').innerHTML=[...words,...words].map(w=>`<span>${w}</span>`).join('<span></span>');
/* scrolling rows: boxes are centred when they fit; arrows appear on the sides when there are more boxes than fit */
function rail(root){const tr=root.querySelector('.track'),l=root.querySelector('.rarr.l'),r=root.querySelector('.rarr.r');
 const upd=()=>{l.hidden=tr.scrollLeft<6;r.hidden=tr.scrollLeft+tr.clientWidth>=tr.scrollWidth-6};
 const step=()=>{const c=tr.children[0];return Math.max(1,Math.floor(tr.clientWidth/((c?c.getBoundingClientRect().width:300)+18)))*((tr.children[0]?tr.children[0].getBoundingClientRect().width:300)+18)};
 l.onclick=()=>tr.scrollBy({left:-step(),behavior:'smooth'});r.onclick=()=>tr.scrollBy({left:step(),behavior:'smooth'});
 tr.addEventListener('scroll',upd,{passive:true});addEventListener('resize',upd);
 new MutationObserver(()=>{tr.scrollLeft=0;upd()}).observe(tr,{childList:true});
 if(window.ResizeObserver)new ResizeObserver(upd).observe(tr);
 upd()}
/* gallery categories, each with several auto-changing carousels */
let stops=[];
$('#tabs').innerHTML=CATS.map((c,i)=>`<button class="chip${i?'':' on'}" data-i="${i}">${c.title}</button>`).join('');
function showCat(i){stops.forEach(f=>f());stops=[];const c=CATS[i];
 $('#subs').innerHTML=c.subs.map((t,k)=>`<div class="sub"><h3>${t}</h3><div class="carousel" id="sc${k}"><p class="empty">Loading…</p></div></div>`).join('');
 c.subs.forEach((t,k)=>{const folder=`src/gallery/${c.id}/carousel-${k+1}`,el=$('#sc'+k);
  findImages(folder).then(u=>{if(!document.body.contains(el))return;
   if(!u.length){el.innerHTML=`<p class="empty">Add photos named 01.jpg, 02.jpg... to ${folder}</p>`;return}
   stops.push(carousel(el,u,{interval:4200,delay:k*1300,open:openLB}))})})}
$('#tabs').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;document.querySelectorAll('#tabs .chip').forEach(x=>x.classList.toggle('on',x===b));showCat(+b.dataset.i)};
showCat(0);rail($('#subsRail'));
/* FILMS. To add a film: add one line to the right list below.
   id = YouTube link or the 11-character video ID.
   Thumbnails come from the numbered images in the folder of that category:
     the 1st film uses 01.jpg, the 2nd uses 02.jpg, and so on (jpg, jpeg, png or webp, 16:9 such as 1280 x 720).
     If an image is missing, YouTube's own thumbnail is used instead.
   Optional: thumb:'path/to/image.jpg' to use a different image for one film.
   To add a new category, add a block {title, folder, videos:[...]} and create src/films/<folder>/. */
const FILMS=[
 {title:'Wedding films',folder:'wedding-films',videos:[
   {id:'https://youtu.be/Ec_4JnoCcRI',title:'Santosh & Yanvita',tag:'Visakhapatnam'},
   {id:'https://youtu.be/RRbdhcJasiA',title:'Vikram & Sri Lekha',tag:'Hyderabad'},
   {id:'https://youtu.be/Ra5dnigt2kQ',title:'Jaikanth & Manasa',tag:'Rajahmundry'},
   {id:'https://youtu.be/oUmAgI-SpA4',title:'Sravan & Renuka',tag:'Annavaram'},
   {id:'https://youtu.be/NWULlW78itM',title:'Sai & Geetha',tag:'Wedding film'},
   {id:'https://youtu.be/PqKYrMFVWmY',title:'Wedding film 3',tag:'Wedding film'},
   {id:'https://youtu.be/J1ZaP93LsHI',title:'Wedding film 3',tag:'Wedding film'},
 ]},
 {title:'Pre-wedding films',folder:'pre-wedding-films',videos:[
  {id:'https://youtu.be/aqz-KE-bpKQ',title:'Pre-wedding film 1',tag:'Sample video'},
  {id:'https://youtu.be/eRsGyueVLvQ',title:'Pre-wedding film 2',tag:'Sample video'},
  {id:'https://youtu.be/R6MlUcmOul8',title:'Pre-wedding film 3',tag:'Sample video'}
 ]}
];
const ytId=v=>{const m=String(v).match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);return m?m[1]:String(v).trim()};
function thumbList(c,v,i){const id=ytId(v.id),nn=String(i+1).padStart(2,'0');
 return [...(v.thumb?[v.thumb]:[]),...['jpg','jpeg','png','webp'].map(e=>`src/films/${c.folder}/${nn}.${e}`),`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,`https://i.ytimg.com/vi/${id}/hqdefault.jpg`]}
$('#filmSections').innerHTML=FILMS.map((c,ci)=>`<div class="fcat"><h2>${c.title}</h2>${ci?'':'<p class="sub">Tap a film to watch it right here.</p>'}<div class="rail"><button type="button" class="rarr l" aria-label="Previous films" hidden>‹</button><div class="films track">${c.videos.map((v,i)=>
 `<button class="vid" data-c="${ci}" data-i="${i}" aria-label="Play ${v.title}"><img loading="lazy" alt="" data-n="0" data-s='${JSON.stringify(thumbList(c,v,i))}'><span class="pl"></span><span class="meta"><h3>${v.title}</h3><small>${v.tag||''}</small></span></button>`).join('')}</div><button type="button" class="rarr r" aria-label="Next films" hidden>›</button></div></div>`).join('');
$('#filmSections').querySelectorAll('.rail').forEach(rail);
$('#filmSections').querySelectorAll('img').forEach(img=>{const s=JSON.parse(img.dataset.s);
 const next=()=>{const n=+img.dataset.n;if(n<s.length){img.dataset.n=n+1;img.src=s[n]}else img.style.display='none'};
 img.addEventListener('error',next);next()});
function openVB(c,i){const v=FILMS[c].videos[i];$('#vt').textContent=v.title;
 const id=ytId(v.id);
 /* same format as YouTube's own "Embed" code (including referrerpolicy, which stops Error 153) */
 $('#vframe').innerHTML=`<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1" title="${v.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
 $('#vyt').href=`https://www.youtube.com/watch?v=${id}`;$('#vb').classList.add('open')}
function closeVB(){$('#vb').classList.remove('open');$('#vframe').innerHTML=''}
$('#filmSections').onclick=e=>{const b=e.target.closest('.vid');if(b)openVB(+b.dataset.c,+b.dataset.i)};
$('#vclose').onclick=closeVB;$('#vb').addEventListener('click',e=>{if(e.target.id==='vb')closeVB()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#vb').classList.contains('open'))closeVB()});
/* lightbox */
let LB={urls:[],i:0};
function showLB(){LB.i=(LB.i+LB.urls.length)%LB.urls.length;$('#lbart').style.backgroundImage=`url("${LB.urls[LB.i]}")`}
function openLB(urls,i){LB={urls,i};showLB();$('#lb').classList.add('open')}
$('#close').onclick=()=>$('#lb').classList.remove('open');
$('#prev').onclick=()=>{LB.i--;showLB()};$('#next').onclick=()=>{LB.i++;showLB()};
addEventListener('keydown',e=>{if(!$('#lb').classList.contains('open'))return;if(e.key==='Escape')$('#close').click();if(e.key==='ArrowRight')$('#next').click();if(e.key==='ArrowLeft')$('#prev').click()});
/* enquiry form (posts to Netlify Forms) */
const F=$('#enqForm'),evs=[...F.querySelectorAll('input[name=events]')],panels=[...F.querySelectorAll('.panel')],send=$('#send');
const pw=evs.find(i=>i.dataset.k==='prewedding'),haldi=F.querySelector('.panel[data-k=haldi]');
let autoPre=false;
$('#date').min=new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
const pick=n=>{const r=F.querySelector(`input[name=${n}]:checked`);return r?r.value:''};
function fmt(d){return d?new Date(d+'T00:00').toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}):''}
const detail={engagement:()=>pick('engagement_coverage'),prewedding:()=>pick('prewedding_type'),haldi:()=>[...haldi.querySelectorAll('input:checked')].map(i=>i.value).join(' + '),sangeeth:()=>pick('sangeeth_coverage'),reception:()=>pick('reception_coverage'),albums:()=>pick('album_sheets')};
function sync(){
 const sv=F.service.value,wed=sv==='Wedding'||sv==='Wedding and Pre-wedding',pre=sv==='Pre-wedding';
 $('#evBox').hidden=!wed;evs.forEach(i=>i.disabled=!wed);
 const lock=sv==='Wedding and Pre-wedding';
 if(lock){pw.checked=true;autoPre=true}else if(autoPre){pw.checked=false;autoPre=false}
 pw.closest('.opt').classList.toggle('locked',lock);
 panels.forEach(p=>{const k=p.dataset.k,show=pre?k==='prewedding':wed&&evs.some(i=>i.dataset.k===k&&i.checked);p.hidden=!show;p.querySelectorAll('input').forEach(i=>i.disabled=!show)});
 if(!haldi.hidden){const [b,g,c]=haldi.querySelectorAll('input');c.disabled=b.checked||g.checked;b.disabled=g.disabled=c.checked;
  b.setCustomValidity([b,g,c].some(i=>i.checked)?'':'Please choose Bride, Groom, both, or Couple.')}
 evs[0].setCustomValidity(wed&&!evs.some(i=>i.checked)?'Please choose at least one event.':'');
 const parts=pre?[['Pre-wedding',detail.prewedding()]]:wed?evs.filter(i=>i.checked).map(i=>[i.value,(detail[i.dataset.k]||(()=>''))()]):[];
 const ev=parts.map(([n,d])=>d?`${n} (${d})`:n).join(', ');
 $('#summary').value=`${sv}: ${ev||'-'}`;
 send.disabled=!$('#consent').checked;$('#err').textContent='';
}
F.addEventListener('input',sync);F.addEventListener('change',sync);
F.addEventListener('submit',async e=>{e.preventDefault();sync();
 if(!F.checkValidity()){F.reportValidity();return}
 send.disabled=true;send.textContent='Sending…';
 try{const r=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(F)).toString()});
  if(!r.ok)throw 0;
  const n=F.name.value.trim().split(' ')[0];$('#dname').textContent=n?', '+n:'';
  F.hidden=true;$('#done').hidden=false;$('#done').scrollIntoView({behavior:'smooth',block:'center'})}
 catch(_){$('#err').textContent='Sorry, that did not go through. Please try again in a moment.';send.textContent='Send enquiry';send.disabled=false}});
sync();