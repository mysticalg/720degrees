/** Recover ECD0 price-mat writes for every FE7C price stage. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),d=require(path.join(root,'src/original-map-decoder.js'));
const c={window:{Skate720:{}}};vm.runInNewContext(fs.readFileSync(path.join(root,'src/compressed-map-data.js'),'utf8'),c);
const data=c.window.Skate720.COMPRESSED_MAP_DATA,overlays=data.cityOverlays.filter(o=>o.selector>=8);
const rows=[];
for(let variant=0;variant<10;variant++){
 const map=d.decodeLevel('city',data,b64=>Buffer.from(b64,'base64'));
 rows.push(d.applyCityOverlays(map,overlays,()=>variant));
}
fs.writeFileSync(path.join(root,'assets/shop-price-cells.json'),JSON.stringify({overlays,rows}));
console.log('Recovered',overlays.length,'price mats with ten variants each');
