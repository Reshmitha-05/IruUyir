// Client-side session helper. Real access control MUST also be enforced by the backend (JWT / session).
const Auth={
token:()=>sessionStorage.getItem('iruuyir_token'),
user:()=>JSON.parse(sessionStorage.getItem('iruuyir_user')||'null')||{name:''},
set(t,u){sessionStorage.setItem('iruuyir_token',t);sessionStorage.setItem('iruuyir_user',JSON.stringify(u))},
requireAuth(){if(!this.token()){location.replace('doctor-login.html');return false}return true},
async logout(){try{await Api.logout()}catch(e){}sessionStorage.clear();location.replace('doctor-login.html')}};
// Block back-button access to protected pages after logout (bfcache)
window.addEventListener('pageshow',e=>{if(e.persisted&&document.body.dataset.protected&&!Auth.token())location.replace('doctor-login.html')});
