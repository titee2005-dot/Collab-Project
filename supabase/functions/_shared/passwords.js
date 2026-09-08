const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export const randomHex=size=>hex(crypto.getRandomValues(new Uint8Array(size)));
export async function passwordHash(password,salt){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const saltBytes=new Uint8Array(salt.match(/../g).map(s=>parseInt(s,16)));
 return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:saltBytes,iterations:310000,hash:'SHA-256'},key,256)));
}
export function sameHash(a,b){if(a.length!==b.length)return false;let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0;}

