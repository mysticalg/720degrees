const assert = require("node:assert/strict"), S = require("../src/original-actor-spawning.js");
//The reported record: kind57, dynamic slot117, packed358. Its static
//directory lookup isFFFF. BDCA doublesFFFF toFFFE before indexed addressing.
for (const bottom of [false,true]) for(let offset=0;offset<64;offset++) {
 const ram=new Uint8Array(4096),seen=[];
 const put=(a,n)=>{ram[a]=n&255;ram[a+1]=(n>>8)&255;};
 put(0x224,bottom?5:6);put(0x226,bottom?6:7);
 put(0x228,336);put(0x22a,352);put(0x9a6,bottom?0:1);put(0x9a4,1);
 const m={readRamByte:a=>ram[a],readObjectWord:a=>{assert.equal(a,0x7a00+358*2);return 65535;},
 readCoordinateWord:a=>{assert(a>=0x4000&&a<0x6000);seen.push(a);return 0;}};
 S.placementVisible(358+512*offset,m);
 const index=(offset-1)&65535;
 assert.deepEqual(seen,[(0x5580+index*2)&65535,(0x4ac0+index*2)&65535]);
}
console.log("PASS reported traffic record and128 top/bottom coordinate lookups retain16-bit CPU address wrap");
