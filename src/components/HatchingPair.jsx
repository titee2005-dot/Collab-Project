import {useState,useRef,useEffect} from 'react';
import HatchingGame from './HatchingGame';
import {getSupabase} from '../services/supabaseClient';
import {HATCH_TARGET,hatchProgress} from '../services/hatching';
export default function HatchingPair({onHatched,headless=false}){
 const [selected,setSelected]=useState('rose');
 const [global,setGlobal]=useState({rose:0,praew:0}),[pending,setPending]=useState({rose:0,praew:0}),[status,setStatus]=useState('กำลังเชื่อมยอดรวม…');
 const total=useRef(global),queue=useRef({rose:0,praew:0}),flight=useRef(null),client=useRef(crypto.randomUUID()),seq=useRef(0),busy=useRef(false),alive=useRef(false),ready=useRef(false);
 const persist=()=>{try{sessionStorage.setItem('heart-hatch-batch.v1',JSON.stringify({id:client.current,seq:seq.current,queue:queue.current,flight:flight.current}));}catch{}};
 function accept(value){const next=hatchProgress(value);total.current={rose:Math.max(total.current.rose,next.rose),praew:Math.max(total.current.praew,next.praew)};if(alive.current)setGlobal(total.current);}
 function tapEgg(r){if(!ready.current||total.current[r]>=HATCH_TARGET||queue.current.rose+queue.current.praew>=1000)return;queue.current={...queue.current,[r]:queue.current[r]+1};setPending({...queue.current});}
 useEffect(()=>{
  alive.current=true;const db=getSupabase();let settle,stopped=false;
  try{const saved=JSON.parse(sessionStorage.getItem('heart-hatch-batch.v1')||'null');if(saved&&/^[a-f0-9-]{36}$/.test(saved.id)&&Number.isSafeInteger(saved.seq)&&saved.seq>=0&&saved.seq<1000000000){client.current=saved.id;seq.current=saved.seq;queue.current=hatchProgress(saved.queue);const f=saved.flight;if(f&&f.p_client===saved.id&&f.p_seq===saved.seq+1&&Number.isInteger(f.p_rose)&&Number.isInteger(f.p_praew)&&f.p_rose>=0&&f.p_praew>=0&&f.p_rose+f.p_praew>0&&f.p_rose+f.p_praew<=100)flight.current=f;if(flight.current)ready.current=true;setPending({...queue.current});}}catch{}
  async function refresh(){if(stopped||busy.current||flight.current)return;const {data,error}=await db.rpc('heart_hatch');if(stopped||busy.current||flight.current)return;if(!error){accept(data);ready.current=true;setStatus('ยอดรวมทุกคน · อัปเดตประมาณทุก 2 วินาที');}else setStatus('เชื่อมต่อไม่ได้ กำลังลองใหม่');}
  async function flush(){persist();if(stopped||busy.current||!ready.current)return;if(!flight.current){const rose=Math.min(100,queue.current.rose),praew=Math.min(100-rose,queue.current.praew);if(!rose&&!praew)return;flight.current={p_client:client.current,p_seq:seq.current+1,p_rose:rose,p_praew:praew};persist();}busy.current=true;const batch=flight.current;try{const {data,error}=await db.rpc('heart_hatch',batch);if(error)throw error;seq.current=batch.p_seq;queue.current={rose:Math.max(0,queue.current.rose-batch.p_rose),praew:Math.max(0,queue.current.praew-batch.p_praew)};flight.current=null;persist();if(!stopped){accept(data);setPending({...queue.current});setStatus('ยอดรวมทุกคน · อัปเดตประมาณทุก 2 วินาที');}}catch{if(!stopped)setStatus('รอซิงก์ยอดกด อย่าเพิ่งปิดหน้านี้');}finally{busy.current=false;}}
  const channel=db.channel('global-hatching').on('postgres_changes',{event:'UPDATE',schema:'public',table:'heart_hatching'},({new:row})=>{if(stopped)return;if(!busy.current&&!flight.current)accept(row);clearTimeout(settle);settle=setTimeout(refresh,2200);}).subscribe(state=>{if(state==='SUBSCRIBED')refresh();if(state==='CHANNEL_ERROR'||state==='TIMED_OUT')setStatus('กำลังเชื่อมต่อยอดสดใหม่…');});
  refresh();const timer=setInterval(flush,2000),fallback=setInterval(()=>{if(document.visibilityState==='visible')refresh();},30000);
  const focus=()=>refresh();const hide=()=>persist();window.addEventListener('focus',focus);window.addEventListener('pagehide',hide);document.addEventListener('visibilitychange',hide);
  return()=>{stopped=true;alive.current=false;persist();clearInterval(timer);clearInterval(fallback);clearTimeout(settle);db.removeChannel(channel);window.removeEventListener('focus',focus);window.removeEventListener('pagehide',hide);document.removeEventListener('visibilitychange',hide);};
 },[]);
 const rose=global.rose>=HATCH_TARGET,praew=global.praew>=HATCH_TARGET;
 useEffect(()=>onHatched?.({rose,praew}),[rose,praew,onHatched]);

 if(headless)return null;
 return <section className="hatch-section"><header className="hatch-heading"><span>MINI GAME</span><h2>ช่วยกันฟักไข่ ♡</h2><p>ยอดรวมจากทุกคน · เป้าตัวละ 100,000 ครั้ง</p></header><div className="hatch-tabs" role="group" aria-label="เลือกไข่"><button aria-pressed={selected==='rose'} onClick={()=>setSelected('rose')}>โรส · กระต่าย</button><button aria-pressed={selected==='praew'} onClick={()=>setSelected('praew')}>แพรว · อัลปาก้า</button></div><p className="hatch-sync" role="status">{status}{pending.rose+pending.praew>0?' · รอส่ง '+(pending.rose+pending.praew)+' คลิก':''}</p><div className={'hatch-pair selected-'+selected}><div className="hatch-pane pane-rose"><HatchingGame recipient="rose" count={Math.min(HATCH_TARGET-1,global.rose+pending.rose)} completed={rose} onTap={()=>tapEgg('rose')} disabled={!ready.current||queue.current.rose+queue.current.praew>=1000}/></div><div className="hatch-pane pane-praew"><HatchingGame recipient="praew" count={Math.min(HATCH_TARGET-1,global.praew+pending.praew)} completed={praew} onTap={()=>tapEgg('praew')} disabled={!ready.current||queue.current.rose+queue.current.praew>=1000}/></div></div></section>;
}
