const ARTWORK_SIZES={
 leaf:[42,42],
 bubbles:[48,48],
 water:[44,48],
 towel:[92,68],
 moon:[38,38],
 sun:[38,38],
 egg:[112,132],
 spark:[28,28],
 soap:[44,44],
};

function ArtworkTitle({title}){
 return title?<title>{title}</title>:null;
}

/**
 * Small inline SVGs used by the bath game and the temporary room reward.
 * Keeping these shapes here means bath UI never relies on platform emoji fonts.
 */
export function PetBathArtwork({type='spark',className='',title,width,height,style}){
 const [defaultWidth,defaultHeight]=ARTWORK_SIZES[type]||ARTWORK_SIZES.spark;
 const labelled=Boolean(title);
 const props={
  className:'pet-bath-artwork pet-bath-artwork-'+type+(className?' '+className:''),
  viewBox:type==='towel'?'0 0 120 88':type==='egg'?'0 0 120 140':'0 0 100 100',
  width:width||defaultWidth,
  height:height||defaultHeight,
  style,
  role:labelled?'img':undefined,
  'aria-hidden':labelled?undefined:true,
  'aria-label':labelled?title:undefined,
  focusable:'false',
 };
 return <svg {...props}>
  <ArtworkTitle title={title}/>
  {type==='leaf'&&<>
   <path d="M50 83C45 68 29 59 17 62c1 15 10 27 29 28" fill="#85ad83" stroke="#5e896b" strokeWidth="3" strokeLinejoin="round"/>
   <path d="M22 67c10 5 18 12 25 20M50 82c7-18 18-29 35-34 2 16-6 31-25 38" fill="#a6c992" stroke="#6c9b73" strokeWidth="3" strokeLinejoin="round"/>
   <path d="M50 84c2-19 12-29 29-36" fill="none" stroke="#5c8565" strokeWidth="3" strokeLinecap="round"/>
  </>}
  {type==='bubbles'&&<>
   <circle cx="32" cy="62" r="19" fill="#d7edf1" stroke="#76aab8" strokeWidth="3"/>
   <circle cx="65" cy="51" r="24" fill="#e8f6f4" stroke="#8bbec1" strokeWidth="3"/>
   <circle cx="79" cy="77" r="12" fill="#c6e7eb" stroke="#76aab8" strokeWidth="3"/>
   <path d="M27 54c3-5 7-7 11-7M58 43c5-7 12-9 17-7M75 74c2-3 4-4 7-4" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"/>
  </>}
  {type==='water'&&<>
   <path d="M50 10C50 10 23 42 23 61a27 27 0 0 0 54 0C77 42 50 10 50 10Z" fill="#b9dfeb" stroke="#6aa8bc" strokeWidth="3"/>
   <path d="M39 59c1-7 5-13 10-18" fill="none" stroke="#f8ffff" strokeWidth="5" strokeLinecap="round"/>
   <path d="M16 22v13M9.5 28.5h13M86 26v10M81 31h10" fill="none" stroke="#82b7c1" strokeWidth="3" strokeLinecap="round"/>
  </>}
  {type==='towel'&&<>
   <path d="M16 17c1-7 7-11 15-10l69 12c8 1 12 7 10 15l-7 35c-1 7-7 11-14 10L20 67c-8-1-12-7-10-15Z" fill="#f4dfe9" stroke="#ab7f9b" strokeWidth="3" strokeLinejoin="round"/>
   <path d="m18 23 82 14M15 34l82 14M13 46l82 14M20 58l70 12" fill="none" stroke="#d2a9be" strokeWidth="3" opacity=".9"/>
   <path d="m86 13 15 3c8 1 11 6 9 14l-2 9-22-4Z" fill="#fff0f4" stroke="#ab7f9b" strokeWidth="3"/>
   <path d="M19 68v8m8-7v9m8-8v9m8-8v9m8-8v9m8-7v8m8-7v7m8-6v6" fill="none" stroke="#ab7f9b" strokeWidth="2" strokeLinecap="round"/>
  </>}
  {type==='moon'&&<path d="M68 10c-17 7-27 22-27 39 0 20 15 37 35 40-7 5-15 8-24 8C28 97 9 78 9 54S28 10 51 10c6 0 12 0 17 0Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>}
  {type==='sun'&&<>
   <circle cx="50" cy="50" r="22" fill="currentColor"/>
   <path d="M50 8v15M50 77v15M8 50h15M77 50h15M20 20l11 11M69 69l11 11M80 20 69 31M31 69 20 80" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/>
  </>}
  {type==='egg'&&<>
   <path d="M60 11c-24 0-39 31-39 62 0 33 18 52 39 52s39-19 39-52c0-31-15-62-39-62Z" fill="#fff4dd" stroke="#c99b86" strokeWidth="3"/>
   <path d="M46 31c-8 11-11 25-11 39 0 17 5 29 14 37" fill="none" stroke="#f4d6bc" strokeWidth="8" strokeLinecap="round" opacity=".9"/>
   <path d="m78 29 4 7m-19-13 2 7m22 45 5 4" fill="none" stroke="#d5a7a2" strokeWidth="3" strokeLinecap="round"/>
  </>}
  {type==='spark'&&<path d="m50 7 6 35 35 8-35 8-6 35-6-35-35-8 35-8Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round"/>}
  {type==='soap'&&<>
   <path d="M21 59c0-15 11-27 27-27h18c10 0 18 8 18 18v9c0 13-10 23-23 23H43c-12 0-22-10-22-23Z" fill="#e5c4dc" stroke="#a8799f" strokeWidth="3"/>
   <path d="M26 58h54M32 72h42" fill="none" stroke="#f7e6f0" strokeWidth="4" strokeLinecap="round"/>
   <circle cx="35" cy="19" r="8" fill="#d9edf0" stroke="#73a9b5" strokeWidth="3"/><circle cx="62" cy="14" r="5" fill="#e9f6f3" stroke="#82b7bc" strokeWidth="3"/>
  </>}
 </svg>;
}

export default PetBathArtwork;

