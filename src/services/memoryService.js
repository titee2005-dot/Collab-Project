import {milestones} from '../data/milestones.js';
import {specialHearts} from '../data/specialHearts.js';
export const crossedMilestones=(before,after)=>milestones.filter(m=>before<m.at && after>=m.at);
export function getPersonalMemories(donations){
 const history=donations.filter(d=>!d.id.startsWith('demo-')).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
 let total=donations.filter(d=>d.id.startsWith('demo-')).reduce((sum,d)=>sum+d.quantity,0);
 const events=history.flatMap(d=>{const crossed=d.memoryMilestones??crossedMilestones(total,total+d.quantity).map(m=>m.at);total+=d.quantity;return crossed.map(at=>({at,donationId:d.id,createdAt:d.createdAt}));});
 const badges=history.length?[{id:'first',name:'My first little heart',description:'The beginning of your story.',createdAt:history[0].createdAt}]:[];
 if(new Set(history.map(d=>d.recipient)).size===2)badges.push({id:'together',name:'Love for both rooms',description:'A little moonlight and a little sunshine.',createdAt:history.find(d=>d.recipient!==history[0].recipient).createdAt});
 for(const event of events){if(badges.some(b=>b.id===`milestone-${event.at}`))continue;const heart=specialHearts.find(h=>h.unlock===event.at);badges.push({id:`milestone-${event.at}`,name:heart?`Here for ${heart.name}`:'Here for the room upgrade',description:`Your heart helped reach ${event.at.toLocaleString()} together.`,createdAt:event.createdAt,at:event.at});}
 return {history:[...history].reverse(),badges,hearts:history.reduce((sum,d)=>sum+d.quantity,0)};
}

