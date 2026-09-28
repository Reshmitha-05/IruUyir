// All backend calls live here. Response shapes are documented in README.md.
// Endpoints marked (extra) are not in the original list; see README.
const Api=(()=>{
const C=window.IRUUYIR_CONFIG,E=encodeURIComponent;
async function req(method,path,body){
 if(C.USE_MOCK)return Mock.handle(method,path,body);
 const h={'Content-Type':'application/json'},t=Auth.token();if(t)h.Authorization='Bearer '+t;
 const r=await fetch(C.API_BASE_URL+path,{method,headers:h,body:body?JSON.stringify(body):undefined});
 const d=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(d.message||`Request failed (${r.status})`);e.status=r.status;throw e}
 return d}
return{
 login:b=>req('POST','/api/auth/doctor/login',b),
 logout:()=>req('POST','/api/auth/logout'),
 getTodayAppointments:()=>req('GET','/api/appointments/today'),
 getCalendar:(from,to)=>req('GET',`/api/appointments/calendar?from=${from}&to=${to}`),
 getPatients:q=>req('GET','/api/patients'+(q?'?q='+E(q):'')),
 getPatient:id=>req('GET','/api/patients/'+E(id)),
 createPatient:b=>req('POST','/api/patients',b),
 getAssessmentSchema:()=>req('GET','/api/assessments/schema'),                 // (extra) urinalysis + fetal fields defined by the backend/model
 createAssessment:b=>req('POST','/api/assessments',b),
 baselineRisk:b=>req('POST','/api/ml/baseline-risk',b),                       // Trimester 1 → Model 1
 trimesterRisk:b=>req('POST','/api/ml/trimester-risk',b),                     // Trimester 2/3 → Model 2
 aiRecommendation:b=>req('POST','/api/ai/recommendation',b),
 saveRecommendation:(id,text)=>req('PUT',`/api/assessments/${E(id)}/recommendation`,{text}),
 approveAssessment:id=>req('POST',`/api/assessments/${E(id)}/approve`),
 saveNotes:(id,notes)=>req('PUT',`/api/assessments/${E(id)}/notes`,{notes}),  // (extra)
 createAppointment:b=>req('POST','/api/appointments',b),
 getTimeline:id=>req('GET',`/api/patients/${E(id)}/timeline`),
 getMenstrualCycle:id=>req('GET',`/api/patients/${E(id)}/menstrual-cycle`),
 getPreArrivalAlerts:()=>req('GET','/api/alerts/pre-arrival')}})();
