// ===============================
// CONFIGURACIÓN INICIAL
// ===============================

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const scoreEl = document.getElementById("score");
const alertContainer = document.getElementById("alert-container");
const alertText = document.getElementById("alert-text");

let gameState = "start"; // start | playing | gameover
let score = 0;
let isBraking = false;

// ===============================
// CARGA DE IMÁGENES
// ===============================

const playerImg = new Image();
playerImg.src = "../img/personatge_principal.png";

const pedestriansImgs = [];
for (let i = 1; i <= 5; i++) {
    const img = new Image();
    img.src = `../img/personatge${i}.png`;
    pedestriansImgs.push(img);
}

const sidesImgs = [];
for (let i = 1; i <= 5; i++) {
    const img = new Image();
    img.src = `../img/costat${i}.png`;
    sidesImgs.push(img);
}

// ===============================
// JUGADOR
// ===============================

const player = {
    x: canvas.width / 2 - 30,
    y: canvas.height - 120,
    width: 60,
    height: 60,
    speed: 6
};

// ===============================
// OBSTÁCULOS / PEATONES
// ===============================

let obstacles = [];
let ticks = 0;
let obstacleInterval = 90; // ticks entre obstáculos
let crosswalkInterval = 600; // ticks entre pasos de peatones
let distractions = [];

// ===============================
// ZONA DE PASO DE PEATONES
// ===============================

const crosswalks = []; // cada crosswalk tiene y y estado de peatón cruzando

// ===============================
// CONTROLES
// ===============================

let keys = {};

document.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.code === "Space") isBraking = true;
});

document.addEventListener("keyup", (e) => {
    keys[e.code] = false;
    if (e.code === "Space") isBraking = false;
});

// ===============================
// FUNCIONES DE UPDATE
// ===============================

function updatePlayer() {
    if (keys["ArrowLeft"] && player.x > 0) player.x -= player.speed;
    if (keys["ArrowRight"] && player.x + player.width < canvas.width) player.x += player.speed;
}

function updateObstacles() {
    obstacles.forEach(o => o.y += 4); // velocidad de avance del mundo
    obstacles = obstacles.filter(o => o.y < canvas.height + 60);
}

function updateCrosswalks() {
    crosswalks.forEach(c => {
        // mover peatones dentro del crosswalk
        c.peas.forEach(p => p.y += 4);
    });
}

function spawnObstacle() {
    const type = Math.random() < 0.5 ? "pedestrian" : "side";
    let img;
    if (type === "pedestrian") img = pedestriansImgs[Math.floor(Math.random() * pedestriansImgs.length)];
    else img = sidesImgs[Math.floor(Math.random() * sidesImgs.length)];

    obstacles.push({
        type,
        img,
        x: Math.random() * (canvas.width - 50),
        y: -60,
        width: 50,
        height: 50
    });
}

function spawnCrosswalk() {
    const peas = [];
    const numPeas = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numPeas; i++) {
        const img = pedestriansImgs[Math.floor(Math.random() * pedestriansImgs.length)];
        peas.push({
            img,
            x: 80 + i * 60,
            y: -50,
            width: 50,
            height: 50
        });
    }
    crosswalks.push({ y: -50, peas });
}

// ===============================
// DISTRACCIONES
// ===============================

function spawnDistraction() {
    const messages = [
        "Notificació: WhatsApp!",
        "Notificació: TikTok!",
        "Missatge important!",
        "Recordatori: Fer feina!"
    ];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    distractions.push({ text: msg, ttl: 200 });
}

function updateDistractions() {
    distractions.forEach(d => d.ttl--);
    distractions = distractions.filter(d => d.ttl > 0);
}

// ===============================
// COLISIONES Y REGLAS
// ===============================

function checkCollision(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function checkGameRules() {

    // Obstáculos
    obstacles.forEach(o => {
        if (checkCollision(player, o)) gameOver("Has xocat amb un obstacle!");
    });

    // Crosswalk peatones
    crosswalks.forEach(c => {
        c.peas.forEach(p => {
            if (checkCollision(player, p)) gameOver("Has atropellat un vianant al pas de vianants!");
        });
    });

    // Penalización si no frena en crosswalk
    crosswalks.forEach(c => {
        if (
            player.y < c.y + 60 &&
            player.y + player.height > c.y
        ) {
            if (!isBraking) gameOver("No has frenat al pas de vianants!");
        }
    });
}

// ===============================
// DIBUJO
// ===============================

function drawBackground() {
    ctx.fillStyle = "#8fd3ff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawPlayer() {
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
}

function drawObstacles() {
    obstacles.forEach(o => ctx.drawImage(o.img, o.x, o.y, o.width, o.height));
}

function drawCrosswalks() {
    crosswalks.forEach(c => {
        // dibujar rayas
        ctx.fillStyle = "white";
        for (let i = 0; i < canvas.width; i += 40) {
            ctx.fillRect(i, c.y, 20, 60);
        }
        // dibujar peatones
        c.peas.forEach(p => ctx.drawImage(p.img, p.x, p.y, p.width, p.height));
        // mover crosswalk down
        c.y += 4;
    });
}

function drawDistractions() {
    distractions.forEach((d, i) => {
        ctx.fillStyle = "#ff1744";
        ctx.fillRect(10, 10 + i * 40, 200, 30);
        ctx.fillStyle = "#fff";
        ctx.font = "14px sans-serif";
        ctx.fillText(d.text, 15, 30 + i * 40);
    });
}

// ===============================
// GAME LOOP
// ===============================

function gameLoop() {
    if (gameState !== "playing") return;

    ticks++;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();
    drawCrosswalks();
    drawObstacles();
    drawPlayer();
    drawDistractions();

    updatePlayer();
    updateObstacles();
    updateCrosswalks();
    updateDistractions();

    checkGameRules();

    // Generar obstáculos periódicamente
    if (ticks % obstacleInterval === 0) spawnObstacle();

    // Generar crosswalk periódicamente
    if (ticks % crosswalkInterval === 0) spawnCrosswalk();

    // Generar distracciones aleatorias
    if (ticks % 500 === 0) spawnDistraction();

    // Puntaje
    score++;
    scoreEl.textContent = score;

    requestAnimationFrame(gameLoop);
}

// ===============================
// GAME CONTROL
// ===============================

function startGame() {
    gameState = "playing";
    score = 0;
    ticks = 0;
    isBraking = false;
    obstacles = [];
    crosswalks.length = 0;
    distractions.length = 0;
    player.x = canvas.width / 2 - 30;

    startBtn.classList.add("hidden");
    restartBtn.classList.add("hidden");

    gameLoop();
}

function gameOver(message) {
    gameState = "gameover";
    alert(message);
    restartBtn.classList.remove("hidden");
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);