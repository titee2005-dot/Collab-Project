import test from 'node:test';
import assert from 'node:assert/strict';
import {readTheme,applyTheme,THEME_KEY} from '../src/services/theme.js';
test('saved theme overrides device preference and invalid values fall back',()=>{
 const env={localStorage:{getItem:()=> 'light'},matchMedia:()=>({matches:true})};
 assert.equal(readTheme(env),'light');env.localStorage.getItem=()=> 'invalid';assert.equal(readTheme(env),'dark');
 env.matchMedia=()=>({matches:false});assert.equal(readTheme(env),'light');
});
test('theme remains usable with blocked storage and persists when available',()=>{
 let applied,saved;const env={document:{documentElement:{setAttribute:(k,v)=>{applied=[k,v];}}},localStorage:{getItem(){throw Error();},setItem(){throw Error();}},matchMedia:()=>({matches:true})};
 assert.equal(readTheme(env),'dark');assert.doesNotThrow(()=>applyTheme('light',env,true));assert.deepEqual(applied,['data-theme','light']);
 env.localStorage.setItem=(k,v)=>{saved=[k,v];};applyTheme('dark',env,true);assert.deepEqual(saved,[THEME_KEY,'dark']);
});
