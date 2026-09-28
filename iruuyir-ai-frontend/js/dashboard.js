(function(){
if(!Auth.requireAuth())return;
const $=s=>document.querySelector(s),app=$('#view'),{esc,fmtDate,fmtTime}=UI;
const LOADER='<div class="loading-block"><span class="spinner"></span></div>';
const lv=l=>l?'r-'+l.toLowerCase():'r-none',pad=n=>String(n).padStart(2,'0');
const sBadge=(s,l)=>s==null?UI.badge(null):`<span class="badge ${lv(l)}">${s}/100 · ${l}</span>`;
const stat=s=>`<span class="status ${s==='Completed'?'approved':s==='In Progress'?'pending':'info'}">${esc(s)}</span>`;
const label=k=>k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
const yn=['No','Yes'];
const MAT=[{key:'age',label:'Age',type:'number',unit:'years',min:12,max:60},{key:'bmi',label:'BMI',type:'number',unit:'kg/m²',min:10,max:60,step:0.1},
 {key:'prevComplications',label:'Previous complications',type:'select',options:yn},{key:'preDiabetes',label:'Pre-existing diabetes',type:'select',options:yn},
 {key:'gestDiabetes',label:'Gestational diabetes',type:'select',options:yn},{key:'mentalHealth',label:'Mental health status',type:'select',options:['Stable','Mild concern','Needs support']}];
const VIT=[{key:'systolic',label:'Systolic BP',type:'number',unit:'mmHg',min:60,max:260},{key:'diastolic',label:'Diastolic BP',type:'number',unit:'mmHg',min:30,max:160},
 {key:'sugar',label:'Blood sugar',type:'number',unit:'mg/dL',min:20,max:600},{key:'temp',label:'Body temperature',type:'number',unit:'°C',min:30,max:43,step:0.1},{key:'hr',label:'Heart rate',type:'number',unit:'bpm',min:30,max:220}];
const UNITS={systolic:'mmHg',diastolic:'mmHg',sugar:'mg/dL',temp:'°C',hr:'bpm'};
const S={month:(()=>{const d=new Date();d.setDate(1);return d})(),sel:UI.todayISO(),cal:[],alerts:[],dismissed:new Set(JSON.parse(sessionStorage.getItem('iruuyir_dismissed')||'[]'))};

$('#userName').textContent=Auth.user().name;$('#logoutBtn').onclick=()=>Auth.logout();
document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{location.hash=b.dataset.nav});
window.addEventListener('hashchange',route);route();pollAlerts();setInterval(pollAlerts,15000);

async function route(){
 const h=location.hash.slice(1)||'dashboard',[k,a,b]=h.split('/').map(decodeURIComponent);
 const nav=k==='dashboard'?'dashboard':k==='appointments'?'appointments':k==='cycle'?'cycle':k==='alerts'?'alerts':'patients';
 document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===nav));
 app.innerHTML=LOADER;
 try{
  if(k==='dashboard')await dashboard();else if(k==='patients')patientsView();else if(k==='appointments')await apptsView();
  else if(k==='cycle')cycleView();else if(k==='alerts')await alertsView();else if(k==='patient')await profile(a);
  else if(k==='assess')await assessView(a,b);else if(k==='schedule')await scheduleView(a);else location.hash='dashboard';
 }catch(e){if(e.status===401)return Auth.logout();app.innerHTML=`<div class="card empty">${esc(e.message)}</div>`}
}

/* ---------- Pre-arrival alerts ---------- */
async function pollAlerts(){try{S.alerts=await Api.getPreArrivalAlerts();const n=S.alerts.filter(a=>!S.dismissed.has(a.id)).length,c=$('#alertCount');c.hidden=!n;c.textContent=n;renderBanner()}catch(e){if(e.status===401)Auth.logout()}}
const alertCard=(a,dis)=>`<section class="incoming"><div class="card-head" style="margin:0"><h2>INCOMING PATIENT</h2><span class="pill-live">${esc(a.status)}</span></div>
 <div class="kv"><div><small>Patient</small><b>${esc(a.patientName)}</b></div><div><small>ID</small><b>${esc(a.patientId)}</b></div><div><small>Current Risk Score</small>${sBadge(a.score,a.level)}</div><div><small>Time</small><b>${fmtTime(new Date(a.time).toTimeString().slice(0,5))}</b></div></div>
 <div class="actions"><a class="btn btn-primary btn-sm" href="#patient/${encodeURIComponent(a.patientId)}">View Patient</a>${dis?`<button class="btn btn-outline btn-sm" data-dis="${esc(a.id)}">Dismiss</button>`:''}</div></section>`;
function renderBanner(){const el=$('#alertBanner');if(!el)return;const l=S.alerts.filter(a=>!S.dismissed.has(a.id));el.innerHTML=l.map(a=>alertCard(a,true)).join('');
 el.querySelectorAll('[data-dis]').forEach(b=>b.onclick=()=>{S.dismissed.add(b.dataset.dis);sessionStorage.setItem('iruuyir_dismissed',JSON.stringify([...S.dismissed]));pollAlerts()})}
async function alertsView(){await pollAlerts();
 app.innerHTML=`<div class="page-enter"><div class="card-head"><h1>Alerts</h1>${IRUUYIR_CONFIG.USE_MOCK?'<button class="btn btn-outline btn-sm" id="sim">Simulate patient SOS (dev)</button>':''}</div>
 <p class="muted">Pre-arrival notifications let the facility prepare. No ambulance is dispatched and no emergency service is called automatically.</p>
 ${S.alerts.length?S.alerts.map(a=>alertCard(a,false)).join(''):'<div class="card empty">No pre-arrival alerts.</div>'}</div>`;
 const s=$('#sim');if(s)s.onclick=async()=>{await fetchDevSos();alertsView()}}
const fetchDevSos=()=>Mock.handle('POST','/api/dev/sos',{});

/* ---------- Dashboard ---------- */
const apptCard=a=>`<article class="appt-card"><div class="appt-time">${fmtTime(a.time)}</div><div><b>${esc(a.patientName)}</b><div class="muted">ID: ${esc(a.patientId)}${a.purpose?' · '+esc(a.purpose):''}</div></div>
 <div class="appt-risk"><small>Risk Score</small>${sBadge(a.score,a.level)}</div><div>${stat(a.status)}</div>
 <div class="actions" style="margin:0"><a class="btn btn-outline btn-sm" href="#patient/${encodeURIComponent(a.patientId)}">View Patient</a>${a.status==='Completed'?'':`<a class="btn btn-primary btn-sm" href="#assess/${encodeURIComponent(a.patientId)}/${encodeURIComponent(a.id)}">Start Assessment</a>`}</div></article>`;
async function dashboard(){
 const list=await Api.getTodayAppointments();list.sort((a,b)=>a.time.localeCompare(b.time));
 app.innerHTML=`<div class="page-enter"><div id="alertBanner"></div><div class="card-head"><div><h1>Today's Appointments</h1><div class="muted">${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div></div><a class="btn btn-outline" href="#appointments">View Calendar</a></div>
 ${list.length?list.map(apptCard).join(''):'<div class="card empty">No appointments scheduled for today.</div>'}</div>`;renderBanner();
}

/* ---------- Appointments calendar ---------- */
async function apptsView(){
 app.innerHTML=`<div class="page-enter"><h1 class="page-title">Appointments</h1><div class="grid-2"><section class="card"><div class="card-head"><h2>Calendar</h2><div class="cal-nav"><button class="btn btn-outline btn-sm" id="prev" aria-label="Previous month">‹</button><strong id="mLabel"></strong><button class="btn btn-outline btn-sm" id="next" aria-label="Next month">›</button></div></div><div id="cal"></div></section>
 <section class="card"><div class="card-head"><h2 id="dayTitle"></h2></div><div id="dayList"></div></section></div></div>`;
 $('#prev').onclick=()=>{S.month.setMonth(S.month.getMonth()-1);loadCal()};$('#next').onclick=()=>{S.month.setMonth(S.month.getMonth()+1);loadCal()};await loadCal();
}
async function loadCal(){const y=S.month.getFullYear(),m=S.month.getMonth();S.cal=await Api.getCalendar(UI.isoDate(new Date(y,m,1)),UI.isoDate(new Date(y,m+1,0)));drawCal()}
function drawCal(){
 const y=S.month.getFullYear(),m=S.month.getMonth(),today=UI.todayISO(),first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();
 $('#mLabel').textContent=S.month.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
 let h=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-dow">${d}</div>`).join('')+'<div class="cal-cell blank"></div>'.repeat(first);
 for(let d=1;d<=days;d++){const iso=UI.isoDate(new Date(y,m,d)),l=S.cal.filter(a=>a.date===iso);
  h+=`<div class="cal-cell${iso===today?' today':''}${iso===S.sel?' sel':''}" data-d="${iso}"><span class="cal-day">${d}</span>${l.slice(0,2).map(a=>`<div class="chip ${lv(a.level)}" title="${esc(a.patientName)} · ${fmtTime(a.time)}"><b>${fmtTime(a.time).replace(':00','')}</b> ${esc(a.patientName.split(' ')[0])}</div>`).join('')}${l.length>2?`<div class="more">+${l.length-2} more</div>`:''}</div>`}
 $('#cal').innerHTML=h;$('#cal').querySelectorAll('.cal-cell[data-d]').forEach(c=>c.onclick=()=>{S.sel=c.dataset.d;drawCal()});
 const l=S.cal.filter(a=>a.date===S.sel);$('#dayTitle').textContent=fmtDate(S.sel);
 $('#dayList').innerHTML=l.length?l.map(a=>`<div class="day-item"><div><a href="#patient/${encodeURIComponent(a.patientId)}">${esc(a.patientName)}</a><div class="muted">${esc(a.patientId)} · ${fmtTime(a.time)} · ${esc(a.purpose||'')}</div></div>${sBadge(a.score,a.level)}</div>`).join(''):'<div class="empty">No appointments on this date.</div>';
}

/* ---------- Patients: search + register ---------- */
function patientsView(){
 app.innerHTML=`<div class="page-enter"><h1 class="page-title">Patients</h1><div class="tabs"><button class="tab active" data-t="s">Search Patient</button><button class="tab" data-t="r">Register Patient</button></div>
 <section class="card" id="pS"><div class="toolbar"><input id="q" type="search" placeholder="Search by patient ID or name" aria-label="Search patients"></div><div id="results">${LOADER}</div></section>
 <section class="card" id="pR" hidden style="max-width:720px"><div class="card-head"><h2>Register Patient</h2></div><form id="reg" novalidate><div class="form-grid">
 ${[['name','Patient name','text'],['patientId','Patient ID','text'],['dob','Date of birth','date'],['contact','Contact','tel'],['emergencyContact','Emergency contact','tel'],['password','Password (login setup)','password'],['confirm','Confirm password','password']].map(([k,l,t])=>`<div class="form-group"><label for="r_${k}">${l}</label><input id="r_${k}" type="${t}"${k==='dob'?` max="${UI.todayISO()}"`:''}${t==='password'?' autocomplete="new-password"':''}><div class="err"></div></div>`).join('')}</div>
 <button class="btn btn-primary" id="regBtn" type="submit">Register Patient</button></form></section></div>`;
 app.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{app.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));$('#pS').hidden=t.dataset.t!=='s';$('#pR').hidden=t.dataset.t!=='r'});
 const run=async()=>{try{const l=await Api.getPatients($('#q').value.trim());
  $('#results').innerHTML=l.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Patient</th><th>Patient ID</th><th>DOB</th><th>Latest Risk Score</th><th>Last Assessment</th><th>Next Appointment</th><th></th></tr></thead><tbody>${l.map(p=>`<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.id)}</td><td>${fmtDate(p.dob)}</td><td>${sBadge(p.score,p.level)}</td><td>${fmtDate(p.lastAssessment)}</td><td>${p.nextAppointment?fmtDate(p.nextAppointment.date)+', '+fmtTime(p.nextAppointment.time):'—'}</td><td><a class="btn btn-outline btn-sm" href="#patient/${encodeURIComponent(p.id)}">View Patient</a></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No patients match this search.</div>'}catch(e){UI.toast(e.message,'error')}};
 let t;$('#q').oninput=()=>{clearTimeout(t);t=setTimeout(run,250)};run();
 $('#reg').onsubmit=async e=>{e.preventDefault();const g=k=>$('#r_'+k).value.trim(),v={};['name','patientId','dob','contact','emergencyContact','password','confirm'].forEach(k=>v[k]=k.includes('assword')||k==='confirm'?$('#r_'+k).value:g(k));
  const ph=/^\+?[0-9 ]{10,15}$/,rules={name:v.name?'':'Required',patientId:/^[A-Za-z0-9-]{3,20}$/.test(v.patientId)?'':'3–20 letters, digits or hyphen',dob:!v.dob?'Required':v.dob>UI.todayISO()?'Cannot be in the future':'',contact:ph.test(v.contact)?'':'Enter a valid number',emergencyContact:ph.test(v.emergencyContact)?'':'Enter a valid number',password:v.password.length>=8?'':'At least 8 characters',confirm:v.confirm===v.password?'':'Passwords do not match'};
  let ok=true;Object.entries(rules).forEach(([k,m])=>{const el=$('#r_'+k);el.closest('.form-group').querySelector('.err').textContent=m;el.classList.toggle('invalid',!!m);if(m)ok=false});if(!ok)return;
  UI.busy($('#regBtn'),true,'Registering');try{const{confirm,...body}=v;const r=await Api.createPatient(body);UI.toast('Patient registered');location.hash='patient/'+encodeURIComponent(r.id)}catch(x){UI.busy($('#regBtn'),false);UI.toast(x.message,'error')}};
}

/* ---------- Patient profile + timeline ---------- */
async function profile(id){
 const[p,tl]=await Promise.all([Api.getPatient(id),Api.getTimeline(id)]);S.tl=tl;
 app.innerHTML=`<div class="page-enter"><a class="back" href="#patients">‹ Patients</a>
 <section class="card profile-head"><div><h1 style="margin-bottom:6px">${esc(p.name)}</h1><div class="meta"><span>ID: <b>${esc(p.id)}</b></span><span>DOB: <b>${fmtDate(p.dob)}</b></span><span>Contact: <b>${esc(p.contact||'—')}</b></span><span>Emergency: <b>${esc(p.emergencyContact||'—')}</b></span></div></div><div><small class="muted">Latest risk score</small><br>${sBadge(p.score,p.level)}</div></section>
 <div class="actions" style="margin:0 0 16px"><a class="btn btn-primary" href="#assess/${encodeURIComponent(p.id)}">Start Assessment</a><a class="btn btn-outline" href="#schedule/${encodeURIComponent(p.id)}">Schedule Appointment</a></div>
 <h2 class="section-title">Patient Timeline</h2>${tl.length?`<ol class="timeline">${tl.map((a,i)=>`<li class="tl-item ${lv(a.level)}"><div class="card" tabindex="0" role="button" data-i="${i}"><div class="tl-head"><div><strong>Appointment ${a.no}</strong><div class="muted">${fmtDate(a.date)} | ${fmtTime(a.time)}${a.trimester?' · Trimester '+a.trimester:''}</div></div>${stat(a.status==='Scheduled'?'Scheduled':a.status)}</div>
 ${a.score!=null&&a.status!=='Scheduled'?`<div class="tl-foot"><span>Risk Score: <b>${a.score}/100</b></span><span>Triage: ${UI.badge(a.level)}</span></div>`:'<div class="muted">Upcoming appointment</div>'}</div></li>`).join('')}</ol>`:'<div class="card empty">No appointments yet.</div>'}</div>`;
 app.querySelectorAll('[data-i]').forEach(c=>{const o=()=>summary(S.tl[+c.dataset.i],p);c.onclick=o;c.onkeydown=e=>{if(e.key==='Enter')o()}});
}
const kv=(o,u)=>Object.entries(o||{}).map(([k,v])=>`<div><small>${label(k)}</small><b>${esc(v)}${u&&u[k]?' '+u[k]:''}</b></div>`).join('');
function summary(a,p){const d=a.data,r=a.recommendation,done=a.status!=='Scheduled';
 const m=UI.modal(`<div class="card-head"><h2>Appointment ${a.no} · ${fmtDate(a.date)}, ${fmtTime(a.time)}</h2><button class="btn btn-outline btn-sm" id="x">Close</button></div>
 <p class="muted" style="margin-top:0">${esc(a.purpose||'')}${a.trimester?' · Trimester '+a.trimester:''} · ${stat(a.status)}</p>
 ${!done||!d?`<div class="empty">No assessment recorded.</div><a class="btn btn-primary btn-sm" href="#assess/${encodeURIComponent(p.id)}/${encodeURIComponent(a.id)}" id="go">Start Assessment</a>`:`
 <div class="score-row" style="margin-bottom:16px"><div class="score ${lv(a.level)}" style="--pct:${a.score||0}"><b>${a.score??'—'}</b><small>/ 100</small></div><div><small class="muted">Triage</small><br>${UI.badge(a.level)}<h3 class="section-title">Key Contributing Factors</h3><ul style="margin:0;padding-left:18px">${(a.factors||[]).map(f=>`<li>${esc(f)}</li>`).join('')||'<li>—</li>'}</ul></div></div>
 <h3 class="section-title">Maternal Information</h3><div class="kv">${kv(d.maternal)}</div><h3 class="section-title">Current Vitals</h3><div class="kv">${kv(d.vitals,UNITS)}</div>
 <h3 class="section-title">Urinalysis</h3><div class="kv">${kv(d.urinalysis)}</div>${d.fetal?`<h3 class="section-title">Fetal Health Inputs</h3><div class="kv">${kv(d.fetal)}</div>`:''}
 <h3 class="section-title">Healthcare Worker Notes</h3><p style="white-space:pre-wrap;margin:0">${esc(a.notes||'—')}</p>
 <h3 class="section-title">Recommendation</h3>${r?`<span class="status ${r.status==='approved'?'approved':'pending'}">${r.status==='approved'?'Healthcare Worker Approved':'Pending Review'}</span><div class="tl-rec">${esc(r.text)}</div>`:'<span class="muted">Not generated</span>'}`}`);
 m.querySelector('#x').onclick=m.close;const g=m.querySelector('#go');if(g)g.onclick=m.close}

/* ---------- Assessment ---------- */
const fld=(g,f)=>{const id=`f_${g}_${f.key}`;return`<div class="form-group"><label for="${id}">${esc(f.label)}</label>${f.type==='select'?`<select id="${id}"><option value="">Select</option>${f.options.map(o=>`<option>${esc(o)}</option>`).join('')}</select>`:`<div class="input-unit"><input id="${id}" type="number" step="${f.step||'any'}" inputmode="decimal"><span>${esc(f.unit||'')}</span></div>`}<div class="err"></div></div>`};
function collect(g,list){let ok=true;const v={};list.forEach(f=>{const el=$(`#f_${g}_${f.key}`),raw=el.value.trim(),er=el.closest('.form-group').querySelector('.err');let msg='';
 if(raw==='')msg='Required';else if(f.type==='number'){const n=Number(raw);if(isNaN(n)||n<f.min||n>f.max)msg=`Enter ${f.min}–${f.max}${f.unit?' '+f.unit:''}`;else v[f.key]=n}else v[f.key]=raw;
 er.textContent=msg;el.classList.toggle('invalid',!!msg);if(msg)ok=false});return ok?v:null}
async function assessView(pid,apptId){
 const[p,schema]=await Promise.all([Api.getPatient(pid),Api.getAssessmentSchema()]);let tri=null;
 const sec=(t,g,l)=>`<section class="card"><div class="card-head"><h2>${t}</h2></div><div class="form-grid">${l.map(f=>fld(g,f)).join('')}</div></section>`;
 app.innerHTML=`<div class="page-enter"><a class="back" href="#patient/${encodeURIComponent(pid)}">‹ ${esc(p.name)}</a><h1 class="page-title">Patient Assessment · ${esc(p.id)}</h1>
 <section class="card"><div class="card-head"><h2>Select Trimester</h2></div><div class="seg" id="tri">${[1,2,3].map(n=>`<button type="button" class="seg-btn" data-n="${n}">TRIMESTER ${n}</button>`).join('')}</div>
 <p class="hint">Trimester 1 uses the baseline model. Trimesters 2 and 3 add fetal-health inputs and use the trimester model.</p></section>
 <form id="aform" class="collapsible" novalidate><div><fieldset id="fs">${sec('Maternal Information','m',MAT)}${sec('Current Vitals','v',VIT)}${sec('Urinalysis','u',schema.urinalysis.fields)}
 <div id="fetal" class="collapsible"><div>${sec('Fetal Health Inputs','f',schema.fetal.fields)}</div></div>
 <button class="btn btn-primary" id="subBtn" type="submit">Submit Assessment</button></fieldset></div></form><div id="out"></div></div>`;
 app.querySelectorAll('.seg-btn').forEach(b=>b.onclick=()=>{tri=+b.dataset.n;app.querySelectorAll('.seg-btn').forEach(x=>x.classList.toggle('active',x===b));$('#aform').classList.add('open');$('#fetal').classList.toggle('open',tri>1);
  $('#fetal').querySelectorAll('input,select').forEach(i=>i.disabled=tri===1)});
 $('#aform').onsubmit=async e=>{e.preventDefault();if(!tri){UI.toast('Select a trimester first','error');return}
  const maternal=collect('m',MAT),vitals=collect('v',VIT),urinalysis=collect('u',schema.urinalysis.fields),fetal=tri>1?collect('f',schema.fetal.fields):null;
  if(vitals&&vitals.diastolic>=vitals.systolic){const el=$('#f_v_diastolic');el.classList.add('invalid');el.closest('.form-group').querySelector('.err').textContent='Must be lower than systolic';return}
  if(!maternal||!vitals||!urinalysis||(tri>1&&!fetal)){UI.toast('Complete the highlighted fields','error');return}
  const btn=$('#subBtn');UI.busy(btn,true,'Submitting');
  try{const{id}=await Api.createAssessment({patientId:pid,appointmentId:apptId||undefined,trimester:tri,maternal,vitals,urinalysis,fetal});
   const res=await(tri===1?Api.baselineRisk:Api.trimesterRisk)({assessmentId:id,trimester:tri,maternal,vitals,urinalysis,fetal});
   $('#fs').disabled=true;app.querySelectorAll('.seg-btn').forEach(b=>b.disabled=true);UI.busy(btn,false);btn.hidden=true;results(id,pid,res)}
  catch(x){UI.busy(btn,false);UI.toast(x.message,'error')}};
}
async function results(id,pid,r){
 $('#out').innerHTML=`<section class="card page-enter"><div class="card-head"><h2>Maternal Risk Score</h2>${UI.badge(r.level)}</div><div class="score-row"><div class="score ${lv(r.level)}" style="--pct:${r.score}"><b>${r.score}</b><small>/ 100</small></div>
 <div><h3 class="section-title" style="margin-top:0">Key Contributing Factors</h3><ul style="margin:0;padding-left:18px">${r.factors.map(f=>`<li>${esc(f)}</li>`).join('')}</ul><p class="hint">Model output for healthcare-worker review. Not a diagnosis.</p></div></div></section>
 <section class="card"><div class="card-head"><h2>Healthcare Worker Notes</h2></div><textarea id="notes" rows="6" placeholder="Observations from the patient's report and consultation"></textarea><div class="actions"><button class="btn btn-outline" id="saveNotes">Save Notes</button></div></section>
 <section class="card" id="ai">${LOADER}</section><div id="sched"></div>`;
 $('#saveNotes').onclick=async e=>{UI.busy(e.target,true,'Saving');try{await Api.saveNotes(id,$('#notes').value.trim());UI.toast('Notes saved')}catch(x){UI.toast(x.message,'error')}UI.busy(e.target,false)};
 const gen=async()=>{$('#ai').innerHTML=LOADER;try{const{text}=await Api.aiRecommendation({assessmentId:id,score:r.score,level:r.level,factors:r.factors});draft(id,pid,text)}
  catch(x){$('#ai').innerHTML=`<div class="card-head"><h2>Decision Support Recommendation</h2></div><p class="muted">${esc(x.message)}</p><button class="btn btn-outline" id="retry">Retry</button>`;$('#retry').onclick=gen}};gen();
}
function draft(id,pid,text){
 $('#ai').innerHTML=`<div class="card-head"><h2>Decision Support Recommendation</h2><span class="status pending" id="rs">Pending Review</span></div>
 <textarea class="rec" id="rt" aria-label="Recommendation">${esc(text)}</textarea><p class="hint">AI-generated support for your consideration. Not a diagnosis; the final decision rests with the healthcare worker. The patient sees nothing until you confirm.</p>
 <div class="actions"><button class="btn btn-primary" id="conf">CONFIRM CHANGES</button></div>`;
 $('#conf').onclick=async e=>{const t=$('#rt').value.trim();if(!t){UI.toast('Recommendation cannot be empty','error');return}
  UI.busy(e.target,true,'Confirming');try{await Api.saveRecommendation(id,t);await Api.approveAssessment(id);
   $('#rt').readOnly=true;$('#rs').className='status approved';$('#rs').textContent='Healthcare Worker Approved';e.target.hidden=true;UI.toast('Approved and made visible to patient');
   $('#sched').innerHTML='<section class="card page-enter" id="sc"></section>';scheduleForm($('#sc'),pid,()=>{location.hash='patient/'+encodeURIComponent(pid)})}
  catch(x){UI.busy(e.target,false);UI.toast(x.message,'error')}};
}

/* ---------- Schedule next appointment ---------- */
function scheduleForm(root,pid,done){
 root.innerHTML=`<div class="card-head"><h2>Schedule Next Appointment</h2></div><div class="form-grid"><div class="form-group"><label for="sd">Date</label><input id="sd" type="date" min="${UI.todayISO()}"></div><div class="form-group"><label for="st">Time</label><input id="st" type="time"></div></div>
 <div class="form-group"><label for="sp">Purpose</label><input id="sp" placeholder="e.g. Follow-up review"></div><div class="err" id="se"></div><div class="actions"><button class="btn btn-primary" id="sb">Save Appointment</button><button class="btn btn-outline" id="sk">Skip</button></div>`;
 root.querySelector('#sk').onclick=done;
 root.querySelector('#sb').onclick=async e=>{const date=$('#sd').value,time=$('#st').value,purpose=$('#sp').value.trim();
  if(!date||!time||!purpose){$('#se').textContent='Date, time and purpose are required.';return}if(date<UI.todayISO()){$('#se').textContent='Date cannot be in the past.';return}
  UI.busy(e.target,true,'Saving');try{await Api.createAppointment({patientId:pid,date,time,purpose});UI.toast('Appointment scheduled');done()}catch(x){UI.busy(e.target,false);$('#se').textContent=x.message}}}
async function scheduleView(pid){const p=await Api.getPatient(pid);
 app.innerHTML=`<div class="page-enter"><a class="back" href="#patient/${encodeURIComponent(pid)}">‹ ${esc(p.name)}</a><h1 class="page-title">Schedule Appointment · ${esc(p.id)}</h1><section class="card" style="max-width:560px" id="sc"></section></div>`;
 scheduleForm($('#sc'),pid,()=>{location.hash='patient/'+encodeURIComponent(pid)})}

/* ---------- Menstrual cycle (read-only) ---------- */
function cycleView(){
 const C={pid:null,phase:'all',month:null,entries:[]};
 app.innerHTML=`<div class="page-enter"><h1 class="page-title">Menstrual Cycle</h1><section class="card"><div class="toolbar"><input id="cq" type="search" placeholder="Search patient by ID or name" aria-label="Search patient"><select id="cp" style="max-width:280px" aria-label="Patient"></select></div><p class="hint" style="margin:0">Entries are logged by the patient. Read-only for healthcare workers.</p></section><div id="cy"></div></div>`;
 const load=async()=>{const l=await Api.getPatients($('#cq').value.trim());$('#cp').innerHTML=l.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.id)})</option>`).join('');show()};
 const show=async()=>{const id=$('#cp').value;if(!id){$('#cy').innerHTML='<div class="card empty">No patient selected.</div>';return}
  const r=await Api.getMenstrualCycle(id);C.entries=[...r.entries].sort((a,b)=>a.start.localeCompare(b.start));const last=C.entries[C.entries.length-1];
  C.month=last?new Date(last.start+'T00:00:00'):new Date();C.month.setDate(1);draw()};
 const draw=()=>{const y=C.month.getFullYear(),m=C.month.getMonth(),first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),today=UI.todayISO();
  const inP=iso=>C.entries.some(e=>iso>=e.start&&iso<=e.end),list=C.entries.filter(e=>C.phase==='all'||e.phase===C.phase);
  let g=['S','M','T','W','T','F','S'].map(d=>`<div class="cal-dow">${d}</div>`).join('')+'<div class="cal-cell blank" style="min-height:44px"></div>'.repeat(first);
  for(let d=1;d<=days;d++){const iso=UI.isoDate(new Date(y,m,d));g+=`<div class="cal-cell${inP(iso)?' period':''}${iso===today?' today':''}" style="min-height:44px;cursor:default"><span class="cal-day">${d}</span></div>`}
  $('#cy').innerHTML=`<div class="grid-2"><section class="card"><div class="card-head"><h2>Cycle History</h2></div><div class="tabs">${[['all','All'],['pre-pregnancy','Pre-pregnancy'],['pregnancy','Pregnancy'],['post-pregnancy','Post-pregnancy']].map(([k,l])=>`<button class="tab${C.phase===k?' active':''}" data-p="${k}">${l}</button>`).join('')}</div>
  ${list.length?`<ol class="timeline">${[...list].reverse().map(e=>`<li class="tl-item r-none"><div class="card" style="padding:12px 16px"><div class="tl-head"><strong>${fmtDate(e.start)} – ${fmtDate(e.end)}</strong><span class="phase-tag">${esc(e.phase)}</span></div><div class="muted">Flow: ${esc(e.flow||'—')} · Symptoms: ${esc(e.symptoms||'—')}</div></div></li>`).join('')}</ol>`:'<div class="empty">No cycle entries logged by this patient.</div>'}</section>
  <section class="card"><div class="card-head"><h2>Calendar</h2><div class="cal-nav"><button class="btn btn-outline btn-sm" id="cpv" aria-label="Previous month">‹</button><strong>${C.month.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</strong><button class="btn btn-outline btn-sm" id="cnx" aria-label="Next month">›</button></div></div><div id="cal">${g}</div><p class="hint">Shaded days: logged period.</p></section></div>`;
  $('#cy').querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{C.phase=b.dataset.p;draw()});$('#cpv').onclick=()=>{C.month.setMonth(C.month.getMonth()-1);draw()};$('#cnx').onclick=()=>{C.month.setMonth(C.month.getMonth()+1);draw()}};
 let t;$('#cq').oninput=()=>{clearTimeout(t);t=setTimeout(load,250)};$('#cp').onchange=show;load();
}
})();
