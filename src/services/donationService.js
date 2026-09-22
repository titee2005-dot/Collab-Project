import {heartTypes,pointsForHeart} from '../data/heartTypes.js';
import {api} from './api.js';
import {backend,getSupabase} from './supabaseClient.js';
import {publicMemory} from './heartMemories.js';
let cache=[];
export const getDonations=()=>cache;
export async function refreshDonations(ids=[]){
 if(backend==='local'){const data=await api('/donations');cache=data.map(publicMemory).filter(Boolean);return cache;}
 const uniqueIds=[...new Set(ids)],batches=[];
 for(let i=0;i<Math.max(1,uniqueIds.length);i+=100)batches.push(uniqueIds.slice(i,i+100));
 const snapshots=await Promise.all(batches.map(async p_ids=>{const {data,error}=await getSupabase().rpc('heart_world',{p_ids});if(error)throw error;return data;}));
 const merged=new Map();for(const snapshot of snapshots)for(const d of snapshot.donations){const memory=publicMemory(d);if(memory)merged.set(memory.id,memory);}
 const rows=[...merged.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));rows.collectionStats=getCollectionStats(snapshots.at(-1).groups);cache=rows;return rows;
}
export async function fetchMemories({recipient=null,type=null,search='',oldest=false,cursor=null,ids=null}={}){
 if(backend==='local'){const data=(await api('/donations')).map(publicMemory).filter(Boolean).filter(d=>(!recipient||d.recipient===recipient)&&(!type||d.heartType===type)&&(!ids||ids.includes(d.id))&&(!search||!d.anonymous&&d.supporterName.toLowerCase().includes(search.toLowerCase())||d.id===search)).sort((a,b)=>(a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))*(oldest?1:-1));return data.filter(d=>!cursor||((d.createdAt.localeCompare(cursor.stamp)||d.id.localeCompare(cursor.id))*(oldest?1:-1)>0)).slice(0,24);}
 if(ids?.length>100){const rows=[];for(let i=0;i<ids.length;i+=100)rows.push(...await fetchMemories({recipient,type,search,oldest,cursor,ids:ids.slice(i,i+100)}));return rows.sort((a,b)=>(a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))*(oldest?1:-1)).slice(0,24);}
 const {data,error}=await getSupabase().rpc('heart_memories',{p_recipient:recipient,p_type:type,p_search:search,p_oldest:oldest,p_cursor:cursor,p_ids:ids});if(error)throw error;return data.map(publicMemory).filter(Boolean);
}
export const getDonationById=id=>cache.find(d=>d.id===id);
export const getRecentDonations=(donations=cache,limit=8)=>[...donations].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,limit);
export function getCollectionStats(donations){
 const room=()=>({total:0,points:0,types:Object.fromEntries(heartTypes.map(h=>[h.id,0]))});
 const stats={rose:room(),praew:room(),total:0,points:0};
 donations.forEach(d=>{const target=stats[d.recipient];if(!target)return;target.total+=d.quantity;target.points+=pointsForHeart(d.heartType,d.quantity);target.types[d.heartType]=(target.types[d.heartType]||0)+d.quantity;stats.total+=d.quantity;stats.points+=pointsForHeart(d.heartType,d.quantity);});return stats;
}
export function searchSupporters(query,donations=cache){
 const q=query.trim().toLowerCase();if(!q)return [];
 const names=new Set(donations.filter(d=>!d.anonymous&&[d.supporterName,d.socialUsername,d.id].some(v=>v?.toLowerCase().includes(q))).map(d=>d.supporterName.toLowerCase()));
 return [...names].map(key=>{const history=donations.filter(d=>!d.anonymous&&d.supporterName.toLowerCase()===key);return {name:history[0].supporterName,history,...getCollectionStats(history)};});
}
