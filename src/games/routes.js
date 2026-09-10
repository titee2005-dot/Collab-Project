import {availableGames} from './catalog.js';
export function gameRoute(path){const clean=path.replace(/\/+$/,'');if(clean==='/games')return {type:'list'};if(clean.startsWith('/games/')){const id=clean.slice(7),game=availableGames().find(g=>g.id===id);return game?{type:'game',game}:{type:'missing'};}return null;}
