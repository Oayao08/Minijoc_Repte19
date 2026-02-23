const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const ui = {
  score: document.getElementById('score'),
  lives: document.getElementById('lives'),
  speed: document.getElementById('speed-indicator'),
  popupFlags: document.getElementById('popup-flags'),
  floatingLayer: document.getElementById('floating-layer'),
  overlay: document.getElementById('overlay'),
  popupIcon: document.getElementById('popup-icon'),
  popupTitle: document.getElementById('popup-title'),
  popupBody: document.getElementById('popup-body'),
  popupConfirm: document.getElementById('popup-confirm'),
  stateScreen: document.getElementById('state-screen'),
  stateTitle: document.getElementById('state-title'),
  stateText: document.getElementById('state-text'),
  restartBtn: document.getElementById('restart-btn'),
  gameFrame: document.getElementById('game-frame')
};

const ASSETS = {
  player: '../img/personatge_principal.png',
  peatons: ['personatge1.png','personatge2.png','personatge3.png','personatge4.png','personatge5.png'],
  obstacles: ['costat1.png','costat2.png','costat3.png','costat4.png','costat5.png'],
  distractions: ['smartphone.png','auriculars.png','semafor.png','bici.png','gos.png'],
  powerups: ['casco.png','chaleco.png'],
  mobile: '../img/costat1.png',
  headphones: '../img/costat2.png',
  pedestrian: '../img/personatge1.png'
};

let state = null;

/* UTILIDADES */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function aabb(a, b) { // colisión simple AABB
  return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

/* PRELOAD IMAGENES */
const images = {};
function loadAssets(assetList, prefix) {
  assetList.forEach((src, i) => {
    const img = new Image();
    img.src = src;
    images[prefix + i] = null;
    img.onload = () => { images[prefix + i] = img; };
    img.onerror = () => { console.warn('No encontrado:', src); images[prefix + i] = null; };
  });
}

// Cargar imágenes principales
const imgPlayer = new Image();
imgPlayer.src = ASSETS.player;
imgPlayer.onload = () => images['player'] = imgPlayer;
imgPlayer.onerror = () => { console.warn('Player no encontrado, se dibujará un rectángulo'); images['player'] = null; }

loadAssets(ASSETS.peatons, 'peaton');
loadAssets(ASSETS.obstacles, 'obst');
loadAssets(ASSETS.distractions, 'dis');
loadAssets(ASSETS.powerups, 'pu');

/* ENTIDADES */
class GameObject {
  constructor(x, y, w, h, image = null) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.image = image;
    this.vx = 0; this.vy = 0;
    this.remove = false;
  }

  draw() {
    if (this.image && images[this.image]) {
      ctx.drawImage(images[this.image], this.x, this.y, this.w, this.h);
    } else {
      // fallback visual
      ctx.fillStyle = '#666';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
  }
}

/* Beep de sonido */
function beep(freq = 220, length = 0.07, type = 'triangle') {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  if (!beep.ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    beep.ctx = new Ctor();
  }
  const audioCtx = beep.ctx;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.frequency.value = freq;
  oscillator.type = type;
  gain.gain.value = 0.045;
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + length);
}

/* HUD */
function updateHud() {
  ui.score.textContent = Math.max(0, Math.floor(state.score));
  ui.lives.textContent = state.lives;
  ui.speed.textContent = `Velocidad: ${(state.difficulty).toFixed(1)}x`;
  ui.popupFlags.textContent = `📱 ${state.popupsSeen.mobile ? '✓' : '○'} · 🎧 ${state.popupsSeen.headphones ? '✓' : '○'} · 🚶 ${state.popupsSeen.pedestrian ? '✓' : '○'}`;
}
function showFloatingText(text, x, y, color = '#ff6d6d') {
  const div = document.createElement('div');
  div.className = 'float-text';
  div.textContent = text;
  div.style.left = `${x}px`;
  div.style.top = `${y}px`;
  div.style.color = color;
  ui.floatingLayer.appendChild(div);
  setTimeout(() => div.remove(), 860);
}

function addParticles(x, y, color = '#ffe082', amount = 8) {
  for (let i = 0; i < amount; i += 1) {
    state.particles.push({
      x,
      y,
      vx: randomRange(-100, 120),
      vy: randomRange(-130, 20),
      life: randomRange(0.35, 0.72),
      color,
      r: randomRange(2, 5)
    });
  }
}

function showPopup(kind) {
  state.paused = true;
  state.activePopup = kind;
  const data = POPUPS[kind];
  ui.popupIcon.src = data.icon;
  ui.popupTitle.textContent = data.title;
  ui.popupBody.textContent = data.body;
  ui.popupConfirm.textContent = data.button;
  ui.overlay.classList.remove('hidden');
}

function closePopup() {
  ui.overlay.classList.add('hidden');
  state.activePopup = null;
  if (!state.gameEnded) state.paused = false;
}

function spawnItem(type) {
  const lastX = state.objects.length ? Math.max(...state.objects.map(obj => obj.x)) : -9999;
  const x = Math.max(canvas.width + randomRange(40, 150), lastX + state.spawn.minGap);
  const y = ROAD_Y - 44;
  state.objects.push({
    type,
    x,
    y,
    w: 44,
    h: 44,
    vx: state.worldSpeed + randomRange(15, 65),
    crossed: false
  });
}

function spawnPedestrian() {
  const fromLeft = Math.random() < 0.5;
  const y = ROAD_Y - 55;
  state.objects.push({
    type: 'pedestrian',
    x: fromLeft ? -70 : canvas.width + 70,
    y,
    w: 52,
    h: 70,
    vx: fromLeft ? randomRange(280, 360) : -randomRange(280, 360),
    crossed: false
  });
}

function triggerDamageFlash() {
  ui.gameFrame.classList.remove('flash-damage');
  void ui.gameFrame.offsetWidth;
  ui.gameFrame.classList.add('flash-damage');
}

function addScore(delta) {
  state.score = Math.max(0, state.score + delta);
  if (delta > 0) {
    showFloatingText(`+${Math.floor(delta)}`, state.player.x + 28, state.player.y - 8, '#6dff99');
    addParticles(state.player.x + 30, state.player.y + 30, '#93ffb7', 5);
  }
}

function onCollision(obj) {
  if (obj.type === 'mobile' || obj.type === 'headphones') {
    state.score = Math.max(0, state.score - 5);
    showFloatingText('-5 pts', state.player.x + 20, state.player.y - 10);
    beep(180, 0.09, 'square');
    addParticles(state.player.x + 20, state.player.y + 30, '#ff9a9a', 8);

    if (!state.popupsSeen[obj.type]) {
      state.popupsSeen[obj.type] = true;
      showPopup(obj.type);
    }
  }

  if (obj.type === 'pedestrian') {
    state.lives -= 1;
    showFloatingText('-1 vida', state.player.x + 20, state.player.y - 8);
    triggerDamageFlash();
    beep(110, 0.13, 'sawtooth');
    addParticles(state.player.x + 20, state.player.y + 30, '#ff6464', 12);

    if (!state.popupsSeen.pedestrian) {
      state.popupsSeen.pedestrian = true;
      showPopup('pedestrian');
    }
  }

  obj.crossed = true;
  updateHud();

  if (state.lives <= 0) {
    endGame(false);
  }
}

function collides(a, b) {
  return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}

function setAnimation() {
  if (!state.player.onGround) {
    state.player.anim = 'jump';
    return;
  }
  if (Math.abs(state.player.vx) < 8) {
    state.player.anim = 'idle';
  } else {
    state.player.anim = 'walk';
  }
}

function processInput(dt) {
  if (state.keys.left) {
    state.player.vx -= state.player.accel * dt;
    state.player.facing = 'left';
  }
  if (state.keys.right) {
    state.player.vx += state.player.accel * dt;
    state.player.facing = 'right';
  }

  if (!state.keys.left && !state.keys.right) {
    state.player.vx *= state.player.friction;
    if (Math.abs(state.player.vx) < 3) state.player.vx = 0;
  }

  state.player.vx = clamp(state.player.vx, -state.player.maxSpeed * state.difficulty, state.player.maxSpeed * state.difficulty);

  if (state.keys.jump && state.player.onGround) {
    state.player.vy = state.player.jumpImpulse;
    state.player.onGround = false;
    beep(330, 0.07, 'triangle');
  }

  state.keys.jump = false;
}

function updatePlayer(dt) {
  processInput(dt);

  state.player.vy += GRAVITY * dt;
  state.player.x += state.player.vx * dt;
  state.player.y += state.player.vy * dt;

  state.player.x = clamp(state.player.x, 6, canvas.width - state.player.w - 6);

  if (state.player.y + state.player.h >= ROAD_Y) {
    state.player.y = ROAD_Y - state.player.h;
    state.player.vy = 0;
    state.player.onGround = true;
  }

  state.player.animT += dt;
  setAnimation();
}

function updateSpawns(dt) {
  state.spawn.itemTimer -= dt;
  state.spawn.pedestrianTimer -= dt;

  if (state.spawn.itemTimer <= 0) {
    spawnItem(Math.random() < 0.5 ? 'mobile' : 'headphones');
    state.spawn.itemTimer = randomRange(
      Math.max(3.8, 6 / state.difficulty),
      Math.max(6.2, 10 / state.difficulty)
    );
  }

  if (state.spawn.pedestrianTimer <= 0) {
    spawnPedestrian();
    state.spawn.pedestrianTimer = randomRange(
      Math.max(5.5, 8 / state.difficulty),
      Math.max(10.5, 18 / state.difficulty)
    );
  }
}

function updateObjects(dt) {
  state.objects.forEach(obj => {
    if (obj.type === 'pedestrian') {
      obj.x += obj.vx * dt;
    } else {
      obj.x -= (obj.vx + state.worldSpeed * state.difficulty) * dt;
    }

    if (!obj.crossed && collides(state.player, obj)) {
      onCollision(obj);
    }
  });

  state.objects = state.objects.filter(
    obj => obj.x > -120 && obj.x < canvas.width + 120 && !obj.crossed
  );
}

function updateParticles(dt) {
  state.particles.forEach(p => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 220 * dt; // gravedad partículas
  });
  state.particles = state.particles.filter(p => p.life > 0);
}

function updateDifficulty(dt) {
  state.elapsed += dt;
  state.difficulty = 1 + Math.min(1.15, state.elapsed / 52);
  state.worldX += state.worldSpeed * state.difficulty * dt;

  if (state.keys.right && state.player.vx > 10) {
    addScore(4.7 * dt * state.difficulty);
  } else {
    addScore(2.1 * dt * state.difficulty);
  }

  if (state.score >= state.goal) {
    endGame(true);
  }
}

function endGame(win) {
  state.running = false;
  state.paused = true;
  state.gameEnded = true;
  ui.stateScreen.classList.remove('hidden');
  ui.stateTitle.textContent = win ? '¡Has ganado!' : 'Game Over';
  ui.stateText.textContent = win
    ? `¡Excelente! Alcanzaste ${Math.floor(state.score)} puntos sin perder la atención en la vía.`
    : `Te has quedado sin vidas con ${Math.floor(state.score)} puntos. Vuelve a intentarlo y evita colisiones.`;
}

function drawParallax() {
  const farOffset = (state.worldX * 0.15) % canvas.width;
  const midOffset = (state.worldX * 0.35) % canvas.width;
  const nearOffset = (state.worldX * 0.62) % canvas.width;

  // cielo
  ctx.fillStyle = '#266f98';
  ctx.fillRect(0, 0, canvas.width, 380);

  // montañas lejanas
  ctx.fillStyle = '#4f9cc0';
  for (let i = -1; i < 4; i++) {
    const x = i * 350 - farOffset;
    ctx.beginPath();
    ctx.moveTo(x, 380);
    ctx.lineTo(x + 170, 170);
    ctx.lineTo(x + 330, 380);
    ctx.closePath();
    ctx.fill();
  }

  // montañas intermedias
  ctx.fillStyle = '#3f88ad';
  for (let i = -1; i < 6; i++) {
    const x = i * 220 - midOffset;
    ctx.beginPath();
    ctx.moveTo(x, 390);
    ctx.lineTo(x + 120, 250);
    ctx.lineTo(x + 220, 390);
    ctx.closePath();
    ctx.fill();
  }

  // carretera
  ctx.fillStyle = '#47a37b';
  for (let i = -1; i < 10; i++) {
    const x = i * 120 - nearOffset;
    ctx.fillRect(x, ROAD_Y - 6, 100, 8);
  }

  // fondo negro suelo
  ctx.fillStyle = '#2f3540';
  ctx.fillRect(0, ROAD_Y, canvas.width, canvas.height - ROAD_Y);

  // marcas viales
  ctx.strokeStyle = '#f6cc44';
  ctx.lineWidth = 6;
  for (let i = -1; i < 20; i++) {
    const x = i * 74 - (state.worldX * 0.95 % 74);
    ctx.beginPath();
    ctx.moveTo(x, ROAD_Y + 45);
    ctx.lineTo(x + 40, ROAD_Y + 45);
    ctx.stroke();
  }
}

function drawPlayer() {
  const { player } = state;
  const swing = Math.sin(player.animT * 18) * 3;

  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
  if (player.facing === 'left') ctx.scale(-1, 1);

  if (images.player.complete && images.player.naturalWidth > 0) {
    ctx.drawImage(images.player, -player.w / 2, -player.h / 2, player.w, player.h);
  } else {
    ctx.fillStyle = '#ffcb29';
    ctx.fillRect(-20, -20, 40, 44);
  }

  // Patas o efectos del player
  ctx.fillStyle = '#1f262e';
  ctx.fillRect(-28, 24, 56, 7);
  if (player.anim === 'walk') {
    ctx.fillRect(-16, 18 + swing, 8, 10);
    ctx.fillRect(8, 18 - swing, 8, 10);
  }
  if (player.anim === 'jump') {
    ctx.fillStyle = '#8be9ff';
    ctx.fillRect(-22, 30, 44, 4);
  }

  ctx.restore();
}

function drawObjects() {
  state.objects.forEach((obj) => {
    const img = images[obj.type];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, obj.x, obj.y, obj.w, obj.h);
    } else {
      ctx.fillStyle = obj.type === 'pedestrian' ? '#ffa4a4' : '#f3e2a6';
      ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    }
  });
}

function drawParticles() {
  state.particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life * 1.7);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function loop(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000);
  state.lastTime = timestamp;

  if (!state.paused && state.running) {
    updatePlayer(dt);
    updateSpawns(dt);
    updateObjects(dt);
    updateDifficulty(dt);
    updateParticles(dt);
    updateHud();
  }

  drawParallax();
  drawObjects();
  drawPlayer();
  drawParticles();

  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') state.keys.left = true;
  if (e.key === 'ArrowRight') state.keys.right = true;
  if (e.key.toLowerCase() === 's') state.keys.jump = true;

  if (e.code === 'Space') {
    state.player.vx = 0;
    state.player.anim = 'idle';
    e.preventDefault();
  }

  if (e.key.toLowerCase() === 'p' && !state.gameEnded) {
    if (!state.activePopup) {
      state.paused = !state.paused;
      if (state.paused) {
        showPopup('initial');
        ui.popupTitle.textContent = 'PAUSA';
        ui.popupBody.textContent = 'El juego está en pausa. Pulsa ENTENDIDO para continuar.';
        ui.popupConfirm.textContent = 'ENTENDIDO';
      }
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') state.keys.left = false;
  if (e.key === 'ArrowRight') state.keys.right = false;
});

// Inicia el loop
requestAnimationFrame(loop);
/* Actualitza UI també quan canvien textos del joc*/
const uiUpdater = setInterval(()=>{ game.updateUI(); }, 300);
ui.popupConfirm.addEventListener('click', closePopup);
ui.restartBtn.addEventListener('click', () => {
  window.location.reload();
});

/* Comença quan assets carregats (o si n'hi ha errors)*/
const waitForLoad = setInterval(()=>{
  if(assetsToLoad === 0){
    clearInterval(waitForLoad);
    game.start();
  }
}, 100);
updateHud();
showPopup('initial');
requestAnimationFrame(loop);
