import {heartTypes} from '../data/heartTypes.js';
export function publicMemory(d){
 if(!d || d.status && d.status!=='approved' || !Number.isInteger(d.quantity)||d.quantity<1||!['rose','praew'].includes(d.recipient)||!heartTypes.some(h=>h.id===d.heartType))return null;
 return {id:d.id,recipient:d.recipient,heartType:d.heartType,quantity:d.quantity,anonymous:!!d.anonymous,supporterName:d.anonymous?'A Mysterious Supporter':d.supporterName||'A Mysterious Supporter',socialUsername:d.anonymous?'':d.socialUsername||'',message:d.message||'',createdAt:d.approvedAt||d.createdAt,approvedAt:d.approvedAt||d.createdAt,amount:d.amount,source:d.source,memoryMilestones:d.memoryMilestones||[]};
}
export function representativeHearts(donations,recipient,limit=10){
 const rows=donations.filter(d=>d.recipient===recipient).map(publicMemory).filter(Boolean).slice().reverse();const result=[];
 for(let index=1;result.length<limit;index++){let added=false;for(const d of rows){if(index<=d.quantity&&result.length<limit){result.push({id:d.id+'-heart-'+index,memory:d});added=true;}}if(!added)break;}
 return result;
}
export function createArrivalSession(storage){
 let seen=new Set();try{seen=new Set(JSON.parse(storage?.getItem('heart-arrivals.v1')||'[]'));}catch{}
 return {claim(d){const key=d.id+'|'+(d.approvedAt||d.createdAt);if(seen.has(key))return false;seen.add(key);try{storage?.setItem('heart-arrivals.v1',JSON.stringify([...seen]));}catch{}return true;}};
}
