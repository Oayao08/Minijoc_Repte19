const canvas = document.getElementById("game-canvas");
const ctx= canvas.getContext("2d");

const startBtn = document.getElementById("start-btn");
const scoreEl = document.getElementById("score");
const alertContainer = document.getElementById("alert-container");
const alertText = document.getElementById("alert-text");

/*Variables --> Estata del joc*/

let gameRunning = false;
let score = 0;
let speed = 3;
let distractions = [];
let obstacles = [];
let keys = {};
let animationId;

/*Jugador*/

const player = {
    x: canvas.width / 2 - 20,
    y: canvas.height - 90,
    width: 40,
    height: 60,
    speed: 5,
};

console.log("Script carregat correctament");

/*Controls */
window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
});

window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
});

/*Botó START */

startBtn.addEventListener("click", startGame);

/*Iniciar */

function startGame() {
    gameRunning = true;
    score = 0;
    speed = 4;
    obstacles = [];
    distractions = [];
    scoreEl.textContent = score;
    startBtn.style.display = "none";
    loop();
}

/*Bucle del joc */

function loop() {
  animationId = requestAnimationFrame(loop);
  update();
  draw();
}

/*Actualitzar l'estat del joc */
function update() {
  if (!gameRunning) return;

  // Controls
  if (keys["ArrowLeft"]) player.x -= player.speed;
  if (keys["ArrowRight"]) player.x += player.speed;
  if (keys[" "]) speed = 1.5;

   else speed = 3 + score * 0.01;

  // Límites
  player.x = Math.max(40, Math.min(canvas.width - 80, player.x));

  // Obstacles
  obstacles.forEach(o => o.y += speed);
  obstacles = obstacles.filter(o => o.y < canvas.height + 60);

  // Distraccions
  distractions.forEach(d => d.y += speed * 0.7);
  distractions = distractions.filter(d => d.y < canvas.height + 60);

  // Spawn
  if (Math.random() < 0.02) spawnObstacle();
  if (Math.random() < 0.005) spawnDistraction();

  // Col·lisions
  obstacles.forEach(o => {
    if (rectCollision(player, o)) endGame();
  });

  // Puntuació
  score++;
  scoreEl.textContent = score;
}

/*Dibuixar el jocc */

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRoad();
  drawPlayer();
  obstacles.forEach(drawObstacle);
  distractions.forEach(drawDistraction);
}

/*Carretera */

function drawRoad() {
  ctx.fillStyle = "#555";
  ctx.fillRect(100, 0, canvas.width - 200, canvas.height);

  ctx.strokeStyle = "#fff";
  ctx.setLineDash([20, 20]);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* Patinet*/
function drawPlayer() {
  ctx.fillStyle = "#00e676";
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // manillar
  ctx.fillStyle = "#111";
  ctx.fillRect(player.x - 10, player.y + 10, player.width + 20, 6);

  // rodes
  ctx.fillStyle = "#000";
  ctx.fillRect(player.x + 5, player.y + player.height - 8, 10, 8);
  ctx.fillRect(player.x + player.width - 15, player.y + player.height - 8, 10, 8);
}