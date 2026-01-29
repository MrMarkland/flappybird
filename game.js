// -------------------------------------------------------------
// Floppy Bird + 6G Telemetry Logger (EDGE / UE SIDE)
// Includes:
//  1) POST /session/start
//  2) WebSocket wss://.../ws/telemetry (stream events)
//  3) POST /session/end
//
// + NEW (Optional):
//  4) Save session telemetry JSON to Google Drive (OAuth)
//  5) Download session telemetry JSON locally
// -------------------------------------------------------------

// ------------------------------
// CONFIG (DigitalOcean endpoints)
// ------------------------------
const DO_HTTP_BASE = "https://YOUR-DO-URL";           // e.g. https://api.yourdomain.com
const DO_WS_URL = "wss://YOUR-DO-URL/ws/telemetry";   // e.g. wss://api.yourdomain.com/ws/telemetry

// ------------------------------
// CONFIG (Google Drive - OPTIONAL)
// ------------------------------
// To enable Google Drive upload:
// 1) Create a Google Cloud project
// 2) Enable Google Drive API
// 3) Create OAuth Client ID (Web) + API Key
// 4) Add your site URL to "Authorized JavaScript origins"
// 5) Paste values below
const GOOGLE_DRIVE = {
  ENABLED: true, // set false if you want to disable the UI/button
  CLIENT_ID: "YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com",
  API_KEY: "YOUR_GOOGLE_API_KEY",
  // Optional: upload into a specific folder (otherwise uploads to My Drive root)
  // FOLDER_ID: "YOUR_FOLDER_ID"
  FOLDER_ID: ""
};

// -------------------------------------------------------------
// OPTIONAL WebSocket uplink (DigitalOcean ready)
// -------------------------------------------------------------
const TelemetryStream = {
  socket: null,
  isOpen: false,

  connect() {
    try {
      this.socket = new WebSocket(DO_WS_URL);

      this.socket.addEventListener("open", () => {
        this.isOpen = true;
        // Optional: identify immediately
        if (Telemetry.sessionId) {
          this.send({
            type: "ws_hello",
            session_id: Telemetry.sessionId,
            timestamp: performance.now()
          });
        }
      });

      this.socket.addEventListener("close", () => {
        this.isOpen = false;
      });

      this.socket.addEventListener("error", () => {
        this.isOpen = false;
      });
    } catch (e) {
      this.isOpen = false;
    }
  },

  send(packet) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(packet));
    }
  },

  close() {
    try {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.close();
      }
    } catch (_) {}
    this.isOpen = false;
  }
};

// -------------------------------------------------------------
// Telemetry
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

    // Real-time uplink (enabled)
    TelemetryStream.send(event);
  },

  export() {
    console.log("SESSION DATA:", JSON.stringify(this.buffer, null, 2));
  },

  // NEW: local download helper
  downloadJSON() {
    try {
      const blob = new Blob([JSON.stringify(this.buffer, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `floppybird_session_${this.sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Local download failed:", e);
      alert("Local download failed. See console for details.");
    }
  }
};

// -------------------------------------------------------------
// Google Drive Uploader (NEW, OPTIONAL, NON-BREAKING)
// -------------------------------------------------------------
const DriveUploader = {
  initialized: false,
  ready: false,
  accessToken: null,
  tokenClient: null,
  lastError: null,
  scope: "https://www.googleapis.com/auth/drive.file",

  async init() {
    if (!GOOGLE_DRIVE.ENABLED) {
      this.initialized = true;
      this.ready = false;
      return;
    }

    // If user didn't configure keys, stay disabled silently
    if (
      !GOOGLE_DRIVE.CLIENT_ID ||
      GOOGLE_DRIVE.CLIENT_ID.includes("YOUR_GOOGLE_OAUTH_CLIENT_ID") ||
      !GOOGLE_DRIVE.API_KEY ||
      GOOGLE_DRIVE.API_KEY.includes("YOUR_GOOGLE_API_KEY")
    ) {
      this.initialized = true;
      this.ready = false;
      this.lastError = "Google Drive not configured (missing CLIENT_ID/API_KEY).";
      return;
    }

    // Wait for Google libraries (gapi + google.accounts) to exist
    await this._waitForGoogleLibs();

    try {
      // Init gapi client (Drive discovery)
      await new Promise((resolve, reject) => {
        gapi.load("client", { callback: resolve, onerror: reject });
      });

      await gapi.client.init({
        apiKey: GOOGLE_DRIVE.API_KEY,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
      });

      // Init token client (GIS)
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_DRIVE.CLIENT_ID,
        scope: this.scope,
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            this.accessToken = tokenResponse.access_token;
            this.ready = true;
            // if a save was requested, caller will proceed
          } else {
            this.lastError = "No access token returned.";
            console.error(this.lastError, tokenResponse);
            alert("Google Drive auth failed (no token).");
          }
        }
      });

      this.initialized = true;
      this.ready = true; // ready to request tokens
    } catch (e) {
      this.initialized = true;
      this.ready = false;
      this.lastError = String(e);
      console.error("Drive init failed:", e);
    }
  },

  async _waitForGoogleLibs() {
    const start = Date.now();
    const timeoutMs = 8000;

    while (Date.now() - start < timeoutMs) {
      const ok = typeof window.gapi !== "undefined" && typeof window.google !== "undefined" && window.google.accounts;
      if (ok) return;
      await new Promise((r) => setTimeout(r, 100));
    }

    throw new Error("Google libraries not available (gapi / GIS). Check script loading.");
  },

  async saveSessionToDrive() {
    try {
      if (!GOOGLE_DRIVE.ENABLED) {
        alert("Google Drive saving is disabled in config.");
        return;
      }

      if (!this.initialized) {
        await this.init();
      }

      if (!this.ready) {
        const msg = this.lastError || "Google Drive not ready.";
        alert(msg);
        return;
      }

      // If no token, request one (popup)
      if (!this.accessToken) {
        await new Promise((resolve) => {
          const prevCb = this.tokenClient.callback;
          this.tokenClient.callback = (resp) => {
            // chain original
            prevCb(resp);
            resolve();
          };
          this.tokenClient.requestAccessToken();
        });
      }

      if (!this.accessToken) {
        alert("Google Drive auth not completed.");
        return;
      }

      await this._uploadJSON(Telemetry.buffer);
      alert("Session saved to Google Drive (My Drive).");
    } catch (e) {
      console.error("Drive save failed:", e);
      alert("Drive save failed. See console for details.");
    }
  },

  async _uploadJSON(data) {
    const filename = `floppybird_session_${Telemetry.sessionId}.json`;

    const metadata = {
      name: filename,
      mimeType: "application/json"
    };

    // Optional folder destination
    if (GOOGLE_DRIVE.FOLDER_ID && GOOGLE_DRIVE.FOLDER_ID.trim().length > 0) {
      metadata.parents = [GOOGLE_DRIVE.FOLDER_ID.trim()];
    }

    const fileBlob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", fileBlob);

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`
      },
      body: form
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Drive upload failed (${res.status}): ${text}`);
    }
  }
};

// -------------------------------------------------------------
// Canvas Setup
// -------------------------------------------------------------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Overlay UI (NEW)
const overlay = document.getElementById("overlay");

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

// IMPORTANT: make this async because startGame() now starts backend session
playBtn.addEventListener("click", async () => {
  menu.style.display = "none";
  canvas.style.display = "block";
  if (bgMusic.src) bgMusic.play();

  // init Drive silently (non-blocking)
  DriveUploader.init().catch(() => {});

  await startGame();
});

// -------------------------------------------------------------
// Assets
// -------------------------------------------------------------
const birdSprites = [
  "assets/bird.png",
  "assets/bird-flap1.png",
  "assets/bird-flap2.png"
];

const birdFrames = birdSprites.map((src) => {
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
    session_id: Telemetry.sessionId,
    timestamp: performance.now(),
    input: inputType,
    bird_y: bird.y,
    velocity: bird.velocity
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
// Backend helpers: session start/end
// -------------------------------------------------------------
async function startBackendSession() {
  try {
    const res = await fetch(`${DO_HTTP_BASE}/session/start`, {
      method: "POST"
    });

    const data = await res.json();
    if (data && data.session_id) {
      Telemetry.sessionId = data.session_id;
    }
  } catch (err) {
    console.error("Session start failed:", err);
    // fallback: keep local UUID in Telemetry.sessionId
  }
}

function endBackendSession({ session_id, score, duration }) {
  // Fire-and-forget (do not block UI)
  fetch(`${DO_HTTP_BASE}/session/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id,
      score,
      duration
    })
  }).catch((err) => {
    console.error("Session end failed:", err);
  });
}

// -------------------------------------------------------------
// Overlay helpers (NEW)
// -------------------------------------------------------------
function clearOverlay() {
  overlay.style.display = "none";
  overlay.innerHTML = "";
  overlay.setAttribute("aria-hidden", "true");
}

function showOverlayButtons() {
  overlay.style.display = "block";
  overlay.setAttribute("aria-hidden", "false");

  const panel = document.createElement("div");
  panel.className = "panel";

  // Button: Save to Google Drive
  const driveBtn = document.createElement("button");
  driveBtn.textContent = "Save Session to Google Drive";
  driveBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await DriveUploader.saveSessionToDrive();
  };

  // Button: Download JSON locally
  const dlBtn = document.createElement("button");
  dlBtn.textContent = "Download Session JSON";
  dlBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    Telemetry.downloadJSON();
  };

  const sub = document.createElement("div");
  sub.className = "sub";
  sub.textContent =
    "Tip: If Drive isn’t configured yet, use Download JSON. Drive uploads go to My Drive (or your folder if set).";

  // If Drive not configured, keep button but it will show a helpful message
  panel.appendChild(driveBtn);
  panel.appendChild(dlBtn);
  panel.appendChild(sub);

  overlay.appendChild(panel);
}

// -------------------------------------------------------------
// Game Over Screen
// -------------------------------------------------------------
function showGameOverScreen(reason) {
  gameOver = true;

  const durationMs = performance.now() - Telemetry.startTime;

  // Log outcome (also streams via WS)
  Telemetry.log({
    type: "outcome",
    session_id: Telemetry.sessionId,
    timestamp: performance.now(),
    event: "game_over",
    reason,
    final_score: score,
    duration_ms: durationMs
  });

  // End backend session (added code #3)
  endBackendSession({
    session_id: Telemetry.sessionId,
    score,
    duration: durationMs
  });

  // Close WebSocket (optional but clean)
  TelemetryStream.close();

  // Local export to console
  Telemetry.export();

  // UI
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff";
  ctx.font = "48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);

  ctx.font = "28px Arial";
  ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 5);
  ctx.fillText("Tap to return to menu", canvas.width / 2, canvas.height / 2 + 55);

  // NEW: show overlay buttons
  showOverlayButtons();

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

  // NEW: clear overlay
  clearOverlay();

  canvas.style.display = "none";
  menu.style.display = "block";
}

// -------------------------------------------------------------
// Start Game
// -------------------------------------------------------------
async function startGame() {
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

  // NEW: clear overlay (in case it was visible)
  clearOverlay();

  // 1) Start backend session (added code #1)
  await startBackendSession();

  // 2) Open WebSocket uplink (added code #2)
  TelemetryStream.connect();

  // Optional: log session start event
  Telemetry.log({
    type: "session_start",
    session_id: Telemetry.sessionId,
    timestamp: performance.now(),
    state_hz: Telemetry.stateHz
  });

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

    // If you ever add "pipe_gap" back (classic flappy),
    // compute it here. For now we stream existing state.
    Telemetry.log({
      type: "state",
      session_id: Telemetry.sessionId,
      timestamp: now,
      tick: Telemetry.tick,
      bird_y: bird.y,
      velocity: bird.velocity,
      pipes: pipes.map((p) => ({ x: p.x, height: p.height })),
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
