const test=require('node:test'),assert=require('node:assert/strict');
const {momentumStep,followVelocity,depthState}=require('../dist/camera.js');

test('released motion decelerates and never passes either shelf end',()=>{
 const next=momentumStep(300,1,16,2000);assert.ok(next.left>300);assert.ok(next.velocity>0&&next.velocity<1);
 assert.deepEqual(momentumStep(995,2,32,1000),{left:1000,velocity:0});
 assert.deepEqual(momentumStep(5,-2,32,1000),{left:0,velocity:0});
 assert.deepEqual(momentumStep(0,2,32,0),{left:0,velocity:0});
});

test('momentum distance is stable across frame rates',()=>{
 const whole=momentumStep(200,1.4,80,3000),half=momentumStep(200,1.4,40,3000),twice=momentumStep(half.left,half.velocity,40,3000);
 assert.ok(Math.abs(whole.left-twice.left)<1e-9);assert.ok(Math.abs(whole.velocity-twice.velocity)<1e-9);
});

test('continued motion settles without endlessly drifting',()=>{
 let state={left:1000,velocity:-1.5};for(let i=0;i<100;i++)state=momentumStep(state.left,state.velocity,16,3000);
 assert.equal(state.velocity,0);assert.ok(state.left>700&&state.left<1000);
});

test('mouse look has a stationary centre and symmetric, bounded edge speeds',()=>{
 for(const r of [.3,.5,.7])assert.equal(Math.abs(followVelocity(r,1000)),0);
 assert.ok(followVelocity(.1,1000)<0);assert.ok(followVelocity(.9,1000)>0);
 assert.ok(Math.abs(followVelocity(.1,1000)+followVelocity(.9,1000))<1e-9);
 assert.ok(Math.abs(followVelocity(-5,10000))<=.65);assert.ok(followVelocity(5,10000)<=.65);
});

test('depth effects are derived from view position and bounded independently of foods',()=>{
 const left=depthState(0,2000),right=depthState(2000,2000),centre=depthState(1000,2000);
 assert.equal(left.board,-right.board);assert.equal(left.floor,-right.floor);assert.equal(Math.abs(centre.board),0);
 assert.equal(depthState(999,0).fraction,.5);assert.equal(depthState(2000,2000,100).turn,2.5);
 assert.equal(depthState(0,2000,-100).turn,-2.5);
});
