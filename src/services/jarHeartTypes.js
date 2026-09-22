import {heartTypes} from '../data/heartTypes.js';
import {jarHeartCount} from './jarHearts.js';
// Keep rare gifts visible even when the display compresses a large collection.
export function jarHeartTypes(types){
 const present=heartTypes.map(h=>({id:h.id,quantity:types[h.id]||0})).filter(h=>h.quantity>0);
 const total=present.reduce((sum,h)=>sum+h.quantity,0),count=jarHeartCount(total);
 if(!count)return [];
 const slots=present.map(h=>({...h,slots:count===total?h.quantity:1+Math.floor((count-present.length)*h.quantity/total),used:0}));
 let remaining=count-slots.reduce((sum,h)=>sum+h.slots,0);
 const remainder=[...slots].sort((a,b)=>((count-present.length)*b.quantity/total)%1-((count-present.length)*a.quantity/total)%1);
 for(let i=0;i<remaining;i++)remainder[i%remainder.length].slots++;
 return Array.from({length:count},(_,i)=>{
  const next=slots.filter(h=>h.used<h.slots).sort((a,b)=>(b.slots*(i+1)/count-b.used)-(a.slots*(i+1)/count-a.used))[0];
  next.used++;return next.id;
 });
}
