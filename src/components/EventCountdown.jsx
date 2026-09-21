
import {useEffect,useState} from 'react';
import {EVENT_END,eventTimeLeft} from '../services/eventCountdown';
import '../styles/event-countdown.css';
export default function EventCountdown({className=''}){
 const [time,setTime]=useState(()=>eventTimeLeft());
 useEffect(()=>{const timer=setInterval(()=>{const next=eventTimeLeft();setTime(next);if(next.ended)clearInterval(timer);},1000);return()=>clearInterval(timer);},[]);
 return <section className={'event-countdown '+className+(time.ended?' event-ended':'')} aria-label="กำหนดปิดกิจกรรม">
 <span className="event-countdown-label" title="25 กันยายน 2026 เวลา 23:59 น. (เวลาไทย)">{time.ended?'สิ้นสุดกิจกรรมแล้ว':'ปิดกิจกรรมใน'}</span><time className="event-countdown-date" dateTime={EVENT_END}>25 กันยายน 2026 เวลา 23:59 น. ตามเวลาไทย</time>
 {!time.ended&&<div className="event-countdown-digits" role="timer" aria-live="off" aria-label={`เหลือ ${time.days} วัน ${time.hours} ชั่วโมง ${time.minutes} นาที ${time.seconds} วินาที`}>{[['days','วัน'],['hours','ชั่วโมง'],['minutes','นาที'],['seconds','วินาที']].map(([key,label])=><span key={key}><b>{String(time[key]).padStart(2,'0')}</b><small>{label}</small></span>)}</div>}
 </section>;
}
