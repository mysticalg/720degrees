const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const R = require("../src/original-ramp-score.js");
const context = {window:{Skate720:{}}};
vm.runInNewContext(fs.readFileSync(require.resolve("../src/landing-score-data.js"),"utf8"),context);
const d=context.window.Skate720.LANDING_SCORE_DATA;
assert.equal(d.rampTimeSpin.length,64);assert.equal(d.rampFirstUse.length,36);
assert.deepEqual(Array.from(d.rampFirstUse),[10,7,10,6,6,7,8,6,8,8,5,8,9,7,9,11,9,11,10,7,12,8,7,8,9,7,9,8,6,8,11,7,11,13,9,13]);
const base={action:0x45,variant:0,completed:0,flags:64,frames:0,rotation:0};
const s=R.begin();assert.equal(R.award(base,s,d).points,700);assert.equal(R.award(base,s,d).points,200);
assert.equal(R.award({...base,variant:18},s,d).points,700);
assert.equal(s.used.filter(Boolean).length,2);
const untouched=R.begin();assert.equal(R.award({...base,action:1},untouched,d).points,0);assert(untouched.used.every(n=>n===0));
for(let variant=0;variant<36;variant++)for(let spin=0;spin<8;spin++)for(let time=0;time<8;time++){
 const state=R.begin(),input={...base,variant,rotation:spin*144,frames:time*16,completed:2};
 const air=d.rampTimeSpin[spin*8+time],sum=d.rampFirstUse[variant]+2+air;
 assert.equal(R.award(input,state,d).points,(Math.min(9,Math.floor((sum+1)/2))+1)*100);
 assert.equal(R.award({...input,rotation:-input.rotation},state,d).points,(Math.min(9,Math.floor((2+air+1)/2))+1)*100);
}
for(const [frames,rotation,expected] of [[15,143,1],[16,144,2],[127,1008,10],[500,5000,10]])
 assert.equal(R.award({...base,frames,rotation},R.begin(),d).airBonus,expected);
assert.equal(R.award({...base,flags:0,frames:100,rotation:1000},R.begin(),d).airBonus,0);
assert.equal(R.award({...base,completed:255},R.begin(),d).points,1000);
console.log("PASS36 original ramp variants x64 spin/time cells, first-use/repeat state, signed spins, frame boundaries, flags and F064 cap");
