# IruUyir AI — Common Entry + Healthcare Worker Frontend
HTML5 + CSS3 + vanilla JS. No build step. Tagline: "For Every Little Heartbeat".

## Run
VS Code → Live Server on `index.html`, or `npx serve .`. Demo mode is ON: any ID + password `demo1234`.
Real backend: in `js/config.js` set `USE_MOCK:false` and `API_BASE_URL`. Then delete `js/mock.js` and its `<script>` tags.

## SHARED DESIGN SYSTEM (source of truth for BOTH developers)
Do not edit these without agreement; add screen-specific styles in your own CSS file.
- `css/shared.css` — tokens (colors, radius, shadow, spacing, transitions), navbar, buttons, cards, inputs, tables, modal, toast, risk badge (`.badge.r-high|r-medium|r-low`), status badge, timeline (`.timeline/.tl-*`), appointment card (`.appt-card`), score ring (`.score`), segmented buttons, collapsible, login layout (`.auth-*`).
- `js/particles.js` — login background (`<canvas id="bg">` inside `.auth-wrap`). Patient login must use the same markup as `doctor-login.html`.
- `js/ui.js` — `UI.go()` page transition, toast, modal, busy button, date/time formatting.
- Patient developer: create `patient-login.html` (the role page already links to it), link `css/shared.css`, reuse the components above.
- Healthcare-worker files: `doctor-login.html`, `doctor-dashboard.html`, `css/doctor.css`, `js/dashboard.js`, `js/auth.js`, `js/api.js`, `js/config.js`, `js/mock.js`.

## Routes (doctor-dashboard.html)
`#dashboard` (today's appointments) · `#patients` (search / register) · `#appointments` (calendar) · `#cycle` (menstrual, read-only) · `#alerts` · `#patient/:id` (timeline) · `#assess/:id[/:appointmentId]` · `#schedule/:id`

## API (JSON, `Authorization: Bearer <token>`)
Listed endpoints: `POST /api/auth/doctor/login`, `POST /api/auth/logout`, `GET /api/appointments/today`, `GET /api/appointments/calendar?from&to`, `GET /api/patients?q=`, `GET /api/patients/:id`, `POST /api/patients`, `POST /api/assessments`, `POST /api/ml/baseline-risk`, `POST /api/ml/trimester-risk`, `POST /api/ai/recommendation`, `PUT /api/assessments/:id/recommendation`, `POST /api/assessments/:id/approve`, `POST /api/appointments`, `GET /api/patients/:id/timeline`, `GET /api/patients/:id/menstrual-cycle`, `GET /api/alerts/pre-arrival`.
Two extra endpoints were needed (add them to the backend):
- `GET /api/assessments/schema` → `{urinalysis:{fields:[...]},fetal:{fields:[...]}}`. The backend defines the exact Kaggle urinalysis and fetal-health fields; the form renders whatever it returns. Field = `{key,label,type:'number'|'select',unit?,min?,max?,step?,options?}`. The mock values are placeholders.
- `PUT /api/assessments/:id/notes` `{notes}` → saves Healthcare Worker Notes for that assessment.

Key shapes: appointment `{id,patientId,patientName,date,time,purpose,status:'Scheduled'|'In Progress'|'Completed',score,level}` · risk response `{score:0-100,level:'LOW'|'MEDIUM'|'HIGH',factors:[...]}` · `POST /api/assessments` `{patientId,appointmentId?,trimester,maternal,vitals,urinalysis,fetal?}` → `{id}` (creates the appointment record when no appointmentId) · timeline items = appointment fields + `no,trimester,data,factors,notes,recommendation:{text,status:'pending'|'approved'}` · pre-arrival alert `{id,patientId,patientName,score,level,time,status:'EMERGENCY PRE-ARRIVAL'}` · menstrual `{entries:[{start,end,phase:'pre-pregnancy'|'pregnancy'|'post-pregnancy',flow,symptoms}]}`.

## Backend rules
Trimester 1 → Model 1 (`baseline-risk`); trimester 2/3 → Model 2 (`trimester-risk`). Scores come only from the models, never the browser. The AI (Groq) draft is never stored as visible; only `approve` makes the recommendation visible to patients. Pre-arrival alerts notify the facility only; no ambulance dispatch or emergency call is made. Enforce auth on every route (401 → frontend logs out).
