// DEV ONLY: stand-in for the Express API so the UI runs without a backend (USE_MOCK in config.js).
// The scoring here is a placeholder for the trained models. The real score MUST come from the backend ML service.
// Urinalysis / fetal fields below are PLACEHOLDERS: the backend must return the exact fields of the selected Kaggle datasets/models.
const Mock=(()=>{
const KEY='iruuyir_mock_v2',iso=o=>{const d=new Date();d.setDate(d.getDate()+o);return UI.isoDate(d)};
const D=(systolic,diastolic,sugar,temp,hr,x,fetal)=>({maternal:{age:28,bmi:24,prevComplications:'No',preDiabetes:'No',gestDiabetes:'No',mentalHealth:'Stable',...(x||{})},vitals:{systolic,diastolic,sugar,temp,hr},urinalysis:{glucose:'Negative',protein:'Negative',ph:6,specificGravity:1.015},fetal:fetal||null});
const F0={baselineValue:140,accelerations:0.003,uterineContractions:0.004,severeDecelerations:0,abnormalShortTermVariability:45};
const S=(id,o,time,purpose)=>({id,date:iso(o),time,purpose,status:'Scheduled',trimester:null,data:null,score:null,level:null,factors:[],notes:'',rec:null});
const C=(id,o,time,tri,score,level,factors,data,notes)=>({id,date:iso(o),time,purpose:'Antenatal review',status:'Completed',trimester:tri,data,score,level,factors,notes:notes||'',rec:{status:'approved',text:`MATERNAL TRIAGE:\n${level}\n\nKey factors:\n${factors.map(f=>'- '+f).join('\n')}\n\nPriority:\n${level}\n\nSuggested action:\nRoutine review per protocol.`}});
const cyc=(a,b,phase,flow,sym)=>({start:iso(a),end:iso(b),phase,flow,symptoms:sym});
const seed=()=>({alerts:[],patients:[
{id:'P1024',name:'Ananya R',dob:'1997-05-12',contact:'+91 90000 11111',emergencyContact:'+91 90000 22222',cycle:[cyc(-420,-415,'pre-pregnancy','Medium','Mild cramps'),cyc(-392,-387,'pre-pregnancy','Heavy','Fatigue'),cyc(-364,-360,'pre-pregnancy','Medium','None'),cyc(-100,-99,'pregnancy','Spotting','Light spotting')],
 appts:[C('a1',-56,'10:00',1,38,'LOW',['No elevated parameters'],D(116,74,90,36.8,78)),C('a2',-28,'10:00',2,61,'MEDIUM',['Borderline blood pressure','Increased blood glucose'],D(134,86,145,37,84,null,F0),'Discussed diet review.'),S('a3',0,'10:00','Antenatal review'),S('a4',14,'10:00','Follow-up')]},
{id:'P1025',name:'Divya S',dob:'1994-11-02',contact:'+91 90000 33333',emergencyContact:'+91 90000 44444',cycle:[],
 appts:[C('b1',-20,'11:00',2,78,'HIGH',['Elevated blood pressure','Increased blood glucose','Previous pregnancy complication'],D(150,96,150,37.2,96,{prevComplications:'Yes'},F0)),S('b2',0,'12:30','High-risk review')]},
{id:'P1026',name:'Revathi M',dob:'1999-02-20',contact:'+91 90000 55555',emergencyContact:'+91 90000 66666',cycle:[],appts:[S('c1',0,'09:30','First antenatal visit')]},
{id:'P1027',name:'Keerthana P',dob:'1992-08-09',contact:'+91 90000 77777',emergencyContact:'+91 90000 88888',cycle:[],
 appts:[C('d1',-10,'14:00',3,30,'LOW',['No elevated parameters'],D(112,72,88,36.7,76,null,F0)),S('d2',3,'11:00','Routine review')]}]});
let db=JSON.parse(localStorage.getItem(KEY)||'null')||seed();const save=()=>localStorage.setItem(KEY,JSON.stringify(db));
const err=(m,s)=>{const e=new Error(m);e.status=s;return e};
const srt=p=>[...p.appts].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
const latest=p=>srt(p).filter(a=>a.score!=null).pop()||{score:null,level:null};
const pat=id=>{const p=db.patients.find(x=>x.id===id);if(!p)throw err('Patient not found',404);return p};
const find=id=>{for(const p of db.patients){const a=p.appts.find(x=>x.id===id);if(a)return{p,a}}throw err('Assessment not found',404)};
const flat=f=>db.patients.flatMap(p=>p.appts.filter(f).map(a=>({id:a.id,patientId:p.id,patientName:p.name,date:a.date,time:a.time,purpose:a.purpose,status:a.status,score:a.score!=null?a.score:latest(p).score,level:a.level||latest(p).level}))).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
function model(a,tri){const v=a.data.vitals,m=a.data.maternal,u=a.data.urinalysis;let s=15;const f=[];
 if(v.systolic>=140||v.diastolic>=90){s+=25;f.push('Elevated blood pressure')}else if(v.systolic>=130){s+=12;f.push('Borderline blood pressure')}
 if(v.sugar>=140){s+=20;f.push('Increased blood glucose')}if(m.prevComplications==='Yes'){s+=15;f.push('Previous pregnancy complication')}
 if(m.gestDiabetes==='Yes'||m.preDiabetes==='Yes'){s+=10;f.push('Diabetes history')}if(v.temp>=38){s+=8;f.push('Raised body temperature')}
 if(v.hr>=100){s+=7;f.push('Elevated heart rate')}if(u.protein&&u.protein!=='Negative'){s+=10;f.push('Urine protein present')}
 if(tri>1&&a.data.fetal&&a.data.fetal.severeDecelerations>0){s+=15;f.push('Fetal deceleration recorded')}
 s=Math.min(100,s);return{score:s,level:s>=65?'HIGH':s>=35?'MEDIUM':'LOW',factors:f.length?f:['No elevated parameters']}}
const sel=(label,key,opts)=>({key,label,type:'select',options:opts});
const schema={urinalysis:{fields:[sel('Glucose','glucose',['Negative','Trace','+','++']),sel('Protein','protein',['Negative','Trace','+','++']),{key:'ph',label:'pH',type:'number',min:4,max:9,step:0.1},{key:'specificGravity',label:'Specific gravity',type:'number',min:1,max:1.04,step:0.001}]},
 fetal:{fields:[{key:'baselineValue',label:'Baseline value',type:'number',unit:'bpm',min:60,max:220},{key:'accelerations',label:'Accelerations',type:'number',min:0,max:1,step:0.001},{key:'uterineContractions',label:'Uterine contractions',type:'number',min:0,max:1,step:0.001},{key:'severeDecelerations',label:'Severe decelerations',type:'number',min:0,max:1,step:0.001},{key:'abnormalShortTermVariability',label:'Abnormal short-term variability',type:'number',min:0,max:100}]}};
function recommend(a){const lv=a.level,fu={HIGH:'Earlier clinical review',MEDIUM:'Repeat measurements at next visit',LOW:'Routine monitoring'}[lv],ac={HIGH:'Consider further clinical assessment according to protocol.',MEDIUM:'Consider closer monitoring according to protocol.',LOW:'Continue routine antenatal care.'}[lv];
 return`MATERNAL TRIAGE:\n${lv}\n\nKey factors:\n${a.factors.map(x=>'- '+x).join('\n')}\n\nPriority:\n${lv}\n\nSuggested follow-up:\n${fu}\n\nSuggested action:\n${ac}`}
function route(method,path,b){
 const[pn,qs]=path.split('?'),u=new URLSearchParams(qs||''),q=(u.get('q')||'').trim().toLowerCase();let m;
 if(pn==='/api/auth/doctor/login'){if(!b.identifier||!b.password)throw err('Enter ID/email and password',400);if(b.password!=='demo1234')throw err('Invalid credentials. Demo password: demo1234',401);return{token:'mock-'+Date.now(),user:{id:'HW-01',name:'Dr. Kavitha Nair'}}}
 if(pn==='/api/auth/logout')return{ok:true};
 if(!sessionStorage.getItem('iruuyir_token'))throw err('Unauthorized',401);
 if(pn==='/api/appointments/today')return flat(a=>a.date===iso(0));
 if(pn==='/api/appointments/calendar')return flat(a=>a.date>=u.get('from')&&a.date<=u.get('to'));
 if(pn==='/api/alerts/pre-arrival')return db.alerts;
 if(pn==='/api/dev/sos'){const p=db.patients[1],l=latest(p);const al={id:'al'+Date.now(),patientId:p.id,patientName:p.name,score:l.score,level:l.level,time:new Date().toISOString(),status:'EMERGENCY PRE-ARRIVAL'};db.alerts.unshift(al);return al}
 if(pn==='/api/patients'&&method==='GET')return db.patients.map(p=>{const l=latest(p),n=srt(p).find(a=>a.status==='Scheduled'&&a.date>=iso(0)),c=srt(p).filter(a=>a.status==='Completed').pop();return{id:p.id,name:p.name,dob:p.dob,score:l.score,level:l.level,lastAssessment:c?c.date:null,nextAppointment:n?{date:n.date,time:n.time}:null}}).filter(s=>!q||s.id.toLowerCase().includes(q)||s.name.toLowerCase().includes(q));
 if(pn==='/api/patients'&&method==='POST'){if(!b.name||!b.patientId||!b.dob||!b.password)throw err('Missing required fields',400);if(db.patients.some(p=>p.id.toLowerCase()===b.patientId.toLowerCase()))throw err('Patient ID already exists',409);db.patients.push({id:b.patientId,name:b.name,dob:b.dob,contact:b.contact,emergencyContact:b.emergencyContact,cycle:[],appts:[]});return{id:b.patientId}}
 if(pn==='/api/assessments/schema')return schema;
 if(pn==='/api/assessments'&&method==='POST'){const p=pat(b.patientId);let a=b.appointmentId&&p.appts.find(x=>x.id===b.appointmentId);
  if(!a){const n=new Date();a=S('a'+Date.now(),0,String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0'),'Antenatal review');p.appts.push(a)}
  a.trimester=b.trimester;a.data={maternal:b.maternal,vitals:b.vitals,urinalysis:b.urinalysis,fetal:b.fetal||null};a.status='In Progress';return{id:a.id}}
 if(pn==='/api/ml/baseline-risk'||pn==='/api/ml/trimester-risk'){const{a}=find(b.assessmentId),r=model(a,pn.endsWith('baseline-risk')?1:b.trimester);Object.assign(a,r);return r}
 if(pn==='/api/ai/recommendation')return{text:recommend(find(b.assessmentId).a)};
 if(m=pn.match(/^\/api\/assessments\/([^/]+)\/recommendation$/)){const{a}=find(m[1]);a.rec={text:b.text,status:'pending'};return a.rec}
 if(m=pn.match(/^\/api\/assessments\/([^/]+)\/approve$/)){const{a}=find(m[1]);if(!a.rec)throw err('No recommendation to approve',400);a.rec.status='approved';a.status='Completed';return a.rec}
 if(m=pn.match(/^\/api\/assessments\/([^/]+)\/notes$/)){find(m[1]).a.notes=b.notes;return{ok:true}}
 if(pn==='/api/appointments'&&method==='POST'){const p=pat(b.patientId);p.appts.push(S('a'+Date.now(),0,b.time,b.purpose));const a=p.appts[p.appts.length-1];a.date=b.date;return{id:a.id}}
 if(m=pn.match(/^\/api\/patients\/([^/]+)\/timeline$/)){return srt(pat(decodeURIComponent(m[1]))).map((a,i)=>({...a,no:i+1,recommendation:a.rec}))}
 if(m=pn.match(/^\/api\/patients\/([^/]+)\/menstrual-cycle$/))return{entries:pat(decodeURIComponent(m[1])).cycle};
 if(m=pn.match(/^\/api\/patients\/([^/]+)$/)){const p=pat(decodeURIComponent(m[1])),l=latest(p);return{id:p.id,name:p.name,dob:p.dob,contact:p.contact,emergencyContact:p.emergencyContact,score:l.score,level:l.level}}
 throw err('Not found',404)}
return{handle:(method,path,body)=>new Promise((res,rej)=>setTimeout(()=>{try{const r=route(method,path,body||{});save();res(JSON.parse(JSON.stringify(r)))}catch(e){rej(e)}},300))}})();
