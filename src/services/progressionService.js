import {milestones} from '../data/milestones.js';
import {specialHearts} from '../data/specialHearts.js';
import {collectibleItems} from '../data/collectibleItems.js';
export const calculateMilestones = total => milestones.map(m=>({...m,unlocked:total>=m.at,progress:Math.min(1,total/m.at)}));
export const getUnlockedHearts = total => specialHearts.filter(h=>total>=h.unlock);
export const getUnlockedCollectibles = (recipient,total) => collectibleItems[recipient].filter(i=>total>=i.at);
export const getNewDiscoveries = (before,after) => specialHearts.filter(h=>h.unlock>before && h.unlock<=after);

