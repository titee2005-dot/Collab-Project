export const EVENT_END='2026-09-25T23:59:00+07:00';
export function eventTimeLeft(now=Date.now()){
 const remaining=Math.max(0,Math.ceil((Date.parse(EVENT_END)-now)/1000));
 return {ended:remaining===0,days:Math.floor(remaining/86400),hours:Math.floor(remaining/3600)%24,minutes:Math.floor(remaining/60)%60,seconds:remaining%60};
}
