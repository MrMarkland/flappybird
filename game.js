const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

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

const birdSprites = [
  "assets/bird.png",          // Use planeRed1.png
  "assets/bird-flap1.png",    // planeRed2.png
  "assets/bird-flap2.png"     // planeRed3.png
];
const birdFrames = birdSprites.map(src => {
  const img = new Image();
  img.src = src;
  return img;
});

const pipeTopImg = new Image(); pipeTopImg.src = "assets/pipe-top.png";
const pipeBottomImg = new Image(); pipeBottomImg.src = "assets/pipe-bottom.png";
const groundImg = new Image(); groundImg.src = "assets/ground.png";

let bird = {
  x: 150,
  y: 300,
  width: 50,
  height: 40,
  velocity: 0,
  gravity: 0.6,
  lift: -12,
  frame: 0
};

let pipes = [];
let frames = 0, score = 0, level = 1;
let gameSpeed = 2, gap = 150;

canvas.addEventListener("click", flap);
canvas.addEventListener("touchstart", flap);

function flap() {
  bird.velocity = bird.lift;
}

function createPipe() {
  const topHeight = Math.random() * (canvas.height / 2);
  pipes.push({ x: canvas.width, top: topHeight, bottom: topHeight + gap, width: 80 });
}

function checkLevelUp() {
  if (score === 10 && level === 1) {
    level++; gameSpeed += 1; gap -= 20;
  }
  if (score === 25 && level === 2) {
    level++; gameSpeed += 1; gap -= 20;
  }
}

function resetGame() {
  pipes = [];
  score = 0;
  level = 1;
  gameSpeed = 2;
  gap = 150;
  bird.y = canvas.height / 2;
  bird.velocity = 0;
  frames = 0;
  bgMusic.pause();
  bgMusic.currentTime = 0;

  menu.style.display = "block";
  canvas.style.display = "none";
}

function startGame() {
  requestAnimationFrame(update);
}

function update() {
  frames++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Bird physics
  bird.velocity += bird.gravity;
  bird.y += bird.velocity;

  // Animate flapping
  if (frames % 5 === 0) {
    bird.frame = (bird.frame + 1) % birdFrames.length;
  }
  ctx.drawImage(birdFrames[bird.frame], bird.x, bird.y, bird.width, bird.height);

  // Create pipes
  if (frames % 90 === 0) createPipe();

  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i];
    p.x -= gameSpeed;

    ctx.drawImage(pipeTopImg, p.x, 0, p.width, p.top);
    ctx.drawImage(pipeBottomImg, p.x, p.bottom, p.width, canvas.height - p.bottom);

    if (
      bird.x < p.x + p.width &&
      bird.x + bird.width > p.x &&
      (bird.y < p.top || bird.y + bird.height > p.bottom)
    ) return resetGame();

    if (p.x + p.width < 0) {
      pipes.splice(i, 1);
      score++;
      checkLevelUp();
    }
  }

  // Ground
  ctx.drawImage(groundImg, 0, canvas.height - 60, canvas.width, 60);

  // Score Display
  ctx.fillStyle = "#fff";
  ctx.font = "24px Arial";
  ctx.fillText(`Score: ${score}`, 20, 40);
  ctx.fillText(`Level: ${level}`, 20, 70);

  // Restart
  requestAnimationFrame(update);
}
