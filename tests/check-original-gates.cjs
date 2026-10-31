const assert=require('node:assert/strict'),actors=require('../src/original-actors.js');
// CB64 waits on its route deadline; CC5A stops an uncompleted gate.
let a={duration:10,routeFlags:4,bitmapIndex:10,dx:123,dy:45,extraPointer:0x7208};
const m=(group,mask)=>({readTraitByte:()=>group,readRamByte:()=>mask});
assert.equal(actors.gateRouteDue(a,m(1,1)),false);assert.equal(a.duration,9);assert.equal(a.extraPointer,0x7208);
for(let group=0;group<=4;group++)for(let mask=0;mask<16;mask++){
 a={duration:1,routeFlags:4,bitmapIndex:10,dx:123,dy:45,extraPointer:0x7208};
 const advance=actors.gateRouteDue(a,m(group,mask));
 const completed=!!(group&&(mask&(1<<(group-1))));assert.equal(advance,completed);
 if(completed){assert.equal(a.extraPointer,0);assert.equal(a.dx,123)}else{assert.equal(a.dx,0);assert.equal(a.dy,0);assert.equal(a.duration,0);assert.equal(a.extraPointer,0x7208)}
}
console.log('PASS original gate deadline, all four completion bits, stop and contact-mask release');
