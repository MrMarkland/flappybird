// -------------------------------------------------------------
// Canvas Setup
// -------------------------------------------------------------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// -------------------------------------------------------------
// Background Music + Menu Controls
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

const pipeBottomImg = new Image(); 
pipeBottomImg.src = "assets/pipe-bottom.png";

const groundImg = new Image(); 
groundImg.src = "assets/ground.png";

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

let gameOver = false;

// -------------------------------------------------------------
// Controls
// -------------------------------------------------------------
canvas.addEventListener("click", flap);
canvas.addEventListener("touchstart", flap);

function flap() {
  if (!gameOver) {
    bird.velocity = bird.lift;
  }
}

// -------------------------------------------------------------
// Create Only BOTTOM Pipe
// -------------------------------------------------------------
function createPipe() {
  const pipeHeight = 100 + Math.random() * 200;

  pipes.push({
    x: canvas.width,
    height: pipeHeight,
    width: 80
  });
}

// -------------------------------------------------------------
// Reset Game (return to menu button)
// -------------------------------------------------------------
function showGameOverScreen() {
  gameOver = true;

  // Freeze game
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff";
  ctx.font = "48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);

  ctx.font = "28px Arial";
  ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 5);
  ctx.fillText("Tap to return to menu", canvas.width / 2, canvas.height / 2 + 55);

  // Handle tap/click to return to menu
  canvas.onclick = () => {
    canvas.onclick = null;
    resetToMenu();
  };
}

function resetToMenu() {
  pipes = [];
  frames = 0;
  score = 0;
  level = 1;
  gameSpeed = 2;
  gameOver = false;

  bird.y = canvas.height / 2;
  bird.velocity = 0;

  bgMusic.pause();
  bgMusic.currentTime = 0;

  canvas.style.display = "none";
  menu.style.display = "block";
}

// -------------------------------------------------------------
// Start Game
// -------------------------------------------------------------
function startGame() {
  pipes = [];
  frames = 0;
  score = 0;
  gameOver = false;

  bird.y = canvas.height / 2;
  bird.velocity = 0;

  requestAnimationFrame(update);
}

// -------------------------------------------------------------
// Update Loop
// -------------------------------------------------------------
function update() {
  if (gameOver) return;

  frames++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ---- Bird Physics ----
  bird.velocity += bird.gravity;
  bird.y += bird.velocity;

  if (frames % 5 === 0) {
    bird.frame = (bird.frame + 1) % birdFrames.length;
  }

  ctx.drawImage(birdFrames[bird.frame], bird.x, bird.y, bird.width, bird.height);

  // ---- Create Pipes ----
  if (frames % 100 === 0) createPipe();

  // ---- Pipe Movement + Collision ----
  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i];
    p.x -= gameSpeed;

    // Draw Bottom Pipe Only
    ctx.drawImage(
      pipeBottomImg,
      p.x,
      canvas.height - p.height - 60,
      p.width,
      p.height
    );

    // Collision Detection
    if (
      bird.x + bird.width > p.x &&
      bird.x < p.x + p.width &&
      bird.y + bird.height > canvas.height - p.height - 60
    ) {
      return showGameOverScreen();
    }

    if (p.x + p.width < 0) {
      pipes.splice(i, 1);
      score++;
    }
  }

  // ---- Ground Collision ----
  if (bird.y + bird.height >= canvas.height - 60) {
    return showGameOverScreen();
  }

  // ---- Scoreboard ----
  ctx.fillStyle = "#fff";
  ctx.font = "24px Arial";
  ctx.fillText(`Score: ${score}`, 20, 40);

  requestAnimationFrame(update);
}
