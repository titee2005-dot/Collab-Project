import {useEffect,useRef,useState} from 'react';
import {audioConfig} from '../data/audioConfig';
export function useAudio(){
 const [playing,setPlaying]=useState(false),[unavailable,setUnavailable]=useState(false),[preferred,setPreferred]=useState(()=>{try{return localStorage.getItem('heart-collection.music')==='true';}catch{return false;}});
 const audio=useRef(null),fade=useRef(null),busy=useRef(false);
 useEffect(()=>()=>{clearInterval(fade.current);audio.current?.pause();},[]);
 const toggle=async()=>{
  if(unavailable||busy.current)return;
  busy.current=true;
  try{
   if(!audio.current){
    const response=await fetch(audioConfig.music,{method:'HEAD'});
    if(!response.ok||!response.headers.get('content-type')?.startsWith('audio/')){setUnavailable(true);return;}
    audio.current=new Audio(audioConfig.music);audio.current.loop=true;audio.current.volume=0;
    audio.current.onerror=()=>{clearInterval(fade.current);setUnavailable(true);setPlaying(false);};
   }
   const next=!playing;clearInterval(fade.current);
   if(next)await audio.current.play();
   setPlaying(next);setPreferred(next);try{localStorage.setItem('heart-collection.music',String(next));}catch{}
   const target=next?audioConfig.volume:0;
   fade.current=setInterval(()=>{const diff=target-audio.current.volume;if(Math.abs(diff)<.02){audio.current.volume=target;clearInterval(fade.current);if(!next)audio.current.pause();}else audio.current.volume=Math.max(0,Math.min(1,audio.current.volume+Math.sign(diff)*.02));},45);
  }catch{setUnavailable(true);setPlaying(false);}finally{busy.current=false;}
 };
 return {playing,unavailable,preferred,toggle};
}

