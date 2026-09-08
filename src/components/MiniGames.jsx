import {Component,useState} from 'react';
import {availableGames,selectedGame} from '../games/catalog';
import {gameComponents} from '../games/components';
class GameBoundary extends Component{
 state={failed:false,retry:0};
 static getDerivedStateFromError(){return {failed:true};}
 render(){if(this.state.failed)return <div className="game-error" role="alert"><p>เกมนี้เปิดไม่สำเร็จ ลองใหม่อีกครั้งได้ครับ</p><button className="secondary" onClick={()=>this.setState(s=>({failed:false,retry:s.retry+1}))}>ลองใหม่</button></div>;return <div key={this.state.retry}>{this.props.children}</div>;}
}
export default function MiniGames({onHatched}){
 const [chosen,setChosen]=useState(null),[visited,setVisited]=useState([]);const games=availableGames(),active=selectedGame(chosen);
 if(!active)return null;
 function choose(id){setChosen(id);setVisited(ids=>ids.includes(id)?ids:[...ids,id]);}
 return <section className="mini-games" aria-label="มินิเกม"><header className="mini-games-heading"><span>PLAY TOGETHER</span><h2>มุมมินิเกม</h2><p>เล่นสนุกด้วยกันระหว่างสะสมหัวใจ</p></header>{games.length>1&&<div className="mini-games-picker" role="group" aria-label="เลือกมินิเกม">{games.map(game=><button key={game.id} aria-pressed={active.id===game.id} aria-controls={'game-'+game.id} onClick={()=>choose(game.id)}><span aria-hidden="true">{game.icon}</span><span><b>{game.title}</b><small>{game.description}</small></span></button>)}</div>}{games.map(game=>{const Game=gameComponents[game.id],isActive=active.id===game.id;if(!Game||(!isActive&&!(game.keepMounted&&(visited.includes(game.id)||games[0].id===game.id))))return null;return <div key={game.id} id={'game-'+game.id} hidden={!isActive} aria-label={game.title}><GameBoundary><Game active={isActive} onHatched={onHatched}/></GameBoundary></div>;})}</section>;
}
