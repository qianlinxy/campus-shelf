/* Input-driven shelf viewpoint. No camera, eye tracking or device sensors. */
(function(root){
 'use strict';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function momentumStep(left,velocity,dt,max){
  const decay=Math.exp(-Math.max(0,dt)/180),distance=velocity*180*(1-decay),next=clamp(left+distance,0,Math.max(0,max));
  return {left:next,velocity:next<=0||next>=max||Math.abs(velocity*decay)<.01?0:velocity*decay};
 }
 function followVelocity(relative,width){const offset=clamp(relative,0,1)-.5,edge=Math.max(0,Math.abs(offset)-.23)/.27;return Math.sign(offset)*edge*Math.min(.65,Math.max(.25,width/1500));}
 function depthState(left,max,speed=0){const fraction=max>0?clamp(left/max,0,1):.5,side=fraction*2-1;return {fraction,board:-side*14,floor:-side*24,upright:-side*1.5,turn:clamp(side*.8+speed*.8,-2.5,2.5),light:50+side*20};}
 function attach({viewport,scene,followButton,onState=()=>{},onModeChange=()=>{}}){
  let following=false,hoverSpeed=0,inertia=0,drag=null,frame=0,lastFrame=0,lastMotion=0,direction='still',speed=0,blockClick=false,previous=viewport.scrollLeft,previousTime=performance.now(),lastNotice='';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const max=()=>Math.max(0,viewport.scrollWidth-viewport.clientWidth);
  function notify(force=false){const key=following+'-'+direction;if(force||key!==lastNotice){lastNotice=key;onState({following,direction});}}
  function paint(force=false){const pose=depthState(viewport.scrollLeft,max(),reduced.matches?0:speed);scene.style.setProperty('--board-shift',pose.board.toFixed(2)+'px');scene.style.setProperty('--floor-shift',pose.floor.toFixed(2)+'px');scene.style.setProperty('--upright-shift',pose.upright.toFixed(2)+'px');scene.style.setProperty('--pack-turn',pose.turn.toFixed(2)+'deg');scene.style.setProperty('--scene-light',pose.light.toFixed(2)+'%');scene.dataset.cameraPosition=pose.fraction.toFixed(3);scene.dataset.direction=direction;scene.dataset.navigation=following?'follow':'drag';followButton.setAttribute('aria-pressed',String(following));notify(force);}
  function schedule(){if(!frame)frame=requestAnimationFrame(tick);}
  function observeScroll(){const now=performance.now(),left=viewport.scrollLeft,delta=left-previous;if(Math.abs(delta)>.1){speed=clamp(delta/Math.max(8,now-previousTime),-2.5,2.5);direction=delta>0?'right':'left';lastMotion=now;previous=left;previousTime=now;}paint();schedule();}
  function canFollow(){const r=viewport.getBoundingClientRect();return !document.hidden&&!document.querySelector('dialog[open]')&&r.bottom>0&&r.top<innerHeight;}
  function tick(now){frame=0;const dt=lastFrame?clamp(now-lastFrame,1,40):16;lastFrame=now;
   if(!drag&&following&&hoverSpeed){if(canFollow()){const old=viewport.scrollLeft;viewport.scrollLeft=clamp(old+hoverSpeed*dt,0,max());if(Math.abs(viewport.scrollLeft-old)<.1)hoverSpeed=0;else observeScroll();}else hoverSpeed=0;}
   else if(!drag&&inertia&&!document.hidden&&!document.querySelector('dialog[open]')){const next=momentumStep(viewport.scrollLeft,inertia,dt,max());viewport.scrollLeft=next.left;inertia=next.velocity;observeScroll();}
   else if(document.hidden||document.querySelector('dialog[open]')){hoverSpeed=0;inertia=0;}
   speed*=Math.exp(-dt/75);if(now-lastMotion>220)direction='still';paint();
   if(inertia||(!drag&&following&&hoverSpeed)||now-lastMotion<300)schedule();else lastFrame=0;
  }
  function stop(){hoverSpeed=0;inertia=0;speed=0;direction='still';lastMotion=0;lastFrame=0;if(frame)cancelAnimationFrame(frame);frame=0;previous=viewport.scrollLeft;previousTime=performance.now();paint();}
  function cancelDrag(){if(drag&&viewport.hasPointerCapture(drag.id))viewport.releasePointerCapture(drag.id);drag=null;viewport.classList.remove('is-dragging');}
  viewport.addEventListener('scroll',observeScroll,{passive:true});
  viewport.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){stop();return;}if(e.button!==0)return;stop();blockClick=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:viewport.scrollLeft,lastLeft:viewport.scrollLeft,time:e.timeStamp,velocity:0,moved:false};});
  viewport.addEventListener('pointermove',e=>{
   if(e.pointerType==='touch')return;
   if(drag&&e.pointerId===drag.id){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.moved&&Math.abs(dx)>6&&Math.abs(dx)>Math.abs(dy)*.8){drag.moved=true;blockClick=true;viewport.setPointerCapture(e.pointerId);viewport.classList.add('is-dragging');}
    if(drag.moved){e.preventDefault();viewport.scrollLeft=clamp(drag.left-dx,0,max());const dt=Math.max(8,e.timeStamp-drag.time),v=(viewport.scrollLeft-drag.lastLeft)/dt;drag.velocity=clamp(drag.velocity*.3+v*.7,-2,2);drag.time=e.timeStamp;drag.lastLeft=viewport.scrollLeft;observeScroll();}return;
   }
   if(following&&e.pointerType==='mouse'){const r=viewport.getBoundingClientRect(),relative=(e.clientX-r.left)/r.width,readingControl=relative>.1&&relative<.9&&e.target.closest('button,input,a,select,textarea');hoverSpeed=readingControl?0:followVelocity(relative,r.width);if(hoverSpeed)schedule();}
  });
  function endDrag(e){if(!drag||e.pointerId!==drag.id)return;const moved=drag.moved,velocity=drag.velocity,recent=e.timeStamp-drag.time<100;cancelDrag();if(e.type==='pointerup'&&moved&&recent&&!reduced.matches){inertia=velocity;schedule();}else if(e.type==='pointerup'&&!moved&&following&&!e.target.closest('button,input,a,select,textarea')){const r=viewport.getBoundingClientRect();hoverSpeed=followVelocity((e.clientX-r.left)/r.width,r.width);if(hoverSpeed)schedule();}setTimeout(()=>{blockClick=false;},0);}
  viewport.addEventListener('pointerup',endDrag);viewport.addEventListener('pointercancel',e=>{endDrag(e);stop();});
  viewport.addEventListener('pointerleave',()=>{hoverSpeed=0;if(drag&&!drag.moved)cancelDrag();});
  viewport.addEventListener('click',e=>{if(blockClick){e.preventDefault();e.stopImmediatePropagation();blockClick=false;}},true);
  followButton.addEventListener('click',()=>{following=!following;stop();paint(true);onModeChange(following?'follow':'drag');});
  viewport.addEventListener('keydown',e=>{if(e.key==='Escape'){following=false;cancelDrag();stop();paint(true);onModeChange('drag');}});
  window.addEventListener('blur',()=>{cancelDrag();stop();});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDrag();stop();}});
  return {refresh(){paint(true);},stop,reset(){following=false;cancelDrag();stop();paint(true);}};
 }
 const api={momentumStep,followVelocity,depthState,attach};root.CampusShelfCamera=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
