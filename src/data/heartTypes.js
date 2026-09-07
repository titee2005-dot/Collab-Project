export const heartTypes = [
  { id: 'pink', name: 'Pink Heart', color: '#e78eb3', meaning: 'Kindness', price: 20, rarity: 'common' },
  { id: 'ruby', name: 'Ruby Heart', color: '#c44c6d', meaning: 'Passion', price: 50, rarity: 'common' },
  { id: 'amber', name: 'Amber Heart', color: '#ed9862', meaning: 'Warmth', price: 100, rarity: 'common' },
  { id: 'golden', name: 'Golden Heart', color: '#dfb450', meaning: 'Hope', price: 200, rarity: 'common' },
];
export function resolveHearts({mode = 'fixed', heartType, quantity = 1, amount}) {
  if (mode === 'amount') {
    if (!Number.isSafeInteger(amount) || amount < 20) throw new Error('Enter a whole amount of at least 20 THB.');
    let remaining = amount;
    const result = [...heartTypes].reverse().flatMap(heart => {const quantity = Math.floor(remaining / heart.price); remaining %= heart.price; return quantity ? [{heartType:heart.id, quantity, amount:quantity * heart.price}] : [];});
    if (remaining) throw new Error('This amount cannot be represented exactly by the available hearts.');
    return result;
  }
  const heart = heartTypes.find(h => h.id === heartType);
  if (!heart || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new Error('Choose 1 to 100 hearts.');
  return [{heartType, quantity, amount:heart.price * quantity}];
}

