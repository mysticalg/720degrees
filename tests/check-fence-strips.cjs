const assert=require('node:assert/strict'),c=require('../src/terrain-collision.js');
// Two-cell post bases touch diagonally along an isometric fence. Collision
// must be continuous between posts, while an actual missing panel stays open.
for(const direction of [-1,1]) {
 const level={name:'city',kind:'city',columns:80,rows:40,sample(x,y){const col=Math.floor(x/8),row=Math.floor(y/8),start=direction===1?8+row*2:70-row*2;const fence=row>=4&&row<=24&&row!==14&&(col===start||col===start+1);return{type:0,profile:fence?(direction===1?87:95):24,blocked:false}}};
 for(let row=5;row<24;row++){
  if(row===13||row===14)continue;
  const x=(direction===1?8+row*2:70-row*2)*8+8,y=row*8+8;
  assert(c.blocked(level,x,y,true),`gap between matching fence posts ${direction}/${row}`);
 }
 const row=14,x=(direction===1?8+row*2:70-row*2)*8+8,y=row*8+4;
 assert(!c.blocked(level,x,y,true),'preserve missing panel');
 for(const mesh of [c.debugMesh(level,true),c.debugMesh(level,false)]){
  assert(mesh.paths.length<=2,'one continuous shape on either side of real gap');
  assert(mesh.segments.some(s=>Math.abs(s.b.x-s.a.x)>80&&Math.abs(s.b.y-s.a.y)>40),'long diagonal fence face');
 }
}
console.log('PASS continuous fence-post boundaries in both isometric directions, shared solid/overlay regions and real panel gaps');
