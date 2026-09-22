import {ArrowUpRight,Check,ChevronRight,Clock3,RefreshCw} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import {usePetBath} from '../hooks/usePetBath';
import {BATH_GOAL,bathStage} from '../services/petBath';
import {FamiliarArt} from './Familiar';
import {PetBathArtwork} from './PetBathArtwork';
import '../styles/pet-bath.css';

const ROOM_META={
 rose:{name:'โรส',animal:'กระต่าย',kind:'rabbit',tone:'rose'},
 praew:{name:'แพรว',animal:'อัลปาก้า',kind:'alpaca',tone:'praew'}
};

const STAGES=[
 {key:'leaves',label:'เก็บใบไม้',range:'0–99,999',start:0,end:100000,hint:'แตะหรือปัดที่ตัวเพื่อเก็บใบไม้'},
 {key:'soap',label:'ถูสบู่',range:'100,000–299,999',start:100000,end:300000,hint:'แตะหรือปัดที่ตัวเพื่อถูสบู่'},
 {key:'rinse',label:'ล้างฟอง',range:'300,000–399,999',start:300000,end:400000,hint:'แตะหรือปัดที่ตัวเพื่อชะฟองออก'},
 {key:'dry',label:'เช็ดตัว',range:'400,000–499,999',start:400000,end:BATH_GOAL,hint:'แตะหรือปัดที่ตัวเพื่อเช็ดให้แห้ง'}
];

const DRAG_THROTTLE_MS=150;

function formatCount(value){
 return Number(value||0).toLocaleString('en-US');
}

function stageProgress(progress,stage){
 const item=STAGES[stage];
 if(!item)return 1;
 return Math.max(0,Math.min(1,(progress-item.start)/(item.end-item.start)));
}

function StatusMessage({error,onRetry}){
 if(!error)return null;
 return <div className="pet-bath-error" role="alert"><span>{error}</span><button type="button" onClick={onRetry}><RefreshCw size={15}/>ลองใหม่</button></div>;
}

function RoomTabs({selected,onSelect}){
 return <div className="pet-bath-room-tabs" role="tablist" aria-label="เลือกเจ้าตัวน้อยที่จะอาบน้ำ">
  {Object.entries(ROOM_META).map(([id,meta])=><button key={id} type="button" role="tab" aria-selected={selected===id} aria-controls={'pet-bath-panel-'+id} className={'pet-bath-room-tab pet-bath-room-tab-'+meta.tone} onClick={()=>onSelect(id)}>
   <span className="pet-bath-room-tab-icon" aria-hidden="true"><PetBathArtwork type={id==='rose'?'moon':'sun'}/></span><span><b>{meta.name}</b><small>{meta.animal}</small></span><ChevronRight size={16} aria-hidden="true"/>
  </button>)}
 </div>;
}

function StageRail({progress}){
 const stage=bathStage(progress);
 return <ol className="pet-bath-stage-rail" aria-label="ขั้นตอนการอาบน้ำ">
  {STAGES.map((item,index)=>{
   const done=stage>index;
   const current=stage===index;
   return <li key={item.key} className={(done?'is-done ':'')+(current?'is-current':'')}><span className="pet-bath-stage-dot" aria-hidden="true">{done?<Check size={13}/>:index+1}</span><span><b>{item.label}</b></span></li>;
  })}
 </ol>;
}

function AnimalEffects({stage,progress}){
 const local=stageProgress(progress,stage);
 if(stage===0){
  const leafCount=Math.max(1,5-Math.floor(local*5));
  return <div className="bath-body-effects" aria-hidden="true"><div className="bath-body-mud" style={{opacity:Math.max(.15,1-local)}}/>{Array.from({length:leafCount},(_,index)=><PetBathArtwork key={index} type="leaf" className={'bath-body-leaf leaf-'+index} width={34} height={34}/>)}</div>;
 }
 if(stage===1)return <div className="bath-body-effects" aria-hidden="true"><PetBathArtwork type="soap" className="bath-body-soap" style={{opacity:.35+local*.65}}/></div>;
 if(stage===2)return <div className="bath-body-effects" aria-hidden="true"><PetBathArtwork type="bubbles" className="bath-body-foam" style={{opacity:Math.max(.3,1-local*.7)}}/></div>;
 return <div className="bath-body-effects" aria-hidden="true"><PetBathArtwork type="towel" className="bath-body-cloth" style={{left:(18+local*54)+'%'}} width={76} height={56}/></div>;
}

function CompletionCard({meta}){
 return <section className="pet-bath-complete" aria-label={meta.name+'อาบน้ำเสร็จแล้ว'}>
  <div className="pet-bath-clean-scene"><div className="pet-bath-clean-glow" aria-hidden="true"/><FamiliarArt kind={meta.kind} awake/><PetBathArtwork type="towel" className="pet-bath-clean-towel" title="ผ้าขนหนูสะอาด"/><PetBathArtwork type="bubbles" className="pet-bath-clean-bubbles"/></div>
  <div className="pet-bath-complete-copy"><PetBathArtwork type="spark" className="pet-bath-complete-mark"/><h3>สะอาดเอี่ยมแล้ว!</h3><p>{meta.name}ดูสดใสและนุ่มฟูมาก ขอบคุณที่ช่วยกันดูแลนะ</p><div className="pet-bath-reward-earned"><b>+20 คะแนนไอเทม</b><small>รางวัลภารกิจประจำวันนี้ของห้องนี้</small></div><p className="pet-bath-wait" role="status"><Clock3 size={14}/>วันนี้ช่วยกันครบแล้ว พบกันพรุ่งนี้หลัง 00:00 น. เวลาไทย</p></div>
 </section>;
}

export default function PetBath(){
 const {rooms,loading,error,busy,help,refresh}=usePetBath();
 const [selected,setSelected]=useState('rose');
 const [feedback,setFeedback]=useState([]);
 const requestLock=useRef(false);
 const lastDrag=useRef(0);
 const pointer=useRef({id:null,x:0,y:0});
 const dragged=useRef(false);
 const ignoreClick=useRef(false);
 const ignoreClickTimer=useRef(null);
 const feedbackId=useRef(0);
 const feedbackTimers=useRef(new Set());
 const room=rooms?.[selected]||{round:1,progress:0,completedAt:null,hatched:false};
 const meta=ROOM_META[selected];
 const progress=Math.max(0,Math.min(BATH_GOAL,Number(room.progress)||0));
 const stage=bathStage(progress);
 const stageInfo=STAGES[stage];

 useEffect(()=>()=>{feedbackTimers.current.forEach(timer=>window.clearTimeout(timer));window.clearTimeout(ignoreClickTimer.current);},[]);

 function addFeedback(){
  const id=++feedbackId.current;
  const timer=window.setTimeout(()=>setFeedback(current=>current.filter(entry=>entry.id!==id)),1600);
  feedbackTimers.current.add(timer);
  setFeedback(current=>[...current.slice(-3),{id}]);
 }

 async function sendHelp(source='tap'){
  if(!room.hatched||progress>=BATH_GOAL||busy||requestLock.current)return false;
  if(source==='drag'&&Date.now()-lastDrag.current<DRAG_THROTTLE_MS)return false;
  requestLock.current=true;
  if(source==='drag')lastDrag.current=Date.now();
  try{
   const accepted=await Promise.resolve(help(selected));
   if(accepted)addFeedback();
   return accepted;
  }catch{return false;}
  finally{requestLock.current=false;}
 }

 function beginPointer(event){
  if(busy||stage===4)return;
  pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY};
  dragged.current=false;
  ignoreClick.current=false;
  window.clearTimeout(ignoreClickTimer.current);
  event.currentTarget.setPointerCapture?.(event.pointerId);
 }

 function movePointer(event){
  if(pointer.current.id!==event.pointerId)return;
  const distance=Math.hypot(event.clientX-pointer.current.x,event.clientY-pointer.current.y);
  if(distance<12)return;
  pointer.current.x=event.clientX;
  pointer.current.y=event.clientY;
  dragged.current=true;
  ignoreClick.current=true;
  window.clearTimeout(ignoreClickTimer.current);
  ignoreClickTimer.current=window.setTimeout(()=>{ignoreClick.current=false;},500);
  void sendHelp('drag');
 }

 function endPointer(event){
  if(pointer.current.id!==event.pointerId)return;
  pointer.current={id:null,x:0,y:0};
 }

 function cancelPointer(event){
  if(pointer.current.id===event.pointerId)pointer.current={id:null,x:0,y:0};
  dragged.current=false;
  ignoreClick.current=false;
 }

 function clickAnimal(){
  if(ignoreClick.current||dragged.current){
   ignoreClick.current=false;
   dragged.current=false;
   return;
  }
  void sendHelp('tap');
 }

 if(loading)return <main className="pet-bath-page" aria-labelledby="pet-bath-title"><header className="pet-bath-heading"><span className="pet-bath-kicker">MINI GAME · SHARED CARE</span><h2 id="pet-bath-title">อาบน้ำให้เจ้าตัวน้อย</h2><p>กำลังเรียกห้องอาบน้ำของทุกคน…</p></header><section className="pet-bath-status pet-bath-loading" role="status"><PetBathArtwork type="bubbles" className="pet-bath-loading-art"/><b>กำลังเตรียมฟองสบู่</b><small>เชื่อมต่อยอดช่วยกันสักครู่นะ</small><button type="button" onClick={refresh}><RefreshCw size={15}/>ลองโหลดใหม่</button></section></main>;
 if(error&&!rooms?.rose?.hatched&&!rooms?.praew?.hatched)return <main className="pet-bath-page" aria-labelledby="pet-bath-title"><header className="pet-bath-heading"><span className="pet-bath-kicker">MINI GAME · SHARED CARE</span><h2 id="pet-bath-title">อาบน้ำให้เจ้าตัวน้อย</h2></header><section className="pet-bath-status pet-bath-status-error" role="alert"><PetBathArtwork type="spark" className="pet-bath-status-art"/><b>ยังเปิดห้องอาบน้ำไม่ได้</b><p>{error}</p><button type="button" onClick={refresh}><RefreshCw size={15}/>ลองใหม่</button></section></main>;

 return <main className={'pet-bath-page pet-bath-'+meta.tone} aria-labelledby="pet-bath-title">
  <header className="pet-bath-heading"><span className="pet-bath-kicker">MINI GAME · SHARED CARE</span><h2 id="pet-bath-title">อาบน้ำให้เจ้าตัวน้อย</h2><p>ช่วยกันดูแลเพื่อนตัวน้อยทีละขั้น แล้วรอความสดใสกลับมา</p></header>
  <RoomTabs selected={selected} onSelect={setSelected}/><StatusMessage error={error} onRetry={refresh}/>
  <section id={'pet-bath-panel-'+selected} className="pet-bath-room" role="tabpanel" aria-label={'ห้องของ'+meta.name}>
   <div className="pet-bath-room-heading"><div><span className="pet-bath-room-kicker">{meta.name==='โรส'?'MOONLIGHT ROOM':'SUNLIGHT ROOM'}</span><h3>{meta.name} · {meta.animal}</h3></div><div className="pet-bath-reward-banner"><PetBathArtwork type="spark"/><span><b>+20 คะแนนไอเทม</b><small>รางวัลเมื่อช่วยกันครบ</small></span></div></div>
   {!room.hatched?<section className="pet-bath-gate" aria-label="ปลดล็อกเจ้าตัวน้อย"><div className="pet-bath-gate-art" aria-hidden="true"><PetBathArtwork type="egg"/><PetBathArtwork type="spark" className="pet-bath-gate-spark"/></div><div><h3>ยังต้องช่วยฟักไข่ก่อน</h3><p>เมื่อพบ{meta.animal}แล้ว กลับมาช่วยกันอาบน้ำได้เลย</p><a href="/games/hatching">ไปช่วยฟักไข่ <ArrowUpRight size={15}/></a></div></section>:<>
    <div className="pet-bath-progress-copy"><div><span className="pet-bath-live-dot" aria-hidden="true"/>สถานะของทุกคน</div><strong>{formatCount(progress)} <small>/ {formatCount(BATH_GOAL)}</small></strong></div>
    <div className="pet-bath-progress" role="progressbar" aria-label={'ความคืบหน้าการอาบน้ำของ'+meta.name} aria-valuemin={0} aria-valuemax={BATH_GOAL} aria-valuenow={progress}><span style={{width:(progress/BATH_GOAL*100)+'%'}}/></div>
    <StageRail progress={progress}/>
    {stage===4?<CompletionCard meta={meta}/>:<div className="pet-bath-play-area">
      <button type="button" className={'pet-bath-character pet-bath-character-'+stageInfo.key} onPointerDown={beginPointer} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={cancelPointer} onClick={clickAnimal} disabled={busy} aria-label={'แตะหรือปัดเพื่อ'+stageInfo.label+'ให้'+meta.name} aria-keyshortcuts="Enter Space">
       <FamiliarArt kind={meta.kind} awake/><AnimalEffects stage={stage} progress={progress}/><span className="pet-bath-character-spark" aria-hidden="true"><PetBathArtwork type="spark"/></span><div className="pet-bath-feedback" aria-live="polite">{feedback.map(item=><span key={item.id} className="pet-bath-feedback-bubble">ช่วยแล้ว ♡</span>)}</div>
      </button>
      <div className="pet-bath-task"><span className="pet-bath-task-icon" aria-hidden="true"><PetBathArtwork type={stageInfo.key==='leaves'?'leaf':stageInfo.key==='soap'?'soap':stageInfo.key==='rinse'?'water':'towel'}/></span><div><span className="pet-bath-kicker">STEP {stage+1} / 4</span><h3>{stageInfo.label}</h3><p>{stageInfo.hint}</p><small className="pet-bath-keyboard-hint">กด Enter หรือ Space ก็ช่วยได้</small></div></div>
    </div>}
   </>}
  </section>
  <p className="pet-bath-note"><PetBathArtwork type="spark"/> เล่นฟรี · ช่วยกันวันละ 1 รอบต่อบ้าน · เริ่มวันใหม่เวลาไทย <PetBathArtwork type="spark"/></p>
 </main>;
}
