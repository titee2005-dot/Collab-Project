import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>{const env=loadEnv(mode,process.cwd(),'VITE_');return {plugins:[react()],server:{port:5173,strictPort:true,proxy:{'/api':'http://127.0.0.1:3001',...(env.VITE_SUPABASE_URL?{'/supabase-api':{target:env.VITE_SUPABASE_URL,changeOrigin:true,rewrite:path=>path.replace(/^\/supabase-api/,'/functions/v1/heart-api'),headers:{Origin:'https://heartcollection.vercel.app'}}}:{})}}};});
