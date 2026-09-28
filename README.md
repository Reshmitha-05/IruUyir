# IruUyir – Maternal Healthcare & Triage Backend

Node.js + Express + SQLite REST API shared by the **Healthcare Worker** and **Patient** frontends, plus a small
Python **ML service** (Random Forest) that produces the risk score. **The backend database is the single source of truth.**

> ⚠️ The risk score is a **prototype ML triage score (0–100) for decision support only. It is not a clinical diagnosis.**

## Architecture
```
Worker frontend ─┐                        ┌─► ML service (Flask, trained models) ─► score + factors
                 ├─► Express API ─► SQLite┤
Patient frontend ┘   (JWT auth)           └─► Groq (draft text, PENDING) ─► worker edits ─► APPROVED ─► visible to patient
```
```
src/  config/ constants/ db/ middleware/ utils/ services/ controllers/ routes/
scripts/  db-init.js  seed.js  db-check.js
ml_service/  train.py  app.py  config.json  requirements.txt  data/ models/
```

## Requirements
Node.js 20+ (LTS), Git, Python 3.10+, a Groq API key (https://console.groq.com), the 3 Kaggle CSVs (see ML section).

## Install
```bash
npm install
cp .env.example .env        # Windows: copy .env.example .env
```
Fill `.env` (never commit it):
| Var | Meaning |
|---|---|
| PORT | API port (5000) |
| JWT_SECRET | ≥16 chars. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| GROQ_API_KEY | Groq key (server side only) |
| ML_SERVICE_URL | `http://127.0.0.1:8000` |
| DATABASE_URL | `./data/iruuyir.db` |
| CORS_ORIGINS | comma-separated frontend origins (defaults cover 3000/5173/5174) |
| PATIENT_CAN_SEE_NOTES | `false` (default) hides internal worker notes from patients |

## Database
```bash
npm run db:init     # creates data/iruuyir.db and all 10 tables
npm run db:seed     # demo worker (from SEED_WORKER_* in .env) + patient PAT-0001 / Patient@123
npm run db:check    # verifies tables, row counts, integrity, foreign keys
```
The `assessments` table is generated from `src/constants/fields.js` so validation, DB columns and ML payload never drift apart.

## Run
```bash
npm run dev      # backend  → http://localhost:5000/api/health
```

## ML service
Three datasets describe **different people**, so they cannot be honestly joined into one training table. Each dataset trains
its own Random Forest; `app.py` combines their 0–100 scores with the weights in `ml_service/config.json`
(prototype defaults, **not clinically validated**).

| Model | Dataset | Score |
|---|---|---|
| maternal | Maternal Health Risk (Age, SystolicBP, DiastolicBP, BS, BodyTemp, HeartRate, RiskLevel) | 100 × expected ordinal risk (low 0, mid 0.5, high 1) |
| urinalysis | Urinalysis Tests (Color … Bacteria, Diagnosis) | 100 × P(positive) |
| fetal | Fetal Health Classification (21 CTG features) | 100 × (0.5·P(suspect)+P(pathological)) |

* **Baseline** (trimester 1) = maternal + urinalysis. **Extended** (trimester 2/3) = baseline + fetal.
* Units: temperature **°F**, blood sugar **mmol/L** (as in the maternal dataset).
* Triage thresholds (`triage_thresholds`) and fusion weights are configurable in `ml_service/config.json`.
* Contributing factors use **occlusion**: drop in final score when a feature is replaced by its training median/mode. Nothing is fabricated;
  if no feature passes `min_factor_points` the list is empty.
* `bmi`, `previous_complication`, `preexisting_diabetes`, `gestational_diabetes`, `mental_health` are **stored and shown** but are **not model inputs**
  (none of the three datasets contains them).

```bash
cd ml_service
python -m venv .venv && .venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
# put CSVs in ml_service/data/ then:
python train.py --maternal data/maternal.csv --urinalysis data/urinalysis.csv --fetal data/fetal_health.csv
python app.py                                       # http://127.0.0.1:8000/health
```
`train.py` prints every dataset's columns and stops with a clear message if a column name differs from what it expects.
Without trained models, assessment endpoints return **503** (no fake scores are ever produced).

## API (all responses `{success,data}` / `{success:false,message}`; send `Authorization: Bearer <token>`)
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | /api/auth/doctor/login | – | `{email \| worker_id, password}` |
| POST | /api/auth/patient/login | – | `{patient_id, password}` |
| GET | /api/auth/me | any | |
| POST | /api/patients | worker | `{name,date_of_birth,contact?,emergency_contact?,password}` |
| GET | /api/patients?q= | worker | search by patient ID / name |
| GET | /api/patients/:id | worker / own patient | `:id` = numeric id or `PAT-0001` |
| POST | /api/appointments | worker | `{patient_id,appointment_date,appointment_time,purpose}` |
| GET | /api/appointments/today · /calendar?from=&to= | worker | includes patient + latest risk/triage |
| GET | /api/patients/:id/appointments | worker / own | patients see risk only if approved |
| POST | /api/ml/baseline-risk · /trimester-risk | worker | stateless prediction |
| POST | /api/assessments | worker | `{patient_id,appointment_id?,trimester,…fields}` → validates → ML → saves |
| GET | /api/assessments/:id · /api/patients/:id/assessments | worker / own | patient: approved only |
| POST | /api/ai/recommendation | worker | `{assessmentId,regenerate?}` → Groq draft, status PENDING |
| PUT | /api/assessments/:id/recommendation | worker | `{text}` (withdraws approval if already approved) |
| POST | /api/assessments/:id/approve | worker | saves final text, worker, timestamp → APPROVED |
| POST | /api/assessments/:id/notes | worker | `{notes}` |
| GET | /api/patients/:id/timeline | worker / own | chronological; patient sees approved only |
| POST/GET | /api/patients/:id/menstrual-cycle | POST patient; GET worker/own | phases PRE_PREGNANCY / PREGNANCY / POST_PREGNANCY |
| GET · PUT | /api/notifications · /:id/read | any | reminders + approvals; worker gets alerts |
| POST | /api/notifications/run-reminders | worker | manual trigger (cron runs daily 09:00) |
| POST | /api/patients/:id/handoff-summary | worker / own | builds from approved stored data only |
| GET | /api/patients/:id/handoff-summary/download | worker / own | PDF (fetch as blob with the Bearer header) |
| POST | /api/patients/:id/pre-arrival | patient | SOS → notifies all workers; no ambulance dispatch |
| GET · PUT | /api/alerts/pre-arrival · /:id/acknowledge | worker | |

Assessment fields — baseline: `age, blood_sugar, body_temperature, heart_rate, systolic_bp, diastolic_bp`; urinalysis: `color, transparency, glucose, protein, ph, specific_gravity, wbc, rbc, epithelial_cells, mucous_threads, amorphous_urates, bacteria`;
trimester 2/3 also require the 21 fetal fields (`baseline_value … histogram_tendency`, see `src/constants/fields.js`). Missing fields → `422` with a per-field error list.

## Security & privacy notes
* bcrypt hashes; JWT auth; password hashes never returned; login rate-limited; helmet; CORS allow-list.
* Patients can only read their own records and **only worker-approved** results (unreviewed ML/AI output is hidden).
* Workers: `canWorkerAccessPatient()` in `src/middleware/auth.js` is the single place to restrict per-worker access (prototype allows all workers).
* Groq never receives names or contact details. Groq is instructed not to diagnose or prescribe; the worker approves everything.

## Frontend connection
Base URL `http://<backend-laptop-ip>:5000/api`. Add each frontend's origin to `CORS_ORIGINS`. Both frontends log in via their own endpoint and use the same API/DB.
