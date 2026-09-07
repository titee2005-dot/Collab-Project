const thresholds=[100,250,500,750,1000,1500,2000];
const kinds=['ribbon','potion','wand','familiar-charm','mirror','crown','book'];
const descriptions=[
 'A ribbon for the room, and a matching bow for your little companion.',
 'A glowing potion finds its place on the shelf beside the heart jar.',
 'A magical wand rests beside the jar. Your companion learns a little happy shuffle.',
 'A lucky charm joins your companion’s bow. Your friend has been here from the very first heart.',
 'A new treasure catches the light beside the moonlit window.',
 'A little crown above the jar, and one for your faithful companion.',
 'An open spellbook rests on the shelf, full of the stories you collected together.',
];
export const collectibleItems={
 rose:['Rose Ribbon','Rose Potion','Moon Wand','Rabbit Moon Charm','Moon Mirror','Rose Crown','Rose Spellbook'].map((name,i)=>({id:`rose-${i}`,name,at:thresholds[i],kind:kinds[i],description:descriptions[i]})),
 praew:['Star Ribbon','Golden Potion','Star Wand','Alpaca Star Charm','Sun Crystal','Star Crown','Butterfly Spellbook'].map((name,i)=>({id:`praew-${i}`,name,at:thresholds[i],kind:i===4?'crystal':kinds[i],description:i===4?'A sun crystal catches warm light beside the magical window.':descriptions[i]})),
};
