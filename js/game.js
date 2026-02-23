const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const ui = {
  score: document.getElementById('score'),
  lives: document.getElementById('lives'),
  speed: document.getElementById('speed-indicator'),
  seenMobile: document.getElementById('seen-mobile'),
  seenHeadphones: document.getElementById('seen-headphones'),
  seenPedestrian: document.getElementById('seen-pedestrian'),
  overlay: document.getElementById('overlay'),
  popupCard: document.getElementById('popup-card'),
  popupIcon: document.getElementById('popup-icon'),
  popupTitle: document.getElementById('popup-title'),
  popupBody: document.getElementById('popup-body'),
  popupButton: document.getElementById('popup-button'),
  endScreen: document.getElementById('end-screen'),
  endTitle: document.getElementById('end-title'),
  endBody: document.getElementById('end-body'),
  restartBtn: document.getElementById('restart-btn'),
  shell: document.getElementById('game-shell')
};

const assets = {
  player: new Image(),
  mobile: new Image(),
  headphones: new Image(),
  pedestrian: new Image()
};
assets.player.src = '../img/personatge_principal.png';
assets.mobile.src = '../img/costat1.png';
assets.headphones.src = '../img/costat2.png';
assets.pedestrian.src = '../img/personatge1.png';

const POPUPS = {
  initial: {
    key: 'initial',
    icon: '../img/personatge_principal.png',
    title: '¡CONTROLES RÁPIDOS!',
    body: `Usa las flechas ← → para moverte.\nPulsa ESPACIO para parar y S para saltar.\nEvita chocar con peatones y no uses el móvil o los auriculares en vías concurridas.\nConsigue 100 puntos para ganar.`,
    button: 'ENTENDIDO'
  },
  headphones: {
    key: 'headphones',
    icon: '../img/costat2.png',
    title: '¡ATENTO A LOS SONIDOS!',
    body: 'Escuchar música a alto volumen te aísla de tu entorno. Necesitas escuchar los vehículos, bocinas y peatones para moverte con seguridad.',
    button: 'ENTENDIDO (-5 pts)'
  },
  mobile: {
    key: 'mobile',
    icon: '../img/costat1.png',
    title: '¡ATENTO A LA PANTALLA!',
    body: 'Mirar el móvil mientras caminas disminuye tu atención y aumenta el riesgo en la vía. Mantén la mirada en el entorno cuando estés en la calle.',
    button: 'ENTENDIDO (-5 pts)'
  },
  pedestrian: {
    key: 'pedestrian',
    icon: '../img/personatge1.png',
    title: '¡CUIDADO, PEATÓN!',
    body: 'Si atropellas a un peatón puedes hacerle daño y perderás una vida. Estate atento y evita colisiones.',
    button: 'ENTENDIDO (-1 vida)'
  }
};

const state = {
  started: false,
  gameOver: false,
  won: false,
  pausedByUser: false,
  pausedByPopup: true,
  score: 0,
  lives: 3,
  gravity: 1900,
  difficultyTime: 0,
  cameraX: 0,
  levelSpeed: 95,
  targetScore: 100,
  lastTime: 0,
  seenPopup: {
    mobile: false,
    headphones: false,
    pedestrian: false
  },
  keys: {
    left: false,
    right: false,
    jumpPressed: false,
    braking: false
  },
  player: {
    x: 230,
    y: 430,
    w: 70,
    h: 90,
    vx: 0,
    vy: 0,
    onGround: true,
    state: 'idle'
  },
  objects: [],
  pedestrians: [],
  floatTexts: [],
  spawn: {
    objectTimer: rand(1.4, 2.2),
    pedestrianTimer: rand(2.6, 4.2),
    lastObjectWorldX: 380
  },
  parallaxOffset: [0, 0, 0]
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function gameplayPaused() {
  return state.pausedByPopup || state.pausedByUser || state.gameOver;
}

function resetGame() {
  state.started = true;
  state.gameOver = false;
  state.won = false;
  state.pausedByUser = false;
  state.pausedByPopup = true;
  state.score = 0;
  state.lives = 3;
  state.difficultyTime = 0;
  state.cameraX = 0;
  state.levelSpeed = 95;
  state.lastTime = 0;
  state.keys.left = false;
  state.keys.right = false;
  state.keys.jumpPressed = false;
  state.keys.braking = false;
  state.player.x = 230;
  state.player.y = 430;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.onGround = true;
  state.player.state = 'idle';
  state.objects = [];
  state.pedestrians = [];
  state.floatTexts = [];
  state.spawn.objectTimer = rand(1.2, 2.2);
  state.spawn.pedestrianTimer = rand(2.6, 4.2);
  state.spawn.lastObjectWorldX = 380;
  state.parallaxOffset = [0, 0, 0];
  state.seenPopup.mobile = false;
  state.seenPopup.headphones = false;
  state.seenPopup.pedestrian = false;
  ui.endScreen.classList.add('hidden');
  syncHud();
  showPopup(POPUPS.initial);
}

function showPopup(config) {
  state.pausedByPopup = true;
  ui.popupCard.classList.remove('glow');
  void ui.popupCard.offsetWidth;
  ui.popupCard.classList.add('glow');
  ui.popupIcon.src = config.icon;
  ui.popupTitle.textContent = config.title;
  ui.popupBody.textContent = config.body;
  ui.popupButton.textContent = config.button;
  ui.overlay.classList.remove('hidden');
}

function closePopup() {
  ui.overlay.classList.add('hidden');
  state.pausedByPopup = false;
}

function openEndScreen(win) {
  state.gameOver = true;
  state.won = win;
  state.pausedByPopup = true;
  state.pausedByUser = false;
  ui.endTitle.textContent = win ? '¡VICTORIA!' : 'GAME OVER';
  ui.endBody.textContent = win
    ? `Has alcanzado ${Math.round(state.score)} puntos y completado el reto con seguridad.`
    : `Te has quedado sin vidas con ${Math.round(state.score)} puntos. Vuelve a intentarlo.`;
  ui.endScreen.classList.remove('hidden');
}

function syncHud() {
  ui.score.textContent = Math.round(state.score);
  ui.lives.textContent = state.lives;
  ui.speed.textContent = `Velocidad: ${Math.round(Math.abs(state.player.vx))}`;
  ui.seenMobile.textContent = state.seenPopup.mobile ? '📱✓' : '📱✖';
  ui.seenHeadphones.textContent = state.seenPopup.headphones ? '🎧✓' : '🎧✖';
  ui.seenPedestrian.textContent = state.seenPopup.pedestrian ? '🚶✓' : '🚶✖';
}

function addFloatingText(text, color) {
  state.floatTexts.push({
    x: state.player.x + state.player.w / 2,
    y: state.player.y - 10,
    text,
    color,
    life: 1.0
  });
}

function spawnObject() {
  const type = Math.random() < 0.5 ? 'mobile' : 'headphones';
  const minGap = 230;
  const spawnX = Math.max(state.cameraX + canvas.width + rand(80, 340), state.spawn.lastObjectWorldX + minGap);
  const groundY = 490;
  state.objects.push({
    type,
    worldX: spawnX,
    y: groundY,
    w: 46,
    h: 46,
    hit: false
  });
  state.spawn.lastObjectWorldX = spawnX;

  const baseMin = Math.max(3.5, 6 - state.difficultyTime / 75);
  const baseMax = Math.max(6.6, 10 - state.difficultyTime / 75);
  state.spawn.objectTimer = rand(baseMin, baseMax);
}

function spawnPedestrian() {
  const fromLeft = Math.random() < 0.5;
  const y = 478;
  const speed = rand(380, 500) + state.difficultyTime * 1.8;
  state.pedestrians.push({
    x: fromLeft ? -80 : canvas.width + 80,
    y,
    w: 54,
    h: 80,
    vx: fromLeft ? speed : -speed,
    hit: false
  });

  const min = Math.max(5.5, 8 - state.difficultyTime / 60);
  const max = Math.max(11.5, 18 - state.difficultyTime / 50);
  state.spawn.pedestrianTimer = rand(min, max);
}

function collides(a, b) {
  return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}

function penalizeObject(type) {
  state.score = Math.max(0, state.score - 5);
  addFloatingText('-5 pts', '#ff6363');
  if (!state.seenPopup[type]) {
    state.seenPopup[type] = true;
    showPopup(type === 'mobile' ? POPUPS.mobile : POPUPS.headphones);
  }
}

function penalizePedestrian() {
  state.lives -= 1;
  addFloatingText('-1 vida', '#ff2747');
  ui.shell.classList.add('screen-hit');
  setTimeout(() => ui.shell.classList.remove('screen-hit'), 160);
  if (!state.seenPopup.pedestrian) {
    state.seenPopup.pedestrian = true;
    showPopup(POPUPS.pedestrian);
  }
  if (state.lives <= 0) {
    openEndScreen(false);
  }
}

function updatePlayer(dt) {
  const player = state.player;
  const accel = 1300 + state.difficultyTime * 5;
  const maxSpeed = 340 + state.difficultyTime * 2.6;
  const friction = 1600;

  if (state.keys.braking) {
    player.vx = 0;
    player.state = 'idle';
  } else {
    if (state.keys.left) player.vx -= accel * dt;
    if (state.keys.right) player.vx += accel * dt;
    if (!state.keys.left && !state.keys.right) {
      const dir = Math.sign(player.vx);
      const next = Math.abs(player.vx) - friction * dt;
      player.vx = next <= 0 ? 0 : dir * next;
    }
    player.vx = clamp(player.vx, -maxSpeed, maxSpeed);
  }

  if (state.keys.jumpPressed && player.onGround) {
    player.vy = -760;
    player.onGround = false;
  }
  state.keys.jumpPressed = false;

  player.vy += state.gravity * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const floorY = 520 - player.h;
  if (player.y >= floorY) {
    player.y = floorY;
    player.vy = 0;
    player.onGround = true;
  }

  player.x = clamp(player.x, 40, canvas.width - player.w - 40);

  if (!player.onGround) {
    player.state = 'jump';
  } else if (Math.abs(player.vx) < 1 || state.keys.braking) {
    player.state = 'idle';
  } else {
    player.state = 'walk';
  }
}

function updateWorld(dt) {
  if (gameplayPaused()) return;

  state.difficultyTime += dt;
  state.levelSpeed = 95 + state.difficultyTime * 1.35;
  state.cameraX += dt * (state.levelSpeed + Math.max(0, state.player.vx * 0.2));
  state.parallaxOffset[0] += dt * state.levelSpeed * 0.2;
  state.parallaxOffset[1] += dt * state.levelSpeed * 0.45;
  state.parallaxOffset[2] += dt * state.levelSpeed * 0.85;

  updatePlayer(dt);

  state.spawn.objectTimer -= dt;
  state.spawn.pedestrianTimer -= dt;
  if (state.spawn.objectTimer <= 0) spawnObject();
  if (state.spawn.pedestrianTimer <= 0) spawnPedestrian();

  const playerBox = state.player;

  for (const obj of state.objects) {
    const screenX = obj.worldX - state.cameraX;
    obj.x = screenX;
    if (!obj.hit && collides(playerBox, obj)) {
      obj.hit = true;
      penalizeObject(obj.type);
    }
  }

  for (const p of state.pedestrians) {
    p.x += p.vx * dt;
    if (!p.hit && collides(playerBox, p)) {
      p.hit = true;
      penalizePedestrian();
    }
  }

  state.objects = state.objects.filter((o) => o.x > -80 && o.x < canvas.width + 120 && !o.hit);
  state.pedestrians = state.pedestrians.filter((p) => p.x > -120 && p.x < canvas.width + 120 && !p.hit);

  state.score = Math.min(110, state.score + dt * 2.65);
  if (state.score >= state.targetScore) {
    openEndScreen(true);
  }

  for (const t of state.floatTexts) {
    t.y -= 48 * dt;
    t.life -= dt;
  }
  state.floatTexts = state.floatTexts.filter((t) => t.life > 0);

  syncHud();
}

function drawParallaxLayer(offset, color, waveHeight, baseY) {
  ctx.fillStyle = color;
  const width = canvas.width;
  const shift = -(offset % width);
  for (let i = -1; i <= 1; i += 1) {
    const x = shift + i * width;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + width * 0.22, baseY - waveHeight);
    ctx.lineTo(x + width * 0.46, baseY);
    ctx.lineTo(x + width * 0.72, baseY - waveHeight * 0.42);
    ctx.lineTo(x + width, baseY);
    ctx.lineTo(x + width, canvas.height);
    ctx.lineTo(x, canvas.height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBackground() {
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, '#2a87af');
  grd.addColorStop(1, '#2e6c8d');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawParallaxLayer(state.parallaxOffset[0], 'rgba(207, 226, 240, 0.22)', 140, 420);
  drawParallaxLayer(state.parallaxOffset[1], 'rgba(112, 178, 198, 0.28)', 120, 460);

  ctx.fillStyle = '#2eaa76';
  ctx.fillRect(0, 520, canvas.width, 12);

  ctx.fillStyle = '#1f2a3b';
  ctx.fillRect(0, 532, canvas.width, 88);

  const roadOffset = -(state.parallaxOffset[2] % 112);
  for (let x = -112; x < canvas.width + 112; x += 112) {
    ctx.fillStyle = '#f2c94c';
    ctx.fillRect(x + roadOffset, 565, 50, 8);
  }
}

function drawPlayer() {
  const p = state.player;
  const bob = p.state === 'walk' ? Math.sin(performance.now() * 0.02) * 3 : 0;

  if (assets.player.complete && assets.player.naturalWidth > 0) {
    ctx.drawImage(assets.player, p.x, p.y + bob, p.w, p.h);
  } else {
    ctx.fillStyle = '#f5b41e';
    ctx.fillRect(p.x + 10, p.y + 20 + bob, p.w - 20, p.h - 20);
  }

  if (p.state === 'jump') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y - 6, 10, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawObjects() {
  for (const obj of state.objects) {
    const img = obj.type === 'mobile' ? assets.mobile : assets.headphones;
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, obj.x, obj.y, obj.w, obj.h);
    } else {
      ctx.fillStyle = obj.type === 'mobile' ? '#ffd166' : '#7fd3ff';
      ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    }
  }

  for (const p of state.pedestrians) {
    if (assets.pedestrian.complete && assets.pedestrian.naturalWidth > 0) {
      ctx.drawImage(assets.pedestrian, p.x, p.y, p.w, p.h);
    } else {
      ctx.fillStyle = '#ff7799';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  }
}

function drawFloatingTexts() {
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px Hind, sans-serif';
  for (const t of state.floatTexts) {
    ctx.globalAlpha = Math.max(0, t.life);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function frame(time) {
  if (!state.lastTime) state.lastTime = time;
  const dt = Math.min(0.033, (time - state.lastTime) / 1000);
  state.lastTime = time;

  updateWorld(dt);
  drawBackground();
  drawObjects();
  drawPlayer();
  drawFloatingTexts();

  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'ArrowLeft') state.keys.left = true;
  if (event.code === 'ArrowRight') state.keys.right = true;
  if (event.code === 'Space') {
    event.preventDefault();
    state.keys.braking = true;
  }
  if (event.code === 'KeyS') state.keys.jumpPressed = true;

  if (event.code === 'KeyP' && !state.gameOver && !state.pausedByPopup) {
    state.pausedByUser = !state.pausedByUser;
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft') state.keys.left = false;
  if (event.code === 'ArrowRight') state.keys.right = false;
  if (event.code === 'Space') state.keys.braking = false;
});

ui.popupButton.addEventListener('click', closePopup);
ui.restartBtn.addEventListener('click', resetGame);

resetGame();
requestAnimationFrame(frame);
