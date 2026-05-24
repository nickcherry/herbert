import {
  robotControlStatusPath,
  videoMjpegPath,
  videoStatusPath,
  webControlCommandPath,
} from "@herbert/shared";

export const videoAppRoutePath = "/";
export const videoAppIndexRoutePath = "/index.html";

export function handleVideoAppRoute({
  request,
}: {
  readonly request: Request;
}): Response {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  return new Response(request.method === "HEAD" ? undefined : videoAppHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

const videoAppHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Herbert Live</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #101214;
        --panel: #191d20;
        --panel-2: #22272b;
        --text: #f2f5f3;
        --muted: #aab3ad;
        --line: #3a4245;
        --green: #6fd08c;
        --yellow: #e4bf65;
        --red: #ed6a5f;
        --blue: #7bb7ff;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }

      .shell {
        min-height: 100vh;
        display: grid;
        grid-template-rows: auto 1fr;
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 18px;
        background: var(--panel);
        border-bottom: 1px solid var(--line);
      }

      h1 {
        margin: 0;
        font-size: 18px;
        line-height: 1.2;
        font-weight: 650;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
        padding: 0 12px;
        border: 1px solid var(--line);
        background: var(--panel-2);
        font-size: 14px;
      }

      .dot {
        width: 9px;
        height: 9px;
        border-radius: 999px;
        background: var(--yellow);
      }

      .status.live .dot {
        background: var(--green);
      }

      .status.stale .dot {
        background: var(--yellow);
      }

      .status.offline .dot {
        background: var(--red);
      }

      main {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        min-height: 0;
      }

      .stage {
        position: relative;
        min-height: 0;
        background: #050607;
        display: grid;
        place-items: center;
        overflow: hidden;
      }

      .feed {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .empty {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: var(--muted);
        font-size: 15px;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
          linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
          #050607;
        background-size: 36px 36px;
      }

      .empty.hidden {
        display: none;
      }

      aside {
        min-width: 0;
        padding: 16px;
        background: var(--panel);
        border-left: 1px solid var(--line);
        display: grid;
        gap: 18px;
        align-content: start;
        overflow-y: auto;
      }

      .panel {
        min-width: 0;
      }

      .panel h2 {
        margin: 0 0 10px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.2;
        font-weight: 650;
        text-transform: uppercase;
      }

      .metrics {
        display: grid;
        gap: 10px;
      }

      .metric {
        display: grid;
        gap: 4px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--line);
      }

      .metric:last-child {
        border-bottom: 0;
      }

      .metric span {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
      }

      .metric strong {
        min-width: 0;
        overflow-wrap: anywhere;
        font-size: 15px;
        font-weight: 600;
      }

      .action-button,
      .control-button {
        width: 100%;
        min-height: 38px;
        border: 1px solid #5f7487;
        background: #203348;
        color: var(--text);
        font: inherit;
        cursor: pointer;
      }

      .action-button {
        margin-top: 16px;
      }

      .action-button:hover,
      .control-button:hover {
        border-color: var(--blue);
      }

      .control-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .control-button {
        aspect-ratio: 1;
        min-height: 0;
        display: grid;
        place-items: center;
        font-size: 22px;
        line-height: 1;
        font-weight: 700;
      }

      .control-button.forward,
      .control-button.tilt-up {
        grid-column: 2;
      }

      .control-button.left,
      .control-button.pan-left {
        grid-column: 1;
      }

      .control-button.stop {
        grid-column: 2;
        background: #5b2528;
        border-color: #9a565b;
      }

      .control-button.right,
      .control-button.pan-right {
        grid-column: 3;
      }

      .control-button.backward,
      .control-button.tilt-down {
        grid-column: 2;
      }

      .range-row {
        display: grid;
        grid-template-columns: 54px minmax(0, 1fr) 42px;
        align-items: center;
        gap: 10px;
        margin-top: 12px;
        color: var(--muted);
        font-size: 13px;
      }

      input[type="range"] {
        width: 100%;
      }

      .range-row strong,
      .control-state {
        color: var(--text);
        font-size: 13px;
        font-weight: 600;
      }

      .control-state {
        min-height: 20px;
        margin-top: 10px;
        overflow-wrap: anywhere;
      }

      @media (max-width: 760px) {
        header {
          align-items: flex-start;
          flex-direction: column;
        }

        main {
          grid-template-columns: 1fr;
          grid-template-rows: minmax(320px, 1fr) auto;
        }

        aside {
          border-left: 0;
          border-top: 1px solid var(--line);
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <h1>Herbert Live</h1>
        <div id="status" class="status offline">
          <span class="dot"></span>
          <span id="statusText">Waiting</span>
        </div>
      </header>
      <main>
        <section class="stage">
          <img id="feed" class="feed" alt="Herbert live camera feed">
          <div id="empty" class="empty">No video frame received</div>
        </section>
        <aside>
          <section class="panel">
            <div class="metrics">
              <div class="metric"><span>Frame</span><strong id="frameId">-</strong></div>
              <div class="metric"><span>Frame Age</span><strong id="age">-</strong></div>
              <div class="metric"><span>Resolution</span><strong id="resolution">-</strong></div>
              <div class="metric"><span>Bytes</span><strong id="bytes">-</strong></div>
              <div class="metric"><span>Viewers</span><strong id="viewers">-</strong></div>
              <div class="metric"><span>Control Queue</span><strong id="controlQueue">-</strong></div>
            </div>
            <button id="reconnect" class="action-button" type="button">Reconnect</button>
          </section>
          <section class="panel">
            <h2>Drive</h2>
            <div class="control-grid">
              <button class="control-button forward" type="button" data-control-action="forward" title="Forward" aria-label="Forward">&#8593;</button>
              <button class="control-button left" type="button" data-control-action="steer-left" title="Turn wheels left" aria-label="Turn wheels left">&#8592;</button>
              <button class="control-button stop" type="button" data-control-action="stop" title="Stop" aria-label="Stop">&#9632;</button>
              <button class="control-button right" type="button" data-control-action="steer-right" title="Turn wheels right" aria-label="Turn wheels right">&#8594;</button>
              <button class="control-button backward" type="button" data-control-action="backward" title="Backward" aria-label="Backward">&#8595;</button>
            </div>
            <label class="range-row">
              <span>Speed</span>
              <input id="speed" type="range" min="15" max="80" step="5" value="45">
              <strong id="speedValue">45</strong>
            </label>
            <label class="range-row">
              <span>Pulse</span>
              <input id="pulse" type="range" min="100" max="800" step="50" value="300">
              <strong id="pulseValue">300</strong>
            </label>
          </section>
          <section class="panel">
            <h2>Camera</h2>
            <div class="control-grid">
              <button class="control-button tilt-up" type="button" data-control-action="tilt-up" title="Tilt camera up" aria-label="Tilt camera up">&#9650;</button>
              <button class="control-button pan-left" type="button" data-control-action="pan-left" title="Pan camera left" aria-label="Pan camera left">&#9664;</button>
              <button class="control-button pan-right" type="button" data-control-action="pan-right" title="Pan camera right" aria-label="Pan camera right">&#9654;</button>
              <button class="control-button tilt-down" type="button" data-control-action="tilt-down" title="Tilt camera down" aria-label="Tilt camera down">&#9660;</button>
            </div>
            <div id="controlState" class="control-state">Ready</div>
          </section>
        </aside>
      </main>
    </div>
    <script>
      const statusEl = document.getElementById("status");
      const statusTextEl = document.getElementById("statusText");
      const feedEl = document.getElementById("feed");
      const emptyEl = document.getElementById("empty");
      const frameIdEl = document.getElementById("frameId");
      const ageEl = document.getElementById("age");
      const resolutionEl = document.getElementById("resolution");
      const bytesEl = document.getElementById("bytes");
      const viewersEl = document.getElementById("viewers");
      const controlQueueEl = document.getElementById("controlQueue");
      const reconnectEl = document.getElementById("reconnect");
      const controlStateEl = document.getElementById("controlState");
      const speedEl = document.getElementById("speed");
      const speedValueEl = document.getElementById("speedValue");
      const pulseEl = document.getElementById("pulse");
      const pulseValueEl = document.getElementById("pulseValue");

      function reconnect() {
        feedEl.src = "${videoMjpegPath}?t=" + Date.now();
      }

      function setStatus(name, text) {
        statusEl.className = "status " + name;
        statusTextEl.textContent = text;
      }

      function formatBytes(value) {
        if (value === null) return "-";
        if (value < 1024) return value + " B";
        if (value < 1024 * 1024) return Math.round(value / 1024) + " KB";
        return (value / 1024 / 1024).toFixed(1) + " MB";
      }

      function renderStatus(status) {
        emptyEl.classList.toggle("hidden", status.hasFrame);
        frameIdEl.textContent = status.frameId ?? "-";
        ageEl.textContent = status.ageMs === null ? "-" : Math.round(status.ageMs / 1000) + "s";
        resolutionEl.textContent =
          status.width === null || status.height === null ? "-" : status.width + " x " + status.height;
        bytesEl.textContent = formatBytes(status.byteLength);
        viewersEl.textContent = String(status.subscriberCount);

        if (!status.hasFrame) {
          setStatus("offline", "Waiting");
          return;
        }

        if (status.ageMs !== null && status.ageMs > 5000) {
          setStatus("stale", "Stale");
          return;
        }

        setStatus("live", "Live");
      }

      async function refreshStatus() {
        try {
          const response = await fetch("${videoStatusPath}", { cache: "no-store" });
          renderStatus(await response.json());
        } catch {
          setStatus("offline", "Disconnected");
        }
      }

      async function refreshControlStatus() {
        try {
          const response = await fetch("${robotControlStatusPath}", { cache: "no-store" });
          if (!response.ok) return;

          const status = await response.json();
          controlQueueEl.textContent = String(status.queueDepth);
        } catch {
          controlQueueEl.textContent = "-";
        }
      }

      function updateRangeLabels() {
        speedValueEl.textContent = speedEl.value;
        pulseValueEl.textContent = pulseEl.value;
      }

      function driveCommand(direction) {
        return {
          type: "drive",
          direction,
          speed: Number(speedEl.value),
          durationMs: Number(pulseEl.value),
        };
      }

      function commandForAction(action) {
        if (action === "forward") return driveCommand("forward");
        if (action === "backward") return driveCommand("backward");
        if (action === "steer-left") return { type: "steer", delta: -8 };
        if (action === "steer-right") return { type: "steer", delta: 8 };
        if (action === "tilt-up") return { type: "camera", axis: "tilt", delta: 5 };
        if (action === "tilt-down") return { type: "camera", axis: "tilt", delta: -5 };
        if (action === "pan-left") return { type: "camera", axis: "pan", delta: -5 };
        if (action === "pan-right") return { type: "camera", axis: "pan", delta: 5 };
        if (action === "stop") return { type: "stop" };
        return undefined;
      }

      function actionForKey(event) {
        if (event.key === "ArrowUp") return "forward";
        if (event.key === "ArrowDown") return "backward";
        if (event.key === "ArrowLeft") return "steer-left";
        if (event.key === "ArrowRight") return "steer-right";
        if (event.key.toLowerCase() === "w") return "tilt-up";
        if (event.key.toLowerCase() === "s") return "tilt-down";
        if (event.key.toLowerCase() === "a") return "pan-left";
        if (event.key.toLowerCase() === "d") return "pan-right";
        if (event.key === " ") return "stop";
        return undefined;
      }

      async function sendControl(command) {
        controlStateEl.textContent = "Sending";

        try {
          const response = await fetch("${webControlCommandPath}", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(command),
          });
          const payload = await response.json();

          if (!response.ok) {
            throw new Error(payload.message ?? "Control command failed.");
          }

          controlStateEl.textContent = "Queued " + payload.command.type;
          controlQueueEl.textContent = String(payload.queueDepth);
          await refreshControlStatus();
        } catch (error) {
          controlStateEl.textContent =
            error instanceof Error ? error.message : "Control command failed.";
        }
      }

      document.querySelectorAll("[data-control-action]").forEach((button) => {
        button.addEventListener("click", () => {
          const command = commandForAction(button.dataset.controlAction);
          if (command !== undefined) void sendControl(command);
        });
      });

      document.addEventListener("keydown", (event) => {
        if (event.target instanceof HTMLInputElement) return;

        const action = actionForKey(event);
        if (action === undefined) return;

        const command = commandForAction(action);
        if (command === undefined) return;

        event.preventDefault();
        void sendControl(command);
      });

      reconnectEl.addEventListener("click", reconnect);
      speedEl.addEventListener("input", updateRangeLabels);
      pulseEl.addEventListener("input", updateRangeLabels);
      updateRangeLabels();
      reconnect();
      refreshStatus();
      refreshControlStatus();
      setInterval(refreshStatus, 1000);
      setInterval(refreshControlStatus, 1000);
    </script>
  </body>
</html>`;
