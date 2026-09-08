import {createServer} from 'node:http';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {configuration,openStore} from './core.js';

export function createApp({config=configuration(),store,verify}={}) {
  return createServer(async (req,res)=>{
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    try {
      const url=new URL(req.url,'http://localhost'), path=url.pathname;
      const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('hc_session='))?.slice(11);
      if(path.startsWith('/api/')) {
        const mutation=req.method!=='GET';
        if(mutation && (!config.origin || req.headers.origin!==config.origin)) return json(403,{error:'คำขอต้องมาจากเว็บไซต์ที่ตั้งค่าไว้'});
        if(path.startsWith('/api/admin/') && !store.authenticated(token)) return json(401,{error:'กรุณาล็อกอินแอดมิน'});
        const readBody=async()=>{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>6*1024*1024)throw Object.assign(new Error('ไฟล์ใหญ่เกินกำหนด'),{status:413});chunks.push(chunk);}return Buffer.concat(chunks);};
        const readJson=async()=>JSON.parse((await readBody()).toString());
        const ip=req.socket.remoteAddress; // Do not trust unconfigured forwarded headers.
        if(path==='/api/config' && req.method==='GET')return json(200,{enabled:config.enabled,accounts:config.enabled?config.accounts:null,message:config.enabled?'เปิดรับโดเนท':'ยังไม่เปิดรับเงินจริง กำลังตั้งค่าระบบ'});
        if(path==='/api/donations' && req.method==='GET')return json(200,store.publicDonations());
        if(path==='/api/login' && req.method==='POST'){store.rate(`login:${ip}`,10,15*60000);const b=await readJson();const t=store.login(b.username,b.password);res.setHeader('Set-Cookie',`hc_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${config.production?'; Secure':''}`);return json(200,{actor:config.username});}
        if(path==='/api/logout' && req.method==='POST'){store.logout(token);res.setHeader('Set-Cookie','hc_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(200,{ok:true});}
        if(path==='/api/orders' && req.method==='POST'){
          store.requireReady();store.rate(`upload:${ip}`,20,3600000);const data=await new Request('http://localhost',{method:'POST',headers:{'Content-Type':req.headers['content-type']||''},body:await readBody()}).formData();
          const file=data.get('slip');if(!file||typeof file.arrayBuffer!=='function')return json(400,{error:'กรุณาแนบสลิป'});
          const o=await store.submit({id:data.get('id'),form:JSON.parse(data.get('form'))},Buffer.from(await file.arrayBuffer()),verify);
          return json(200,{id:o.id,status:o.status});
        }
        if(path==='/api/admin/state' && req.method==='GET')return json(200,store.state());
        if(path==='/api/admin/verification' && req.method==='POST')return json(200,store.setVerificationPolicy(await readJson()));
        if(path==='/api/admin/mode' && req.method==='POST'){const b=await readJson();store.setMode(b.recipient,b.mode);return json(200,{ok:true});}
        if(path==='/api/admin/review' && req.method==='POST'){const b=await readJson();return json(200,store.review(b.id,b));}
        if(path==='/api/admin/external' && req.method==='POST'){const b=await readJson();return json(200,await store.submit({id:b.id,form:b.form},null,verify,{...b.form,reason:b.reason}));}
        if(path.startsWith('/api/admin/slips/') && req.method==='GET'){const row=store.slip(path.split('/').pop());if(!row?.slip)return json(404,{error:'ไม่พบสลิป'});res.setHeader('Content-Type',row.mime);res.setHeader('Content-Disposition','inline; filename="slip"');res.end(Buffer.from(row.slip));return;}
        return json(404,{error:'ไม่พบ API'});
      }
      if(req.method!=='GET'&&req.method!=='HEAD')return json(405,{error:'Method not allowed'});
      const dist=resolve('dist'), file=resolve(dist,'.'+decodeURIComponent(path));
      if(!file.startsWith(dist+sep)&&file!==dist)return json(404,{error:'Not found'});
      const target=extname(file)?file:resolve(dist,'index.html');
      if(!existsSync(target))return json(404,{error:'Run npm run build first'});
      res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav','.png':'image/png'})[extname(target)]||'application/octet-stream');
      res.end(req.method==='HEAD'?undefined:readFileSync(target));
    }catch(e){json(e.status||((e instanceof SyntaxError || e instanceof TypeError)?400:500),{error:e.status?e.message:'ไม่สามารถทำรายการได้ กรุณาลองใหม่'});}
  });
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const config=configuration();const path=resolve(process.env.DATABASE_PATH||'data/heart-collection.sqlite');mkdirSync(dirname(path),{recursive:true});
  const store=openStore(path,config),app=createApp({config,store});
  app.requestTimeout=30000;app.headersTimeout=15000;
  app.listen(Number(process.env.PORT||3001),process.env.HOST||'127.0.0.1',()=>console.log(`Heart server: port ${process.env.PORT||3001}; receiving ${config.enabled?'ENABLED':'DISABLED'}`));
}
