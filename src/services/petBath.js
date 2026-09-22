export const BATH_GOAL=500000;
export function bathStage(progress){return progress<100000?0:progress<300000?1:progress<400000?2:progress<BATH_GOAL?3:4;}
export function bathRoom(value){return {rewardPoints:Number.isSafeInteger(value?.rewardPoints)?Math.max(0,value.rewardPoints):0,round:Number.isSafeInteger(value?.round)&&value.round>0?value.round:1,progress:Number.isFinite(value?.progress)?Math.max(0,Math.min(BATH_GOAL,Math.floor(value.progress))):0,day:value?.day||null,completedAt:value?.completedAt||null,lastCompletedAt:value?.lastCompletedAt||value?.completedAt||null,hatched:value?.hatched===true};}
export const bathRooms=data=>({rose:bathRoom(data?.rose),praew:bathRoom(data?.praew)});
export function mergeBathRooms(previous,data){const next=bathRooms(data);for(const id of ['rose','praew']){const old=previous[id];if(next[id].round<old.round||(next[id].round===old.round&&next[id].progress<old.progress))next[id]=old;}return next;}

export const bathRewardActive=(room,now=Date.now())=>{const stamp=Date.parse(room?.lastCompletedAt||room?.completedAt);return Number.isFinite(stamp)&&now>=stamp&&now-stamp<300000;};

// Mission points unlock the existing items without adding donated hearts.
export function withBathRewards(stats,rooms){
 const rose=bathRoom(rooms?.rose).rewardPoints,praew=bathRoom(rooms?.praew).rewardPoints;
 return {...stats,points:stats.points+rose+praew,rose:{...stats.rose,points:stats.rose.points+rose},praew:{...stats.praew,points:stats.praew.points+praew}};
}
