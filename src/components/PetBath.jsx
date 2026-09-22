import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,ChevronRight,Clock3,Leaf,RefreshCw,Sparkles} from 'lucide-react';
import {usePetBath} from '../hooks/usePetBath';
import {FamiliarArt} from './Familiar';
import '../styles/pet-bath.css';

const ROOM_META={
 rose:{name:'โรส',animal:'กระต่าย',kind:'rabbit',tone:'rose'},
 praew:{name:'แพรว',animal:'อัลปาก้า',kind:'alpaca',tone:'praew'}
};

const STAGES=[
 {key:'leaves',label:'เก็บใบไม้',range:'0–19',icon:'🍃',hint:'แตะใบไม้รอบตัวให้หมด'},
 {key:'soap',label:'ถูสบู่',range:'20–69',icon:'🫧',hint:'เลื่อนนิ้วถูฟองสบู่เบา ๆ'},
 {key:'rinse',label:'ล้างฟอง',range:'70–99',icon:'💧',hint:'แตะหรือเลื่อนเพื่อชะฟองออก'},
 {key:'dry',label:'เช็ดตัว',range:'100–119',icon:'🧺',hint:'แตะหรือเลื่อนผ้าขนหนูให้แห้ง'}
];

const DRAG_THROTTLE_MS=4000;
function stageFor(progress){
 if(progress<20)return 0;
 if(progress<70)return 1;
 if(progress<100)return 2;
 if(progress<120)return 3;
 return 4;
}
function StatusMessage({error,onRetry}){
 if(!error)return null;
 return <div className="pet-bath-error" role="alert"><span>{error}</span><button type="button" onClick={onRetry}><RefreshCw size={15}/>ลองใหม่</button></div>;
}

function RoomTabs({selected,onSelect}){
 return <div className="pet-bath-room-tabs" role="tablist" aria-label="เลือกเจ้าตัวน้อยที่จะอาบน้ำ">
  {Object.entries(ROOM_META).map(([id,meta])=><button key={id} type="button" role="tab" aria-selected={selected===id} aria-controls={`pet-bath-panel-${id}`} className={`pet-bath-room-tab pet-bath-room-tab-${meta.tone}`} onClick={()=>onSelect(id)}>
   <span className="pet-bath-room-tab-icon" aria-hidden="true">{id==='rose'?'☾':'☀'}</span><span><b>{meta.name}</b><small>{meta.animal}</small></span><ChevronRight size={16} aria-hidden="true"/>
  </button>)}
 </div>;
}

function StageRail({progress}){
 const stage=stageFor(progress);
 return <ol className="pet-bath-stage-rail" aria-label="ขั้นตอนการอาบน้ำ">
  {STAGES.map((item,index)=>{
   const done=stage>index;
   const current=stage===index;
   return <li key={item.key} className={`${done?'is-done ':''}${current?'is-current':''}`}><span className="pet-bath-stage-dot" aria-hidden="true">{done?<Check size={13}/>:index+1}</span><span><b>{item.label}</b></span></li>;
  })}
 </ol>;
}

function DragSurface({stage,onPointerDown,onPointerMove,onPointerUp,onPointerCancel,disabled}){
 const item=STAGES[stage];
 return <div className={`pet-bath-drag-surface pet-bath-drag-${item.key}`} role="img" aria-label={`${item.label}: ${item.hint}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} aria-disabled={disabled}>
  <span className="pet-bath-drag-halo" aria-hidden="true"/><span className="pet-bath-tool-icon" aria-hidden="true">{item.icon}</span><span className="pet-bath-drag-copy"><b>{item.label}</b><small>{item.hint}</small></span>
 </div>;
}

function CompletionCard({meta}){
 return <section className="pet-bath-complete" aria-label={`${meta.name}อาบน้ำเสร็จแล้ว`}>
  <div className="pet-bath-clean-scene"><div className="pet-bath-clean-glow" aria-hidden="true"/><FamiliarArt kind={meta.kind} awake/><span className="pet-bath-clean-towel" aria-label="ผ้าขนหนูสะอาด">🧺</span><span className="pet-bath-clean-bubbles" aria-hidden="true">✦　🫧　✦</span></div>
  <div className="pet-bath-complete-copy"><span className="pet-bath-complete-mark" aria-hidden="true">✦</span><h3>สะอาดเอี่ยมแล้ว!</h3><p>{meta.name}ดูสดใสและนุ่มฟูมาก ขอบคุณที่ช่วยกันดูแลนะ</p><p className="pet-bath-wait" role="status"><Clock3 size={14}/>วันนี้ช่วยกันครบแล้ว พบกันพรุ่งนี้หลัง 00:00 น. เวลาไทย</p></div>
 </section>;
}

export default function PetBath(){
 const {rooms,loading,error,busy,help,refresh}=usePetBath();
 const [selected,setSelected]=useState('rose');
 const [started,setStarted]=useState({rose:false,praew:false});
 const [feedback,setFeedback]=useState([]);
 const requestLock=useRef(false);
 const lastDrag=useRef(0);
 const pointer=useRef({id:null,x:0,y:0});
 const feedbackId=useRef(0);
 const room=rooms?.[selected]||{round:1,progress:0,completedAt:null,hatched:false};
 const meta=ROOM_META[selected];
 const progress=Math.max(0,Math.min(120,Number(room.progress)||0));
 const stage=stageFor(progress);
 const stageInfo=STAGES[stage];
 const feedbackTimers=useRef(new Set());
 useEffect(()=>()=>feedbackTimers.current.forEach(timer=>window.clearTimeout(timer)),[]);

 function addFeedback(kind='help'){
  const id=++feedbackId.current;
  const item={id,kind,timer:window.setTimeout(()=>setFeedback(current=>current.filter(entry=>entry.id!==id)),1600)};
  feedbackTimers.current.add(item.timer);
  setFeedback(current=>[...current.slice(-3),item]);
 }
 function send(action='help',source='tap'){
  if(!room.hatched||progress>=120||busy||requestLock.current)return false;
  if(action==='help'&&source==='drag'&&Date.now()-lastDrag.current<DRAG_THROTTLE_MS)return false;
  requestLock.current=true;
  if(source==='drag')lastDrag.current=Date.now();
  addFeedback(action==='start'?'start':'help');
  const result=help(selected);
  Promise.resolve(result).finally(()=>{requestLock.current=false;});
  return true;
 }
 function begin(){
  if(progress!==0||started[selected]||!room.hatched)return;
  setStarted(current=>({...current,[selected]:true}));

 }
 function helpOnce(source='tap'){
  if(progress===0&&!started[selected])return;
  send('help',source);
 }
 function beginDrag(event){
  if(stage<1||stage>3||progress>=120||(!started[selected]&&progress===0))return;
  pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY};
  event.currentTarget.setPointerCapture?.(event.pointerId);
  helpOnce('drag');
 }
 function moveDrag(event){
  if(pointer.current.id!==event.pointerId)return;
  const distance=Math.hypot(event.clientX-pointer.current.x,event.clientY-pointer.current.y);
  if(distance<18)return;
  pointer.current.x=event.clientX;pointer.current.y=event.clientY;
  helpOnce('drag');
 }
 function endDrag(event){
  if(pointer.current.id===event.pointerId)pointer.current={id:null,x:0,y:0};
 }


 if(loading)return <main className="pet-bath-page" aria-labelledby="pet-bath-title"><header className="pet-bath-heading"><span className="pet-bath-kicker">MINI GAME · SHARED CARE</span><h2 id="pet-bath-title">อาบน้ำให้เจ้าตัวน้อย</h2><p>กำลังเรียกห้องอาบน้ำของทุกคน…</p></header><section className="pet-bath-status pet-bath-loading" role="status"><span className="pet-bath-loading-orb" aria-hidden="true">🫧</span><b>กำลังเตรียมฟองสบู่</b><small>เชื่อมต่อยอดช่วยกันสักครู่นะ</small><button type="button" onClick={refresh}><RefreshCw size={15}/>ลองโหลดใหม่</button></section></main>;
 if(error&&!rooms?.rose?.hatched&&!rooms?.praew?.hatched)return <main className="pet-bath-page" aria-labelledby="pet-bath-title"><header className="pet-bath-heading"><span className="pet-bath-kicker">MINI GAME · SHARED CARE</span><h2 id="pet-bath-title">อาบน้ำให้เจ้าตัวน้อย</h2></header><section className="pet-bath-status pet-bath-status-error" role="alert"><span className="pet-bath-status-icon" aria-hidden="true">♡</span><b>ยังเปิดห้องอาบน้ำไม่ได้</b><p>{error}</p><button type="button" onClick={refresh}><RefreshCw size={15}/>ลองใหม่</button></section></main>;

 return <main className={`pet-bath-page pet-bath-${meta.tone}`} aria-labelledby="pet-bath-title">
  <header className="pet-bath-heading"><span className="pet-bath-kicker">MINI GAME · SHARED CARE</span><h2 id="pet-bath-title">อาบน้ำให้เจ้าตัวน้อย</h2><p>ช่วยกันดูแลเพื่อนตัวน้อยทีละขั้น แล้วรอความสดใสกลับมา</p></header>
  <RoomTabs selected={selected} onSelect={setSelected}/><StatusMessage error={error} onRetry={refresh}/>
  <section id={`pet-bath-panel-${selected}`} className="pet-bath-room" role="tabpanel" aria-label={`ห้องของ${meta.name}`}>
   <div className="pet-bath-room-heading"><div><span className="pet-bath-room-kicker">{meta.name==='โรส'?'MOONLIGHT ROOM':'SUNLIGHT ROOM'}</span><h3>{meta.name} · {meta.animal}</h3></div><span className="pet-bath-round">ภารกิจวันนี้</span></div>
   {!room.hatched?<section className="pet-bath-gate" aria-label="ปลดล็อกเจ้าตัวน้อย"><div className="pet-bath-gate-art" aria-hidden="true">🥚<span>✦</span></div><div><h3>ยังต้องช่วยฟักไข่ก่อน</h3><p>เมื่อพบ{meta.animal}แล้ว กลับมาช่วยกันอาบน้ำได้เลย</p><a href="/games/hatching">ไปช่วยฟักไข่ <ArrowUpRight size={15}/></a></div></section>:<>
    <div className="pet-bath-progress-copy"><div><span className="pet-bath-live-dot" aria-hidden="true"/>สถานะของทุกคน</div><strong>{progress} <small>/ 120</small></strong></div>
    <div className="pet-bath-progress" role="progressbar" aria-label={`ความคืบหน้าการอาบน้ำของ${meta.name}`} aria-valuemin={0} aria-valuemax={120} aria-valuenow={progress}><span style={{width:`${progress/120*100}%`}}/></div>
    <StageRail progress={progress}/>
    {stage===4?<CompletionCard meta={meta}/>:<div className="pet-bath-play-area">
      <div className={`pet-bath-character pet-bath-character-${stageInfo.key}`} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={()=>stage===0&&helpOnce('tap')}><FamiliarArt kind={meta.kind} awake/><div className="bath-body-effects" aria-hidden="true"><div className="bath-mud" style={{opacity:Math.max(0,1-Math.max(0,progress-20)/50)}}><i/><i/><i/></div>{Array.from({length:Math.max(0,5-Math.floor(progress/4))},(_,i)=><span key={'leaf'+i} className={'bath-body-leaf leaf-'+i}>🍃</span>)}{stage===1||stage===2?<div className="bath-body-foam" style={{opacity:stage===1?Math.min(1,(progress-19)/20):Math.max(0,1-(progress-70)/30)}}>🫧 🫧<br/>🫧 🫧 🫧</div>:null}{stage===3&&<span className="bath-body-cloth" style={{left:(20+(progress%10)*4)+'%'}}>🧺</span>}</div><span className="pet-bath-character-spark" aria-hidden="true">✦</span><div className="pet-bath-feedback" aria-live="polite">{feedback.map(item=><span key={item.id} className={`pet-bath-feedback-bubble pet-bath-feedback-${item.kind}`}>{item.kind==='start'?'เริ่มแล้ว ♡':'ช่วยแล้ว ♡'}</span>)}</div></div>
      <div className="pet-bath-task"><span className="pet-bath-task-icon" aria-hidden="true">{stageInfo.icon}</span><div><span className="pet-bath-kicker">STEP {stage+1} / 4</span><h3>{stageInfo.label}</h3><p>{stageInfo.hint}</p></div></div>
      {progress===0&&!started[selected]?<div className="pet-bath-start"><button type="button" className="pet-bath-primary" onClick={begin} disabled={busy}><Sparkles size={17}/>เริ่มช่วยกันอาบน้ำ</button><small>ทุกการช่วยจะส่งไปยังยอดร่วมของห้องนี้</small></div>:<div className="pet-bath-interaction">
       {stage===0?<button type="button" className="pet-bath-tap-card pet-bath-tap-leaves" onClick={()=>helpOnce('tap')} disabled={busy} aria-label={`แตะเพื่อ${stageInfo.label}ให้${meta.name}`}><span className="pet-bath-tap-art" aria-hidden="true"><Leaf/><Leaf/><Leaf/></span><strong>แตะเพื่อเก็บใบไม้</strong><small>กดปุ่มนี้เพื่อช่วยอีกครั้ง</small></button>:<><DragSurface stage={stage} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} disabled={busy}/><button type="button" className="pet-bath-accessible-action" onClick={()=>helpOnce('tap')} disabled={busy} aria-label={`ใช้ปุ่มช่วย${stageInfo.label}ให้${meta.name}`}><span>{stage===1?'ถูสบู่ด้วยปุ่ม':stage===2?'ช่วยล้างด้วยปุ่ม':'ช่วยเช็ดตัวด้วยปุ่ม'}</span><ChevronRight size={16}/></button></>}
      </div>}
    </div>}
   </>}
  </section>
  <p className="pet-bath-note"><span aria-hidden="true">✧</span> เล่นฟรี · ช่วยกันวันละ 1 รอบต่อบ้าน · เริ่มวันใหม่เวลาไทย <span aria-hidden="true">✧</span></p>
 </main>;
}
