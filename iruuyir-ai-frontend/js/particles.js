// Shared login background: slow white particles that drift and gently move away from the cursor.
(function(){
const c=document.getElementById('bg');if(!c)return;const x=c.getContext('2d'),still=matchMedia('(prefers-reduced-motion: reduce)').matches;
let w,h,ps=[],m={x:-999,y:-999};
function size(){const r=c.getBoundingClientRect(),d=window.devicePixelRatio||1;w=r.width;h=r.height;c.width=w*d;c.height=h*d;x.setTransform(d,0,0,d,0,0);
 const n=Math.round(Math.min(60,Math.max(22,w*h/26000)));ps=Array.from({length:n},()=>({x:Math.random()*w,y:Math.random()*h,r:2+Math.random()*4,vx:(Math.random()-.5)*.25,vy:(Math.random()-.5)*.25,a:.25+Math.random()*.35,ox:0,oy:0}))}
function draw(){x.clearRect(0,0,w,h);
 for(const p of ps){p.x+=p.vx;p.y+=p.vy;if(p.x<-10)p.x=w+10;if(p.x>w+10)p.x=-10;if(p.y<-10)p.y=h+10;if(p.y>h+10)p.y=-10;
  const dx=p.x-m.x,dy=p.y-m.y,d=Math.hypot(dx,dy),R=140;let tx=0,ty=0;if(d<R&&d>0){const f=(1-d/R)*28;tx=dx/d*f;ty=dy/d*f}
  p.ox+=(tx-p.ox)*.08;p.oy+=(ty-p.oy)*.08;
  x.beginPath();x.arc(p.x+p.ox,p.y+p.oy,p.r,0,6.283);x.fillStyle='rgba(255,255,255,'+p.a+')';x.fill()}
 if(!still)requestAnimationFrame(draw)}
addEventListener('pointermove',e=>{const r=c.getBoundingClientRect();m.x=e.clientX-r.left;m.y=e.clientY-r.top});
addEventListener('pointerleave',()=>{m.x=m.y=-999});addEventListener('resize',size);size();draw();
})();
