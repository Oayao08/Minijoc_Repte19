console.log("Funciona el DOM i javascript.");

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  console.log('DOM listo. Iniciant el joc...');

  //CONSTANTS 
  const ROAD_Y  = 380;
  const GRAVITY = 900;

  // CANVAS 
  const canvas = document.getElementById('game-canvas');
  if (!canvas) { console.error('No se encontró #game-canvas'); return; }
  const ctx = canvas.getContext('2d');

  // UI (PUNTUACIÓ, VIDES, VELOCITTAT, POPUPS...)
  const ui = {
    score:          document.getElementById('score'),
    lives:          document.getElementById('lives'),
    speed:          document.getElementById('speed-indicator'),
    seenMobile:     document.getElementById('seen-mobile'),
    seenHeadphones: document.getElementById('seen-headphones'),
    seenPedestrian: document.getElementById('seen-pedestrian'),
    overlay:        document.getElementById('overlay'),
    popupIcon:      document.getElementById('popup-icon'),
    popupTitle:     document.getElementById('popup-title'),
    popupBody:      document.getElementById('popup-body'),
    popupConfirm:   document.getElementById('popup-button'),
    endScreen:      document.getElementById('end-screen'),
    endTitle:       document.getElementById('end-title'),
    endBody:        document.getElementById('end-body'),
    restartBtn:     document.getElementById('restart-btn')
  };

  // ASSETS PERSONATGE I OBJECTES 
  const ASSETS = {
    player:     '../assets/sprites/personatge_principal.png',
    mobile:     '../assets/sprites/costat1.png',
    headphones: '../img/costat2.png',
    pedestrian: '../assets/sprites/personatge1.png'
  };

  //   QUADRES EDUCATIUS 
  const POPUPS = {
    initial: {
      icon:   '',
      title:  'BENVINGUT!',
      body:   'Mou el patineter amb ← →, salta amb S i para amb ESPAI. Evita distraccions i vianants. Aconsegueix 300 punts! ',
      button: 'COMENÇAR ARA'
    },
    mobile: {
      icon:   ASSETS.mobile,
      title:  'Mòbil a la via!',
      body:   'Mirar el mòbil mentre condueixes multiplica per 4 el risc de tenir accidents. 5 segons de distracció a km/h són com recórrer un camp de futbol a cegues.',
      button: 'Guardar mòbil'
    },
    headphones: {
      icon:   ASSETS.headphones,
      title:  'Auriculars!',
      body:   'Amb auriculars no pots sentir cotxes, bicis o sirenes. En un patinet, cada so és crucial per a la teva seguretat.',
      button: 'Treure auriculars'
    },
    pedestrian: {
      icon:   ASSETS.pedestrian,
      title:  'Vianants al camí!',
      body:   'Els vianants són màxima prioritat. Frena a temps i mantingues la vista en el camí.',
      button: 'Anar amb més compte'
    }
  };

  // UTILITATS 
  function clamp(v, a, b)        { return Math.max(a, Math.min(b, v)); }
  function randomRange(min, max) { return min + Math.random() * (max - min); }

  // ─── IMATGES PANTALLA
  const images = {};

  function loadImage(key, src) {
    const img = new Image();
    images[key] = null;           // clave registrada desde el principio
    img.onload  = () => { images[key] = img; };
    img.onerror = () => { console.warn('Imagen no encontrada:', src); };
    img.src = src;                // src DESPUÉS de los handlers
  }

  loadImage('player',     ASSETS.player);
  loadImage('mobile',     ASSETS.mobile);
  loadImage('headphones', ASSETS.headphones);
  loadImage('pedestrian', ASSETS.pedestrian);

  //SOROLL DEL JOC 
  function beep(freq = 220, length = 0.07, type = 'triangle') {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    if (!beep._ctx) {
      beep._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ac   = beep._ctx;
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.value = freq;
    osc.type            = type;
    gain.gain.value     = 0.045;
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + length);
  }

  //ESTAT 
  function createState() {
    return {
      running:    true,
      paused:     true,
      gameEnded:  false,
      elapsed:    0,
      score:      0,
      goal:       300,
      lives:      3,
      difficulty: 1,
      worldSpeed: 140 ,
      worldX:     0,
      lastTime:   null,
      activePopup: null,
      keys:       { left: false, right: false, jump: false },
      player: {
        x: 80, y: ROAD_Y - 60,
        w: 52, h: 60,
        vx: 0, vy: 0,
        onGround:    true,
        facing:      'right',
        anim:        'idle',
        animT:       0,
        accel:       980,
        maxSpeed:    280,
        friction:    0.82,
        jumpImpulse: -460
      },
      objects:    [],
      particles:  [],
      popupsSeen: { mobile: false, headphones: false, pedestrian: false },
      spawn: {
        itemTimer:       randomRange(3.5, 6),
        pedestrianTimer: randomRange(6, 11),
        minGap:          180
      }
    };
  }

  let state = createState();

  // HUD  
  function updateHud() {
    if (ui.score)          ui.score.textContent          = Math.max(0, Math.floor(state.score));
    if (ui.lives)          ui.lives.textContent          = state.lives;
    if (ui.speed)          ui.speed.textContent          = 'Velocitat: ' + state.difficulty.toFixed(1) + 'x';
    if (ui.seenMobile)     ui.seenMobile.textContent     = state.popupsSeen.mobile     ? '✔' : '✖';
    if (ui.seenHeadphones) ui.seenHeadphones.textContent = state.popupsSeen.headphones ? '✔' : '✖';
    if (ui.seenPedestrian) ui.seenPedestrian.textContent = state.popupsSeen.pedestrian ? '✔' : '✖';
  }

  // PARTÍCULES 
  function addParticles(x, y, color, amount) {
    color  = color  || '#ffe082';
    amount = amount || 8;
    for (var i = 0; i < amount; i++) {
      state.particles.push({
        x: x, y: y,
        vx:   randomRange(-100, 120),
        vy:   randomRange(-130, 20),
        life: randomRange(0.35, 0.72),
        color: color,
        r:    randomRange(2, 5)
      });
    }
  }

  //POPUPS 
  function showPopup(kind) {
    if (!POPUPS[kind]) return;
    state.paused      = true;
    state.activePopup = kind;
    var data          = POPUPS[kind];

    if (ui.popupIcon) {
      ui.popupIcon.src           = data.icon || '';
      ui.popupIcon.style.display = data.icon ? '' : 'none';
    }
    if (ui.popupTitle)   ui.popupTitle.textContent   = data.title;
    if (ui.popupBody)    ui.popupBody.textContent    = data.body;
    if (ui.popupConfirm) ui.popupConfirm.textContent = data.button;
    if (ui.overlay)      ui.overlay.classList.remove('hidden');
  }

  function closePopup() {
    if (ui.overlay) ui.overlay.classList.add('hidden');
    state.activePopup = null;
    if (!state.gameEnded) state.paused = false;
  }

  //SPAWN DELS OBJECTES 
  function spawnItem(type) {
    var lastX = state.objects.length
      ? Math.max.apply(null, state.objects.map(function(o) { return o.x; }))
      : -9999;
    var x = Math.max(canvas.width + randomRange(40, 150), lastX + state.spawn.minGap);
    state.objects.push({
      type:    type,
      x:       x,
      y:       ROAD_Y - 44,
      w:       44,
      h:       44,
      vx:      state.worldSpeed + randomRange(15, 65),
      crossed: false
    });
  }

  function spawnPedestrian() {
    var fromLeft = Math.random() < 0.5;
    state.objects.push({
      type:    'pedestrian',
      x:       fromLeft ? -70 : canvas.width + 70,
      y:       ROAD_Y - 55,
      w:       52,
      h:       70,
      vx:      fromLeft ? randomRange(280, 360) : -randomRange(280, 360),
      crossed: false
    });
  }

  //COLISIONS PERSONATGE 
  function collides(a, b) {
    return !(a.x + a.w < b.x || a.x > b.x + b.w ||
             a.y + a.h < b.y || a.y > b.y + b.h);
  }

  function onCollision(obj) {
    if (obj.type === 'mobile' || obj.type === 'headphones') {
      state.score = Math.max(0, state.score - 5);
      beep(180, 0.09, 'square');
      addParticles(state.player.x + 20, state.player.y + 30, '#ff9a9a', 8);
      if (!state.popupsSeen[obj.type]) {
        state.popupsSeen[obj.type] = true;
        showPopup(obj.type);
      }
    }

    if (obj.type === 'pedestrian') {
      state.lives -= 1;
      beep(110, 0.13, 'sawtooth');
      addParticles(state.player.x + 20, state.player.y + 30, '#ff6464', 12);
      if (!state.popupsSeen.pedestrian) {
        state.popupsSeen.pedestrian = true;
        showPopup('pedestrian');
      }
    }
    obj.crossed = true;
    updateHud();
    if (state.lives <= 0) endGame(false);
  }

  // FIN DEL JOC 
  function endGame(win) {
    state.running   = false;
    state.paused    = true;
    state.gameEnded = true;
    if (ui.endScreen) ui.endScreen.classList.remove('hidden');
    if (ui.endTitle)  ui.endTitle.textContent = win ? '🏆 Has guanyat!' : 'Has perdut...';
    if (ui.endBody)   ui.endBody.textContent  = win
      ? 'Excel·lent! Has aconseguit ' + Math.floor(state.score) + ' punts mantenint l\'atenció a la via.'
      : 'T\'has quedat sense vides amb ' + Math.floor(state.score) + ' punts. Torna-ho a intentar!';
  }

  // ANIMACIÓ 
  function setAnimation() {
    if (!state.player.onGround) { state.player.anim = 'jump'; return; }
    state.player.anim = Math.abs(state.player.vx) < 8 ? 'idle' : 'walk';
  }

  // INPUT 
  function processInput(dt) {
    var p = state.player;
    if (state.keys.left)  { p.vx -= p.accel * dt; p.facing = 'left'; }
    if (state.keys.right) { p.vx += p.accel * dt; p.facing = 'right'; }

    if (!state.keys.left && !state.keys.right) {
      p.vx *= p.friction;
      if (Math.abs(p.vx) < 3) p.vx = 0;
    }

    p.vx = clamp(p.vx, -p.maxSpeed * state.difficulty, p.maxSpeed * state.difficulty);

    if (state.keys.jump && p.onGround) {
      p.vy       = p.jumpImpulse;
      p.onGround = false;
      beep(330, 0.07, 'triangle');
    }
    state.keys.jump = false;
  }

  //UPDATE 
  function updatePlayer(dt) {
    processInput(dt);
    var p = state.player;
    p.vy += GRAVITY * dt;
    p.x  += p.vx * dt;
    p.y  += p.vy * dt;
    p.x   = clamp(p.x, 6, canvas.width - p.w - 6);
    if (p.y + p.h >= ROAD_Y) {
      p.y        = ROAD_Y - p.h;
      p.vy       = 0;
      p.onGround = true;
    }
    p.animT += dt;
    setAnimation();
  }

  function updateSpawns(dt) {
    state.spawn.itemTimer       -= dt;
    state.spawn.pedestrianTimer -= dt;

    if (state.spawn.itemTimer <= 0) {
      spawnItem(Math.random() < 0.5 ? 'mobile' : 'headphones');
      state.spawn.itemTimer = randomRange(
        Math.max(3.8, 6  / state.difficulty),
        Math.max(6.2, 10 / state.difficulty)
      );
    }
    if (state.spawn.pedestrianTimer <= 0) {
      spawnPedestrian();
      state.spawn.pedestrianTimer = randomRange(
        Math.max(5.5,  8  / state.difficulty),
        Math.max(10.5, 18 / state.difficulty)
      );
    }
  }

  function updateObjects(dt) {
    state.objects.forEach(function(obj) {
      if (obj.type === 'pedestrian') {
        obj.x += obj.vx * dt;
      } else {
        obj.x -= (obj.vx + state.worldSpeed * state.difficulty) * dt;
      }
      if (!obj.crossed && collides(state.player, obj)) onCollision(obj);
    });
    state.objects = state.objects.filter(function(obj) {
      return obj.x > -120 && obj.x < canvas.width + 120 && !obj.crossed;
    });
  }

  function updateParticles(dt) {
    state.particles.forEach(function(p) {
      p.life -= dt;
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 220 * dt;
    });
    state.particles = state.particles.filter(function(p) { return p.life > 0; });
  }

  function updateDifficulty(dt) {
    state.elapsed    += dt;
    state.difficulty  = 1 + Math.min(1.15, state.elapsed / 52);
    state.worldX     += state.worldSpeed * state.difficulty * dt;

    var delta = (state.keys.right && state.player.vx > 10)
      ? 4.7 * dt * state.difficulty
      : 2.1 * dt * state.difficulty;
    state.score = Math.max(0, state.score + delta);

    if (state.score >= state.goal) endGame(true);
  }

  //DIBUIX 
  function drawParallax() {
    var farOffset  = (state.worldX * 0.15) % canvas.width;
    var midOffset  = (state.worldX * 0.35) % canvas.width;
    var nearOffset = (state.worldX * 0.62) % canvas.width;
    var i, x;

    ctx.fillStyle = '#266f98';
    ctx.fillRect(0, 0, canvas.width, 380);

    ctx.fillStyle = '#4f9cc0';
    for (i = -1; i < 4; i++) {
      x = i * 350 - farOffset;
      ctx.beginPath();
      ctx.moveTo(x, 380); ctx.lineTo(x + 170, 170); ctx.lineTo(x + 330, 380);
      ctx.closePath(); ctx.fill();
    }

    ctx.fillStyle = '#3f88ad';
    for (i = -1; i < 6; i++) {
      x = i * 220 - midOffset;
      ctx.beginPath();
      ctx.moveTo(x, 390); ctx.lineTo(x + 120, 250); ctx.lineTo(x + 220, 390);
      ctx.closePath(); ctx.fill();
    }

    ctx.fillStyle = '#47a37b';
    for (i = -1; i < 10; i++) {
      ctx.fillRect(i * 120 - nearOffset, ROAD_Y - 6, 300, 8);
    }

    ctx.fillStyle = '#2f3540';
    ctx.fillRect(0, ROAD_Y, canvas.width, canvas.height - ROAD_Y);

    ctx.strokeStyle = '#f6cc44';
    ctx.lineWidth   = 6;
    for (i = -1; i < 20; i++) {
      x = i * 74 - (state.worldX * 0.95 % 74);
      ctx.beginPath();
      ctx.moveTo(x, ROAD_Y + 45); ctx.lineTo(x + 40, ROAD_Y + 45);
      ctx.stroke();
    }
  }

  function drawPlayer() {
    var p     = state.player;
    var swing = Math.sin(p.animT * 18) * 3;

    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    if (p.facing === 'left') ctx.scale(-1, 1);

    var img = images['player'];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -p.w / 2, -p.h / 2, p.w, p.h);
    } else {
      ctx.fillStyle = '#ffcb29';
      ctx.fillRect(-20, -20, 40, 44);
    }

    ctx.fillStyle = '#1f262e';
    ctx.fillRect(-28, 24, 56, 7);

    if (p.anim === 'walk') {
      ctx.fillRect(-16, 18 + swing, 8, 10);
      ctx.fillRect(  8, 18 - swing, 8, 10);
    }
    if (p.anim === 'jump') {
      ctx.fillStyle = '#8be9ff';
      ctx.fillRect(-22, 30, 44, 4);
    }

    ctx.restore();
  }

  function drawObjects() {
    state.objects.forEach(function(obj) {
      var img = images[obj.type];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, obj.x, obj.y, obj.w, obj.h);
      } else {
        ctx.fillStyle = obj.type === 'pedestrian' ? '#ffa4a4' : '#f3e2a6';
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
      }
    });
  }

  function drawParticles() {
    state.particles.forEach(function(p) {
      ctx.globalAlpha = Math.max(0, p.life * 1.7);
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  //LOOP PRINCIPAL 
  function loop(timestamp) {
    if (!state.lastTime) state.lastTime = timestamp;
    var dt = Math.min(0.033, (timestamp - state.lastTime) / 1000);
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

  // TECLAT
  window.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowLeft')                  state.keys.left  = true;
    if (e.key === 'ArrowRight')                 state.keys.right = true;
    if (e.key.toLowerCase() === 's')            state.keys.jump  = true;

    if (e.code === 'Space') {
      state.player.vx   = 0;
      state.player.anim = 'idle';
      e.preventDefault();
    }

    if (e.key.toLowerCase() === 'p' && !state.gameEnded && !state.activePopup) {
      state.paused = !state.paused;
      if (state.paused) {
        if (ui.overlay)      ui.overlay.classList.remove('hidden');
        if (ui.popupTitle)   ui.popupTitle.textContent   = 'PAUSA';
        if (ui.popupBody)    ui.popupBody.textContent    = 'El joc està en pausa. Prem el botó per continuar.';
        if (ui.popupConfirm) ui.popupConfirm.textContent = 'ENTESOS';
        state.activePopup = 'pause';
      }
    }
  });

  window.addEventListener('keyup', function(e) {
    if (e.key === 'ArrowLeft')  state.keys.left  = false;
    if (e.key === 'ArrowRight') state.keys.right = false;
  });

  //BOTONS
  if (ui.popupConfirm) ui.popupConfirm.addEventListener('click', closePopup);
  if (ui.restartBtn)   ui.restartBtn.addEventListener('click', function() { window.location.reload(); });

  //INICI DEL JOC
  updateHud();
  showPopup('initial');
  requestAnimationFrame(loop);

  console.log('Juego iniciado correctamente ✓');

}); // fin DOMContentLoaded