const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const menu = document.getElementById("menu");
const playBtn = document.getElementById("playBtn");
const musicUpload = document.getElementById("musicUpload");

let bgMusic = new Audio();
bgMusic.loop = true;

musicUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file && file.type.startsWith("audio/")) {
    bgMusic.src = URL.createObjectURL(file);
  }
});

playBtn.addEventListener("click", () => {
  menu.style.display = "none";
  canvas.style.display = "block";

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  if (bgMusic.src) bgMusic.play();
  requestAnimationFrame(update);
});

// Images
const birdImg = new Image(); birdImg.src = "assets/bird.png";
const pipeTopImg = new Image(); pipeTopImg.src = "assets/pipe-top.png";
const pipeBottomImg = new Image(); pipeBottomImg.src = "assets/pipe-bottom.png";
const groundImg = new Image(); groundImg.src = "assets/ground.png";

// Game State
let frames = 0, score = 0, level = 1;
let pipes = [];
let gameSpeed = 2, gap = 150;

const bird = {
  x: 150,
  y: 300,
  width: 40,
  height: 30,
  velocity: 0,
  gravity: 0.6,
  lift: -12
};

function resetGame() {
  pipes = []; score = 0; level = 1;
  gameSpeed = 2; gap = 150;
  bird.y = canvas.height / 2;
  bird.velocity = 0;
  if (bgMusic) bgMusic.pause();
}

function flap() {
  bird.velocity = bird.lift;
}

window.addEventListener("click", flap);
window.addEventListener("touchstart", flap);

function createPipe() {
  const topHeight = Math.random() * (canvas.height / 2);
  pipes.push({ x: canvas.width, top: topHeight, bottom: topHeight + gap, width: 80 });
}

function checkLevelUp() {
  if (score === 10 && level === 1) { level++; gameSpeed += 1; gap -= 20; }
  if (score === 25 && level === 2) { level++; gameSpeed += 1; gap -= 20; }
}

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  frames++;

  // Bird physics
  bird.velocity += bird.gravity;
  bird.y += bird.velocity;
  ctx.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);

  if (frames % 90 === 0) createPipe();

  for (let i = pipes.length - 1; i >= 0; i--) {
    let p = pipes[i];
    p.x -= gameSpeed;

    ctx.drawImage(pipeTopImg, p.x, 0, p.width, p.top);
    ctx.drawImage(pipeBottomImg, p.x, p.bottom, p.width, canvas.height - p.bottom);

    // collision
    if (
      bird.x < p.x + p.width &&
      bird.x + bird.width > p.x &&
      (bird.y < p.top || bird.y + bird.height > p.bottom)
    ) {
      resetGame();
      menu.style.display = "block";
      canvas.style.display = "none";
      return;
    }

    if (p.x + p.width < 0) {
      pipes.splice(i, 1);
      score++;
      checkLevelUp();
    }
  }

  ctx.drawImage(groundImg, 0, canvas.height - 60, canvas.width, 60);

  ctx.fillStyle = "#fff";
  ctx.font = "24px Arial";
  ctx.fillText(`Score: ${score}`, 20, 40);
  ctx.fillText(`Level: ${level}`, 20, 70);

  requestAnimationFrame(update);
}
