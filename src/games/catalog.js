// Keep the unfinished bath game available only in local development.
export const petBathEnabled=import.meta.env?.DEV===true && typeof window!=='undefined' && ['localhost','127.0.0.1','[::1]'].includes(window.location.hostname);
// Stable IDs also identify each game's UI panel and storage namespace.
export const gameCatalog=[{id:'hatching',title:'ช่วยกันฟักไข่',description:'สะสมยอดกดร่วมกันเพื่อพบเพื่อนตัวน้อย',icon:'🥚',enabled:true,keepMounted:true},{id:'pet-bath',title:'อาบน้ำให้เจ้าตัวน้อย',description:'ช่วยกันเก็บใบไม้ ถูสบู่ และเช็ดตัวให้สะอาด · เล่นฟรี',icon:'🫧',enabled:petBathEnabled}];
export function availableGames(catalog=gameCatalog){return catalog.filter(game=>game.enabled);}
export function selectedGame(id,catalog=gameCatalog){const games=availableGames(catalog);return games.find(game=>game.id===id)||games[0]||null;}
export function gameStorageKey(id,version=1){return 'heart-collection.game.'+id+'.v'+version;}
