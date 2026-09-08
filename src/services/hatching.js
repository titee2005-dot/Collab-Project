export const HATCH_TARGET=100000;
export const HATCH_KEY='heart-collection.hatching.v2';
export function hatchCount(value){return typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(HATCH_TARGET,Math.floor(value))):0;}
export function hatchProgress(value){return {rose:hatchCount(value?.rose),praew:hatchCount(value?.praew)};}
export function loadHatchCount(){try{return hatchProgress(JSON.parse(localStorage.getItem(HATCH_KEY)||'{}'));}catch{return hatchProgress();}}
export function saveHatchCount(value){try{const old=loadHatchCount(),next=hatchProgress(value);localStorage.setItem(HATCH_KEY,JSON.stringify({rose:Math.max(old.rose,next.rose),praew:Math.max(old.praew,next.praew)}));}catch{}}
