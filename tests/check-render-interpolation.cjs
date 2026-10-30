const assert = require('node:assert/strict');
const r = require('../src/render-interpolation.js');
const actor = {actorX:20,actorY:30,height:0,pointer:1234};
const g = {mode:'city',event:null,paused:false,player:{x:100,y:200,z:0,romSpeed:2400},camera:{x:100,y:200},cityActors:[],trafficActors:[actor],bees:{x:10,y:20},score:123};
const old=r.capture(g);g.player.x=108;g.player.y=196;g.player.z=4;g.camera.x=102;actor.actorX=24;g.bees.x=12;
const before=JSON.stringify(g);
for(const alpha of [0,.25,.5,.75,1]){const v=r.view(g,old,alpha);assert.equal(v.player.x,100+8*alpha);assert.equal(v.player.z,4*alpha);assert.equal(v.camera.x,100+2*alpha);assert.equal(v.trafficActors[0].actorX,20+4*alpha);assert.equal(v.bees.x,10+2*alpha);assert.equal(v.score,123);assert.equal(v.player.romSpeed,2400);assert.equal(v.trafficActors[0].pointer,1234);assert.equal(JSON.stringify(g),before)}
const replacement={...g.player,x:5};g.player=replacement;assert.equal(r.view(g,old,.5).player,replacement);g.player=old.player.source;g.player.x=1000;assert.equal(r.view(g,old,.5).player,g.player);g.paused=true;assert.equal(r.view(g,old,.5),g);g.paused=false;g.event={kind:'ramp'};assert.equal(r.view(g,old,.5),g);g.event=null;g.mode='event';assert.equal(r.view(g,old,.5),g);console.log('PASS render interpolation: fractional player/camera/traffic/bee positions; no simulation mutation; resets, teleports, pause and park changes snap');
