/* Shared auth helpers (sessionStorage). Portal key: 'patient' or 'doctor'. */
window.IruAuth = {
  save(role, token, user){ sessionStorage.setItem('iu_'+role, JSON.stringify({token, user})); },
  get(role){ try { return JSON.parse(sessionStorage.getItem('iu_'+role)); } catch(e){ return null; } },
  require(role, loginPage){ const s = this.get(role); if (!s) { location.replace(loginPage); return null; } return s; },
  async logout(role, loginPage){
    const s = this.get(role);
    try { await fetch(API_BASE_URL + '/api/auth/logout', {method:'POST', headers:{Authorization:'Bearer '+(s&&s.token)}}); } catch(e){}
    sessionStorage.removeItem('iu_'+role); location.replace(loginPage);
  },
  async api(role, path, opts){
    const s = this.get(role); opts = opts || {};
    opts.headers = Object.assign({'Content-Type':'application/json', Authorization:'Bearer '+(s&&s.token)}, opts.headers);
    const r = await fetch(API_BASE_URL + path, opts);
    if (r.status === 401) { sessionStorage.removeItem('iu_'+role); location.replace(role+'-login.html'); throw new Error('Session expired'); }
    return r.json();
  }
};
