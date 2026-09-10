import {createContext,useContext,useEffect,useState} from 'react';

import {readTheme,applyTheme,THEME_KEY} from '../services/theme';
const ThemeContext=createContext({theme:'light',toggle:()=>{}});
export function ThemeProvider({children}) {
 const [theme,setTheme]=useState(()=>readTheme());
 useEffect(()=>{
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const sync=()=>{const next=readTheme();applyTheme(next);setTheme(next);};
  const storage=e=>{if(e.key===THEME_KEY||e.key===null)sync();};
  sync();media.addEventListener('change',sync);window.addEventListener('storage',storage);
  return()=>{media.removeEventListener('change',sync);window.removeEventListener('storage',storage);};
 },[]);
 function toggle(){const next=theme==='dark'?'light':'dark';applyTheme(next,globalThis,true);setTheme(next);}
 return <ThemeContext.Provider value={{theme,toggle}}>{children}</ThemeContext.Provider>;
}
export default function ThemeToggle(){
 const {theme,toggle}=useContext(ThemeContext),dark=theme==='dark';
 return <button className="theme-toggle" type="button" onClick={toggle} aria-label="โหมดมืด" aria-pressed={dark} title={dark?'เปลี่ยนเป็นโหมดสว่าง':'เปลี่ยนเป็นโหมดมืด'}>
  <i className="theme-glyph theme-glyph-sun" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4.5"/><path d="M12 3v2.25M12 18.75V21M3 12h2.25M18.75 12H21M5.64 5.64l1.59 1.59m9.54 9.54 1.59 1.59M5.64 18.36l1.59-1.59m9.54-9.54 1.59-1.59" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></i>
  <i className="theme-glyph theme-glyph-moon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 2.1a.75.75 0 0 1 .2.85A8.8 8.8 0 0 0 21 14.4a.75.75 0 0 1 .94 1A10.3 10.3 0 1 1 8.6 1.95a.75.75 0 0 1 .8.15Z"/></svg></i>
 </button>;
}