const thresholds = [100, 250, 500, 750, 1000, 1500, 2000];
const definitions = {
 rose: [
  ['Rose Ribbon','ribbon',6397], ['Rose Potion','potion',6401],
  ['Moon Wand','wand',6405], ['Rabbit Moon Charm','familiar-charm',6399],
  ['Moon Crystal','mirror',6407], ['Rose Crown','crown',6409],
  ['Rose Spellbook','book',6403],
 ],
 praew: [
  ['Star Ribbon','ribbon',6398], ['Golden Potion','potion',6402],
  ['Star Wand','wand',6406], ['Alpaca Star Charm','familiar-charm',6400],
  ['Sun Crystal','crystal',6408], ['Star Crown','crown',6410],
  ['Butterfly Spellbook','book',6404],
 ],
};
const descriptions = [
 'A ribbon on your display shelf, and a matching bow for your little companion.',
 'A magical potion joins the treasures on your display shelf.',
 'A magical wand joins your collection. Your companion learns a little happy shuffle.',
 'A lucky charm on the shelf, and a matching charm for your companion.',
 'A crystal catches the light on your display shelf.',
 'A little crown for your collection, and one for your faithful companion.',
 'A spellbook full of the stories you collected together.',
];
export const collectibleItems = Object.fromEntries(Object.entries(definitions).map(([recipient,items])=>[
 recipient, items.map(([name,kind,image],i)=>({id:`${recipient}-${i}`,name,kind,at:thresholds[i],description:descriptions[i],artwork:`/items/drive/IMG_${image}.PNG`})),
]));
