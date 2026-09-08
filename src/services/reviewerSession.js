const prefix='heart-collection.reviewer.v1.';
const memory=new Map();
export function reviewerSession(scope){
 try{
  const value=memory.get(scope)||JSON.parse(localStorage.getItem(prefix+scope)||'null');
  if(value?.scope===scope&&typeof value.token==='string'&&/^[a-f0-9]{64}$/.test(value.token)&&Date.parse(value.expiresAt)>Date.now())return value;
 }catch{}
 clearReviewerSession(scope);return null;
}
export function saveReviewerSession(session){memory.set(session.scope,session);try{localStorage.setItem(prefix+session.scope,JSON.stringify(session));}catch{}}
export function clearReviewerSession(scope){memory.delete(scope);try{localStorage.removeItem(prefix+scope);}catch{}}

