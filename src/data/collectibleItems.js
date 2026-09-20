const thresholds = [100, 250, 500, 750, 1000, 1500, 2000];
const definitions = {
 rose: [
  ['Moon Ribbon','ribbon',6397], ['Moon Charm','familiar-charm',6399],
  ['Moon Potion','potion',6401], ['Moon Spellbook','book',6403],
  ['Moon Wand','wand',6405], ['Moon Crystal','mirror',6407],
  ['Moon Crown','crown',6409],
 ],
 praew: [
  ['Sun Ribbon','ribbon',6398], ['Sun Charm','familiar-charm',6400],
  ['Sun Potion','potion',6402], ['Sun Spellbook','book',6404],
  ['Sun Wand','wand',6406], ['Sun Crystal','crystal',6408],
  ['Sun Crown','crown',6410],
 ],
};
const descriptions = [
 'A ribbon on your display shelf, and a matching bow for your little companion.',
 'A lucky charm on the shelf, and a matching charm for your companion.',
 'A magical potion joins the treasures on your display shelf.',
 'A spellbook full of the stories you collected together.',
 'A magical wand joins your collection. Your companion learns a little happy shuffle.',
 'A crystal catches the light on your display shelf.',
 'A little crown for your collection, and one for your faithful companion.',
];
export const collectibleItems = Object.fromEntries(Object.entries(definitions).map(([recipient,items])=>[
 recipient, items.map(([name,kind,image],i)=>({id:`${recipient}-${i}`,name,kind,at:thresholds[i],description:descriptions[i],artwork:`/items/drive/IMG_${image}.PNG`})),
]));
