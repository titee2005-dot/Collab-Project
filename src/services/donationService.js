import {crossedMilestones} from './memoryService.js';
import {mockDonations} from '../data/mockDonations.js';
import {heartTypes,resolveHearts} from '../data/heartTypes.js';
export const STORAGE_KEY='heart-collection.donations.v1';
const listeners=new Set();
export function validateDonation(d){
 if(!d || !['rose','praew'].includes(d.recipient)) throw new Error('Choose a recipient.');
 const [line]=resolveHearts(d);
 if(typeof d.supporterName!=='string' || d.supporterName.length>30 || (!d.anonymous&&!d.supporterName.trim())) throw new Error('Please add your name or send anonymously.');
 if(typeof d.message!=='string'||d.message.length>120) throw new Error('Keep your message within 120 characters.');
 if(d.socialUsername && (typeof d.socialUsername!=='string'||d.socialUsername.length>40)) throw new Error('Keep your social username within 40 characters.');
 return line;
}
export function getSavedDonations(){
 const raw=localStorage.getItem(STORAGE_KEY);
 if(!raw)return [];
 const data=JSON.parse(raw);
 if(!Array.isArray(data))throw new Error('Invalid archive');
 data.forEach(d=>{validateDonation(d);if(!d.id||!Number.isFinite(Date.parse(d.createdAt)))throw new Error('Invalid archive');});
 return data;
}
export const getDonations=()=>[...mockDonations,...getSavedDonations()];
export const getDonationById=id=>getDonations().find(d=>d.id===id);
export function createDonation(input){
 const line=validateDonation(input); const saved=getSavedDonations(); const before=getCollectionStats([...mockDonations,...saved]).total;
 const donation={...input,...line,id:crypto.randomUUID(),supporterName:input.anonymous?'Anonymous':input.supporterName.trim(),socialUsername:input.anonymous?'':(input.socialUsername||'').trim(),createdAt:new Date().toISOString(),specialHeart:null,memoryMilestones:crossedMilestones(before,before+line.quantity).map(m=>m.at)};
 localStorage.setItem(STORAGE_KEY,JSON.stringify([...saved,donation]));
 listeners.forEach(fn=>fn(donation));
 return donation;
}
export const subscribeToDonations=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export const getRecentDonations=(donations=getDonations(),limit=8)=>[...donations].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,limit);
export function getCollectionStats(donations){
 const stats={rose:{total:0,types:Object.fromEntries(heartTypes.map(h=>[h.id,0]))},praew:{total:0,types:Object.fromEntries(heartTypes.map(h=>[h.id,0]))},total:0};
 donations.forEach(d=>{stats[d.recipient].total+=d.quantity;stats[d.recipient].types[d.heartType]=(stats[d.recipient].types[d.heartType]||0)+d.quantity;stats.total+=d.quantity;});
 return stats;
}
export function searchSupporters(query,donations=getDonations()){
 const q=query.trim().toLowerCase();if(!q)return [];
 const names=new Set(donations.filter(d=>!d.anonymous&&[d.supporterName,d.socialUsername,d.id].some(v=>v?.toLowerCase().includes(q))).map(d=>d.supporterName.toLowerCase()));
 return [...names].map(key=>{const history=donations.filter(d=>!d.anonymous&&d.supporterName.toLowerCase()===key);return {name:history[0].supporterName,history,...getCollectionStats(history)};});
}


