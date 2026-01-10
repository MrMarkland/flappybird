// -------------------------------------------------------------
// 6G Telemetry Logger (EDGE / UE SIDE)
// -------------------------------------------------------------
const Telemetry = {
  sessionId: crypto.randomUUID(),
  startTime: performance.now(),
  tick: 0,
  stateHz: 30, // 20–60 Hz allowed
  buffer: [],
  lastStateLog: 0,

  log(event) {
    this.buffer.push(event);

    // OPTIONAL: real-time uplink (enable later)
    // TelemetryStream.send(event);
  },

  export() {
    console.log(
      "SESSION DATA:",
      JSON.stringify(this.buffer, null, 2)
    );
  }
};

// -------------------------------------------------------------
// OPTIONAL WebSocket uplink (DigitalOcean ready)
// -------------------------------------------------------------
/*
const TelemetryStream = {
  socket: null,
  connect() {
    this.socket = new WebSocket("wss://YOUR_DO_DOMAIN/ws");
  },
  send(packet) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(packet));
    }
  }
};
*/

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
let gameOver = false;

// -------------------------------------------------------------
// Controls (INPUT EVENTS)
// -------------------------------------------------------------
canvas.addEventListener("click", () => flap("click"));
canvas.addEventListener("touchstart", () => flap("touch"));

function flap(inputType) {
  if (gameOver) return;

  bird.velocity = bird.lift;

  Telemetry.log({
    type: "input",
    sessionId: Telemetry.sessionId,
    timestamp: performance.now(),
    input: inputType,
    birdY: bird.y,
    birdVelocity: bird.velocity
  });
}

// -------------------------------------------------------------
// Create Only Bottom Pipe
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
// Game Over Screen
// -------------------------------------------------------------
function showGameOverScreen(reason) {
  gameOver = true;

  Telemetry.log({
    type: "outcome",
    sessionId: Telemetry.sessionId,
    timestamp: performance.now(),
    event: "game_over",
    reason,
    finalScore: score,
    durationMs: performance.now() - Telemetry.startTime
  });

  Telemetry.export();

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff";
  ctx.font = "48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);

  ctx.font = "28px Arial";
  ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 5);
  ctx.fillText("Tap to return to menu", canvas.width / 2, canvas.height / 2 + 55);

  canvas.onclick = () => {
    canvas.onclick = null;
    resetToMenu();
  };
}

// -------------------------------------------------------------
// Reset to Menu
// -------------------------------------------------------------
function resetToMenu() {
  pipes = [];
  frames = 0;
  score = 0;
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

  Telemetry.startTime = performance.now();
  Telemetry.tick = 0;
  Telemetry.buffer = [];
  Telemetry.lastStateLog = 0;

  requestAnimationFrame(update);
}

// -------------------------------------------------------------
// Update Loop (STATE SNAPSHOTS @ 30 Hz)
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
    p.x -= 2;

    ctx.drawImage(
      pipeBottomImg,
      p.x,
      canvas.height - p.height - 60,
      p.width,
      p.height
    );

    if (
      bird.x + bird.width > p.x &&
      bird.x < p.x + p.width &&
      bird.y + bird.height > canvas.height - p.height - 60
    ) {
      return showGameOverScreen("pipe_collision");
    }

    if (p.x + p.width < 0) {
      pipes.splice(i, 1);
      score++;
    }
  }

  // ---- Ground Collision ----
  if (bird.y + bird.height >= canvas.height - 60) {
    return showGameOverScreen("ground_collision");
  }

  // ---- STATE SNAPSHOT (FIXED RATE) ----
  const now = performance.now();
  if (now - Telemetry.lastStateLog >= 1000 / Telemetry.stateHz) {
    Telemetry.tick++;

    Telemetry.log({
      type: "state",
      sessionId: Telemetry.sessionId,
      timestamp: now,
      tick: Telemetry.tick,
      birdY: bird.y,
      birdVelocity: bird.velocity,
      pipes: pipes.map(p => ({ x: p.x, height: p.height })),
      score
    });

    Telemetry.lastStateLog = now;
  }

  // ---- Scoreboard ----
  ctx.fillStyle = "#fff";
  ctx.font = "24px Arial";
  ctx.fillText(`Score: ${score}`, 20, 40);

  requestAnimationFrame(update);
}
