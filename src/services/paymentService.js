export async function simulatePayment({fail = false} = {}) {
  await new Promise(resolve=>setTimeout(resolve,650));
  if (fail) throw new Error('Something interrupted the spell. Please try again.');
  return {id:crypto.randomUUID(),status:'simulated',paidAt:new Date().toISOString()};
}

