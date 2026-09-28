# IruUyir shared frontend

`shared/` is the single source of truth for BOTH portals. Do not copy it, edit tokens, or add page-level colours/fonts.
Changes to `shared/` go through a pull request reviewed by both developers.

```
index.html                 role selection (common entry)
shared/css/iruuyir.css     tokens + all components
shared/js/iruuyir.js       transitions, modal, toast, loading, risk badge, login particles
shared/components.html     visual reference: open it to copy markup
shared/assets/             logo goes here (replace .logo-placeholder)
doctor-login.html          healthcare-worker developer
patient-login.html         patient developer
```

Each page: `<link rel="stylesheet" href="shared/css/iruuyir.css">` and `<script src="shared/js/iruuyir.js"></script>`
(adjust the relative path if pages live in subfolders). Keep `API_BASE_URL` in a `config.js` per portal, never inline.

## Login page skeleton (identical for both portals)
```html
<body class="login-page">
  <canvas id="iu-particles"></canvas>
  <main class="login-card">
    <div class="login-head"><div class="logo-placeholder">LOGO<br>PLACEHOLDER</div><h1>IruUyir</h1><p class="muted small">Maternal Healthcare &amp; Triage Support</p></div>
    <!-- .field > label + .input  (doctor: their fields / patient: Patient ID, Password, Date of Birth) -->
    <div class="btn-row"><button class="btn btn-secondary" data-href="index.html">Back</button><button class="btn btn-primary">Login</button></div>
  </main>
  <script src="shared/js/iruuyir.js"></script>
  <script>IruUyir.initLoginBackground();</script>
</body>
```
Risk colours: use `.risk-badge`, `.risk-score`, `.timeline-item` with `high|medium|low`.
Use `IruUyir.go(url)` or `data-href` for navigation so transitions stay consistent.
