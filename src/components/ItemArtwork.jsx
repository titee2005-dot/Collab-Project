export default function ItemArtwork({item}) {
 return <img className="item-artwork" src={item.artwork} alt={item.name} width="2048" height="2048" decoding="async"/>;
}
export function ItemDisplay({items,total,preview}) {
 if(!items.some(item=>item.at<=total)&&!preview)return null;
 return <div className="item-display-shelf" aria-label="Room items">
  {items.map(item=>{
   const unlocked=item.at<=total,selected=preview?.id===item.id&&!unlocked;
   return <div key={item.id} className={'item-display-slot item-position-'+item.kind+(selected?' item-preview':'')} title={unlocked||selected?item.name:undefined}>
    {(unlocked||selected)&&<><ItemArtwork item={item}/>{selected&&<span className="item-preview-label">PREVIEW</span>}</>}
   </div>;
  })}
 </div>;
}
