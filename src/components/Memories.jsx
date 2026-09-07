import {useEffect, useState} from 'react';
import {BookHeart, Sparkles, ArrowUpRight} from 'lucide-react';
import Modal from './Modal';
import {Heart, Prop} from './Artwork';
import {FamiliarArt} from './Familiar';
import {ShareCard} from './Collections';
import {useCollection} from '../hooks/useCollection';
import {getPersonalMemories} from '../services/memoryService';
import {heartTypes} from '../data/heartTypes';
import {specialHearts} from '../data/specialHearts';

export function PersonalBook({onClose}) {
 const {donations,replayCelebration}=useCollection();const {history,badges,hearts}=getPersonalMemories(donations);
 const [selected,setSelected]=useState(null),[filter,setFilter]=useState('all');
 if(selected)return <ShareCard donation={selected} onClose={()=>setSelected(null)} backLabel="Back to My Memories"/>;
 const shown=history.filter(d=>filter==='all'||d.recipient===filter);
 return <Modal wide title="My little book of memories" onClose={onClose}>
  <p className="muted">Your hearts, your words, your little moments. Saved on this device, including anonymous gifts.</p>
  <div className="memory-summary"><BookHeart size={29}/><span><b>{hearts} hearts sent with love</b><small>{history.length} saved {history.length===1?'story':'stories'} · Every card is yours to keep.</small></span></div>
  <section className="memory-badges" aria-label="Memory badges">{badges.length?badges.map(b=><article key={b.id}><Sparkles size={22}/><h3>{b.name}</h3><p>{b.description}</p><time dateTime={b.createdAt}>{new Date(b.createdAt).toLocaleDateString()}</time>{b.at&&<button className="text-button" onClick={()=>{onClose();replayCelebration(b.at);}}>Relive this moment</button>}</article>):<p className="memory-empty">Your first heart will start your story and earn your first memory badge.</p>}</section>
  <div className="tabs">{['all','rose','praew'].map(f=><button key={f} aria-pressed={filter===f} className={filter===f?'active':''} onClick={()=>setFilter(f)}>{f==='all'?'All my stories':f==='rose'?'For Rose':'For Praew'}</button>)}</div>
  <div className="memory-stories">{shown.map(d=>{const h=heartTypes.find(h=>h.id===d.heartType);return <button key={d.id} onClick={()=>setSelected(d)} className="memory-story"><Heart color={h.color}/><span><b>{h.name} × {d.quantity} · for {d.recipient==='rose'?'Rose':'Praew'}</b><span>“{d.message||'A little heart, with love.'}”</span><small>{d.supporterName} · {new Date(d.createdAt).toLocaleString()}</small></span><ArrowUpRight size={18}/></button>;})}{!shown.length&&<p className="memory-empty">No stories here yet. Every little heart has a place in this book.</p>}</div>
  <p className="fine-print">Open any story to read it and download its card again. This is a local demo book, not a signed-in account.</p>
 </Modal>;
}

export function TogetherCelebration({event,onDone}) {
 const [arrived,setArrived]=useState(false);
 const milestone=event.milestones.at(-1),heart=specialHearts.find(h=>h.unlock===milestone.at);
 useEffect(()=>{const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const reveal=setTimeout(()=>setArrived(true),reduced?0:1500);const finish=setTimeout(onDone,reduced?3000:5000);return()=>{clearTimeout(reveal);clearTimeout(finish);};},[event.id]);
 return <Modal wide title="A little magic, together" onClose={onDone}>
  <div className={`together-scene ${arrived?'friends-arrived':''}`}>
   <div className="celebration-orbit"/><span className="celebration-stars" aria-hidden="true">✧　✦　✧</span>
   <div className="celebration-grand"><Heart color="#d09abe"/></div>
   <div className="celebration-friend friend-rose"><FamiliarArt kind="rabbit" awake ribbon charm/><small>Rose’s rabbit</small></div>
   <div className="celebration-friend friend-praew"><FamiliarArt kind="alpaca" awake ribbon charm/><small>Praew’s alpaca</small></div>
   <div className="celebration-gift">{heart?<Heart color={heart.color}/>:<Prop kind="book"/>}</div>
  </div>
  <div className="together-copy" aria-live="polite"><span className="eyebrow">{milestone.at.toLocaleString()} HEARTS, COLLECTED TOGETHER</span><h3>{arrived?(heart?`${heart.name} discovered!`:milestone.name):'Two little friends. One Grand Heart.'}</h3><p>{arrived?'The rooms are glowing a little brighter because of you.':'The rabbit and alpaca are bringing their love to the center.'}</p><small>{event.milestones.map(m=>m.name).join(' · ')}</small></div>
  <button className="text-button full" onClick={onDone}>Continue to the collection · Skip celebration</button>
 </Modal>;
}

