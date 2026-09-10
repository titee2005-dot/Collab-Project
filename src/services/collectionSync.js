export function relativeSyncTime(timestamp,now=Date.now()){
 if(!timestamp)return 'ตรวจหัวใจล่าสุด';const seconds=Math.max(0,Math.floor((now-timestamp)/1000));
 if(seconds<10)return 'อัปเดตเมื่อสักครู่';if(seconds<60)return 'อัปเดต '+seconds+' วินาทีที่แล้ว';
 const minutes=Math.floor(seconds/60);if(minutes<60)return 'อัปเดต '+minutes+' นาทีที่แล้ว';
 return 'อัปเดต '+Math.floor(minutes/60)+' ชั่วโมงที่แล้ว';
}
export function createCollectionSync({fetchData,onData,onState,now=Date.now}){
 let current=null,busy=false,disposed=false,lastSyncedAt=null,cooldownUntil=0,manualState='idle',syncError='',initialError='',liveQueue=new Set(),queuedCause=null;
 const emit=()=>{if(!disposed)onState({lastSyncedAt,isRefreshing:busy,cooldownUntil,manualState,syncError,initialError});};
 async function refresh(cause='manual'){
  if(disposed)return false;
  if(cause==='manual'&&(busy||now()<cooldownUntil))return false;
  if(busy){if(cause==='live')queuedCause='live';else if(cause==='catchup'&&queuedCause!=='live')queuedCause='catchup';return false;}
  busy=true;if(cause==='manual'){cooldownUntil=now()+4000;manualState='checking';}syncError='';emit();
  const existingQueue=new Set(liveQueue),ids=cause==='live'?existingQueue:new Set();
  try{
   const data=await fetchData([...ids]);if(disposed)return false;
   if(!Array.isArray(data)||data.some(d=>!d||typeof d.id!=='string'||!['rose','praew'].includes(d.recipient)||!Number.isInteger(d.quantity)||d.quantity<1||!['pink','ruby','amber','golden'].includes(d.heartType)))throw Error('Invalid approved collection');
   const latestStamp=current?Math.max(0,...current.map(d=>Date.parse(d.approvedAt||d.createdAt)||0)):0;
   // A snapshot may include another fresh approval before its websocket message arrives.
   const liveDonations=current?data.filter(d=>ids.has(d.id)||(cause==='live'&&latestStamp>0&&!current.some(p=>p.id===d.id)&&Date.parse(d.approvedAt||d.createdAt)>latestStamp)):[];
   current=data;for(const id of ids)liveQueue.delete(id);if(cause!=='live')for(const id of existingQueue)if(data.some(d=>d.id===id))liveQueue.delete(id);
   lastSyncedAt=now();initialError='';syncError='';if(cause==='manual')manualState='success';
   onData(data,{cause,liveDonations});return true;
  }catch(e){
   if(!disposed){if(current===null)initialError='ยังโหลดคอลเลกชันไม่ได้ กรุณาลองอีกครั้ง';syncError='ตรวจหัวใจล่าสุดไม่สำเร็จ ลองอีกครั้งได้ครับ';if(cause==='manual')manualState='error';}
   return false;
  }finally{busy=false;emit();if(!disposed&&queuedCause){const next=queuedCause;queuedCause=null;queueMicrotask(()=>refresh(next));}}
 }
 function live(id){if(disposed||typeof id!=='string'||current?.some(d=>d.id===id)||liveQueue.has(id))return;liveQueue.add(id);return refresh('live');}
 return {refresh,live,getLastSyncedAt:()=>lastSyncedAt,dispose(){disposed=true;liveQueue.clear();queuedCause=null;}};
}
