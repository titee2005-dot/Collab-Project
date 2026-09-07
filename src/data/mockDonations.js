import {heartTypes} from './heartTypes.js';
const names=['Mint','Beam','Ploy','Fern','June','Fah','Mew','Prim','May','Jane','Krit','Ice','Pim','Pear','Yok','Aim','Nan','Mild'];
const counts={rose:[128,64,31,12],praew:[119,72,26,17]};
export const mockDonations = Object.entries(counts).flatMap(([recipient,values],r)=>values.flatMap((count,t)=>Array.from({length:count},(_,i)=>({id:`demo-${recipient}-${t}-${i}`,recipient,supporterName:names[(i+t*3+r)%names.length],anonymous:false,socialUsername:`@${names[(i+t*3+r)%names.length].toLowerCase()}`,heartType:heartTypes[t].id,quantity:1,amount:heartTypes[t].price,message:['Always cheering for you ♡','A little magic, just for you.','So happy to be part of your story.'][i%3],createdAt:new Date(Date.UTC(2026,8,7,6)-((i*8+t*2+r)*60000)).toISOString(),specialHeart:null}))));

