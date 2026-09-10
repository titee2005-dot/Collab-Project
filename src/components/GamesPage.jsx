import ThemeToggle from './ThemeToggle';
import {ArrowLeft,ChevronRight,Gamepad2} from 'lucide-react';
import {availableGames} from '../games/catalog';
import {gameComponents} from '../games/components';
import GameBoundary from '../games/GameBoundary';
export default function GamesPage({route}){
 const game=route.game,Game=game&&gameComponents[game.id];
 return <div className="games-page"><header className="games-page-nav"><a className="games-home-button" href="/"><ArrowLeft size={21}/><span>กลับห้องหลัก</span></a><div className="games-nav-tools"><span>HEART COLLECTION</span><ThemeToggle/></div></header><main className="games-page-main">
 {route.type==='list'?<><div className="games-page-heading"><Gamepad2 size={32}/><h1>เลือกมินิเกม</h1><p>มาเล่นด้วยกัน แล้วเติมความสนุกให้ห้องหัวใจ ♡</p></div><div className="mini-games-menu games-page-list">{availableGames().map(g=><a key={g.id} href={'/games/'+g.id}><span className="game-menu-icon" aria-hidden="true">{g.icon}</span><span><b>{g.title}</b><small>{g.description}</small></span><ChevronRight size={20}/></a>)}</div></>:Game?<><h1 className="games-page-title">{game.title}</h1><GameBoundary><Game active/></GameBoundary></>:<div className="games-page-heading"><h1>ไม่พบมินิเกมนี้</h1></div>}
 </main></div>;
}
