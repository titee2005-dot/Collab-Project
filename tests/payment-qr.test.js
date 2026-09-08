import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentQR} from '../src/services/paymentQR.js';
test('payment QR is bound to recipient and exact configured bank account',()=>{
 const rose={bankCode:'004',accountNumber:'2192973506'},praew={bankCode:'004',accountNumber:'2361656396'};
 assert.equal(paymentQR('rose',rose),'/payments/rose-payment.png');
 assert.equal(paymentQR('praew',praew),'/payments/praew-payment.png');
 assert.equal(paymentQR('rose',praew),null);assert.equal(paymentQR('praew',rose),null);
 assert.equal(paymentQR('rose',{...rose,bankCode:'014'}),null);
 assert.equal(paymentQR('rose',{...rose,accountNumber:'0000000000'}),null);
 assert.equal(paymentQR('rose',null),null);
});
