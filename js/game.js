// ===============================
// CONFIGURACIÓN INICIAL
// ===============================

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const scoreEl = document.getElementById("score");

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

// ===============================
// JUGADOR
// ===============================

const player = {
    x: canvas.width / 2 - 30,
    y: canvas.height - 100,
    width: 60,
    height: 60,
    speed: 6
};

// ===============================
// PEATONES
// ===============================

let pedestrians = [];

function spawnPedestrian() {
    const img = pedestriansImgs[Math.floor(Math.random() * pedestriansImgs.length)];

    pedestrians.push({
        img,
        x: -60,
        y: stopZone.y + 10,
        width: 50,
        height: 50,
        speed: 2 + Math.random() * 1.5
    });
}

// ===============================
// ZONA STOP
// ===============================

const stopZone = {
    y: canvas.height / 2 - 40,
    height: 80
};

// ===============================
// CONTROLES
// ===============================

let keys = {};

document.addEventListener("keydown", (e) => {
    keys[e.code] = true;

    if (e.code === "Space") {
        isBraking = true;
    }
});

document.addEventListener("keyup", (e) => {
    keys[e.code] = false;

    if (e.code === "Space") {
        isBraking = false;
    }
});

// ===============================
// UPDATE
// ===============================

function updatePlayer() {
    if (keys["ArrowLeft"] && player.x > 0) {
        player.x -= player.speed;
    }
    if (keys["ArrowRight"] && player.x + player.width < canvas.width) {
        player.x += player.speed;
    }
}

function updatePedestrians() {
    pedestrians.forEach(p => {
        p.x += p.speed;
    });

    pedestrians = pedestrians.filter(p => p.x < canvas.width + 60);
}

// ===============================
// COLISIONES
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

    pedestrians.forEach(p => {
        if (checkCollision(player, p)) {
            gameOver("Has atropellat un vianant!");
        }
    });

    // Si entra en zona STOP sin frenar
    if (
        player.y < stopZone.y + stopZone.height &&
        player.y + player.height > stopZone.y
    ) {
        if (!isBraking) {
            gameOver("No has frenat al pas de vianants!");
        }
    }
}

// ===============================
// DRAW
// ===============================

function drawBackground() {
    ctx.fillStyle = "#555";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawCrosswalk() {
    ctx.fillStyle = "white";
    for (let i = 0; i < canvas.width; i += 40) {
        ctx.fillRect(i, stopZone.y, 20, stopZone.height);
    }
}

function drawPlayer() {
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
}

function drawPedestrians() {
    pedestrians.forEach(p => {
        ctx.drawImage(p.img, p.x, p.y, p.width, p.height);
    });
}

// ===============================
// GAME LOOP
// ===============================

function gameLoop() {

    if (gameState !== "playing") return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();
    drawCrosswalk();

    updatePlayer();
    updatePedestrians();

    drawPedestrians();
    drawPlayer();

    checkGameRules();

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
    pedestrians = [];
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

startBtn.addEventListener("click", () => {
    startGame();
});

restartBtn.addEventListener("click", () => {
    startGame();
});

// Spawn peatones cada 2 segundos
setInterval(() => {
    if (gameState === "playing") {
        spawnPedestrian();
    }
}, 2000);