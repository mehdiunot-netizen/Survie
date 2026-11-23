// Logique pure du jeu (sans 3D) — testable avec Node : node tests/test.js
(function(root){
const CFG={ // valeurs « à équilibrer » = prix/temps non fixés par REGLES_DU_JEU.md
 PILES:10, TOTAL:5000000, PRICE_PER_SHEET:0.5, CRUSH_SEC_PER_SHEET:0.04, CRUSH_MIN_SEC:2, INV_SLOTS:4, SLOT_CAP:100,
 SHOP_QUEST:100, CASINO_COST:100, CUBE_SHEETS:100,
 ROBOTS:{normal:{cost:150,rate:100,repair:30,hp:[2,3,4,5]},pro:{cost:500,rate:500,repair:100,hp:[3,4,5,6]},max:{cost:1500,rate:2000,repair:300,hp:[5,7,9,10]}},
 UPG:[0,100,300,700],
 SLOTS:{sym:['🍒','🍋','🔔','⭐','7','💎'],triple:[3,4,6,8,15,30],pair:1.5,bets:[10,25,50]},
 ARMORY:{lampe:50,pistolet:250,kalach:750,pompe:1000,dynamite:300}
};
function newState(){const per=Math.floor(CFG.TOTAL/CFG.PILES);return{v:1,piles:Array(CFG.PILES).fill(per),collected:0,sold:0,credits:0,inv:[0,0,0,0],bullet:0,
 unlocked:{shop:false,armory:false,casino:false},robots:[],cubes:[],upgrades:{normal:0,pro:0,max:0},crush:null,variant:'normal',skills:{col:0,rob:0,log:0,sur:0},weapons:{}}}
const carried=s=>s.inv.reduce((a,b)=>a+b,0);
function pick(s,pile,rnd){ // ramassage manuel : 3 ou 4 feuilles
 const want=3+(Math.floor((rnd||Math.random)()*2))+(s.skills.col>>1),slot=s.inv.findIndex(n=>n<CFG.SLOT_CAP);
 if(slot<0)return 0;const n=Math.min(want,CFG.SLOT_CAP-s.inv[slot],s.piles[pile]);if(n<=0)return 0;
 s.inv[slot]+=n;s.piles[pile]-=n;s.collected+=n;if(s.collected>=CFG.SHOP_QUEST)s.unlocked.shop=true;return n}
function startCrush(s,now){ // le joueur vend : feuilles + cubes + balle éventuelle
 if(s.crush)return false;let n=carried(s);for(const c of s.cubes)n+=c.n;
 if(n===0&&!s.bullet)return false;
 s.crush={n,bullet:s.bullet,start:now,dur:Math.max(CFG.CRUSH_MIN_SEC,n*CFG.CRUSH_SEC_PER_SHEET*(1-.1*s.skills.log))*1000};
 s.inv=[0,0,0,0];s.cubes=[];s.bullet=0;return true}
function tickCrush(s,now){const c=s.crush;if(!c||now-c.start<c.dur)return null;
 const gain=Math.floor(c.n*CFG.PRICE_PER_SHEET);s.credits+=gain;s.sold+=c.n;if(c.bullet)s.unlocked.armory=true;s.crush=null;return{gain,n:c.n,armory:!!c.bullet}}
function maxHp(s,r){return CFG.ROBOTS[r.t].hp[s.upgrades[r.t]]+(s.skills.sur>>1)}
function buyRobot(s,t){const d=CFG.ROBOTS[t];if(!s.unlocked.shop||s.credits<d.cost)return false;s.credits-=d.cost;s.robots.push({t,hp:d.hp[s.upgrades[t]]+(s.skills.sur>>1),acc:0,carry:0});return true}
function buyUpgrade(s,t){const l=s.upgrades[t];if(l>=3||!s.unlocked.shop)return false;const c=CFG.UPG[l+1];if(s.credits<c)return false;s.credits-=c;s.upgrades[t]++;
 for(const r of s.robots)if(r.t===t&&r.hp>0)r.hp+=1; return true} // approximation : +1 PV immédiat (documenté)
function repair(s,i){const r=s.robots[i];if(!r||r.hp>0)return false;const c=CFG.ROBOTS[r.t].repair;if(s.credits<c)return false;s.credits-=c;r.hp=maxHp(s,r);return true}
function hit(s,i){const r=s.robots[i];if(!r||r.hp<=0)return;r.hp--} // à 0 coup restant le robot s'arrête
function tickRobots(s,dt){ // dt en secondes ; un robot actif prélève sur les tas et dépose un cube de 100 feuilles
 for(const r of s.robots){if(r.hp<=0)continue;r.acc+=CFG.ROBOTS[r.t].rate*(1+.1*s.skills.rob)/60*dt;
  while(r.acc>=1){const p=s.piles.findIndex(x=>x>0);if(p<0){r.acc=0;break}r.acc--;s.piles[p]--;r.carry++;
   if(r.carry>=CFG.CUBE_SHEETS){s.cubes.push({t:r.t,n:r.carry});r.carry=0}}}}
function buyCasino(s){if(s.unlocked.casino||s.credits<CFG.CASINO_COST)return false;s.credits-=CFG.CASINO_COST;s.unlocked.casino=true;return true}
function slotPayout(a,b,c){if(a===b&&b===c)return CFG.SLOTS.triple[a];if(a===b||b===c||a===c)return CFG.SLOTS.pair;return 0}
function rouletteSpin(rnd){return Math.floor((rnd||Math.random)()*38)} // 0..35 normaux, 36 = « 0 », 37 = « 00 »
function roulettePayout(bet,n){ // retour total, mise incluse. bet:{type,val}
 const z=n>=36,num=z?-1:n+1; // cases 1..36 = num ; 0/00 perdent hors pari numéro exact
 const red=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
 switch(bet.type){case'rouge':return !z&&red.includes(num)?2:0;case'noir':return !z&&!red.includes(num)?2:0;
 case'pair':return !z&&num%2===0?2:0;case'impair':return !z&&num%2===1?2:0;
 case'douzaine':return !z&&Math.ceil(num/12)===bet.val?3:0;case'numero':return (bet.val===0?n===36:bet.val===-1?n===37:(!z&&num===bet.val))?36:0}return 0}
const SK=['col','rob','log','sur'],MAXSK=5;
function skillPts(s){return Math.floor(s.sold/1000)-SK.reduce((a,k)=>a+s.skills[k],0)} // 1 point / 1000 feuilles vendues
function buySkill(s,k){if(!SK.includes(k)||s.skills[k]>=MAXSK||skillPts(s)<1)return false;s.skills[k]++;return true}
function buyWeapon(s,w){if(!s.unlocked.armory||!(w in CFG.ARMORY)||s.credits<CFG.ARMORY[w]||(w!=='dynamite'&&s.weapons[w]))return false;s.credits-=CFG.ARMORY[w];s.weapons[w]=(s.weapons[w]||0)+1;return true}
function canShoot(s){return !!(s.weapons.pistolet||s.weapons.kalach||s.weapons.pompe||s.weapons.dynamite)}
function shoot(s){if(!canShoot(s))return false;if(!s.weapons.pistolet&&!s.weapons.kalach&&!s.weapons.pompe)s.weapons.dynamite--;return true} // dynamite = usage unique
const VARIANTS={horreur:'horreur',doree:'doree',neon:'neon',normal:'normal'};
function setVariant(s,code){const v=VARIANTS[String(code).trim().toLowerCase()];if(!v)return false;s.variant=v;return true}
function save(s,st){try{st.setItem('100000000000page',JSON.stringify(s));return true}catch(e){return false}}
function load(st){try{const j=JSON.parse(st.getItem('100000000000page'));return j&&j.v===1?Object.assign(newState(),j):null}catch(e){return null}}
const API={buySkill,skillPts,buyWeapon,canShoot,shoot,setVariant,CFG,newState,carried,pick,startCrush,tickCrush,buyRobot,buyUpgrade,repair,hit,tickRobots,buyCasino,slotPayout,rouletteSpin,roulettePayout,maxHp,save,load};
if(typeof module!=='undefined')module.exports=API;else root.Game=API;
})(this);
