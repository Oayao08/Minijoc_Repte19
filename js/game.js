const ASSETS = {
  player: 'player.png', // posa la teva imatge del patinet (o deixa en blanc: es dibuixa un rectangle)
  peatons: ['personatge1.png','personatge2.png','personatge3.png','personatge4.png','personatge5.png'],
  obstacles: ['costat1.png','costat2.png','costat3.png','costat4.png','costat5.png'],
  distractions: ['smartphone.png','auriculars.png','semafor.png','bici.png','gos.png'],
  powerups: ['casco.png','chaleco.png']
};

let state = null;
/*UTILITATS*/
function clamp(v,a,b){return Math.max(a, Math.min(b, v));}
function rand(a,b){return a + Math.random()*(b-a);}
function aabb(a,b){ // col·lisió simple AABB
  return !(a.x+a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}

/* PRELOAD IMATGES SEGUR */
const images = {};
function loadAssets(assetList, prefix){
  assetList.forEach((src,i)=>{
    const img = new Image();
    img.src = src;
    images[prefix+i] = null;
    img.onload = ()=>{ images[prefix+i] = img; };
    img.onerror = ()=>{ console.warn('No trobat:', src); images[prefix+i]=null; };
  });
}

// Player fallback
images['player'] = null;
const imgPlayer = new Image();
imgPlayer.src = ASSETS.player;
imgPlayer.onload = ()=>images['player']=imgPlayer;
imgPlayer.onerror = ()=>{ console.warn('Player no trobat, es dibuixarà rectangle'); images['player']=null; }

loadAssets(ASSETS.peatons,'peaton');
loadAssets(ASSETS.obstacles,'obst');
loadAssets(ASSETS.distractions,'dis');
loadAssets(ASSETS.powerups,'pu');

/* Inicia el joc immediatament sense esperar */
game.start();

/* ENTITATS*/
class GameObject {
  constructor(x,y,w,h,image=null){
    this.x=x; this.y=y; this.w=w; this.h=h; this.image=image;
    this.vx=0; this.vy=0;
    this.remove=false;
  }
  draw(){
    if(this.image && images[this.image]){
      ctx.drawImage(images[this.image], this.x, this.y, this.w, this.h);
    } else {
      // fallback visual (segons tipus)
      ctx.fillStyle = '#666';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
  }
}

/*Jugador controlat: patinet*/
class Player extends GameObject{
  constructor(){
    super(100, H-140, 64, 64, 'player');
    this.speed=260;
    this.life=3;
    this.score=0;
    this.shield=0; // segons segons de protecció
  }
  update(dt, input){
    let dx=0, dy=0;
    if(input.left) dx -= 1;
    if(input.right) dx += 1;
    if(input.up) dy -= 1;
    if(input.down) dy += 1;
    const len = Math.hypot(dx,dy) || 1;
    this.x += (dx/len) * this.speed * dt;
    this.y += (dy/len) * this.speed * dt;
    this.x = clamp(this.x, 0, W - this.w);
    this.y = clamp(this.y, 0, H - this.h - 20);
    if(this.shield>0) this.shield = Math.max(0, this.shield - dt);
  }
  draw(){
    // si hi ha imatge del player la mostrem, si no, dibuix minimal
    if(images['player']){
      ctx.drawImage(images['player'], this.x, this.y, this.w, this.h);
    } else {
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.fillStyle = '#000'; ctx.fillText('PAT', this.x+8, this.y+36);
    }
    // indicador escut
    if(this.shield>0){
      ctx.strokeStyle = 'rgba(80,220,255,0.9)';
      ctx.lineWidth = 3;
      ctx.strokeRect(this.x-4, this.y-4, this.w+8, this.h+8);
    }
  }
}

/*Peató: apareix i creua un crosswalk */
class Peaton extends GameObject{
  constructor(x, y, dir, imageKey){
    super(x,y,48,64,imageKey);
    this.vx = dir * rand(40,80);
    this.h = 56;
  }
  update(dt){ this.x += this.vx * dt; if(this.x < -100 || this.x > W+100) this.remove=true; }
}

/* Obstáculos: cotxes/patinetes/bicis (mòbils) */
class Obstacle extends GameObject{
  constructor(x,y,vx,imageKey){
    super(x,y,72,48,imageKey);
    this.vx = vx;
    this.h = 48;
  }
  update(dt){ this.x += this.vx * dt; if(this.x < -200 || this.x > W+200) this.remove=true; }
}

/* Distracció: icona educativa (pot ser estàtica o mòbil) */
class Distraction extends GameObject{
  constructor(x,y,imageKey, info){
    super(x,y,44,44,imageKey);
    this.info = info; // missatge educatiu
    this.vx = 0;
  }
  update(dt){ this.x += this.vx*dt; }
}

/* Power-up */
class PowerUp extends GameObject{
  constructor(x,y,imageKey, kind){
    super(x,y,40,40,imageKey);
    this.kind = kind;
  }
}

/* ======= SISTEMA SPAWN & GAME ======= */
const CROSSWALKS = [ H-220, H-320 ]; // y positions dels crosswalks (on apareixen peatons)

class Game {
  constructor(){
    this.player = new Player();
    this.objects = [];
    this.spawnTimer = 0;
    this.obstTimer = 0;
    this.disTimer = 0;
    this.powerTimer = 8;
    this.input = {left:false,right:false,up:false,down:false};
    this.lastTime = 0;
    this.running = true;
    this.tipText = 'Respecta els passos de vianants.';
    this.updateUI();
  }

  updateUI(){
    document.getElementById('score').textContent = Math.floor(this.player.score);
    document.getElementById('life').textContent = this.player.life;
    document.getElementById('shield').textContent = this.player.shield>0 ? 'Sí' : 'No';
    document.getElementById('tipText').innerHTML = this.tipText;
  }

  spawnPeaton(){
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y = CROSSWALKS[Math.floor(Math.random()*CROSSWALKS.length)];
    const x = dir>0 ? -80 : W+80;
    const idx = Math.floor(Math.random()*ASSETS.peatons.length);
    this.objects.push(new Peaton(x,y,dir, 'peaton'+idx));
  }

  spawnObstacle(){
    const laneY = H - 180 + Math.floor(Math.random()*3)*48;
    const dir = Math.random() < 0.6 ? -1 : 1;
    const x = dir>0 ? -200 : W+200;
    const speed = dir>0 ? rand(100,220) : -rand(100,220);
    const idx = Math.floor(Math.random()*ASSETS.obstacles.length);
    this.objects.push(new Obstacle(x, laneY, speed, 'obst'+idx));
  }

  spawnDistraction(){
    const idx = Math.floor(Math.random()*ASSETS.distractions.length);
    const x = rand(200, W-160);
    const y = rand(H-360, H-120);
    const info = {
      'smartphone.png': 'Mirar el mòbil mentre condueixes és una distracció seriosa: atura’t abans de mirar-lo.',
      'auriculars.png': 'Els auriculars poden impedir escoltar el trànsit. Evita-los o redueix volum.',
      'semafor.png': 'Respecta els semàfors: són clau per la seguretat de tothom.',
      'bici.png': 'Atura’t i comprova si venen bicicletes abans de creuar.',
      'gos.png': 'Animals poden aparèixer inesperadament: redueix la velocitat i prepara’t a frenar.'
    }[ASSETS.distractions[idx]] || 'Vigila les distraccions i atura’t si cal.';
    this.objects.push(new Distraction(x,y, 'dis'+idx, info));
  }

  spawnPowerUp(){
    const idx = Math.floor(Math.random()*ASSETS.powerups.length);
    const x = rand(200, W-160);
    const y = rand(H-360, H-120);
    const kind = ASSETS.powerups[idx].includes('casco') ? 'casco' : 'chaleco';
    this.objects.push(new PowerUp(x,y,'pu'+idx, kind));
  }

  update(dt){
    if(!this.running) return;

    // Spawn timers
    this.spawnTimer += dt;
    this.obstTimer += dt;
    this.disTimer += dt;
    this.powerTimer -= dt;

    if(this.spawnTimer > 1.6){ this.spawnPeaton(); this.spawnTimer = 0; }
    if(this.obstTimer > 1.2){ this.spawnObstacle(); this.obstTimer = 0; }
    if(this.disTimer > 4.5){ this.spawnDistraction(); this.disTimer = 0; }
    if(this.powerTimer <= 0){ this.spawnPowerUp(); this.powerTimer = 12; }

    this.player.update(dt, this.input);

    // update objects
    for(const o of this.objects) { if(o.update) o.update(dt); }

    // collisions
    for(const o of this.objects){
      if(o.remove) continue;
      if(aabb(this.player, o)){
        if(o instanceof Obstacle){
          if(this.player.shield>0){
            this.player.score += 10; // protegit evita dany
            o.remove = true;
            this.tipText = 'Escut actiu: has evitat el dany!';
          } else {
            this.player.life -= 1;
            this.player.score = Math.max(0, this.player.score - 20);
            o.remove = true;
            this.tipText = 'Has xocat amb un obstacle. Redueix la velocitat i atura si cal.';
          }
        } else if(o instanceof Peaton){
          // si passes a prop d'un peató sense aturar -> multes educatives
          this.player.score = Math.max(0, this.player.score - 10);
          this.tipText = 'Has interaccionat amb un vianant: recorda cedir pas en crossing.';
          // empetiteix la penalització i empuja el jugador cap enrere
          this.player.x -= (o.vx>0? -40 : 40);
          o.remove = true;
        } else if(o instanceof Distraction){
          this.player.score = Math.max(0, this.player.score - 15);
          // mostrar consell didàctic del objecte
          this.tipText = o.info;
          o.remove = true;
        } else if(o instanceof PowerUp){
          if(o.kind === 'casco'){
            this.player.shield = 8; // segons
            this.player.score += 30;
            this.tipText = 'Has agafat un casc! Protecció temporal activada.';
          } else {
            this.player.score += 25;
            this.player.shield = 5;
            this.tipText = 'Xapa reflectant: ets més visible i segur.';
          }
          o.remove = true;
        }
      }
    }

    // neteja
    this.objects = this.objects.filter(o => !o.remove);

    // petita recompensa passiva per conducció segura (no xocs recents)
    this.player.score += dt * 2;

    // condicions final
    if(this.player.life <= 0){
      this.running = false;
      this.tipText = 'Game over — Practica la conducció segura. Reinicia per tornar-ho a intentar.';
    }

    this.updateUI();
  }

  draw(){
    // fons: carretera i passos de vianants
    ctx.clearRect(0,0,W,H);

    // dibuixa vorera i carretera
    ctx.fillStyle = '#3b3b3b';
    ctx.fillRect(0, H-200, W, 200);

    // passos de vianants (checks)
    ctx.fillStyle = '#fff';
    for(const y of CROSSWALKS){
      const stepW = 36;
      for(let x=0; x<W; x += stepW*2){
        ctx.fillRect(x, y+12, stepW, 12);
      }
    }

    // dibuixar entitats
    // objectes en ordre: obstacles darrere, peatons, powerups, player, HUD
    // obstacles
    for(const o of this.objects.filter(o => o instanceof Obstacle)) o.draw();
    for(const o of this.objects.filter(o => o instanceof Peaton)) o.draw();
    for(const o of this.objects.filter(o => o instanceof PowerUp)) o.draw();
    for(const o of this.objects.filter(o => o instanceof Distraction)) o.draw();

    // dibuixar jugador
    this.player.draw();

    // puntets de info addicionals
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(8,8,260,66);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.fillText('Puntuació: ' + Math.floor(this.player.score), 16, 30);
    ctx.fillText('Vida: ' + this.player.life, 16, 50);
    ctx.fillText('Protegit: ' + (this.player.shield>0 ? 'Sí' : 'No'), 140, 50);

    // mini indicador de recomanacions
    ctx.font = '12px Arial';
    ctx.fillStyle = '#bfe';
    ctx.fillText('Tip: ' + this.tipText.slice(0,60) + (this.tipText.length>60 ? '...' : ''), 16, 80);
  }

  loop = (t) => {
    if(!this.lastTime) this.lastTime = t;
    const dt = Math.min(0.05, (t - this.lastTime)/1000);
    this.lastTime = t;
    if(assetsToLoad === 0){ this.update(dt); this.draw(); }
    requestAnimationFrame(this.loop);
  }

  start(){
    this.lastTime = 0;
    requestAnimationFrame(this.loop);
  }
}

/* ======= INPUT ======= */
const game = new Game();
window.addEventListener('keydown', e=>{
  if(e.key === 'ArrowLeft' || e.key==='a') game.input.left=true;
  if(e.key === 'ArrowRight' || e.key==='d') game.input.right=true;
  if(e.key === 'ArrowUp' || e.key==='w') game.input.up=true;
  if(e.key === 'ArrowDown' || e.key==='s') game.input.down=true;
});
window.addEventListener('keyup', e=>{
  if(e.key === 'ArrowLeft' || e.key==='a') game.input.left=false;
  if(e.key === 'ArrowRight' || e.key==='d') game.input.right=false;
  if(e.key === 'ArrowUp' || e.key==='w') game.input.up=false;
  if(e.key === 'ArrowDown' || e.key==='s') game.input.down=false;
});

/* Reiniciar */
document.getElementById('restart').addEventListener('click', ()=>{
  const g2 = new Game();
  Object.assign(game, g2);
});

/* Actualitza UI també quan canvien textos del joc*/
const uiUpdater = setInterval(()=>{ game.updateUI(); }, 300);

/* Comença quan assets carregats (o si n'hi ha errors)*/
const waitForLoad = setInterval(()=>{
  if(assetsToLoad === 0){
    clearInterval(waitForLoad);
    game.start();
  }
}, 100);
