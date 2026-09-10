import {useState,useEffect} from 'react';
import {Sparkles} from 'lucide-react';
import {useCollection} from '../hooks/useCollection';
import {relativeSyncTime} from '../services/collectionSync';
export default function LatestHeartUpdate(){
 const {lastSyncedAt}=useCollection();const [now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[]);
 return <div className="latest-heart-update"><span className="heart-update-time" title={lastSyncedAt?'อัปเดตล่าสุด '+new Date(lastSyncedAt).toLocaleString('th-TH'):undefined}><Sparkles size={12} aria-hidden="true"/><span>{lastSyncedAt?'หัวใจ'+relativeSyncTime(lastSyncedAt,now):'กำลังโหลดข้อมูลหัวใจ…'}</span></span></div>;
}
