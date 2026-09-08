export function adminRoute(path){
 const routes={
  '/adminpage-rose':{scope:'rose',settings:false},
  '/adminpage-praew':{scope:'praew',settings:false},
  '/adminpage-all':{scope:'all',settings:false},
  '/adminpage-settings':{scope:'all',settings:true}
 };
 return routes[path.replace(/\/+$/,'')]||null;
}

