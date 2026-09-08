import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
import {createHandler} from './handler.js';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createHandler({db,env:(name:string)=>Deno.env.get(name)}));
