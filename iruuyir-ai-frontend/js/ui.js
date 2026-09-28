const UI=(()=>{
const p=n=>String(n).padStart(2,'0');
const isoDate=d=>`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=iso=>iso?new Date(iso+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';
const fmtTime=t=>{if(!t)return '';const[h,m]=t.split(':').map(Number);return `${h%12||12}:${p(m)} ${h<12?'AM':'PM'}`};
const rc=r=>r?'r-'+r.toLowerCase():'r-none';
const badge=r=>`<span class="badge ${rc(r)}">${r||'NOT ASSESSED'}</span>`;
function toast(msg,type){const t=document.createElement('div');t.className='toast '+(type||'');t.textContent=msg;document.getElementById('toasts').appendChild(t);setTimeout(()=>t.remove(),3200)}
function busy(btn,on,label){if(on){btn.dataset.l=btn.innerHTML;btn.classList.add('loading');btn.innerHTML=`<span class="spinner"></span> ${label||'Please wait'}`}else{btn.classList.remove('loading');btn.innerHTML=btn.dataset.l}}
function modal(html){const b=document.createElement('div');b.className='modal-backdrop';b.innerHTML=`<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
const k=e=>e.key==='Escape'&&close();const close=()=>{b.style.opacity=0;setTimeout(()=>b.remove(),150);document.removeEventListener('keydown',k)};
b.onclick=e=>{if(e.target===b)close()};document.addEventListener('keydown',k);document.getElementById('modalRoot').appendChild(b);b.close=close;return b}
function go(url){document.body.classList.add('page-exit');setTimeout(()=>location.href=url,200)}
return{go,isoDate,todayISO:()=>isoDate(new Date()),esc,fmtDate,fmtTime,rc,badge,toast,busy,modal}})();
