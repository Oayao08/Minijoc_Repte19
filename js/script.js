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
    
}