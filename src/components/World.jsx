import {jarHeartTypes} from '../services/jarHeartTypes';
import {jarHeartCount,jarHeartPosition} from '../services/jarHearts';
import ItemArtwork,{ItemDisplay} from './ItemArtwork';
import AnimatedCount from './AnimatedCount';
import {useState} from 'react';
import Familiar from './Familiar';
import LatestHeartUpdate from './LatestHeartUpdate';
import {grandTier,grandTiers} from '../data/grandTiers';
import {Moon,Sun,Sparkles,ArrowUpRight,LockKeyhole} from 'lucide-react';
import {Heart} from './Artwork';
import {heartTypes} from '../data/heartTypes';
import {collectibleItems} from '../data/collectibleItems';
import {milestones} from '../data/milestones';
import {useCollection} from '../hooks/useCollection';
import '../styles/jar-premium.css';
export function Progress({value,max,label}){return <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value,max)}><span style={{width:`${Math.min(100,value/max*100)}%`}}/></div>}
export function Room({character,onCollect,onCabinet,active,onStory,hatched=false,bathState}){
 const {stats,arrival,notice,stories,evolution}=useCollection();const {id,name}=character,s=stats[id]; const [previewId,setPreviewId]=useState(null);const preview=collectibleItems[id].find(i=>i.id===previewId);const previewLocked=preview && preview.at>s.points;
 const next=collectibleItems[id].find(i=>i.at>s.points);
 const count=jarHeartCount(s.total);
 const displayTypes=jarHeartTypes(s.types);
 const latest=stories?.[id];
 return <section className={`room ${id} ${active?'mobile-active':''} ${notice?.landed&&notice?.recipient===id?'receiving':''}`} aria-label={`${name}'s collection`}>
  <div className="room-heading"><div className="sigil">{id==='rose'?<Moon size={18}/>:<Sun size={20}/>}</div><h2>{name}<span>’s collection</span></h2></div>
  <div className="room-stage" data-jar={id}>
   <div className="arch"><span className="arch-star s1">✧</span><span className="arch-star s2">✦</span><span className="arch-star s3">✧</span><div className="celestial">{id==='rose'?<Moon/>:<Sun/>}</div></div>
   <ItemDisplay items={collectibleItems[id]} total={s.points} preview={previewLocked?preview:null}/>
   <div className="hanging left">✧</div><div className="hanging right">✧</div>
   {character.artwork&&<img className="licensed-art" src={character.artwork} alt={`${name} artwork`}/>}
   <div className="jar-wrap"><svg className="jar-glass" viewBox="0 0 300 340" aria-hidden="true"><defs><clipPath id={`jar-fill-${id}`} clipPathUnits="objectBoundingBox"><path transform="matrix(.0032 0 0 .0028235294 .02 .02)" d="M110 62Q75 80 51 126C-14 237 71 313 150 327C229 313 314 237 249 126Q225 80 190 62Z"/></clipPath><linearGradient id={`glass-${id}`} x2="1" y2=".7"><stop stopColor="#fff5ef" stopOpacity=".8"/><stop offset=".45" stopColor={id==='rose'?'#eac9df':'#f3d5bb'} stopOpacity=".22"/><stop offset="1" stopColor="#fff3e7" stopOpacity=".8"/></linearGradient></defs><path d="M110 62Q75 80 51 126C-14 237 71 313 150 327C229 313 314 237 249 126Q225 80 190 62Z" fill={`url(#glass-${id})`} stroke={id==='rose'?'#bd8ca9':'#c8a27a'} strokeWidth="2.5"/><path d="M97 89Q39 133 49 200M71 245q14 27 40 38" fill="none" stroke="#fff9ef" strokeWidth="8" strokeLinecap="round" opacity=".85"/><ellipse cx="150" cy="64" rx="46" ry="11" fill="#ead1c7" stroke="#b98b85" strokeWidth="2"/><rect x="105" y="44" width="90" height="20" rx="8" fill="#ecd5b6" stroke="#b89b76" strokeWidth="2"/><path d="M113 49H187M117 57H183" stroke="#c4a179"/><path d="M137 41q-13-20 13-29 26 9 13 29Z" fill="#ead7bb" stroke="#b89b85" strokeWidth="2"/></svg>
    <div className="jar-fill" style={{clipPath:`url(#jar-fill-${id})`}} aria-hidden="true"><div className="jar-hearts">{Array.from({length:count},(_,i)=>{const typeId=displayTypes.length?displayTypes[i]:heartTypes[i%4].id;const type=heartTypes.find(h=>h.id===typeId)||heartTypes[i%4];return <span key={i} className={`jar-heart jar-heart-${type.id}`} style={jarHeartPosition(i,s.total)}><Heart color={type.color}/>{type.id!=='pink'&&<i className="jar-heart-spark" aria-hidden="true">✦</i>}</span>;})}</div></div>
    {latest&&<button className={`story-heart ${notice?.id===latest.id?'story-heart-new':''}`} aria-label={`Read ${latest.supporterName}'s heart story for ${name}`} onClick={()=>onStory(latest)}><Heart color={heartTypes.find(h=>h.id===latest.heartType).color}/><span>{notice?.id===latest.id?'NEW STORY':'READ STORY'}</span></button>}<div className="jar-emblem">{id==='rose'?<Moon size={19}/>:<Sun size={19}/>}</div>
   </div>
   
   
   {hatched&&<Familiar bathState={bathState} recipient={id} total={s.points} celebrating={arrival?.recipient===id || notice?.recipient===id} previewCharm={previewLocked && preview.kind==='familiar-charm'}/>}<div className="shelf"/><span className="shelf-label">{id==='rose'?'THE MOONLIGHT ROOM':'THE SUNLIGHT ROOM'}</span>
   {notice?.recipient===id&&<div className="supporter-message">{notice.message&&<span>{notice.message}</span>}<small>{notice.anonymous?'ไม่ระบุชื่อ':notice.supporterName}</small></div>}
  </div>
  <div className="room-stats"><div className="count"><strong><AnimatedCount value={s.total}/></strong><span>hearts collected</span><button className="room-heart-arrow" title="กดเพื่อซื้อหัวใจ" onClick={()=>onCollect(id)} aria-label={`Collect Heart · ซื้อหัวใจให้ ${name}`}><span>Collect Heart</span><ArrowUpRight size={16}/></button></div><div className="room-unlock-points"><span>คะแนนปลดล็อกไอเทม</span><b>{s.points.toLocaleString()}</b></div><div className="type-counts">{heartTypes.map(h=><span key={h.id} title={`${h.name}: ${s.types[h.id]}`}><Heart color={h.color}/><b>{s.types[h.id]}</b><small>{h.name.split(' ')[0]}</small></span>)}</div><button className="next-item" aria-expanded={!!preview} onClick={()=>next?setPreviewId(preview?null:next.id):onCabinet()}><ItemArtwork item={next||collectibleItems[id].at(-1)}/><span><small>{next?'NEXT MAGICAL ITEM':'ROOM COMPLETE'}</small><b>{next?.name||'A room full of magic'}</b></span><span>{next?`${s.points} / ${next.at} คะแนน`:'✧'}</span></button><Progress value={s.points} max={next?.at||s.points||1} label={`${name}'s next collectible`}/>{preview && <div className="item-preview-panel"><div className="preview-panel-heading"><span className="eyebrow">TRY A LITTLE MAGIC</span><button onClick={()=>setPreviewId(null)} aria-label="Close item preview">×</button></div><h3>{preview.name}</h3><p>{preview.description}</p><strong>{previewLocked?`อีก ${(preview.at-s.points).toLocaleString()} คะแนนเพื่อปลดล็อก`:'Already part of your room'}</strong><div className="preview-item-options" aria-label="Preview room collectibles">{collectibleItems[id].map(item=><button key={item.id} aria-label={`Preview ${item.name}`} aria-pressed={preview.id===item.id} onClick={()=>setPreviewId(item.id)}><ItemArtwork item={item}/></button>)}</div><small>Preview only. Your collection stays just as it is.</small></div>}</div>
 </section>
}
export function GrandHeart({onCollect,onCollection,children}){
 const {stats}=useCollection();const tier=grandTier(stats.points),next=tier.next;const pct=tier.value/tier.max;
 return <section className={`grand stage-${Math.min(4,Math.floor(pct*4))} ${stats.points>=2000?'transformed':''}`} style={{'--tier-color':tier.current.color,'--tier-ink':tier.current.ink,'--tier-soft':tier.current.soft}} aria-label="Grand Heart"><div className="grand-crystal"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="orbit-star star-one">✦</span><span className="orbit-star star-two">✧</span><span className="orbit-star star-three">✦</span><Heart color={tier.current.color}/><span className="crystal-spark">✧</span><div className="crystal-base"/></div><div className="grand-progress"><h2>The Grand Heart</h2><LatestHeartUpdate/><div key={tier.index} className="grand-tier" role="status"><span aria-hidden="true">{tier.current.symbol}</span><span><small>TIER {tier.index+1} / {grandTiers.length}</small><b>{tier.current.name}</b></span></div><p><strong><AnimatedCount value={stats.points}/></strong><span>{next?' / '+next.at.toLocaleString()+' คะแนน':' คะแนน · MAX TIER'}</span></p><Progress value={tier.value} max={tier.max} label={'Tier '+(tier.index+1)+' progress'}/><small>{next?`${Math.max(0,next.at-stats.points).toLocaleString()} คะแนนถึง ${next.name}`:'เทียร์สูงสุดแล้ว ขอบคุณทุกหัวใจ ♡'}</small></div><button className="primary collect-button" onClick={()=>onCollect()}><Heart color="#f7d6df"/>Collect a Heart<Sparkles size={17}/></button><span className="demo-note">ส่งสลิปและรออนุมัติก่อนเพิ่มหัวใจ</span><button className="next-discovery" onClick={onCollection}><div><Heart color={(next||tier.current).color}/>{next&&<LockKeyhole size={13}/>}</div><span><small>{next?'NEXT DISCOVERY':'COLLECTION COMPLETE'}</small><b>{next?.name||'All hearts discovered'}</b></span><ArrowUpRight size={18}/></button><div className="grand-games">{children}</div></section>
}


