// Original, procedurally composed celesta loop. No sampled or third-party audio.
import {writeFileSync,mkdirSync} from 'node:fs';
const rate=22050;
function render(name,duration,notes){
 const samples=new Float64Array(rate*duration);
 for(const [start,midi,length,volume] of notes){const frequency=440*2**((midi-69)/12);for(let i=0;i<length*rate;i++){const p=Math.floor(start*rate)+i;if(p>=samples.length)break;const t=i/rate,envelope=Math.min(1,t/.012)*Math.exp(-t*2/length)*Math.min(1,(length-t)/.1);samples[p]+=volume*envelope*(Math.sin(2*Math.PI*frequency*t)+.23*Math.sin(2*Math.PI*frequency*2*t)*Math.exp(-t*3)+.08*Math.sin(2*Math.PI*frequency*3*t));}}
 const buffer=Buffer.alloc(44+samples.length*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(samples.length*2,40);samples.forEach((v,i)=>buffer.writeInt16LE(Math.round(Math.max(-.95,Math.min(.95,v))*32767),44+i*2));writeFileSync(`public/audio/${name}.wav`,buffer);
}
mkdirSync('public/audio',{recursive:true});
const melody=[72,76,79,83,81,79,76,74,72,76,79,86,83,81,79,76];
render('magical-theme',32,melody.map((m,i)=>[i*1.85+.3,m,2.5,.19]).concat([48,53,55,48].flatMap((m,i)=>[[i*7.4,m,6,.07],[i*7.4+.1,m+7,6,.045]])));
render('heart-arrive',2,[[0,79,1,.15],[.2,83,1.2,.12],[.4,86,1.4,.1]]);
render('heart-drop',1,[[0,72,.8,.15]]);
render('unlock',3,[[0,72,2,.12],[.2,76,2,.12],[.4,79,2,.12],[.7,84,2,.13]]);
render('sparkle',1,[[0,88,.8,.09],[.1,91,.8,.08]]);
