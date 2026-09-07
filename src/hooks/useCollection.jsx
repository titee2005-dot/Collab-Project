import {crossedMilestones} from '../services/memoryService';
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {getDonations,subscribeToDonations,getCollectionStats} from '../services/donationService';
import {getNewDiscoveries} from '../services/progressionService';
import {mockDonations} from '../data/mockDonations';
const Context=createContext(null);
export function CollectionProvider({children}){
 const [donations,setDonations]=useState(()=>{try{return getDonations();}catch{return mockDonations;}}),[error,setError]=useState(''),[arrival,setArrival]=useState(null),[discoveries,setDiscoveries]=useState([]),[notice,setNotice]=useState(null),[celebration,setCelebration]=useState(null);
 const current=useRef(donations),timers=useRef([]);
 const reload=()=>{try{const data=getDonations();current.current=data;setDonations(data);setError('');}catch{setError('The Heart Archive is resting for a moment.');}};
 useEffect(()=>{reload();const unsubscribe=subscribeToDonations(d=>{
  const before=getCollectionStats(current.current).total;
  current.current=[...current.current,d];
  setArrival(d);
  timers.current.push(setTimeout(()=>{setDonations([...current.current]);setNotice(d);setArrival(null);const crossed=crossedMilestones(before,before+d.quantity);if(crossed.length)setCelebration({id:d.id,milestones:crossed});const found=getNewDiscoveries(before,before+d.quantity);if(found.length)setDiscoveries(q=>[...q,...found]);},matchMedia('(prefers-reduced-motion: reduce)').matches?150:1450));
  timers.current.push(setTimeout(()=>setNotice(null),9000));
 });const sync=()=>reload();window.addEventListener('storage',sync);return()=>{unsubscribe();timers.current.forEach(clearTimeout);window.removeEventListener('storage',sync);};},[]);
 return <Context.Provider value={{donations,stats:getCollectionStats(donations),error,reload,arrival,notice,discoveries,celebration,replayCelebration:at=>setCelebration({id:`replay-${at}-${Date.now()}`,milestones:crossedMilestones(at-1,at)}),dismissCelebration:()=>setCelebration(null),dismissDiscovery:()=>setDiscoveries(q=>q.slice(1))}}>{children}</Context.Provider>
}
export const useCollection=()=>useContext(Context);



