// -------------------------------------------------------------
// Floppy Bird + 6G Telemetry Logger (EDGE / UE SIDE)
// FINAL VERSION — WITH FRONTEND RESULTS VIEWER
// -------------------------------------------------------------

// ------------------------------
// CONFIG (DigitalOcean endpoints)
// ------------------------------
const DO_HTTP_BASE = "https://YOUR-DO-URL";
const DO_WS_URL = "wss://YOUR-DO-URL/ws/telemetry";

// ------------------------------
// RESULTS VIEWER (FRONTEND)
// ------------------------------
const resultsPanel = document.getElementById("resultsPanel");
const resultsList = document.getElementById("resultsList");
const refreshBtn = document.getElementById("refreshResults");

refreshBtn?.addEventListener("click", loadResults);

async function loadResults() {
  resultsList.innerHTML = "Loading...";
  try {
    const res = await fetch(`${DO_HTTP_BASE}/sessions`);
    const data = await res.json();

    if (!data.length) {
      resultsList.innerHTML = "No sessions found.";
      return;
    }

    resultsList.innerHTML = "";
    data.forEach((s, i) => {
      const div = document.createElement("div");
      div.style.borderBottom = "1px solid #444";
      div.style.padding = "10px 0";

      div.innerHTML = `
        <b>#${i + 1}</b><br/>
        <b>Session:</b> ${s.session_id}<br/>
        <b>Device:</b> ${s.device || "unknown"}<br/>
        <b>Score:</b> ${s.score ?? "—"}<br/>
        <b>Duration:</b> ${
          s.duration_sec ? (s.duration_sec / 1000).toFixed(2) + "s" : "—"
        }
      `;
      resultsList.appendChild(div);
    });
  } catch (err) {
    resultsList.innerHTML = "Failed to load results.";
    console.error(err);
  }
}

// -------------------------------------------------------------
// WebSocket Telemetry Stream
// -------------------------------------------------------------
const TelemetryStream = {
  socket: null,
  connect() {
    this.socket = new WebSocket(DO_WS_URL);
    this.socket.onopen = () => {
      if (Telemetry.sessionId) {
        this.send({
          type: "ws_hello",
          session_id: Telemetry.sessionId,
          timestamp: performance.now()
        });
      }
    };
  },
  send(data) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  },
  close() {
    try {
      this.socket?.close();
    } catch {}
  }
};

// -------------------------------------------------------------
// Telemetry Core
// -------------------------------------------------------------
const Telemetry = {
  sessionId: crypto.randomUUID(),
  startTime: performance.now(),
  tick: 0,
  stateHz: 30,
  buffer: [],
  lastStateLog: 0,
  log(event) {
    this.buffer.push(event);
    TelemetryStream.send(event);
  }
};

// -------------------------------------------------------------
// Backend Session Helpers
// -------------------------------------------------------------
async function startBackendSession() {
  try {
    const res = await fetch(`${DO_HTTP_BASE}/session/start`, { method: "POST" });
    const data = await res.json();
    if (data.session_id) Telemetry.sessionId = data.session_id;
  } catch {}
}

function endBackendSession(payload) {
  fetch(`${DO_HTTP_BASE}/session/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

// -------------------------------------------------------------
// Canvas + Game (UNCHANGED CORE)
// -------------------------------------------------------------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let bird = { x: 150, y: canvas.height / 2, width: 50, height: 40, velocity: 0, gravity: 0.6, lift: -12 };
let pipes = [];
let frames = 0;
let score = 0;
let gameOver = false;

// -------------------------------------------------------------
// INPUT
// -------------------------------------------------------------
canvas.addEventListener("click", () => flap("click"));
canvas.addEventListener("touchstart", () => flap("touch"));

function flap(type) {
  if (gameOver) return;
  bird.velocity = bird.lift;
  Telemetry.log({ type: "input", session_id: Telemetry.sessionId, timestamp: performance.now(), input: type });
}

// -------------------------------------------------------------
// GAME OVER
// -------------------------------------------------------------
function showGameOverScreen(reason) {
  gameOver = true;
  const duration = performance.now() - Telemetry.startTime;

  Telemetry.log({
    type: "outcome",
    session_id: Telemetry.sessionId,
    reason,
    final_score: score,
    duration_ms: duration
  });

  endBackendSession({
    session_id: Telemetry.sessionId,
    score,
    duration
  });

  TelemetryStream.close();

  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "40px Arial";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);
  ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 10);
  ctx.fillText("Tap to return", canvas.width / 2, canvas.height / 2 + 60);

  canvas.onclick = () => {
    canvas.onclick = null;
    canvas.style.display = "none";
    resultsPanel.style.display = "block";
    loadResults();
  };
}

// -------------------------------------------------------------
// START GAME
// -------------------------------------------------------------
async function startGame() {
  pipes = [];
  frames = 0;
  score = 0;
  gameOver = false;

  Telemetry.startTime = performance.now();
  Telemetry.buffer = [];

  await startBackendSession();
  TelemetryStream.connect();

  requestAnimationFrame(update);
}

// -------------------------------------------------------------
// UPDATE LOOP
// -------------------------------------------------------------
function update() {
  if (gameOver) return;

  frames++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  bird.velocity += bird.gravity;
  bird.y += bird.velocity;
  ctx.fillRect(bird.x, bird.y, bird.width, bird.height);

  if (bird.y + bird.height >= canvas.height) {
    return showGameOverScreen("ground");
  }

  ctx.fillText(`Score: ${score}`, 20, 40);
  requestAnimationFrame(update);
}
