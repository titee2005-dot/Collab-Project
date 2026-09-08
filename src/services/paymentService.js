import {api,rememberOrder} from './api';
export const getPaymentConfig=()=>api('/config');
export async function submitSlip(form,id,slip){
 const body=new FormData();body.set('id',id);body.set('form',JSON.stringify(form));body.set('slip',slip);rememberOrder(id);
 return api('/orders',{method:'POST',body});
}
