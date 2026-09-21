// Show each of the first twenty gifts, then compress the growing pile.
export function jarHeartCount(total){return Math.min(96,total<=20?Math.max(0,Math.floor(total)):20+Math.ceil((total-20)/5));}
const noise=(index,salt)=>{const n=Math.sin(index*127.1+salt*311.7)*43758.5453;return n-Math.floor(n);};
// Settle each gift against the curved floor and the gifts already below it.
// Seeded candidates keep the pile stable across renders, without visible rows.
const pile=[];
for(let i=0;i<96;i++){
 const radius=5.7+noise(i,1)*1.5;
 let best;
 for(let candidate=0;candidate<(i===0?1:64);candidate++){
  const x=i===0?50:12+noise(i*64+candidate,2)*76;
  let bottom=3+Math.pow(x-50,2)*.011;
  for(const other of pile){
   const dx=Math.abs(x-other.x),reach=radius+other.radius;
   if(dx<reach)bottom=Math.max(bottom,other.bottom+Math.sqrt(reach*reach-dx*dx)*.30);
  }
  const score=bottom+Math.abs(x-50)*.035;
  if(!best||score<best.score)best={x,bottom,radius,score};
 }
 pile.push(best);
}
export function jarHeartPosition(index,total){
 const point=pile[Math.max(0,Math.min(95,index))];
 const settle=Math.min(1,Math.max(0,(total-20)/100));
 const variation=index===0?0:noise(index,3)*5-2.5;
 return {left:`${point.x}%`,bottom:`${3+(point.bottom-3)*(1.12-.12*settle)}%`,width:`${34-10*settle+variation}px`,transform:`translateX(-50%) rotate(${noise(index,4)*76-38}deg)`,animationDelay:'0s'};
}
