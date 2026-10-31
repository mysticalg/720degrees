const assert=require('node:assert/strict');
const rom=require('../src/original-routines.js');
assert.equal(rom.initialRaceCounter(0,1),32);
assert.equal(rom.initialRaceCounter(1,1),112);
let counter=32;
for(let frame=1;frame<=480;frame++)counter=rom.tickRaceCounter(counter,frame,3,1);
assert.equal(counter,2,'one decrement per16 frames');
for(let frame=481;frame<=720;frame++)counter=rom.tickRaceCounter(counter,frame,3,5);
assert.equal(counter,2,'original airborne action5 pauses time');
for(let phase of [0,1,2,4,5,6])assert.equal(rom.tickRaceCounter(2,16,phase,1),2);
assert.equal(rom.tickRaceCounter(2,16,3,9),1,'recovery still costs race time');
assert.equal(rom.tickRaceCounter(0,16,3,1),0);
assert.equal(rom.tickRaceCounter(65535,16,3,1),65535,'signed nonpositive words unchanged');
for(const reduced of[false,true]){
 let c=128,total=0;
 for(;;){const t=rom.tallyRaceCounter(c,reduced);c=t.counter;if(t.done){assert.equal(t.wait,96);break;}total+=t.award;}
 assert.equal(total,128*(reduced?50:100));assert.equal(c,0);
}
console.log('PASS ROM race setup,16-frame active clock,airborne pause,signed stop and50/100-point counter tally');
