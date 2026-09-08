import {createClient} from '@supabase/supabase-js';
const env=import.meta.env??{};
export const backend=env.VITE_BACKEND||'supabase';
let client;
export function getSupabase(){
 if(client)return client;
 const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new Error('ยังไม่ได้ตั้งค่า Supabase URL และ Publishable key');
 client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 return client;
}
export function edgeURL(path){
 const url=env.VITE_SUPABASE_URL;if(!url)throw new Error('ยังไม่ได้ตั้งค่า Supabase');
 return url.replace(/\/$/,'')+'/functions/v1/heart-api'+path;
}
export const publicKey=()=>env.VITE_SUPABASE_PUBLISHABLE_KEY;
