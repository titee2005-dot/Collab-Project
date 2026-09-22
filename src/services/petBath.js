export const BATH_GOAL=120;
export function bathStage(progress){return progress<20?0:progress<70?1:progress<100?2:progress<120?3:4;}
export function bathRoom(value){return {round:Number.isSafeInteger(value?.round)&&value.round>0?value.round:1,progress:Number.isFinite(value?.progress)?Math.max(0,Math.min(120,Math.floor(value.progress))):0,day:value?.day||null,completedAt:value?.completedAt||null,lastCompletedAt:value?.lastCompletedAt||value?.completedAt||null,hatched:value?.hatched===true};}
export const bathRooms=data=>({rose:bathRoom(data?.rose),praew:bathRoom(data?.praew)});
export function mergeBathRooms(previous,data){const next=bathRooms(data);for(const id of ['rose','praew']){const old=previous[id];if(next[id].round<old.round||(next[id].round===old.round&&next[id].progress<old.progress))next[id]=old;}return next;}

export const bathRewardActive=(room,now=Date.now())=>{const stamp=Date.parse(room?.lastCompletedAt||room?.completedAt);return Number.isFinite(stamp)&&now>=stamp&&now-stamp<300000;};
