import {useState} from 'react';
import {Gamepad2,ChevronRight} from 'lucide-react';
import Modal from './Modal';
import HatchingPair from './HatchingPair';
import GameBoundary from '../games/GameBoundary';
import {availableGames} from '../games/catalog';
export default function MiniGames({onHatched}){
 const [open,setOpen]=useState(false);
 return <section className="mini-games mini-games-launcher" aria-label="มินิเกม"><button className="mini-games-open" aria-haspopup="dialog" onClick={()=>setOpen(true)}><Gamepad2 size={25}/><span><b>มินิเกม</b><small>พักมาเล่นด้วยกัน ♡</small></span><ChevronRight size={20}/></button>
 {open&&<Modal wide title="เลือกมินิเกม" onClose={()=>setOpen(false)}><p className="mini-games-intro">เลือกเกมที่อยากเล่น แล้วมาสนุกด้วยกัน</p><div className="mini-games-menu games-page-list">{availableGames().map(game=><a key={game.id} href={'/games/'+game.id}><span className="game-menu-icon" aria-hidden="true">{game.icon}</span><span><b>{game.title}</b><small>{game.description}</small></span><ChevronRight size={20}/></a>)}</div></Modal>}
 <GameBoundary><HatchingPair headless onHatched={onHatched}/></GameBoundary></section>;
}
