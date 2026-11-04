const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const equipment=require('../src/original-equipment.js'),bail=require('../src/original-bail.js');
const scope={window:{Skate720:{}}};
for(const file of ['equipment-data.js','compressed-map-data.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../src/'+file,'utf8'),scope);
const data=scope.window.Skate720,prices=data.COMPRESSED_MAP_DATA.cityOverlays.filter(o=>o.selector>=8);
assert.equal(prices.length,4);
for(const mat of prices)assert.equal(mat.variants.length,10,'ECD0 price stages must not be truncated to three equipment variants');
for(let stage=0;stage<16;stage++){
 const variant=equipment.priceVariant(stage,data.EQUIPMENT_DATA);
 assert.equal(variant,Math.min(stage,9));
 assert.equal(equipment.price(stage,data.EQUIPMENT_DATA),Math.min(stage+1,10)*25);
 for(const mat of prices)assert(mat.variants[variant].length>0);
}
for(let helmet=0;helmet<4;helmet++){
 const limit=bail.helmetLimits[helmet];
 const low=bail.beginBail(limit-1,0,0,0,helmet,0,false,0,0,()=>0x4400);
 const high=bail.beginBail(limit,0,0,0,helmet,0,false,0,0,()=>0x4400);
 assert.equal(bail.soundCommand(low,2),0x54);
 for(let entropy=0;entropy<256;entropy++)assert.equal(bail.soundCommand(high,entropy),[0x56,0x5a,0x5b,0x56][entropy&3]);
 const slope=bail.beginBail(1300,0,0,2,helmet,0,false,0,0,()=>0x4400);
 assert.equal(bail.soundCommand(slope,2),0x54);
}
console.log('PASS four complete ECD0 price mats,16 purchase/display stages and A3C0/FCF6 bail-sound boundaries');
