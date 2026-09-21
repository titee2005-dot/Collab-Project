// Show each of the first twenty gifts, then compress the growing pile.
export function jarHeartCount(total){return Math.min(96,total<=20?Math.max(0,Math.floor(total)):20+Math.ceil((total-20)/5));}
export function jarHeartPosition(index,total){
 let row=0,offset=index,capacity=3;
 while(offset>=capacity){offset-=capacity;row++;capacity=Math.min(9,3+row*2);}
 const side=offset===0?0:Math.ceil(offset/2)*(offset%2?-1:1);
 const settle=Math.min(1,Math.max(0,(total-20)/100));
 return {left:`${50+side*10}%`,bottom:`${3+row*(9-3*settle)}%`,width:`${34-10*settle+(index%3)*1.5}px`,transform:`translateX(-50%) rotate(${(index*29)%36-18}deg)`,animationDelay:'0s'};
}
