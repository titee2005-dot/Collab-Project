import {petBathEnabled} from '../games/catalog';
import {useCallback,useEffect,useRef,useState} from 'react';
import {getSupabase} from '../services/supabaseClient';
import {bathRooms,bathStage,mergeBathRooms} from '../services/petBath';
export function usePetBath(){
 const [rooms,setRooms]=useState(()=>bathRooms()),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const state=useRef(rooms),alive=useRef(false),lock=useRef(false),pending=useRef(null),request=useRef(0),accepted=useRef(0);
 const publish=useCallback((data,seq)=>{if(!alive.current||seq<accepted.current)return;accepted.current=seq;const next=mergeBathRooms(state.current,data);state.current=next;setRooms(next);setLoading(false);setError('');},[]);
 const refresh=useCallback(async()=>{if(!petBathEnabled||lock.current)return;const seq=++request.current;try{const {data,error}=await getSupabase().rpc('heart_pet_bath').abortSignal(AbortSignal.timeout(15000));if(error)throw error;publish(data,seq);}catch{if(alive.current){setLoading(false);setError('ยังเชื่อมต่อเกมไม่ได้ กรุณาลองอีกครั้ง');}}},[publish]);
 useEffect(()=>{if(!petBathEnabled){setLoading(false);return;}alive.current=true;refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh();},5000);const focus=()=>{if(document.visibilityState==='visible')refresh();};document.addEventListener('visibilitychange',focus);return()=>{alive.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',focus);};},[refresh]);
 const act=useCallback(async(recipient,action)=>{
  if(!petBathEnabled||lock.current||!alive.current)return false;const room=state.current[recipient];if(!room?.hatched)return false;
  lock.current=true;setBusy(true);setError('');
  const retry=pending.current;
  const args=retry||{p_recipient:recipient,p_action:action,p_round:room.round,p_stage:bathStage(room.progress),p_request:crypto.randomUUID()};pending.current=args;
  const seq=++request.current;
  try{const {data,error}=await getSupabase().rpc('heart_pet_bath',args).abortSignal(AbortSignal.timeout(15000));if(error)throw error;pending.current=null;publish(data,seq);return data?.[recipient]?.progress>room.progress&&args.p_recipient===recipient;}
  catch{if(alive.current)setError('ส่งไม่สำเร็จ กดช่วยอีกครั้งเพื่อลองส่งรายการเดิม');return false;}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 },[publish]);
 return {rooms,loading,error,busy,help:recipient=>act(recipient,'help'),start:recipient=>act(recipient,'start'),refresh};
}
