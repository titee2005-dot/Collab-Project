import {useId} from 'react';
export function Heart({color='#df91b2',className='',...props}) {
 const id=useId().replace(/:/g,'');
 return <svg viewBox="0 0 100 90" className={`heart ${className}`} aria-hidden="true" {...props}><defs><linearGradient id={id} x2=".8" y2="1"><stop stopColor="#fff3ef"/><stop offset=".32" stopColor={color}/><stop offset="1" stopColor={color}/></linearGradient></defs><path d="M50 84 12 48C-14 19 22-10 50 17 78-10 114 19 88 48Z" fill={`url(#${id})`} stroke={color} strokeWidth="2"/><path d="M50 17 34 36 50 84 66 36ZM12 48 34 36 15 20M88 48 66 36 85 20M34 36H66" fill="none" stroke="#fff5ed" strokeOpacity=".45" strokeWidth="1.1"/><path d="m24 14 2 8 8 2-8 2-2 8-2-8-8-2 8-2Z" fill="#fff5ed" opacity=".9"/></svg>
}
export function Prop({kind='potion',color='#ce8aa5',...props}) {
 return <svg viewBox="0 0 80 90" aria-hidden="true" {...props}>
 {kind==='ribbon'?<g fill={color} stroke="#f6d8dc" strokeWidth="2"><path d="M39 33Q4 2 7 35Q8 57 36 42L22 76 41 67 56 78 48 44Q76 58 76 33Q77 7 43 33Z"/><circle cx="41" cy="37" r="8"/></g>:
 kind==='potion'?<g stroke="#b18b78" strokeWidth="2"><path d="M30 10H50V34Q82 55 65 78Q40 87 15 78Q-2 55 30 34Z" fill="#f9e8eb"/><path d="M23 49Q40 57 57 49L64 71Q40 85 16 73Z" fill={color}/><rect x="28" y="5" width="24" height="10" rx="3" fill="#c7a277"/><path d="M23 48Q17 55 18 62" stroke="#fff3ed" strokeWidth="4"/><path d="m42 55 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#fce5ad"/></g>:
 kind==='rabbit'||kind==='cat'?<g fill={kind==='rabbit'?'#fff0e8':'#e7bda4'} stroke="#b58c87" strokeWidth="1.8"><ellipse cx="40" cy="65" rx="26" ry="20"/>{kind==='rabbit'?<><ellipse cx="27" cy="25" rx="8" ry="24" transform="rotate(-12 27 25)"/><ellipse cx="50" cy="24" rx="8" ry="23" transform="rotate(9 50 24)"/><path d="M26 11V35M50 10V34" stroke="#edbcc5" strokeWidth="5"/></>:<path d="m15 45 0-30 23 19 25-20 4 34Z"/>}<ellipse cx="40" cy="48" rx="26" ry="22"/><path className="blink" d="M24 46q4 5 8 0m16 0q4 5 8 0" fill="none" stroke="#74545f"/><path d="m37 53 3 3 3-3" fill="#b87889"/><ellipse cx="23" cy="54" rx="6" ry="3" fill="#e5a6b2" stroke="none"/><ellipse cx="57" cy="54" rx="6" ry="3" fill="#e5a6b2" stroke="none"/></g>:
 kind==='familiar-charm'?<g fill={color} stroke="#b6955c" strokeWidth="2"><path d="M26 17q14-18 28 0L47 39H33Z" fill="#edd2c4"/><path d="m40 32 9 16 19 3-14 14 3 20-17-10-17 10 3-20-14-14 19-3Z"/><circle cx="40" cy="23" r="5"/></g>:kind==='book'?<g stroke="#bc8d94" strokeWidth="2"><path d="M5 18Q24 10 40 23Q56 10 75 18V76Q55 67 40 80Q24 67 5 76Z" fill="#efd8b8"/><path d="M40 24V79M13 29l19 2m-19 9 19 2m-19 9 19 2m16-22 18-3m-18 14 18-3m-18 14 18-3" fill="none"/></g>:
 kind==='crown'?<path d="m9 28 18 14L40 13l14 29 18-14-10 44H20Z" fill="#d8b86f" stroke="#fff0bb" strokeWidth="3"/>:
 kind==='mirror'||kind==='crystal'?<g stroke="#d9b36c" strokeWidth="4"><ellipse cx="40" cy="35" rx="27" ry="29" fill="#ddd2e5"/><path d="m30 18 18 32m-3-32 10 18M40 64V81M24 84H56"/><path d="m26 9 4-7 6 7" fill="#ead4a4"/></g>:
 <g stroke="#d0ad74" strokeWidth="5"><path d="m20 81 37-59"/><path d="m54 3 6 13 14 2-10 10 2 14-12-7-13 7 3-14-11-10 15-2Z" fill="#f1d49e" strokeWidth="2"/></g>}
 </svg>
}
export function Candle(){return <svg viewBox="0 0 50 120" aria-hidden="true"><path d="M25 7Q5 32 25 37Q43 31 25 7" fill="#eebd6d" className="flame"/><path d="M15 40H35V100H15Z" fill="#f4dfbd" stroke="#be9c7c"/><path d="M15 40q6 15 11 2" fill="none" stroke="#fff0d2" strokeWidth="5"/><path d="M6 107H44M25 100v8" stroke="#b49369" strokeWidth="5"/></svg>}

