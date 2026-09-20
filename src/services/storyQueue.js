export const STORY_DURATION = 60_000;
const recipients=['rose','praew'];
const stamp=d=>Date.parse(d.approvedAt||d.createdAt)||0;
const chronological=(a,b)=>stamp(a)-stamp(b)||a.id.localeCompare(b.id);
export function createStoryQueue({onChange,now=Date.now,schedule=setTimeout,cancel=clearTimeout}={}){
 const rooms=Object.fromEntries(recipients.map(r=>[r,{queue:[],latest:null,timer:null,remaining:STORY_DURATION,started:0}]));
 const seen=new Set();let initialized=false,paused=false,disposed=false;
 const emit=()=>{if(!disposed)onChange(Object.fromEntries(recipients.map(r=>[r,rooms[r].queue[0]||rooms[r].latest])));};
 function stop(room){if(room.timer!==null)cancel(room.timer);room.timer=null;}
 function run(room){if(disposed||paused||room.timer!==null||!room.queue.length)return;room.started=now();room.timer=schedule(()=>{room.timer=null;room.queue.shift();room.remaining=STORY_DURATION;emit();run(room);},room.remaining);}
 return {
  update(snapshot,incoming=[]){
   if(disposed)return;const byId=new Map(snapshot.map(d=>[d.id,d]));
   if(!initialized){for(const d of snapshot)if(!incoming.some(n=>n.id===d.id))seen.add(d.id);initialized=true;}
   for(const r of recipients){const room=rooms[r],previous=room.queue[0]?.id;
    room.latest=snapshot.filter(d=>d.recipient===r).sort(chronological).at(-1)||null;
    room.queue=room.queue.filter(d=>byId.get(d.id)?.recipient===r).map(d=>byId.get(d.id));
    if(previous!==room.queue[0]?.id){stop(room);room.remaining=STORY_DURATION;}
   }
   for(const d of [...incoming].sort(chronological)){if(!rooms[d.recipient]||seen.has(d.id)||!byId.has(d.id))continue;seen.add(d.id);rooms[d.recipient].queue.push(byId.get(d.id));}
   emit();for(const room of Object.values(rooms))run(room);
  },
  ids(){return [...new Set(Object.values(rooms).flatMap(r=>r.queue.map(d=>d.id)))];},
  pause(){if(disposed||paused)return;paused=true;for(const room of Object.values(rooms)){if(room.timer!==null)room.remaining=Math.max(0,room.remaining-(now()-room.started));stop(room);}},
  resume(){if(disposed||!paused)return;paused=false;for(const room of Object.values(rooms))run(room);},
  dispose(){disposed=true;for(const room of Object.values(rooms))stop(room);}
 };
}
