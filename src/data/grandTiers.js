import {specialHearts} from './specialHearts.js';
const accents={moon:{ink:'#654198',soft:'#eee5fa',symbol:'☾'},crystal:{ink:'#286e7d',soft:'#def3f5',symbol:'✧'},angel:{ink:'#665578',soft:'#eee9f5',symbol:'✦'},eternal:{ink:'#9b315f',soft:'#fae0eb',symbol:'∞'}};
export const grandTiers=[{at:0,name:'Little Love',color:'#ce92b7',ink:'#8e456f',soft:'#f5e1ed',symbol:'♡'},...specialHearts.map(h=>({id:h.id,at:h.unlock,name:h.name,color:h.color,...accents[h.id]}))];
export function grandTier(total){const index=grandTiers.findLastIndex(t=>total>=t.at),i=Math.max(0,index),current=grandTiers[i],next=grandTiers[i+1]||null;return {index:i,current,next,value:next?Math.max(0,total-current.at):1,max:next?next.at-current.at:1};}
