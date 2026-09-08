import {heartTypes} from '../data/heartTypes.js';
import {api} from './api.js';
let cache=[];
export const getDonations=()=>cache;
export async function refreshDonations(){const data=await api('/donations');if(!Array.isArray(data))throw new Error('ข้อมูลโดเนทไม่ถูกต้อง');cache=data;return data;}
export const getDonationById=id=>cache.find(d=>d.id===id);
export const getRecentDonations=(donations=cache,limit=8)=>[...donations].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,limit);
export function getCollectionStats(donations){
 const stats={rose:{total:0,types:Object.fromEntries(heartTypes.map(h=>[h.id,0]))},praew:{total:0,types:Object.fromEntries(heartTypes.map(h=>[h.id,0]))},total:0};
 donations.forEach(d=>{stats[d.recipient].total+=d.quantity;stats[d.recipient].types[d.heartType]=(stats[d.recipient].types[d.heartType]||0)+d.quantity;stats.total+=d.quantity;});return stats;
}
export function searchSupporters(query,donations=cache){
 const q=query.trim().toLowerCase();if(!q)return [];
 const names=new Set(donations.filter(d=>!d.anonymous&&[d.supporterName,d.socialUsername,d.id].some(v=>v?.toLowerCase().includes(q))).map(d=>d.supporterName.toLowerCase()));
 return [...names].map(key=>{const history=donations.filter(d=>!d.anonymous&&d.supporterName.toLowerCase()===key);return {name:history[0].supporterName,history,...getCollectionStats(history)};});
}
