export const grandTiers = [
  {at: 0, name: 'Little Spark', symbol: '✧', color: '#ffd4e5', ink: '#d4a5b8', soft: '#ffe9f2'},
  {at: 500, name: 'Moon Heart', symbol: '☽', color: '#aa8bd0', ink: '#7a5ba0', soft: '#cab9e0'},
  {at: 1000, name: 'Crystal Heart', symbol: '◈', color: '#80c6d3', ink: '#5096a3', soft: '#b0d6e3'},
  {at: 2000, name: 'Angel Heart', symbol: '✦', color: '#c8bfd7', ink: '#988fa7', soft: '#d8cfe7'},
  {at: 5000, name: 'Eternal Heart', symbol: '♥', color: '#dc72a8', ink: '#ac4278', soft: '#eca2c8'}
];

export function grandTier(total) {
  let index = 0;
  for (let i = grandTiers.length - 1; i >= 0; i--) {
    if (total >= grandTiers[i].at) {
      index = i;
      break;
    }
  }
  
  const current = grandTiers[index];
  const next = index < grandTiers.length - 1 ? grandTiers[index + 1] : null;
  const value = next ? total - current.at : current.at;
  const max = next ? next.at - current.at : current.at;
  
  return {
    index,
    current,
    next,
    value,
    max
  };
}
