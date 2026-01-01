// -------------------------------------------------------------
// Canvas Setup
// -------------------------------------------------------------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// -------------------------------------------------------------
// Music + Menu
// -------------------------------------------------------------
let bgMusic = new Audio();
bgMusic.loop = true;

const playBtn = document.getElementById("playBtn");
const musicUpload = document.getElementById("musicUpload");
const menu = document.getElementById("menu");

musicUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file && file.type.startsWith("audio/")) {
    bgMusic.src = URL.createObjectURL(file);
  }
});

playBtn.addEventListener("click", () => {
  menu.style.display = "none";
  canvas.style.display = "block";
  if (bgMusic.src) bgMusic.play();
  startGame();
});

// -------------------------------------------------------------
// Assets
// -------------------------------------------------------------
const birdSprites = [
  "assets/bird.png",
  "assets/bird-flap1.png",
  "assets/bird-flap2.png"
];

const birdFrames = birdSprites.map(src => {
  const img = new Image();
  img.src = src;
  return img;
});

const pipeTopImg = new Image(); pipeTopImg.src = "assets/pipe-top.png";
const pipeBottomImg = new Image(); pipeBottomImg.src = "assets/pipe-bottom.png";
const groundImg = new Image(); groundImg.src = "assets/ground.png";

// -------------------------------------------------------------
// Bird Object
// -------------------------------------------------------------
let bird = {
  x: 150,
  y: canvas.height / 2,
  width: 50,
  height: 40,
  velocity: 0,
  gravity: 0.6,
  lift: -12,
  frame: 0
};

// -------------------------------------------------------------
// Game State
// -------------------------------------------------------------
let pipes = [];
let frames = 0;
let score = 0;
let level = 1;

let gameSpeed = 2;
let gap = 150; // Distance between pipes

// -------------------------------------------------------------
// Controls
// -------------------------------------------------------------
canvas.addEventListener("click", flap);
canvas.addEventListener("touchstart", flap);

function flap() {
  bird.velocity = bird.lift;
}

// -------------------------------------------------------------
// Pipe Generation
// -------------------------------------------------------------
function createPipe() {
  const topHeight = Math.random() * (canvas.height * 0.45);
  pipes.push({
    x: canvas.width,
    top: topHeight,
    bottom: topHeight + gap,
    width: 80
  });
}

// -------------------------------------------------------------
// Leveling System
// -------------------------------------------------------------
function checkLevelUp() {
  if (score === 10 && level === 1) {
    level++;
    gameSpeed++;
    gap -= 20;
  }
  if (score === 25 && level === 2) {
    level++;
    gameSpeed++;
    gap -= 20;
  }
}

// -------------------------------------------------------------
// Reset
// -------------------------------------------------------------
function resetGame() {
  pipes = [];
  score = 0;
  level = 1;
  gameSpeed = 2;
  gap = 150;
  frames = 0;

  bird.y = canvas.height / 2;
  bird.velocity = 0;

  bgMusic.pause();
  bgMusic.currentTime = 0;

  menu.style.display = "block";
  canvas.style.display = "none";
}

// -------------------------------------------------------------
// Start Game
// -------------------------------------------------------------
function startGame() {
  requestAnimationFrame(update);
}

// -------------------------------------------------------------
// Collision Detection (improved)
// -------------------------------------------------------------
function birdHitsPipe(bird, pipe) {

  const margin = 8; // shrink hitbox for accuracy

  const birdLeft   = bird.x + margin;
  const birdRight  = bird.x + bird.width - margin;
  const birdTop    = bird.y + margin;
  const birdBottom = bird.y + bird.height - margin;

  const pipeLeft   = pipe.x;
  const pipeRight  = pipe.x + pipe.width;

  // Must overlap horizontally to collide
  if (birdRight > pipeLeft && birdLeft < pipeRight) {

    // Above gap
    if (birdTop < pipe.top) return true;

    // Below gap
    if (birdBottom > pipe.bottom) return true;
  }

  return false;
}

// -------------------------------------------------------------
// Update Loop
// -------------------------------------------------------------
function update() {
  frames++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ---- Bird physics ----
  bird.velocity += bird.gravity;
  bird.y += bird.velocity;

  // Prevent bird from floating off-screen top
  if (bird.y < 0) bird.y = 0;

  // Animate bird
  if (frames % 5 === 0) {
    bird.frame = (bird.frame + 1) % birdFrames.length;
  }

  // Draw bird
  ctx.drawImage(
    birdFrames[bird.frame],
    bird.x,
    bird.y,
    bird.width,
    bird.height
  );

  // ---- Pipe creation ----
  if (frames % 90 === 0) createPipe();

  // ---- Pipes movement + collision ----
  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i];
    p.x -= gameSpeed;

    // Draw top pipe
    ctx.drawImage(pipeTopImg, p.x, 0, p.width, p.top);

    // Draw bottom pipe
    ctx.drawImage(
      pipeBottomImg,
      p.x,
      p.bottom,
      p.width,
      canvas.height - p.bottom
    );

    // Collision check
    if (birdHitsPipe(bird, p)) {
      return resetGame();
    }

    // Remove pipes off-screen
    if (p.x + p.width < 0) {
      pipes.splice(i, 1);
      score++;
      checkLevelUp();
    }
  }

  // ---- Ground ----
  ctx.drawImage(groundImg, 0, canvas.height - 60, canvas.width, 60);

  // If bird hits ground → game over
  if (bird.y + bird.height >= canvas.height - 60) {
    return resetGame();
  }

  // ---- Scoreboard ----
  ctx.fillStyle = "#fff";
  ctx.font = "24px Arial";
  ctx.fillText(`Score: ${score}`, 20, 40);
  ctx.fillText(`Level: ${level}`, 20, 70);

  requestAnimationFrame(update);
}
