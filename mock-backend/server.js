/* TEMPORARY mock backend for frontend testing only. Replace with the real Express backend. */
const express = require('express'), path = require('path');
const app = express(); app.use(express.json());
app.use((req,res,next)=>{ res.set({'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}); if(req.method==='OPTIONS') return res.sendStatus(204); next(); });
app.use(express.static(path.join(__dirname,'..')));   // serves the frontend at http://localhost:3000
const tokens = new Map();
const PATIENT = {id:'IU-1001', password:'demo123', dob:'1998-05-14', name:'Priya Devi', riskScore:72, triage:'MEDIUM', lastAssessment:'25 Sept 2026'};
const auth = (req,res,next)=>{ const t=(req.headers.authorization||'').replace('Bearer ',''); if(!tokens.has(t)) return res.status(401).json({message:'Unauthorized'}); req.user=tokens.get(t); next(); };
app.post('/api/auth/patient/login',(req,res)=>{ const {patientId,password,dob}=req.body;
  if(patientId!==PATIENT.id||password!==PATIENT.password||dob!==PATIENT.dob) return res.status(401).json({message:'Patient ID, password or date of birth is incorrect.'});
  const token='p-'+Math.random().toString(36).slice(2); tokens.set(token,{id:PATIENT.id,role:'patient'}); res.json({token,user:{id:PATIENT.id,name:PATIENT.name}}); });
app.post('/api/auth/doctor/login',(req,res)=>{ const {workerId,password}=req.body;
  if(workerId!=='HW-01'||password!=='demo123') return res.status(401).json({message:'Worker ID or password is incorrect.'});
  const token='d-'+Math.random().toString(36).slice(2); tokens.set(token,{id:'HW-01',role:'doctor'}); res.json({token,user:{id:'HW-01',name:'Healthcare Worker'}}); });
app.post('/api/auth/logout',(req,res)=>{ tokens.delete((req.headers.authorization||'').replace('Bearer ','')); res.json({ok:true}); });
app.get('/api/patients/:id',auth,(req,res)=>{ if(req.params.id!==PATIENT.id) return res.status(404).json({message:'Not found'}); const {password,dob,...p}=PATIENT; res.json(p); });
app.post('/api/patients/:id/pre-arrival',auth,(req,res)=>{ console.log('PRE-ARRIVAL:',req.body); res.json({ok:true}); });
app.listen(3000,()=>console.log('Open http://localhost:3000\nPatient: IU-1001 / demo123 / DOB 1998-05-14\nWorker: HW-01 / demo123'));
