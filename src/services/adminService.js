import {saveReviewerSession,clearReviewerSession} from './reviewerSession';
import {api} from './api';
import {backend,getSupabase} from './supabaseClient';
export const getAdminState=async(scope='all')=>{
 const data=await api('/admin/state?scope='+encodeURIComponent(scope),{reviewerScope:scope});
 if(backend==='local')return {...data,orders:data.orders.filter(o=>scope==='all'||o.form.recipient===scope)};
 return data;
};
export const getAdminSettings=()=>api(backend==='local'?'/admin/state':'/admin/settings');
export async function login(username,password){
 if(backend==='local')return api('/login',{method:'POST',body:{username,password}});
 const {error}=await getSupabase().auth.signInWithPassword({email:username.trim(),password});
 if(error)throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
}
export async function logout(){
 if(backend==='local')return api('/logout',{method:'POST'});
 const {error}=await getSupabase().auth.signOut({scope:'local'});if(error)throw new Error('ออกจากระบบไม่สำเร็จ');
}
export const getSlipURL=async(id,scope)=>backend==='local'?'/api/admin/slips/'+id:(await api('/admin/slips/'+id,{reviewerScope:scope})).url;
export const setReviewMode=(recipient,mode)=>api('/admin/mode',{method:'POST',body:{recipient,mode}});
export const reviewOrder=(id,decision,evidence={},scope='all')=>api('/admin/review',{method:'POST',reviewerScope:scope,body:{id,decision,scope,...evidence,reason:decision==='approve'?'แอดมินตรวจยอดเข้าบัญชีและอนุมัติ':'แอดมินปฏิเสธรายการ'}});
export const recordExternalDonation=(form,id,scope='all')=>api('/admin/external',{method:'POST',reviewerScope:scope,body:{form:{...form,channel:'Other'},id,scope,reason:'แอดมินยืนยันยอดเข้าบัญชีจากรายการภายนอก'}});
export const setVerificationPolicy=body=>api('/admin/verification',{method:'POST',body});


export async function loginReviewer(scope,password){const session=await api('/reviewer/login',{method:'POST',body:{scope,password}});saveReviewerSession(session);}
export async function logoutReviewer(scope){try{await api('/reviewer/logout',{method:'POST',reviewerScope:scope,body:{}});}finally{clearReviewerSession(scope);}}
export const setReviewerPassword=(scope,password)=>api('/admin/reviewer-password',{method:'POST',body:{scope,password}});
