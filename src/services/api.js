import {reviewerSession,clearReviewerSession} from './reviewerSession.js';
import {backend,getSupabase,edgeURL,publicKey} from './supabaseClient.js';
export async function api(path, {method='GET',body,reviewerScope}={}){
 const headers=body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{};
 let url='/api'+path;
 if(backend!=='local'){
  const client=getSupabase();url=import.meta.env.DEV?'/supabase-api'+path:edgeURL(path);headers.apikey=publicKey();
  if(reviewerScope){const session=reviewerSession(reviewerScope);if(session)headers['x-reviewer-token']=session.token;else{const {data}=await client.auth.getSession();if(!data.session)throw Object.assign(new Error('กรุณาใส่รหัสผ่านเพื่อเข้าหน้านี้'),{status:401});headers.Authorization='Bearer '+data.session.access_token;}}
  else if(path.startsWith('/admin/')){
   const {data,error}=await client.auth.getSession();
   if(error||!data.session)throw Object.assign(new Error('กรุณาล็อกอินแอดมิน'),{status:401});
   headers.Authorization='Bearer '+data.session.access_token;
  }
 }
 let response;
 try{response=await fetch(url,{method,headers,credentials:backend==='local'?'same-origin':'omit',body:body instanceof FormData?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});}
 catch{throw new Error('ติดต่อระบบไม่ได้ กรุณาลองใหม่ด้วยรายการเดิม');}
 let data;try{data=await response.json();}catch{throw new Error('ยังไม่ได้ติดตั้ง API ของระบบโดเนท');}
 if(response.status===401&&reviewerScope)clearReviewerSession(reviewerScope);
 if(!response.ok)throw Object.assign(new Error(data.error||'ทำรายการไม่สำเร็จ'),{status:response.status});return data;
}
export function rememberOrder(id){try{const ids=ownedOrders();localStorage.setItem('heart-collection.owned-orders.v1',JSON.stringify([...new Set([...ids,id])]));}catch{}}
export function ownedOrders(){try{const ids=JSON.parse(localStorage.getItem('heart-collection.owned-orders.v1')||'[]');return Array.isArray(ids)?ids.filter(id=>typeof id==='string'):[];}catch{return [];}}
