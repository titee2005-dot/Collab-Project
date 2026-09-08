import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {refreshDonations,getCollectionStats} from '../services/donationService';
import {crossedMilestones} from '../services/memoryService';
import {getNewDiscoveries} from '../services/progressionService';
const Context=createContext(null);
export function CollectionProvider({children}){
 const [donations,setDonations]=useState([]),[error,setError]=useState(''),[arrival,setArrival]=useState(null),[notice,setNotice]=useState(null),[discoveries,setDiscoveries]=useState([]),[celebration,setCelebration]=useState(null);
 const reloadRef=useRef(()=>{});
 useEffect(()=>{
  let disposed=false,busy=false,current=null,timer;
  async function reload(){if(busy)return;busy=true;try{const data=await refreshDonations();if(disposed)return;
   if(current){const known=new Set(current.map(d=>d.id)),newItems=data.filter(d=>!known.has(d.id));if(newItems.length){const before=getCollectionStats(current).total,after=getCollectionStats(data).total,last=newItems.at(-1);setArrival(last);setNotice(last);const crossed=crossedMilestones(before,after);if(crossed.length)setCelebration({id:last.id,milestones:crossed});setDiscoveries(q=>[...q,...getNewDiscoveries(before,after)]);clearTimeout(timer);timer=setTimeout(()=>{setArrival(null);setNotice(null);},5000);}}
   current=data;setDonations(data);setError('');
  }catch(e){if(!disposed)setError(e.message);}finally{busy=false;}}
  reloadRef.current=reload;reload();const interval=setInterval(reload,5000);window.addEventListener('focus',reload);
  return()=>{disposed=true;clearInterval(interval);clearTimeout(timer);window.removeEventListener('focus',reload);};
 },[]);
 return <Context.Provider value={{donations,stats:getCollectionStats(donations),error,reload:()=>reloadRef.current(),arrival,notice,discoveries,celebration,replayCelebration:at=>setCelebration({id:'replay-'+at+'-'+Date.now(),milestones:crossedMilestones(at-1,at)}),dismissCelebration:()=>setCelebration(null),dismissDiscovery:()=>setDiscoveries(q=>q.slice(1))}}>{children}</Context.Provider>;
}
export const useCollection=()=>useContext(Context);
