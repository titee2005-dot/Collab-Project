import {milestones} from './milestones.js';
import {specialHearts} from './specialHearts.js';
const names={rose:['A Quiet Beginning','Rose Garden','Moonlit Window','Crystal Alcove','Secret Library','Moonlight Sanctuary'],praew:['A Quiet Beginning','Star-flower Garden','Sunlit Window','Golden Alcove','Secret Library','Starlight Sanctuary']};
const additions=['garden','window','alcove','library','sanctuary'];
export const roomStages=Object.fromEntries(['rose','praew'].map(id=>[id,[{id:id+'-quiet',minHearts:0,name:names[id][0],unlocks:[]},...milestones.map((m,i)=>({id:id+'-'+additions[i],minHearts:m.at,name:names[id][i+1],unlocks:additions.slice(0,i+1)}))]]));
export const getRoomStage=(id,count)=>roomStages[id].filter(s=>s.minHearts<=count).at(-1)||roomStages[id][0];
export const getNextRoomStage=(id,count)=>roomStages[id].find(s=>s.minHearts>count)||null;
export const crossedRoomStages=(id,before,after)=>roomStages[id].filter(s=>s.minHearts>before&&s.minHearts<=after);
export function getRoomProgress(id,count){const stage=getRoomStage(id,count),next=getNextRoomStage(id,count);return {stage,next,value:next?count-stage.minHearts:1,max:next?next.minHearts-stage.minHearts:1,remaining:next?next.minHearts-count:0};}
export const roomSpecials=total=>specialHearts.filter(h=>total>=h.unlock);
