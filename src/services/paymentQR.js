const posters={
 rose:{bankCode:'004',accountNumber:'2192973506',src:'/payments/rose-payment.png'},
 praew:{bankCode:'004',accountNumber:'2361656396',src:'/payments/praew-payment.png'}
};
// Never show a saved QR if the configured receiving account has changed.
export function paymentQR(recipient,account){const p=posters[recipient];return p&&account?.bankCode===p.bankCode&&account?.accountNumber===p.accountNumber?p.src:null;}
