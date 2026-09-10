import {getNewDiscoveries} from '../services/progressionService';
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {refreshDonations,getCollectionStats} from '../services/donationService';
import {crossedMilestones} from '../services/memoryService';
import {createCollectionSync} from '../services/collectionSync';
import {createArrivalSession} from '../services/heartMemories';
import {crossedRoomStages} from '../data/roomEvolution';
import {backend,getSupabase} from '../services/supabaseClient';
const Context=createContext(null);
let arrivalSession;
export function CollectionProvider({children}){
 const [donations,setDonations]=useState([]),[stats,setStats]=useState(()=>getCollectionStats([])),[arrival,setArrival]=useState(null),[notice,setNotice]=useState(null),[evolution,setEvolution]=useState(null),[celebration,setCelebration]=useState(null);
 const [sync,setSync]=useState({lastSyncedAt:null,isRefreshing:false,cooldownUntil:0,manualState:'idle',syncError:'',initialError:''}),[realtimeConnectionState,setConnection]=useState('connecting');
 const reloadRef=useRef(()=>Promise.resolve(false));
 useEffect(()=>{
  let storage;try{storage=sessionStorage;}catch{}arrivalSession??=createArrivalSession(storage);
  let disposed=false,timer,channel,db,readyAt=Infinity,missedWhileHidden=false,hiddenAt=document.hidden?Date.now():null,queue=[],running=false,actual=getCollectionStats([]),display=actual;
  function showStats(){const next=structuredClone(actual);for(const d of queue){next[d.recipient].total=Math.max(0,next[d.recipient].total-d.quantity);next[d.recipient].types[d.heartType]=Math.max(0,next[d.recipient].types[d.heartType]-d.quantity);next.total=Math.max(0,next.total-d.quantity);}display=next;setStats(next);}
  function clearArrivals(){clearTimeout(timer);queue=[];running=false;setArrival(null);setNotice(null);setEvolution(null);showStats();}
  function play(){
   if(disposed||running||!queue.length||document.hidden)return;running=true;const d=queue[0];setArrival(d);setNotice(d);setEvolution(null);
   const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   timer=setTimeout(()=>{if(disposed)return;const before=display[d.recipient].total,sharedBefore=display.total;queue.shift();showStats();setArrival(null);setNotice({...d,landed:true,specials:getNewDiscoveries(sharedBefore,display.total)});
    const stages=crossedRoomStages(d.recipient,before,display[d.recipient].total);if(stages.length)setEvolution({id:d.id,recipient:d.recipient,stages});
    timer=setTimeout(()=>{running=false;setNotice(null);setEvolution(null);play();},1400);
   },reduced?150:1700);
  }
  const coordinator=createCollectionSync({fetchData:ids=>refreshDonations([...new Set([...ids,...queue.map(d=>d.id)])]),onState:setSync,onData:(data,{liveDonations})=>{
   setDonations(data);actual=data.collectionStats||getCollectionStats(data);
   // Refreshes/corrections update silently, including removal of an active memory.
   if(queue.some(d=>!data.some(row=>row.id===d.id&&row.quantity===d.quantity&&row.recipient===d.recipient&&row.heartType===d.heartType))){clearArrivals();}
   const incoming=liveDonations.filter(d=>arrivalSession.claim(d));
   if(!document.hidden){queue.push(...incoming.slice(0,Math.max(0,8-queue.length)));}
   showStats();play();
  }});
  reloadRef.current=()=>coordinator.refresh('manual');coordinator.refresh('initial');
  if(backend!=='local'){
   try{db=getSupabase();channel=db.channel('approved-heart-collection').on('postgres_changes',{event:'*',schema:'public',table:'heart_collection_events'},payload=>{
    if(disposed)return;if(document.hidden){missedWhileHidden=true;return;}
    if(payload.eventType==='INSERT'&&Date.parse(payload.new.approved_at)>=readyAt)coordinator.live(payload.new.id);else coordinator.refresh('catchup');
   }).subscribe(state=>{if(disposed)return;if(state==='SUBSCRIBED'){readyAt=Date.now();setConnection('live');coordinator.refresh('catchup');}else if(['CLOSED','CHANNEL_ERROR','TIMED_OUT'].includes(state)){readyAt=Infinity;setConnection('reconnecting');}});}catch{setConnection('reconnecting');}
  }else setConnection('offline');
  function visibility(){document.documentElement.classList.toggle('world-hidden',document.hidden);if(document.hidden){hiddenAt=Date.now();clearArrivals();return;}const last=coordinator.getLastSyncedAt();if(missedWhileHidden||(hiddenAt!==null&&Date.now()-hiddenAt>=60000&&(!last||Date.now()-last>=60000)))coordinator.refresh('catchup');missedWhileHidden=false;hiddenAt=null;}
  function online(){coordinator.refresh('catchup');}
  document.addEventListener('visibilitychange',visibility);window.addEventListener('online',online);
  return()=>{disposed=true;coordinator.dispose();clearTimeout(timer);if(channel)db.removeChannel(channel);document.documentElement.classList.remove('world-hidden');document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',online);};
 },[]);
 return <Context.Provider value={{donations,stats,error:sync.initialError,...sync,realtimeConnectionState,reload:()=>reloadRef.current(),refreshHeartCollection:()=>reloadRef.current(),arrival,notice,evolution,discoveries:[],celebration,replayCelebration:at=>setCelebration({id:'replay-'+at+'-'+Date.now(),milestones:crossedMilestones(at-1,at)}),dismissCelebration:()=>setCelebration(null),dismissDiscovery:()=>{}}}>{children}</Context.Provider>;
}
export const useCollection=()=>useContext(Context);
