// =====================
// Variables generals
// =====================
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const startBtn = document.getElementById("start-btn");
const alertContainer = document.getElementById("alert-container");
const alertText = document.getElementById("alert-text");

let gameRunning = false;
let score = 0;
let speed = 2;
const maxSpeed = 6;
let distance = 0;
const destination = 2000;

let keys = {};
let currentDistraction = null;
let distractionTimer = null;
let blurEffect = false;
let trafficLight = { active: false, stopDistance: 500 };

// =====================
// Player
// =====================
const player = {
  x: canvas.width / 2 - 25,
  y: canvas.height - 120,
  width: 50,
  height: 80,
  velocityX: 0,
  sprite: new Image()
};
player.sprite.src = "../img/personatge_principal.png";

// =====================
// Obstacles / Distraccions
// =====================
const distractions = [];
const distractionSprites = [
  "../personatge1.png",
  "../personatge2.png",
  "../personatge3.png",
  "../personatge4.png",
  "../personatge5.png"
];
const dangerSprite = new Image();

// =====================
// Fons / Parallax
// =====================
const bgSprites = [];
for (let i = 1; i <= 5; i++) {
  const img = new Image();
  img.src = `../costat${i}.png`;
  bgSprites.push(img);
}
const panorama = new Image();

// =====================
// Control teclat
// =====================
document.addEventListener("keydown", (e) => {
  keys[e.key] = true;

  if (currentDistraction) {
    if (e.key.toLowerCase() === "q") {
      // Evitar distracció
      endDistraction(true);
    } else if (e.key.toLowerCase() === "t") {
      // Caure en distracció
      endDistraction(false);
    }
  }
});

document.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

// =====================
// Iniciar joc
// =====================
startBtn.addEventListener("click", () => {
  if (!gameRunning) startGame();
});

// =====================
// Funcions de joc
// =====================
function startGame() {
  gameRunning = true;
  score = 0;
  distance = 0;
  speed = 2;
  alertContainer.classList.add("hidden");
  startBtn.style.display = "none";
  requestAnimationFrame(gameLoop);
  scheduleDistraction();
}

function endGame(won = false) {
  gameRunning = false;
  alertContainer.classList.remove("hidden");
  alertText.textContent = won
    ? `Has arribat! 🎉 Punts: ${score}`
    : `Has perdut! Punts: ${score}`;
  startBtn.style.display = "block";
  clearTimeout(distractionTimer);
}

// =====================
// Distraccions
// =====================
function scheduleDistraction() {
  const delay = 3000 + Math.random() * 3000; // 3-6s
  distractionTimer = setTimeout(() => {
    currentDistraction = {
      sprite: new Image(),
      x: Math.random() * (canvas.width - 50),
      y: Math.random() * (canvas.height - 300),
      type: Math.random() > 0.5 ? "vibracio" : "pensament"
    };
    if (currentDistraction.type === "vibracio") {
      currentDistraction.sprite.src = dangerSprite.src;
    } else {
      currentDistraction.sprite.src =
        distractionSprites[Math.floor(Math.random() * distractionSprites.length)];
    }
    alertContainer.classList.remove("hidden");
    alertText.textContent =
      currentDistraction.type === "vibracio"
        ? "Vibració del mòbil! (Q per ignorar / T per agafar)"
        : "Pensament distràctiu! (Q per ignorar / T per seguir pensant)";
  }, delay);
}

function endDistraction(success) {
  if (success) score += 10;
  else {
    if (currentDistraction.type === "pensament") blurEffect = true;
    score -= 5;
  }
  currentDistraction = null;
  alertContainer.classList.add("hidden");
  blurEffect = false;
  scheduleDistraction();
}

// =====================
// Update
// =====================
function update() {
  // Moviment lateral
  if (keys["ArrowLeft"]) player.x -= 5;
  if (keys["ArrowRight"]) player.x += 5;

  // Frena
  if (keys[" "]) speed = Math.max(0, speed - 0.2);
  else speed = Math.min(maxSpeed, speed + 0.05);

  distance += speed;

  // Semàfor
  if (trafficLight.active && distance >= trafficLight.stopDistance && speed > 0) {
    speed = 0;
  }

  // Limitar dins canvas
  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));

  // Comprovar final
  if (distance >= destination) endGame(score >= 100);
  scoreEl.textContent = score;
}

// =====================
// Draw
// =====================
function draw() {
  // Fons
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  bgSprites.forEach((bg, i) => {
    ctx.drawImage(bg, 0, -distance * (0.2 + i * 0.1), canvas.width, canvas.height);
  });

  // Blur si pensant
  if (blurEffect) {
    ctx.filter = "blur(3px)";
  } else {
    ctx.filter = "none";
  }

  // Jugador
  ctx.drawImage(player.sprite, player.x, player.y, player.width, player.height);

  // Distracció
  if (currentDistraction) {
    ctx.drawImage(
      currentDistraction.sprite,
      currentDistraction.x,
      currentDistraction.y,
      50,
      50
    );
  }

  // Semàfor
  if (trafficLight.active) {
    ctx.fillStyle = "red";
    ctx.fillRect(canvas.width - 60, canvas.height / 2 - 40, 40, 80);
  }

  // Minimap
  const mapWidth = 150;
  const mapHeight = 50;
  ctx.fillStyle = "#000";
  ctx.fillRect(canvas.width - mapWidth - 10, 10, mapWidth, mapHeight);
  ctx.drawImage(panorama, canvas.width - mapWidth - 10, 10, mapWidth, mapHeight);
  // Posició jugador al minimapa
  const playerMapX = (distance / destination) * mapWidth;
  ctx.fillStyle = "#0f0";
  ctx.fillRect(canvas.width - mapWidth - 10 + playerMapX - 5, 30, 10, 10);
}

// =====================
// Loop principal
// =====================
function gameLoop() {
  if (!gameRunning) return;
  update();
  draw();
  requestAnimationFrame(gameLoop);
}
