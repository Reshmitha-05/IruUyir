/* IruUyir shared behaviour v1.0 - used by BOTH portals. Exposes window.IruUyir */
(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Smooth page transition: any <a data-transition> or [data-href] fades out, then navigates */
  function go(url){
    if (reduce) { location.href = url; return; }
    document.body.classList.add('iu-leaving');
    setTimeout(() => { location.href = url; }, 220);
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-href], a[data-transition]');
    if (!el) return;
    e.preventDefault();
    go(el.dataset.href || el.getAttribute('href'));
  });
  window.addEventListener('pageshow', e => { if (e.persisted) document.body.classList.remove('iu-leaving'); });

  /* Modal */
  const modal = {
    open(id){ const m = document.getElementById(id); if (m) { m.classList.add('open'); m.querySelector('button,input')?.focus(); } },
    close(id){ document.getElementById(id)?.classList.remove('open'); }
  };
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
    const c = e.target.closest('[data-modal-close]');
    if (c) c.closest('.modal-overlay').classList.remove('open');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  });

  /* Toast: IruUyir.toast('Title', 'Message', 'success|warning|error') */
  function toast(title, message, type, ms){
    let stack = document.querySelector('.toast-stack');
    if (!stack) { stack = document.createElement('div'); stack.className = 'toast-stack'; stack.setAttribute('role','status'); document.body.appendChild(stack); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    const s = document.createElement('strong'); s.textContent = title;
    t.appendChild(s);
    if (message) t.appendChild(document.createTextNode(message));
    stack.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, ms || 5000);
  }

  /* Button loading state: IruUyir.loading(btn, true|false) */
  function loading(btn, on){ btn.classList.toggle('is-loading', !!on); btn.disabled = !!on; }

  /* Risk helpers: score 0-100 -> level. Thresholds are placeholders; align with the backend's triage output. */
  function riskClass(level){ return String(level || '').toLowerCase(); }
  function riskBadge(score, level){
    const el = document.createElement('span');
    el.className = 'risk-badge ' + riskClass(level);
    el.textContent = (score != null ? score + ' / 100 · ' : '') + level;
    return el;
  }

  /* Login background: subtle white particles that drift and shift slightly with the cursor */
  function initLoginBackground(canvasId){
    const canvas = document.getElementById(canvasId || 'iu-particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, dpr, parts = [], mx = 0, my = 0, tx = 0, ty = 0;
    function resize(){
      dpr = window.devicePixelRatio || 1; w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
      const n = Math.min(60, Math.round(w * h / 22000));
      parts = Array.from({length:n}, () => ({
        x: Math.random()*w, y: Math.random()*h, r: 1.5 + Math.random()*3.5,
        vx: (Math.random()-.5)*.18, vy: (Math.random()-.5)*.18,
        depth: .3 + Math.random()*.9, a: .15 + Math.random()*.35
      }));
    }
    window.addEventListener('mousemove', e => { tx = (e.clientX / w - .5); ty = (e.clientY / h - .5); });
    window.addEventListener('resize', resize); resize();
    function frame(){
      mx += (tx - mx) * .05; my += (ty - my) * .05;
      ctx.clearRect(0,0,w,h);
      for (const p of parts){
        if (!reduce){ p.x += p.vx; p.y += p.vy; }
        if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
        ctx.beginPath();
        ctx.arc(p.x - mx * 40 * p.depth, p.y - my * 40 * p.depth, p.r, 0, 6.283);
        ctx.fillStyle = 'rgba(255,255,255,' + p.a + ')'; ctx.fill();
      }
      if (!reduce) requestAnimationFrame(frame);
    }
    frame();
  }

  window.IruUyir = { go, modal, toast, loading, riskBadge, initLoginBackground };
})();
