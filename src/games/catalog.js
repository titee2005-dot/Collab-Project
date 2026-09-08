// Stable IDs also identify each game's UI panel and storage namespace.
export const gameCatalog=[{id:'hatching',title:'ช่วยกันฟักไข่',description:'สะสมยอดกดร่วมกันเพื่อพบเพื่อนตัวน้อย',icon:'🥚',enabled:true,keepMounted:true}];
export function availableGames(catalog=gameCatalog){return catalog.filter(game=>game.enabled);}
export function selectedGame(id,catalog=gameCatalog){const games=availableGames(catalog);return games.find(game=>game.id===id)||games[0]||null;}
export function gameStorageKey(id,version=1){return 'heart-collection.game.'+id+'.v'+version;}
