'use strict';
const IMG_PATHS = {
  ped1:   '../assets/sprites/personatge1.png',
  ped2:   '../assets/sprites/personatge2.png',
  ped3:   '../assets/sprites/personatge3.png',
  side1:  '../assets/sprites/costat1.png',
  player: '../assets/sprites/personatge_principal.png',
  side2:  '../img/costat2.png',
  side3:  '../img/costat3.jpg',
};

const SFX_PATHS = {
  bgRetro:  '../assets/effects/music-fons-retro.mp3',
  bgNormal: '../assets/effects/music-fons.mp3',
  hit:      '../assets/effects/colisio.mp3',
  win:      '../assets/effects/guanyar.mp3',
  lose:     '../assets/effects/perdre.mp3',
};

/* CANVAS I CONSTANTS DE PERSPECTIVA*/
const cv  = document.getElementById('c');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

const W = 480, H = 680;

// Horitzó elevat → carretera molt visible (74% de la pantalla)
const HRZ   = H * 0.26;   // línia d'horitzó
const RHW_B = W * 0.70;   // semi-amplada carretera al fons
const RHW_T = W * 0.080;  // semi-amplada carretera a l'horitzó
const HB_Y  = H - 93;     // base del manillar

// Factor global d'escala dels obstacles (>1 = més grans)
// Augmenta per fer-los encara més visibles
const OBS_SC = 1.7;

/*PALETA DE COLORS*/
const P = {
  skyT:'#0a1628', skyB:'#1555a0',
  road:'#52525e', roadD:'#3e3e4a', roadE:'#6a6a78',
  swk:'#7a6840',  swkL:'#9a885a',
  or:'#ff6b00',   orD:'#cc4400',
  yw:'#ffee00',   gn:'#00ff55',   rd:'#ff2200',
  wh:'#ffffff',   bk:'#000000',   skin:'#f0c898',
};

/* GEOMETRIA DE PERSPECTIVA*/ 
/* vpX = punt de fuga X, s'anima per simular canvi de carril*/
let vpX = W / 2;

const rL    = d => vpX - (RHW_T + (RHW_B - RHW_T) * d);
const rR    = d => vpX + (RHW_T + (RHW_B - RHW_T) * d);
const rY    = d => HRZ + (H - HRZ) * d;
const dSc   = d => (0.10 + d * 1.10) * OBS_SC;  // escala obstàcle a profunditat d
const lX    = (ln, d) => vpX + ln * 0.36 * (rR(d) - rL(d));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ESTAT DEL JOC*/
const GS = {
  MENU:'MENU', TUTO:'TUTO', CD:'CD',
  PLAY:'PLAY', PHASE_IN:'PHASE_IN',
  POPUP:'POPUP', ERROR:'ERROR', GO:'GO',
};
let st = GS.MENU;

const pl = { lane:0, laneVis:0, speed:1.1, baseSpd:1.1 };
let score = 0, health = 100, dist = 0, gTime = 0;
const S = { dc:0, da:0, col:0, dod:0, lr:0, li:0, zr:0, zi:0 };

let obs=[], lights=[], zebras=[], floats=[];
let roadOff=0, lCooldown=0, cdTimer=3500, lastTs=0;
let shakeX=0, shakeY=0, flickT=0;
let alertMsg='', alertTimer=0, alertCol=P.gn;
let distrPopup=null, distrAnimT=0;
let errPopup=null, errAnimT=0, errChartT=0;

// Timers de spawn
let obsTimer=0, nextObs=5000;
let lightTimer=0, nextLight=99999;
let zebraTimer=0, nextZebra=99999;
let popTimer=0, nextPop=99999;

// Fites de distància ja celebrades
let milestones = new Set();

/* SISTEMA DE FASES*/
let phase = 0;           // fase actual (0 = tutorial, 1..4 = joc)
let phaseTimer = 0;      // temps acumulat dins la fase (ms)
let phaseInTimer = 0;    // temps restant de la pantalla d'entrada (ms)

/* Definició de cada fase */
const PHASES = [
  /* ── TUTORIAL (fase 0): sense obstacles, aprèn els controls ── */
  {
    id: 0, col:'#00aaff', icon:'🎮',
    title:'TUTORIAL – APRÈN ELS CONTROLS',
    intro:[
      '↑  Prem amunt per ACCELERAR.',
      '↓  Prem avall per FRENAR.',
      '← → Esquerra/dreta per CANVIAR DE CARRIL.',
    ],
    obj:'Practica els controls sense perill!',
    duration: 16000,   // 16 s de tutorial sense obstacles
    obsInterval: 99999,
    obsCount: 0,
    obsTypes: [],
    lights: false, zebras: false, popups: false,
  },
  /* ── FASE 1: cotxes lents, un a la vegada ── */
  {
    id: 1, col:'#00cc44', icon:'🚗',
    title:'FASE 1 – COTXES',
    intro:[
      'Apareixeran cotxes a la via.',
      'Canvia de carril (← →) per esquivar.',
      'Comença a ritme tranquil!',
    ],
    obj:'Esquiva els cotxes! ← →',
    duration: 32000,
    obsInterval: 4500,
    obsCount: 1,
    obsTypes: ['car_red','car_blue','car_yellow'],
    lights: false, zebras: false, popups: false,
  },
  /* ── FASE 2: semàfors ── */
  {
    id: 2, col:'#ffee00', icon:'🚦',
    title:'FASE 2 – SEMÀFORS',
    intro:[
      'Ara hi haurà semàfors.',
      'Prem ↓ per frenar al VERMELL.',
      'Mai passis amb llum vermella!',
    ],
    obj:'Frena als semàfors vermells! ↓',
    duration: 45000,
    obsInterval: 4000,
    obsCount: 1,
    obsTypes: ['car_red','car_blue','car_yellow','box'],
    lights: true, zebras: false, popups: false,
  },
  /* ── FASE 3: vianants i passos de zebra ── */
  {
    id: 3, col:'#ff88ff', icon:'🦓',
    title:'FASE 3 – VIANANTS',
    intro:[
      'Ara hi haurà vianants i passos.',
      'Frena (↓) als passos de zebra.',
      'Els vianants tenen prioritat!',
    ],
    obj:'Cedeix el pas als vianants! ↓',
    duration: 55000,
    obsInterval: 3600,
    obsCount: 2,
    obsTypes: ['car_red','car_blue','car_yellow','box','ped_a','ped_b','ped_c'],
    lights: true, zebras: true, popups: false,
  },
  /* ── FASE 4: distraccions digitals ── */
  {
    id: 4, col:'#ff8800', icon:'📱',
    title:'FASE 4 – DISTRACCIONS DIGITALS',
    intro:[
      'Ara rebràs notificacions i missatges.',
      'Prem C per CANCEL·LAR la distracció.',
      'Mai el mòbil mentre circules!',
    ],
    obj:'Ignora el mòbil! Prem C',
    duration: Infinity,
    obsInterval: 3000,
    obsCount: 2,
    obsTypes: ['car_red','car_blue','car_yellow','box','ped_a','ped_b','ped_c','scooter'],
    lights: true, zebras: true, popups: true,
  },
];

const curPhase = () => PHASES[clamp(phase, 0, PHASES.length - 1)];

/* Aplica els paràmetres de spawn de la fase actual */
function applyPhase() {
  const ph = curPhase();
  nextObs   = ph.obsInterval;
  nextLight = ph.lights  ? 16000 + Math.random() * 8000  : 99999;
  nextZebra = ph.zebras  ? 12000 + Math.random() * 8000  : 99999;
  nextPop   = ph.popups  ? 10000 + Math.random() * 5000  : 99999;
  // Augmenta lleugerament la velocitat base a cada fase
  pl.baseSpd = 1.1 + phase * 0.18;
}

/* Comprova si hem de passar a la fase següent */
function checkPhaseUp(dt) {
  if (phase >= PHASES.length - 1) return;
  phaseTimer += dt;
  if (phaseTimer >= curPhase().duration) {
    phase++;
    phaseTimer = 0;
    phaseInTimer = 5000;   // mostrar pantalla intro 5 s
    st = GS.PHASE_IN;
    applyPhase();
  }
}

/* SISTEMA D'ÀUDIO
   Carrega els fitxers mp3 i exposa play/loop/stop. */
const SFX = {};
let bgMusic = null;

function loadAudio() {
  Object.entries(SFX_PATHS).forEach(([k, url]) => {
    try {
      const a = new Audio(url);
      a.preload = 'auto';
      SFX[k] = a;
    } catch(e) { /* so no disponible */ }
  });
}

function playBg() {
  // Usa la música retro com a fons de joc
  const src = SFX.bgRetro || SFX.bgNormal;
  if (!src || bgMusic === src) return;
  if (bgMusic) { bgMusic.pause(); bgMusic.currentTime = 0; }
  bgMusic = src;
  bgMusic.loop = true;
  bgMusic.volume = 0.35;
  bgMusic.play().catch(()=>{});
}

function stopBg() {
  if (bgMusic) { bgMusic.pause(); bgMusic.currentTime = 0; bgMusic = null; }
}

function playSfx(key, vol = 0.7) {
  const s = SFX[key];
  if (!s) return;
  try {
    const clone = s.cloneNode();
    clone.volume = vol;
    clone.play().catch(()=>{});
  } catch(e) {}
}

/* IMATGES EXTERNES */
const IMGS = {};

function loadImages(cb) {
  let n = 0;
  Object.entries(IMG_PATHS).forEach(([k, url]) => {
    if (!url) return;
    n++;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => { IMGS[k] = img; if (--n === 0) cb(); };
    img.onerror = () => {                if (--n === 0) cb(); };
    img.src = url;
  });
  if (n === 0) cb();
}

/* Dibuixa imatge escalada o crida al fallback pixel art */
function spr(key, cx, cy, s, fallback) {
  const img = IMGS[key];
  if (img) {
    const w = img.naturalWidth  * s * 0.20;
    const h = img.naturalHeight * s * 0.20;
    ctx.drawImage(img, (cx - w / 2) | 0, (cy - h) | 0, w | 0, h | 0);
  } else {
    fallback(cx, cy, s);
  }
}

/*PRIMITIVES DE DIBUIX*/
const pr = (x, y, w, h, c) => {
  ctx.fillStyle = c;
  ctx.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0));
};

function pt(t, x, y, s, c, al = 'left', bl = 'top') {
  ctx.font = `${s}px 'Press Start 2P',monospace`;
  ctx.textAlign = al; ctx.textBaseline = bl;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillText(t, (x + 2) | 0, (y + 2) | 0);
  ctx.fillStyle = c;
  ctx.fillText(t, x | 0, y | 0);
}

/* Contorn brillant al voltant d'un obstacle (millora visibilitat) */
function obsGlow(cx, cy, w, h, col) {
  ctx.shadowColor = col;
  ctx.shadowBlur  = 14;
  ctx.strokeStyle = col;
  ctx.lineWidth   = 2;
  ctx.strokeRect((cx - w / 2 - 3) | 0, (cy - h - 3) | 0, (w + 6) | 0, (h + 6) | 0);
  ctx.shadowBlur  = 0;
}

/* SPRITES PIXEL ART D'OBSTACLES
   Mida base ~70×110 px per cotxes, ~80px per persones.
   S'escalen per dSc(d) * OBS_SC → obstacles grans i molt visibles.*/

/* Cotxe genèric (cx,cy = cantonada inferior central) */
function _car(cx, cy, s, body, cab, stripe) {
  const w = 70 * s, h = 110 * s;
  // Ombra al terra
  pr(cx - w * .45 + 4*s, cy - 4*s, w * .9, 8*s, 'rgba(0,0,0,0.3)');
  // Carrosseria
  pr(cx - w/2, cy - h, w, h, body);
  // Cabina
  pr(cx - w*.37, cy - h*.94, w*.74, h*.44, cab);
  // Parabrises davanter
  pr(cx - w*.30, cy - h*.88, w*.60, h*.20, '#a8d4f8');
  pr(cx - w*.24, cy - h*.87, w*.48, h*.09, '#d0eaff');
  // Lluna posterior
  pr(cx - w*.28, cy - h*.57, w*.56, h*.14, '#4477aa');
  // Banda lateral
  pr(cx - w*.50, cy - h*.50, w, h*.04, stripe);
  // Llums davanteres
  pr(cx - w*.42, cy - h + 2*s, w*.28, 6*s, '#ffffa0');
  pr(cx + w*.14, cy - h + 2*s, w*.28, 6*s, '#ffffa0');
  // Llums posterior
  pr(cx - w*.42, cy - 8*s, w*.24, 6*s, '#ff3333');
  pr(cx + w*.18, cy - 8*s, w*.24, 6*s, '#ff3333');
  // Rodes
  [ [cy-h*.25, cy-h*.82] ].forEach(wy => wy.forEach(ty => {
    [ cx-w*.50-3*s, cx+w*.42 ].forEach(tx => {
      pr(tx, ty, 10*s, 24*s, '#1a1a1a');
      pr(tx+2*s, ty+4*s, 5*s, 16*s, '#555');
    });
  }));
  // Contorn brillant per visibilitat
  obsGlow(cx, cy, w, h, body);
}

function drawCarR(cx,cy,s){ spr('car_red',   cx,cy,s,(cx,cy,s)=>_car(cx,cy,s,'#dd3333','#991111','#ee1111')); }
function drawCarB(cx,cy,s){ spr('car_blue',  cx,cy,s,(cx,cy,s)=>_car(cx,cy,s,'#2244cc','#1133aa','#3355dd')); }
function drawCarY(cx,cy,s){ spr('car_yellow',cx,cy,s,(cx,cy,s)=>_car(cx,cy,s,'#cc9900','#aa7700','#ddaa00')); }

/* Persones (cx,cy = peu) */
function _person(cx, cy, s, shirt, pants, hair, imgKey) {
  spr(imgKey, cx, cy, s, (cx,cy,s) => {
    const sc = s * 82;
    // Peus / sabates
    pr(cx-sc*.22,cy-sc*.07, sc*.18,sc*.07,'#222');
    pr(cx+sc*.04,cy-sc*.07, sc*.18,sc*.07,'#222');
    // Cames
    pr(cx-sc*.19,cy-sc*.38, sc*.15,sc*.31, pants);
    pr(cx+sc*.04,cy-sc*.38, sc*.15,sc*.31, pants);
    // Cos
    pr(cx-sc*.24,cy-sc*.74, sc*.48,sc*.36, shirt);
    pr(cx-sc*.24,cy-sc*.42, sc*.48,sc*.05,'#7a4000');
    // Braços
    pr(cx-sc*.40,cy-sc*.72, sc*.17,sc*.30, P.skin);
    pr(cx+sc*.23,cy-sc*.72, sc*.17,sc*.30, P.skin);
    // Cap
    pr(cx-sc*.17,cy-sc*1.02,sc*.34,sc*.28, P.skin);
    pr(cx-sc*.19,cy-sc*1.02,sc*.38,sc*.10, hair);
    // Ulls
    pr(cx-sc*.10,cy-sc*.82, sc*.06,sc*.06, P.bk);
    pr(cx+sc*.04,cy-sc*.82, sc*.06,sc*.06, P.bk);
    // Glow de contorn
    obsGlow(cx, cy, sc*.46, sc*1.02, shirt);
  });
}

function drawPersonA(cx,cy,s){ _person(cx,cy,s,'#cc3311','#224488','#332211','ped1'); }
function drawPersonB(cx,cy,s){ _person(cx,cy,s,'#225588','#884400','#111133','ped2'); }
function drawPersonC(cx,cy,s){ _person(cx,cy,s,'#996622','#333366','#221100','ped3'); }

/* Persona per pas de zebra */
function drawPersonZebra(cx,cy,s) {
  const sc = s * 78;
  pr(cx-sc*.22,cy-sc*.07, sc*.18,sc*.07,'#1a1a1a');
  pr(cx+sc*.04,cy-sc*.07, sc*.18,sc*.07,'#1a1a1a');
  pr(cx-sc*.19,cy-sc*.38, sc*.15,sc*.31,'#334422');
  pr(cx+sc*.04,cy-sc*.38, sc*.15,sc*.31,'#334422');
  pr(cx-sc*.24,cy-sc*.74, sc*.48,sc*.36,'#884488');
  pr(cx-sc*.38,cy-sc*.70, sc*.15,sc*.28, P.skin);
  pr(cx+sc*.23,cy-sc*.70, sc*.15,sc*.28, P.skin);
  pr(cx-sc*.15,cy-sc*1.0, sc*.30,sc*.26, P.skin);
  pr(cx-sc*.17,cy-sc*1.0, sc*.34,sc*.09,'#221100');
  pr(cx-sc*.08,cy-sc*.80, sc*.06,sc*.06, P.bk);
  pr(cx+sc*.03,cy-sc*.80, sc*.06,sc*.06, P.bk);
  obsGlow(cx, cy, sc*.46, sc*1.0,'#aa55aa');
}

/* Caixa obstacle */
function drawBox(cx,cy,s) {
  const w = 54*s, h = 48*s;
  pr(cx-w/2+4*s, cy-3*s, w, 8*s,'rgba(0,0,0,0.28)');
  pr(cx-w/2, cy-h, w, h,'#8B4513');
  pr(cx-w/2+3*s,cy-h+3*s, w-6*s,h-6*s,'#a0522d');
  pr(cx-w/2+3*s,cy-h+3*s, w-6*s,6*s,'#c07040');
  ctx.strokeStyle='#cc9955'; ctx.lineWidth=Math.max(1.5,2.5*s);
  ctx.beginPath();
  ctx.moveTo((cx-w/2)|0,(cy-h)|0); ctx.lineTo((cx+w/2)|0,cy|0);
  ctx.moveTo((cx+w/2)|0,(cy-h)|0); ctx.lineTo((cx-w/2)|0,cy|0);
  ctx.stroke();
  obsGlow(cx, cy, w, h,'#cc8844');
}

/* Patinet obstacle */
function drawObsScooter(cx,cy,s) {
  const sc=s*56;
  pr(cx-sc*.40,cy-sc*.38, sc*.80,sc*.16,'#009900');
  pr(cx-sc*.40,cy-sc*.38, sc*.80,sc*.05,'#00cc00');
  pr(cx-sc*.05,cy-sc*1.22,sc*.10,sc*.84,'#007700');
  pr(cx-sc*.36,cy-sc*1.18,sc*.72,sc*.11,'#005500');
  ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=Math.max(2,5*s);
  ctx.beginPath();ctx.arc((cx-sc*.28)|0,(cy-sc*.2)|0,sc*.22,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc((cx+sc*.28)|0,(cy-sc*.2)|0,sc*.22,0,Math.PI*2);ctx.stroke();
  obsGlow(cx, cy, sc*.80, sc*1.22,'#00cc44');
}

/* Taula d'obstacles: id, dmg, pts, error a mostrar, funció de dibuix */
const OBS_DEF = [
  { id:'car_red',   dmg:30,pts:14,err:'collision',drawFn:drawCarR },
  { id:'car_blue',  dmg:30,pts:14,err:'collision',drawFn:drawCarB },
  { id:'car_yellow',dmg:28,pts:14,err:'collision',drawFn:drawCarY },
  { id:'box',       dmg:14,pts: 7,err:'collision',drawFn:drawBox  },
  { id:'ped_a',     dmg:22,pts:10,err:'collision',drawFn:drawPersonA },
  { id:'ped_b',     dmg:20,pts:10,err:'collision',drawFn:drawPersonB },
  { id:'ped_c',     dmg:20,pts:10,err:'collision',drawFn:drawPersonC },
  { id:'scooter',   dmg:20,pts:12,err:'collision',drawFn:drawObsScooter },
];

/* DADES EDUCATIVES (gràfic d'accidents)*/
const CHART = [
  { label:'Mòbil/Distrac.', pct:34, col:'#ff4455' },
  { label:'Velocitat exc.', pct:27, col:'#ff8822' },
  { label:'Semàfor/Senyal', pct:18, col:'#ffee22' },
  { label:'Pas vianants',   pct:13, col:'#ff55cc' },
  { label:'Altres',          pct: 8, col:'#8899ff' },
];

const ERR_DEF = {
  collision: {
    title:'COL·LISIÓ!', icon:'💥', col:'#ff2200', hl:'Velocitat exc.',
    lines:[
      'Has topat amb un obstacle.',
      'Anticipa i esquiva a temps.',
      'Quant més lluny els veus,',
      'millor pots reaccionar!',
    ],
    tip:'Mira sempre endavant i\nanticipa els obstacles des de lluny.',
  },
  distraction: {
    title:'DISTRACCIÓ!', icon:'📱', col:'#ff8800', hl:'Mòbil/Distrac.',
    lines:[
      'Has acceptat la distracció.',
      '1 segon de distracció = 5 metres',
      'sense controlar el patinet.',
      'Mai el mòbil mentre circules!',
    ],
    tip:'Guarda el mòbil sempre.\nCap missatge no val una vida.',
  },
  redlight: {
    title:'SEMÀFOR VERMELL!', icon:'🚦', col:'#ff2200', hl:'Semàfor/Senyal',
    lines:[
      'Has passat en llum vermella.',
      'Els semàfors eviten accidents',
      'mortals a les interseccions.',
      'Prem ↓ per frenar!',
    ],
    tip:'Quan vegis el semàfor groc o vermell,\nfrena fins a aturar-te completament.',
  },
  zebra: {
    title:'PAS DE VIANANTS!', icon:'🚶', col:'#ff55cc', hl:'Pas vianants',
    lines:[
      'No has respectat el pas de zebra.',
      'El vianant sempre té prioritat',
      'als passos senyalitzats.',
      'Frena (↓) quan vegis vianants!',
    ],
    tip:'Redueix la velocitat i cedeix el pas\na qualsevol vianant al pas de zebra.',
  },
};

/* DISTRACCIONS (popups C/V)*/
const POPS = [
  {
    icon:'📱', title:'NOTIFICACIÓ!',
    lines:["Algú t'ha", "etiquetat en una foto.", "Vols mirar-ho?"],
    cancel:'Ara no', accept:'Miro el mòbil',
    bon:'✓ El mòbil pot esperar sempre!',
    pen:'✗ Mai el mòbil mentre circules!',
    edu:'El 34% d\'accidents en patinet\nés per culpa del mòbil.',
  },
  {
    icon:'🎵', title:'CANÇÓ ENGANXOSA!',
    lines:['Aquella cançó no se\'t va del cap...','Poses els auriculars ara?'],
    cancel:'Ara no', accept:'Sí, els poso',
    bon:'✓ Sense auriculars sents els perills!',
    pen:'✗ Amb auriculars no sents botzines!',
    edu:'Els auriculars impedeixen sentir\nalerts acústics del trànsit.',
  },
  {
    icon:'💭', title:'PENSAMENT!',
    lines:['Recordes el que va passar ahir?','T\'hi poses a pensar?'],
    cancel:'Concentrat!', accept:'Sí, hi penso',
    bon:'✓ Ment clara = viatge segur.',
    pen:'✗ Centra\'t en la via!',
    edu:'Distreure\'s mentalment és tan\nperillós com mirar el mòbil.',
  },
  {
    icon:'💬', title:'WHATSAPP!',
    lines:['5 missatges nous del grup.','Els llegeixo ara?'],
    cancel:'Esperar', accept:'Llegir ara',
    bon:'✓ Els missatges sempre esperen!',
    pen:'✗ Mai llegeixis missatges en marxa!',
    edu:'Llegir un missatge redueix per 3\nel teu temps de reacció.',
  },
  {
    icon:'💬', title:'INSTAGRAM!',
    lines:['Una persona ha donat like al teu post.','Ho reviso?'],
    cancel:'Esperar', accept:'Mirar ara',
    bon:'✓ Els missatges sempre esperen!',
    pen:'✗ Mai llegeixis missatges en marxa!',
    edu:'Llegir un missatge redueix molt teu temps de reacció.',
  },
  {
    icon:'🎧', title:'SPOTIFY!',
    lines:['La teva playlist t\'espera.','Canvies la cançó ara?'],
    cancel:'Segueixo igual', accept:'Canvio ara',
    bon:'✓ Tria la música ABANS de sortir.',
    pen:'✗ No escoltar res mentre condueixes!',
    edu:'El millor és evitar utilitzar auriculars',
  },
];

/* ENTORN (cel, edificis, carretera)*/
const BL=[
  {x:-4, w:54,h:92, c:'#8b1f1f',wc:'#ffe066'},
  {x:48, w:42,h:68, c:'#1a3d6b',wc:'#99ddff'},
  {x:88, w:62,h:108,c:'#2d5a1b',wc:'#aaffaa'},
  {x:148,w:36,h:78, c:'#4a1a6b',wc:'#ddaaff'},
  {x:182,w:28,h:58, c:'#3d2a00',wc:'#ffcc88'},
];
const BR=[
  {x:W-58, w:58,h:88, c:'#1a3d6b',wc:'#99ddff'},
  {x:W-105,w:44,h:105,c:'#6b1f1f',wc:'#ffaa66'},
  {x:W-150,w:42,h:72, c:'#1a5a3d',wc:'#aaffcc'},
  {x:W-190,w:36,h:58, c:'#3d3d1a',wc:'#ffffaa'},
  {x:W-220,w:28,h:48, c:'#4b1a00',wc:'#ffcc88'},
];

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, HRZ);
  g.addColorStop(0, P.skyT); g.addColorStop(1, P.skyB);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, HRZ);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  [[28,10],[80,7],[155,17],[230,5],[310,13],[400,8],[455,19],
   [60,24],[190,27],[380,21],[130,4],[340,31]].forEach(([sx,sy])=>ctx.fillRect(sx,sy,2,2));
}

function drawBuildings() {
  [BL, BR].forEach(arr => arr.forEach(b => {
    const by = HRZ - b.h;
    pr(b.x, by, b.w, b.h, b.c);
    pr(b.x, by-3, b.w, 3, 'rgba(0,0,0,.45)');
    pr(b.x, by, b.w, 4, 'rgba(255,255,255,.07)');
    for (let wy=by+7;wy<HRZ-6;wy+=16)
      for (let wx=b.x+5;wx<b.x+b.w-8;wx+=14) {
        pr(wx,wy, 8,8, b.wc);
        pr(wx+3,wy, 2,8,'rgba(0,0,0,.28)');
        pr(wx,wy+3, 8,2,'rgba(0,0,0,.22)');
      }
  }));
}

function drawRoadSurface() {
  // Voreres
  [[0,rL],[W,rR]].forEach(([edge,fn])=>{
    ctx.fillStyle=P.swk;
    ctx.beginPath();ctx.moveTo(edge,HRZ);ctx.lineTo(fn(0),HRZ);ctx.lineTo(fn(1),H);ctx.lineTo(edge,H);ctx.closePath();ctx.fill();
  });
  // Limits vorera
  ctx.strokeStyle=P.swkL; ctx.lineWidth=2;
  [rL,rR].forEach(fn=>{ ctx.beginPath();ctx.moveTo(fn(0),HRZ);ctx.lineTo(fn(1),H);ctx.stroke(); });
  // Asfalt
  ctx.fillStyle=P.road;
  ctx.beginPath();ctx.moveTo(rL(0),HRZ);ctx.lineTo(rR(0),HRZ);ctx.lineTo(rR(1),H);ctx.lineTo(rL(1),H);ctx.closePath();ctx.fill();
  // Bandes de perspectiva alternades (sensació de moviment)
  for(let i=0;i<8;i++){
    if(i%2===0){
      const d0=i/8, d1=(i+0.44)/8;
      ctx.fillStyle=P.roadD;
      ctx.beginPath();ctx.moveTo(rL(d0),rY(d0));ctx.lineTo(rR(d0),rY(d0));ctx.lineTo(rR(d1),rY(d1));ctx.lineTo(rL(d1),rY(d1));ctx.closePath();ctx.fill();
    }
  }
}

function drawLaneLines() {
  const N = 18;
  [-1,0,1].forEach(li => {
    const isY = (li === 0);
    for(let i=0;i<N;i++){
      const d0=((i/N)+roadOff)%1, d1=(((i+0.44)/N)+roadOff)%1;
      if(d1<d0) continue;
      const rw0=rR(d0)-rL(d0), rw1=rR(d1)-rL(d1);
      const x0=vpX+li*rw0*.36, x1=vpX+li*rw1*.36;
      ctx.strokeStyle=isY?'rgba(255,238,0,.80)':'rgba(255,255,255,.60)';
      ctx.lineWidth=Math.max(1,(isY?3:2)*d1);
      ctx.beginPath();ctx.moveTo(x0,rY(d0));ctx.lineTo(x1,rY(d1));ctx.stroke();
    }
  });
}

/* PAS DE ZEBRA*/
function drawZebraCrossing(zb) {
  const d=zb.depth;
  const y0=rY(d-.025), y1=rY(d+.025);
  const xl=rL(d), xr=rR(d), w=xr-xl;
  // Bandes blanques i negres
  for(let i=0;i<9;i++){
    const bx=xl+i*(w/9);
    ctx.fillStyle=(i%2===0)?'rgba(255,255,255,0.94)':'rgba(30,30,30,0.35)';
    ctx.beginPath();ctx.moveTo(bx,y0);ctx.lineTo(bx+w/9*.60,y0);ctx.lineTo(bx+w/9*.60,y1);ctx.lineTo(bx,y1);ctx.closePath();ctx.fill();
  }
  // Etiqueta (visible quan s'apropa)
  if(d>.42){
    const a=clamp((d-.42)/.28,0,1);
    ctx.globalAlpha=a;
    const lh=16*dSc(d)/OBS_SC;
    pr(xl,y1, w,lh,'rgba(0,0,0,.65)');
    ctx.font=`${Math.max(5,8*dSc(d)/OBS_SC)}px 'Press Start 2P'`;
    ctx.fillStyle=P.yw; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('PAS VIANANTS',(xl+xr)/2|0,(y1+lh/2)|0);
    ctx.globalAlpha=1;
  }
  // Vianant al pas
  if(zb.hasPed){
    const cy=rY(d);
    const pedX=zb.pedSide===0?lX(-1,d)+20*(dSc(d)/OBS_SC):lX(1,d)-20*(dSc(d)/OBS_SC);
    drawPersonZebra(pedX, cy, dSc(d));
  }
}

/* SEMÀFOR*/
function drawTrafficLight(tl) {
  const s=dSc(tl.depth)/OBS_SC;
  const bx=rR(tl.depth)+12*s, by=rY(tl.depth);
  const pH=108*s, bW=28*s, bH=76*s, lr=9*s;
  pr(bx+2*s,by-pH, 10*s,pH,'#3a3a3a');
  pr(bx+3*s,by-pH, 5*s,pH,'#555');
  pr(bx,by-pH, bW,bH,'#0e0e0e');
  pr(bx+1*s,by-pH+1*s, bW-2*s,bH-2*s,'#151515');
  function bulb(yOff,on,off,on2){
    ctx.fillStyle=on?on2:off;
    if(on){ctx.shadowColor=on2;ctx.shadowBlur=18*s;}
    ctx.beginPath();ctx.arc((bx+bW/2)|0,(by-pH+yOff)|0,lr,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    if(on){
      ctx.fillStyle='rgba(255,255,255,.2)';
      ctx.beginPath();ctx.arc((bx+bW/2-lr*.3)|0,(by-pH+yOff-lr*.3)|0,lr*.3,0,Math.PI*2);ctx.fill();
    }
  }
  bulb(lr+3*s,   tl.state==='red',   '#2a0000','#ff2200');
  bulb(bH/2,     tl.state==='yellow','#2a2000','#ffee00');
  bulb(bH-lr-3*s,tl.state==='green', '#002200','#00ff44');
  if(tl.state==='red' && tl.depth>.33){
    const a=clamp((tl.depth-.33)/.30,0,1); ctx.globalAlpha=a;
    pr(bx-5*s,by+3*s, bW+10*s,16*s,'#cc0000');
    ctx.font=`${Math.max(5,9*s)}px 'Press Start 2P'`;
    ctx.fillStyle=P.wh; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('STOP',(bx+bW/2)|0,(by+11*s)|0); ctx.globalAlpha=1;
  }
}

/* MANILLAR I MANS (primera persona)
   handSway = desplaçament lateral per animar el gir del manillar*/
function drawHandlebars(handSway) {
  const cx = (W / 2 + handSway) | 0;
  const by = HB_Y;
  const tilt = handSway * 0.006;

  // Tija
  pr(cx-10,by-62,20,62,'#777');pr(cx-8,by-60,9,58,'#999');pr(cx-10,by-62,20,5,'#aaa');
  // Pantalla digital
  pr(cx-26,by-58,52,36,'#0a0a0a');pr(cx-24,by-56,48,32,'#001a00');pr(cx-24,by-56,48,5,'#002800');
  ctx.font="7px 'Press Start 2P'";ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#00ff44';ctx.fillText(Math.floor(pl.speed*10)+'km/h',cx,by-39);

  // Barra horitzontal (lleugerament inclinada en girs)
  ctx.save();ctx.translate(cx,by-68);ctx.rotate(tilt);
  pr(-112,0,224,19,'#888');pr(-112,0,224,5,'#aaa');pr(-112,14,224,4,'#555');
  // Frens
  pr(-108,-26,15,32,'#444');pr(-106,-24,7,26,'#666');
  pr( 93,-26,15,32,'#444');pr( 95,-24,7,26,'#666');
  // Puny esquerre
  pr(-124,-11,32,30,'#222');pr(-124,-11,32,8,'#333');
  for(let i=0;i<5;i++)pr(-121+i*5,-2,3,13,'#1a1a1a');
  // Puny dret
  pr( 92,-11,32,30,'#222');pr( 92,-11,32,8,'#333');
  for(let i=0;i<5;i++)pr(94+i*5,-2,3,13,'#1a1a1a');
  // Timbre
  ctx.fillStyle='#ccaa00';ctx.beginPath();ctx.arc(-91,-16,9,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ffdd00';ctx.beginPath();ctx.arc(-91,-17,6,0,Math.PI*2);ctx.fill();
  ctx.restore();

  const tiltPx = (handSway * .18) | 0;
  drawHand(cx-105+tiltPx, by-68, false);
  drawHand(cx+109-tiltPx, by-68, true);
}

function drawHand(cx,cy,right) {
  const fl = right ? 1 : -1;
  pr(cx-14,cy-2,28,20,P.skin);pr(cx-12,cy-2,24,6,'#f5d9b0');
  for(let f=0;f<4;f++){pr(cx-10+f*7,cy-16,5,17,P.skin);pr(cx-10+f*7,cy-16,5,4,'#e8c090');}
  pr(cx+fl*14,cy+2,10,14,P.skin);pr(cx+fl*14,cy+2,10,3,'#f5d9b0');
}

/* HUD (Barra d'energia, punts, velocitat, avís de perill)*/
function drawHUD() {
  pr(0,0,W,60,'rgba(0,0,0,.92)');pr(0,58,W,2,P.or);

  // Barra de salut
  pr(8,8,162,22,'#111');
  const hP=health/100, hC=health>60?'#00ee00':health>30?'#eeee00':'#ee2200';
  ctx.globalAlpha=health<30?(.5+.5*Math.sin(Date.now()*.012)):1;
  pr(8,8,Math.max(0,162*hP),22,hC);ctx.globalAlpha=1;
  for(let i=1;i<10;i++)pr(8+162/10*i,8,1,22,'rgba(0,0,0,.45)');
  pr(8,8,162,2,'rgba(255,255,255,.14)');
  ctx.font="6px 'Press Start 2P'";ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillStyle='rgba(255,255,255,.82)';ctx.fillText('ENERGIA',12,11);

  // Puntuació
  pt('PUNTS',W/2,5,6,'#999','center');
  pt(String(score).padStart(6,'0'),W/2,16,12,P.yw,'center');

  // Velocitat
  pt('VEL',W-10,5,6,'#999','right');
  pt(Math.floor(pl.speed*10)+'km/h',W-10,17,8,'#00ccff','right');

  // Stats
  pt('✓'+S.dc,W-12,40,7,P.gn,'right');
  pt('✗'+S.da,W-60,40,7,'#ff8888','right');
  pt(Math.floor(dist)+'m',10,40,7,'#8888ff','left');
  pt('⏱'+Math.floor(gTime/1000)+'s',W/2,40,6,'#aaaacc','center');

  // Indicador de carril + avís de perill
  const liY=H-28;
  [-1,0,1].forEach(ln=>{
    const lx=W/2+ln*22;
    const warn=laneHasDanger(ln);
    const active=Math.round(pl.laneVis)===ln;
    pr(lx-8,liY, 16,11, active?P.or:warn?'#aa0000':'#1a1a1a');
    if(active)pr(lx-3,liY-5,6,5,P.or);
    if(warn&&!active){
      // Icona d'exclamació de perill
      ctx.font="8px 'Press Start 2P'";ctx.fillStyle='#ff4400';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('!',(lx)|0,(liY+5)|0);
    }
  });

  // Indicador de fase (part inferior dreta)
  if(phase>0){
    const phCol=curPhase().col;
    ctx.font="5px 'Press Start 2P'";ctx.fillStyle=phCol;
    ctx.textAlign='right';ctx.textBaseline='bottom';
    ctx.fillText('FASE '+phase,W-10,H-5);
  }

  // Alerta visual
  if(alertTimer>0){
    const a=clamp(alertTimer/800,0,1);ctx.globalAlpha=a;
    const ay=H*.40;
    pr(W/2-200,ay-28,400,56,'rgba(0,0,0,.88)');
    pr(W/2-200,ay-28,400,3,alertCol);pr(W/2-200,ay+25,400,3,alertCol);
    pt(alertMsg,W/2,ay-13,8,alertCol,'center');
    ctx.globalAlpha=1;alertTimer-=16;
  }

  // Missatge de fase actual (objectiu)
  if(phase>0&&alertTimer<=0){
    const ob=curPhase().obj;
    ctx.font="5px 'Press Start 2P'";
    ctx.textAlign='center';ctx.textBaseline='bottom';
    ctx.fillStyle='rgba(180,180,100,0.5)';
    ctx.fillText(ob,W/2,H-6);
  }
}

/* Retorna true si hi ha un obstacle en el carril ln que s'apropa */
function laneHasDanger(ln) {
  return obs.some(o => o.lane === ln && o.depth > 0.38 && o.depth < 0.72);
}

/*TUTORIAL (capa informativa durant la Fase 0)*/
let tutoStep = 0;  // 0=accelerar, 1=frenar, 2=canviar carril, 3=completat
let tutoCheck = { up:false, down:false, lane:false };

function drawTutorial() {
  const tips = [
    { key:'↑', desc:'Mantén ↑ per ACCELERAR', done:tutoCheck.up },
    { key:'↓', desc:'Prem ↓ per FRENAR',      done:tutoCheck.down },
    { key:'←→', desc:'← → per CANVIAR DE CARRIL', done:tutoCheck.lane },
  ];
  const bx=10, by=68, bw=W-20;
  pr(bx,by, bw,78,'rgba(0,0,30,.88)');
  pr(bx,by, bw,3,P.or);
  ctx.font="6px 'Press Start 2P'";ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillStyle=P.or;ctx.fillText('🎮  TUTORIAL – APRÈN ELS CONTROLS',bx+8,by+7);
  tips.forEach((t,i)=>{
    const ty=by+22+i*18;
    const done=t.done;
    ctx.fillStyle=done?P.gn:'#ccccdd';
    ctx.fillText((done?'✓ ':'○ ')+t.desc, bx+8, ty);
  });
  // Parpellejament de la tecla activa
  const activeKey=tips[tutoStep];
  if(activeKey&&!activeKey.done&&Math.floor(Date.now()/400)%2===0){
    ctx.font="8px 'Press Start 2P'";ctx.fillStyle=P.yw;ctx.textAlign='right';ctx.textBaseline='bottom';
    ctx.fillText('PREM '+activeKey.key,bw-4,by+78);
  }
}

/* PANTALLA D'INTRO DE FASE
   Apareix 5 s en entrar en cada nova fase. El joc s'atura.*/
function drawPhaseIntro() {
  const ph = curPhase();
  phaseInTimer -= 16;
  if (phaseInTimer <= 0) { st = GS.PLAY; return; }

  renderScene();
  ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(0,0,W,H);

  const pw=420,ph_h=320,px=(W-pw)/2,py=(H-ph_h)/2;
  // Marc
  pr(px-6,py-6,pw+12,ph_h+12,ph.col);
  pr(px-4,py-4,pw+8,ph_h+8,P.bk);
  pr(px,py,pw,ph_h,'#00001a');
  pr(px,py,pw,3,ph.col);
  // CRT scanlines
  ctx.fillStyle='rgba(0,0,60,.08)';
  for(let sy=py;sy<py+ph_h;sy+=3)ctx.fillRect(px,sy,pw,2);

  // Icona i títol
  ctx.font='40px serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(ph.icon,W/2,(py+44)|0);
  pt(ph.title,W/2,py+70,8,ph.col,'center');

  // Línies explicatives
  ctx.font="7px 'Press Start 2P'";ctx.fillStyle='#ccccdd';ctx.textAlign='center';ctx.textBaseline='top';
  ph.intro.forEach((l,i)=>ctx.fillText(l,W/2,py+98+i*20));

  // Objectiu
  pr(px+12,py+ph_h-86,pw-24,38,'rgba(0,0,0,.6)');
  pr(px+12,py+ph_h-86,pw-24,3,ph.col);
  ctx.font="7px 'Press Start 2P'";ctx.fillStyle=ph.col;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('OBJECTIU: '+ph.obj,W/2,(py+ph_h-67)|0);

  // Barra de compte enrere
  const progress=clamp(phaseInTimer/5000,0,1);
  pr(px+12,py+ph_h-36,pw-24,16,'#111133');
  pr(px+12,py+ph_h-36,(pw-24)*progress,16,ph.col);
  ctx.font="6px 'Press Start 2P'";ctx.fillStyle='rgba(255,255,255,.6)';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('Comença en...',(W/2)|0,(py+ph_h-28)|0);
}

/*   POPUP DE DISTRACCIÓ (C/V)*/
function drawDistrPopup() {
  if (!distrPopup) return;
  distrAnimT=Math.min(1,distrAnimT+.09);
  ctx.fillStyle='rgba(0,0,0,.78)';ctx.fillRect(0,0,W,H);
  ctx.globalAlpha=distrAnimT;ctx.save();
  const sc=.60+.40*distrAnimT;
  ctx.translate(W/2,H/2);ctx.scale(sc,sc);ctx.translate(-W/2,-H/2);
  const pw=376,ph=310,px=(W-pw)/2,py=(H-ph)/2;
  const bc=Math.floor(Date.now()/200)%2===0?P.or:P.yw;
  pr(px-6,py-6,pw+12,ph+12,bc);pr(px-4,py-4,pw+8,ph+8,P.bk);pr(px,py,pw,ph,'#00001e');
  ctx.fillStyle='rgba(0,0,80,.06)';for(let sy=py;sy<py+ph;sy+=4)ctx.fillRect(px,sy,pw,2);
  pr(px,py,pw,38,'#160d00');pr(px,py,pw,3,P.or);
  ctx.font='28px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(distrPopup.icon,(px+38)|0,(py+19)|0);
  pt(distrPopup.title,W/2+12,py+10,9,P.or,'center');
  ctx.font="7px 'Press Start 2P'";ctx.fillStyle=P.wh;ctx.textAlign='center';ctx.textBaseline='top';
  distrPopup.lines.forEach((l,i)=>ctx.fillText(l,W/2,py+52+i*17));
  // Botó C
  const bY=py+ph-108,bH=48;
  pr(px+10,bY,164,bH,'#002600');pr(px+12,bY+2,160,bH-4,'#004000');pr(px+12,bY+2,160,8,'#006000');
  ctx.fillStyle=P.gn;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font="7px 'Press Start 2P'";
  ctx.fillText('[C]',(px+46)|0,(bY+18)|0);ctx.fillStyle='#aaffaa';ctx.fillText(distrPopup.cancel,(px+108)|0,(bY+18)|0);
  // Botó V
  pr(px+pw-174,bY,164,bH,'#260000');pr(px+pw-172,bY+2,160,bH-4,'#400000');pr(px+pw-172,bY+2,160,8,'#600000');
  ctx.fillStyle='#ff6666';ctx.font="7px 'Press Start 2P'";
  ctx.fillText('[V]',(px+pw-138)|0,(bY+18)|0);ctx.fillStyle='#ffaaaa';ctx.fillText(distrPopup.accept,(px+pw-78)|0,(bY+18)|0);
  // Missatge educatiu
  ctx.font="5.5px 'Press Start 2P'";ctx.fillStyle='rgba(180,180,100,.72)';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText(distrPopup.edu?.split('\n')[0]||'',W/2,py+ph-26);
  if(Math.floor(Date.now()/520)%2===0){
    ctx.fillStyle='rgba(255,220,0,.88)';ctx.font="6px 'Press Start 2P'";
    ctx.fillText('< PREM C o V >',W/2,py+ph-14);
  }
  ctx.restore();ctx.globalAlpha=1;
}

/* POPUP D'ERROR AMB GRÀFIC DIDÀCTIC ANIMAT
   Mostra les causes d'accidents per reforçar l'aprenentatge.*/
function drawErrPopup() {
  if (!errPopup) return;
  errAnimT =Math.min(1,errAnimT +.07);
  errChartT=Math.min(1,errChartT+.020);
  ctx.fillStyle='rgba(0,0,0,.90)';ctx.fillRect(0,0,W,H);
  ctx.globalAlpha=errAnimT;ctx.save();
  const sc=.55+.45*errAnimT;ctx.translate(W/2,H/2);ctx.scale(sc,sc);ctx.translate(-W/2,-H/2);
  const pw=444,ph=464,px=(W-pw)/2,py=(H-ph)/2;
  const flashC=Math.floor(Date.now()/320)%2===0?errPopup.col:'#440000';
  pr(px-8,py-8,pw+16,ph+16,flashC);pr(px-4,py-4,pw+8,ph+8,P.bk);pr(px,py,pw,ph,'#000014');
  ctx.fillStyle='rgba(0,0,60,.07)';for(let sy=py;sy<py+ph;sy+=3)ctx.fillRect(px,sy,pw,2);
  // Capçalera
  pr(px,py,pw,50,'#0a0008');pr(px,py,pw,4,errPopup.col);
  ctx.font='32px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(errPopup.icon,(px+40)|0,(py+25)|0);
  pt(errPopup.title,W/2+16,py+13,9,errPopup.col,'center');
  // Text educatiu
  ctx.font="6px 'Press Start 2P'";ctx.fillStyle='#ccccdd';ctx.textAlign='center';ctx.textBaseline='top';
  errPopup.lines.forEach((l,i)=>ctx.fillText(l,W/2,py+58+i*14));
  // ── Gràfic de barres animat ────────────────────────────────
  const gX=px+18,gY=py+122,gW=pw-36,gH=152;
  pr(gX,gY,gW,gH,'#070716');pr(gX,gY,gW,2,'#333355');
  ctx.font="5px 'Press Start 2P'";ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillStyle='#8888aa';ctx.fillText('CAUSES D\'ACCIDENTS EN PATINET (%)',gX+4,gY+4);
  const barH=20,barGap=4,barY0=gY+18,maxW=gW-84;
  CHART.forEach((d,i)=>{
    const by=barY0+i*(barH+barGap);
    const isHL=d.label===errPopup.hl;
    const curW=d.pct/100*maxW*errChartT;
    pr(gX+78,by,maxW,barH,'#0e0e22');
    pr(gX+78,by,curW,barH,isHL?d.col:'#2a2a6a');
    if(isHL&&curW>3){
      pr(gX+78,by,curW,5,'rgba(255,255,255,.2)');
      ctx.shadowColor=d.col;ctx.shadowBlur=10;
      ctx.fillStyle=`rgba(${hexRgb(d.col)},0.28)`;ctx.fillRect((gX+78)|0,by|0,curW|0,barH|0);
      ctx.shadowBlur=0;
    }
    ctx.font=`${isHL?6:5}px 'Press Start 2P'`;
    ctx.fillStyle=isHL?d.col:'#7777aa';ctx.textAlign='right';ctx.textBaseline='middle';
    ctx.fillText(d.label,(gX+74)|0,(by+barH/2)|0);
    if(errChartT>.5){ctx.fillStyle=isHL?'#fff':'#5566aa';ctx.textAlign='left';ctx.fillText(d.pct+'%',(gX+82+curW)|0,(by+barH/2)|0);}
  });
  // Consell
  const tipY=gY+gH+8;
  pr(px+10,tipY,pw-20,52,'#001400');pr(px+10,tipY,pw-20,3,'#00aa44');
  ctx.font="6px 'Press Start 2P'";ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillStyle='#00ff88';ctx.fillText('💡  '+errPopup.tip.split('\n')[0],W/2,tipY+8);
  if(errPopup.tip.includes('\n')){ctx.fillStyle='#88ffaa';ctx.fillText(errPopup.tip.split('\n')[1],W/2,tipY+24);}
  // Botó continuar
  const contY=tipY+58;
  const bp=Math.floor(Date.now()/520)%2===0;
  pr(W/2-136,contY,272,48,bp?P.or:P.orD);pr(W/2-134,contY+2,268,44,bp?'#ff8800':'#882200');pr(W/2-134,contY+2,268,14,bp?'#ffaa44':'#aa3300');
  ctx.font="8px 'Press Start 2P'";ctx.fillStyle=P.wh;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('CONTINUAR',W/2,(contY+22)|0);
  ctx.font="6px 'Press Start 2P'";ctx.fillStyle='#777';ctx.fillText('[ENTER / ESPAI]',W/2,(contY+38)|0);
  ctx.restore();ctx.globalAlpha=1;
}

function hexRgb(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

/* TEXTOS FLOTANTS (punts, fites)*/
const floatFn = [];  // funcions de dibuix de floats actius

function drawFloats() {
  floats=floats.filter(f=>{
    ctx.globalAlpha=clamp(f.t/1600,0,1);
    pt(f.text,f.x,f.y,f.sz||10,f.col,'center');
    ctx.globalAlpha=1;f.y-=.55;f.t-=16;return f.t>0;
  });
}

function addFloat(txt,x,y,col,sz=10){floats.push({text:txt,x,y,col,t:1600,sz});}
function showAlert(msg,col){alertMsg=msg;alertTimer=3000;alertCol=col||P.gn;}

/* Fites de distància */
const MILE_MSG = [30,60,100,150,200,300,400,500];
function checkMilestones(){
  MILE_MSG.forEach(m=>{
    if(!milestones.has(m)&&dist>=m){
      milestones.add(m);
      score+=25;
      showAlert('🏁 '+m+'m RECORREGUTS! +25',P.yw);
      addFloat('+25  🏁',W/2,H*.45,P.yw,11);
      playSfx('win',0.5);
    }
  });
}

/*     PANTALLES DE MENÚ, COMPTE ENRERE I GAME OVER */
function drawMenu() {
  drawSky();drawBuildings();drawRoadSurface();drawLaneLines();drawHandlebars(0);
  ctx.fillStyle='rgba(0,0,18,.72)';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(0,0,0,.12)';for(let y=0;y<H;y+=3)ctx.fillRect(0,y,W,1);
  // Títol
  const g=.45+.55*Math.sin(Date.now()*.0028);
  ctx.shadowColor=P.or;ctx.shadowBlur=22*g;
  pr(W/2-204,42,408,100,P.or);pr(W/2-200,46,400,92,'#000016');ctx.shadowBlur=0;
  ctx.font="22px 'Press Start 2P'";ctx.fillStyle=P.or;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.shadowColor=P.or;ctx.shadowBlur=18*g;ctx.fillText('Ves amb compte!',W/2,82);ctx.shadowBlur=0;
  ctx.font="7px 'Press Start 2P'";ctx.fillStyle=P.yw;ctx.fillText('Juga amb Seguretat al Carrer!',W/2,112);
  // Panell de controls
  pr(W/2-184,155,368,278,'rgba(0,0,42,.95)');pr(W/2-184,155,368,4,P.or);
  ctx.textBaseline='top';
  [
    ['← →   Canvia de carril',             '#aaffaa'],
    ['↑      Accelera',                     '#aaffaa'],
    ['↓      Frena',                        '#aaffaa'],
    ['C      Cancel·la distracció',         P.gn    ],
    ['V      Accepta distracció (perill!)', '#ff8888'],
    ['',                                    ''],
    ['🚗  Esquiva els cotxes!',             '#ffaa44'],
    ['🚦  Semàfor vermell = FRENA!',        P.yw    ],
    ['🦓  Pas de zebra = CEDEIX PAS!',      '#ffaaff'],
    ['📱  Ignora el mòbil!',               '#88aaff'],
    ['🏁  Fites de distància = BONUS!',    P.yw    ],
  ].forEach(([t,c],i)=>{
    if(t)pt(t,W/2,168+i*22,7,c,'center','top');
  });
  // Botó
  const bp=Math.floor(Date.now()/520)%2===0;
  pr(W/2-154,452,308,60,bp?P.or:P.orD);pr(W/2-152,454,304,56,bp?'#ff8800':'#992200');pr(W/2-152,454,304,15,bp?'#ffaa44':'#bb4400');
  ctx.font="11px 'Press Start 2P'";ctx.fillStyle=P.wh;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('PREM ENTER',W/2,482);
  ctx.font="6px 'Press Start 2P'";ctx.fillStyle='#222240';ctx.fillText('Educació vial · Seguretat en patinet',W/2,528);
}

function drawCountdown() {
  drawSky();drawBuildings();drawRoadSurface();drawLaneLines();drawHandlebars(0);
  const elapsed=3500-cdTimer;
  const num=elapsed<1000?3:elapsed<2000?2:elapsed<3000?1:0;
  const ph=(elapsed%1000)/1000;
  pr(W/2-192,H/2-74,384,122,P.or);pr(W/2-188,H/2-70,376,114,'#000016');
  if(num>0){
    ctx.save();ctx.translate(W/2,H/2-18);ctx.scale(1.7-.7*ph,1.7-.7*ph);
    ctx.globalAlpha=Math.max(0,1-ph*.4);
    ctx.font="58px 'Press Start 2P'";ctx.fillStyle=P.or;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor=P.or;ctx.shadowBlur=28;ctx.fillText(num,0,0);
    ctx.restore();ctx.globalAlpha=1;ctx.shadowBlur=0;
  } else {
    ctx.font="14px 'Press Start 2P'";ctx.fillStyle=P.gn;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor=P.gn;ctx.shadowBlur=24;ctx.fillText('ENDAVANT!',W/2,H/2-18);ctx.shadowBlur=0;
  }
  ctx.font="7px 'Press Start 2P'";ctx.fillStyle='#888';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText("Comencem pel tutorial. Aprèn els controls!",W/2,H/2+62);
}

function drawGameOver() {
  drawSky();drawBuildings();drawRoadSurface();drawLaneLines();drawHandlebars(0);
  ctx.fillStyle='rgba(0,0,0,.85)';ctx.fillRect(0,0,W,H);
  pr(W/2-206,H/2-254,412,492,'#cc0000');pr(W/2-202,H/2-250,404,484,'#000018');pr(W/2-202,H/2-250,404,8,'#200000');
  ctx.font="17px 'Press Start 2P'";ctx.fillStyle='#ff2200';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.shadowColor='#ff0000';ctx.shadowBlur=18;ctx.fillText('GAME OVER',W/2,H/2-238);ctx.shadowBlur=0;
  pr(W/2-168,H/2-204,336,48,'#111136');
  pt('PUNTUACIÓ FINAL',W/2,H/2-198,7,'#999','center');
  pt(String(score).padStart(6,'0'),W/2,H/2-182,16,P.yw,'center');
  const rows=[
    ['Distància:',         Math.floor(dist)+'m','#aaaaff'],
    ['Fase assolida:',     'Fase '+phase,       '#88ccff'],
    ['Distr. cancel·les:', S.dc,                P.gn    ],
    ['Distr. acceptades:', S.da,                '#ff7777'],
    ['Col·lisions:',       S.col,               '#ff5555'],
    ['Esquivats:',         S.dod,               '#88ff88'],
    ['Semàfors ok:',       S.lr,                P.gn    ],
    ['Zebres ok:',         S.zr,                '#ffaaff'],
  ];
  ctx.font="7px 'Press Start 2P'";ctx.textBaseline='top';
  rows.forEach(([l,v,c],i)=>{
    ctx.fillStyle='#44446a';ctx.textAlign='left';ctx.fillText(l,(W/2-162)|0,(H/2-140+i*22)|0);
    ctx.fillStyle=c;ctx.textAlign='right';ctx.fillText(String(v),(W/2+162)|0,(H/2-140+i*22)|0);
  });
  // Missatge final adaptat al rendiment
  let edu;
  if(phase>=4&&S.da<=1)    edu=['Molt bé!','Conductor model! 🏆'];
  else if(S.da>=3)         edu=['Les distraccions son perilloses!','Prem sempre C quan surti el mòbil!'];
  else if(S.col>=3)        edu=['Mira al davant!','Anticipa els obstacles des de lluny.'];
  else if(S.li>=2)         edu=['Respecta els semàfors!','Frena (↓) quan vegis vermell o groc.'];
  else                     edu=['Practica i milloraràs!','La seguretat vial salva vides.'];
  pr(W/2-166,H/2+44,332,68,'#001200');pr(W/2-166,H/2+44,332,4,'#00aa44');
  ctx.font="7px 'Press Start 2P'";ctx.textAlign='center';ctx.textBaseline='top';
  edu.forEach((l,i)=>{ctx.fillStyle=i===0?'#00ff88':'#77ffaa';ctx.fillText(l,W/2,(H/2+52+i*24)|0);});
  const bp=Math.floor(Date.now()/520)%2===0;
  pr(W/2-140,H/2+132,280,52,bp?P.or:P.orD);pr(W/2-138,H/2+134,276,48,bp?'#ff8800':'#882200');
  ctx.font="9px 'Press Start 2P'";ctx.fillStyle=P.wh;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('TORNA A JUGAR',W/2,(H/2+158)|0);
  ctx.font="6px 'Press Start 2P'";ctx.fillStyle='#777';ctx.fillText('[ENTER]',W/2,(H/2+172)|0);
}

/* LÒGICA D'ACTUALITZACIÓ */
function updatePlayer(dt) {
  if(keys['ArrowUp'])   pl.speed=Math.min(5.0,pl.speed+dt*.0018);
  else if(keys['ArrowDown'])pl.speed=Math.max(.05,pl.speed-dt*.0035);
  else pl.speed+=(pl.baseSpd-pl.speed)*dt*.0009;
  // Suavitzar posició visual de carril
  pl.laneVis+=(pl.lane-pl.laneVis)*Math.min(1,dt*.010);
  // Punt de fuga: es desplaça amb el canvi de carril → perspectiva animada
  vpX+=(W/2-pl.laneVis*60-vpX)*Math.min(1,dt*.013);
  roadOff=(roadOff+pl.speed*dt*.000062)%1;
  dist+=pl.speed*dt*.012;
  if(lCooldown>0)lCooldown-=dt;

  // Progressió tutorial
  if(st===GS.TUTO||st===GS.PLAY){
    if(keys['ArrowUp']  &&!tutoCheck.up  ){tutoCheck.up=true;  showAlert('✓ Accelerant!',P.gn);}
    if(keys['ArrowDown']&&!tutoCheck.down){tutoCheck.down=true;showAlert('✓ Frenant!',P.gn);}
    if(pl.lane!==0      &&!tutoCheck.lane){tutoCheck.lane=true;showAlert('✓ Carril canviat!',P.gn);}
    tutoStep=[tutoCheck.up,tutoCheck.down,tutoCheck.lane].filter(Boolean).length;
  }
}

function updateObs(dt) {
  const mv=pl.speed*dt*.00042;
  const ph=curPhase();
  obsTimer+=dt;
  if(obsTimer>=nextObs){
    const active=obs.filter(o=>!o.passed).length;
    if(active<ph.obsCount) spawnObs();
    obsTimer=0;nextObs=ph.obsInterval+Math.random()*1200;
  }
  obs=obs.filter(o=>{
    o.depth+=mv;
    if(!o.passed&&o.depth>=.84){
      o.passed=true;
      const diff=Math.abs(pl.laneVis-o.lane);
      if(diff<0.46){
        // COL·LISIÓ
        health=clamp(health-o.def.dmg,0,100);
        score=Math.max(0,score-5);S.col++;
        shakeX=7;shakeY=5;flickT=30;
        playSfx('hit');
        openErrPopup('collision');
        addFloat('-'+o.def.dmg+'❤',lX(o.lane,.9),rY(.7),'#ff4444');
        if(health<=0)triggerGO();
      } else {
        S.dod++;score+=o.def.pts;
        addFloat('+'+o.def.pts,lX(o.lane,.86),rY(.73),P.gn);
        if(S.dod%5===0)showAlert('✓ Gran esquivament!',P.gn);
      }
    }
    return o.depth<1.14;
  });
}

function updateLights(dt) {
  const mv=pl.speed*dt*.00042;
  lightTimer+=dt;
  if(lightTimer>=nextLight){spawnLight();lightTimer=0;nextLight=15000+Math.random()*9000;}
  lights=lights.filter(tl=>{
    tl.depth+=mv;tl.elapsed+=dt;
    if(tl.state==='green' &&tl.elapsed>4200)tl.state='yellow';
    if(tl.state==='yellow'&&tl.elapsed>5400)tl.state='red';
    if(tl.state==='red'   &&tl.elapsed>9000){tl.state='green';tl.elapsed=0;}
    if(!tl.passed&&tl.depth>=.80){
      tl.passed=true;
      if(tl.state==='red'){
        if(pl.speed<0.6){score+=30;S.lr++;showAlert('🚦 Semàfor respectat! +30',P.gn);addFloat('+30',W/2,rY(.76),P.gn);playSfx('win',0.4);}
        else{health=clamp(health-14,0,100);score=Math.max(0,score-20);S.li++;flickT=18;openErrPopup('redlight');addFloat('-20',W/2,rY(.76),'#ff4444');playSfx('hit');if(health<=0)triggerGO();}
      } else if(tl.state==='green'){score+=5;addFloat('+5',W/2,rY(.76),P.gn);}
    }
    return tl.depth<1.2;
  });
}

function updateZebras(dt) {
  const mv=pl.speed*dt*.00042;
  zebraTimer+=dt;
  if(zebraTimer>=nextZebra){spawnZebra();zebraTimer=0;nextZebra=12000+Math.random()*8000;}
  zebras=zebras.filter(zb=>{
    zb.depth+=mv;
    if(!zb.passed&&zb.depth>=.80){
      zb.passed=true;
      if(zb.hasPed){
        if(pl.speed<0.9){score+=20;S.zr++;showAlert('🦓 Pas de zebra respectat! +20','#ffaaff');addFloat('+20',W/2,rY(.76),'#ffaaff');playSfx('win',0.4);}
        else{health=clamp(health-18,0,100);score=Math.max(0,score-15);S.zi++;flickT=22;openErrPopup('zebra');addFloat('-15',W/2,rY(.76),'#ff4444');playSfx('hit');if(health<=0)triggerGO();}
      } else {if(pl.speed<1.1){score+=8;addFloat('+8',W/2,rY(.75),'#ffccff');}}
    }
    return zb.depth<1.2;
  });
}

function updatePopTimer(dt) {
  popTimer+=dt;
  if(popTimer>=nextPop){spawnPop();popTimer=0;nextPop=9000+Math.random()*5000;}
}

/*SPAWN D'ELEMENTS*/
function spawnObs() {
  const ph=curPhase();
  if(ph.obsTypes.length===0) return;
  let lane=[-1,0,1][Math.floor(Math.random()*3)];
  // Evitar obstàcles massa seguits al mateix carril
  if(obs.filter(o=>o.lane===lane&&o.depth<.22).length){
    const alt=[-1,0,1].filter(l=>l!==lane);
    lane=alt[Math.floor(Math.random()*2)];
  }
  const id=ph.obsTypes[Math.floor(Math.random()*ph.obsTypes.length)];
  const def=OBS_DEF.find(d=>d.id===id)||OBS_DEF[0];
  obs.push({def,lane,depth:.02,passed:false});
}

function spawnLight() {
  lights.push({state:Math.random()>.45?'red':'green',depth:.02,elapsed:0,passed:false});
}

function spawnZebra() {
  zebras.push({depth:.02,hasPed:Math.random()>.32,pedSide:Math.random()>.5?0:1,passed:false});
}

function spawnPop() {
  distrPopup={...POPS[Math.floor(Math.random()*POPS.length)]};distrAnimT=0;st=GS.POPUP;
}

/*GESTIÓ DE POPUPS D'ERROR I DISTRACCIÓ*/
function openErrPopup(type){errPopup=ERR_DEF[type];errAnimT=0;errChartT=0;st=GS.ERROR;}

function resolveDistr(accept) {
  if(!distrPopup) return;
  if(!accept){
    S.dc++;score+=15;showAlert('✓ '+distrPopup.bon,P.gn);addFloat('+15',W/2,H*.4,P.gn);
  } else {
    S.da++;health=clamp(health-15,0,100);score=Math.max(0,score-10);
    flickT=22;showAlert('✗ '+distrPopup.pen,'#ff4400');addFloat('-10 ❤',W/2,H*.4,'#ff4444');
    playSfx('hit',0.5);
    if(health<=0){distrPopup=null;triggerGO();return;}
    // Mostrar popup d'error educatiu després d'acceptar distracció
    distrPopup=null;openErrPopup('distraction');return;
  }
  distrPopup=null;st=GS.PLAY;
}

function resolveErr() {errPopup=null; if(health>0)st=GS.PLAY; else triggerGO();}

function triggerGO() {st=GS.GO;stopBg();playSfx('lose');}

/* 
  RESET I INICI
  */

function resetGame() {
  st=GS.CD;cdTimer=3500;
  score=0;health=100;dist=0;gTime=0;phase=0;phaseTimer=0;phaseInTimer=0;
  pl.lane=0;pl.laneVis=0;pl.speed=1.1;pl.baseSpd=1.1;vpX=W/2;
  obs=[];lights=[];zebras=[];floats=[];distrPopup=null;errPopup=null;
  obsTimer=0;nextObs=5000;lightTimer=0;nextLight=99999;zebraTimer=0;nextZebra=99999;
  popTimer=0;nextPop=99999;lCooldown=0;shakeX=0;shakeY=0;flickT=0;
  alertMsg='';alertTimer=0;roadOff=0;milestones.clear();
  tutoCheck={up:false,down:false,lane:false};tutoStep=0;
  Object.keys(S).forEach(k=>S[k]=0);
  applyPhase();
  playBg();
}

/* INPUT*/
const keys = {};

document.addEventListener('keydown', e => {
  keys[e.key] = true;
  // Canvi de carril suau
  if((e.key==='ArrowLeft'||e.key==='a'||e.key==='A')&&lCooldown<=0&&(st===GS.PLAY||st===GS.TUTO)){
    if(pl.lane>-1){pl.lane--;lCooldown=210;}
  }
  if((e.key==='ArrowRight'||e.key==='d'||e.key==='D')&&lCooldown<=0&&(st===GS.PLAY||st===GS.TUTO)){
    if(pl.lane<1){pl.lane++;lCooldown=210;}
  }
  // Popup distracció
  if(st===GS.POPUP){
    if(e.key==='c'||e.key==='C')resolveDistr(false);
    if(e.key==='v'||e.key==='V')resolveDistr(true);
  }
  // Popup error (continuar)
  if(st===GS.ERROR&&(e.key==='Enter'||e.key===' '))resolveErr();
  // Menú i game over
  if(e.key==='Enter'||e.key===' '){
    if(st===GS.MENU)resetGame();
    if(st===GS.GO)  resetGame();
  }
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

/* 
RENDERITZAT D'ESCENA
*/

function renderScene() {
  const handSway = -(pl.lane - pl.laneVis) * 30;
  drawSky();
  drawBuildings();
  drawRoadSurface();
  drawLaneLines();
  // Zebres (de lluny a prop)
  zebras.slice().sort((a,b)=>a.depth-b.depth).forEach(drawZebraCrossing);
  // Semàfors
  lights.forEach(drawTrafficLight);
  // Obstacles (de lluny a prop → z-ordering correcte)
  obs.slice().sort((a,b)=>a.depth-b.depth).forEach(o=>o.def.drawFn(lX(o.lane,o.depth),rY(o.depth),dSc(o.depth)));
  // Primer pla: manillar i mans
  drawHandlebars(handSway);
  drawFloats();
}

/*BUCLE PRINCIPAL*/
function loop(ts) {
  const dt = Math.min(ts - lastTs, 50);
  lastTs = ts;
  gTime += dt;
  ctx.clearRect(0, 0, W, H);

  // Efecte de pantalla en col·lisió
  let saved = false;
  if(shakeX>0||shakeY>0){
    ctx.save();
    ctx.translate(((Math.random()-.5)*shakeX*1.6)|0,((Math.random()-.5)*shakeY*1.6)|0);
    shakeX=Math.max(0,shakeX-.65);shakeY=Math.max(0,shakeY-.65);
    saved=true;
  }

  // Màquina d'estats 
  switch(st) {

    case GS.MENU:
      drawMenu();
      break;

    case GS.CD:
      cdTimer-=dt;
      drawCountdown();
      if(cdTimer<=-500){ st=GS.TUTO; phaseInTimer=0; }
      break;

    case GS.TUTO:
      //Tutorial del joc 
      updatePlayer(dt);
      checkPhaseUp(dt);
      renderScene();
      drawHUD();
      drawTutorial();
      if(phase>0){ st=GS.PHASE_IN; phaseInTimer=5000; }
      break;

    case GS.PLAY:
      updatePlayer(dt);
      updateObs(dt);
      updateLights(dt);
      updateZebras(dt);
      updatePopTimer(dt);
      checkPhaseUp(dt);
      checkMilestones();
      renderScene();
      drawHUD();
      break;

    case GS.PHASE_IN:
      drawPhaseIntro();
      drawHUD();
      if(phaseInTimer<=0) st=GS.PLAY;
      break;

    case GS.POPUP:
      roadOff=(roadOff+.28*dt*.000062)%1;
      renderScene();drawHUD();drawDistrPopup();
      break;

    case GS.ERROR:
      renderScene();drawHUD();drawErrPopup();
      break;

    case GS.GO:
      drawGameOver();
      break;
  }

  // Parpelleig vermell en error/col·lisió
  if(flickT>0){
    ctx.fillStyle=`rgba(255,0,0,${flickT/30*.44})`;
    ctx.fillRect(0,0,W,H);flickT--;
  }

  if(saved) ctx.restore();
  requestAnimationFrame(loop);
}

/* Arrencada */
loadImages(() => {
  loadAudio();
  st = GS.MENU;
  requestAnimationFrame(loop);
});