/** Build the initial-class original city overlay cell list for PNG rendering. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),d=require(path.join(root,'src/original-map-decoder.js'));
const c={window:{Skate720:{}}};vm.runInNewContext(fs.readFileSync(path.join(root,'src/compressed-map-data.js'),'utf8'),c);
const data=c.window.Skate720.COMPRESSED_MAP_DATA,map=d.decodeLevel('city',data,b64=>Buffer.from(b64,'base64'));
const changes=d.applyCityOverlays(map,data.cityOverlays,()=>0);
fs.writeFileSync(path.join(root,'assets/city-overlay-cells.json'),JSON.stringify(changes));
console.log(`${data.cityOverlays.length} original overlay placements, ${changes.length} cell writes`);
