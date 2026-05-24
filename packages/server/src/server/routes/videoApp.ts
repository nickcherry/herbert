import {
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
    <title>Herbert Cam</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07100d;
        --panel: rgba(15, 35, 29, 0.92);
        --panel-strong: rgba(20, 39, 32, 0.96);
        --text: #fff6dd;
        --muted: #d2c39b;
        --line: rgba(229, 188, 91, 0.42);
        --brass: #e5bc5b;
        --brass-soft: #ffe095;
        --green: #74d99c;
        --yellow: #f0c86b;
        --red: #ef766b;
        --blue: #83cfe8;
        --rose: #e98a8f;
        --burgundy: #6f2537;
        --button: rgba(30, 73, 62, 0.96);
        --button-2: rgba(44, 91, 78, 0.96);
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        width: 100%;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
        overscroll-behavior: none;
      }

      .shell {
        min-height: 100svh;
        background:
          repeating-linear-gradient(
            135deg,
            rgba(229, 188, 91, 0.05) 0,
            rgba(229, 188, 91, 0.05) 1px,
            transparent 1px,
            transparent 18px
          ),
          linear-gradient(145deg, rgba(39, 83, 68, 0.32), rgba(8, 13, 11, 0) 54%),
          #07100d;
      }

      .stage {
        position: relative;
        min-height: 100svh;
        background: #050607;
        overflow: hidden;
      }

      .feed {
        display: block;
        width: 100%;
        height: 100svh;
        object-fit: contain;
        background: #050607;
      }

      .masthead {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 4;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: max(12px, env(safe-area-inset-top)) 12px 10px;
        background: linear-gradient(
          to bottom,
          rgba(5, 8, 7, 0.92),
          rgba(5, 8, 7, 0.62),
          rgba(5, 8, 7, 0)
        );
        pointer-events: none;
      }

      .identity {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        padding: 8px 10px 8px 8px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background:
          linear-gradient(135deg, rgba(30, 73, 62, 0.86), rgba(14, 24, 21, 0.82)),
          rgba(15, 24, 21, 0.76);
        box-shadow:
          inset 0 1px 0 rgba(255, 246, 221, 0.08),
          0 10px 30px rgba(0, 0, 0, 0.22);
        backdrop-filter: blur(10px);
      }

      .chauffeur-mark {
        width: 32px;
        height: 32px;
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        border: 1px solid rgba(229, 188, 91, 0.8);
        border-radius: 999px;
        color: var(--brass-soft);
        background:
          radial-gradient(circle at 35% 25%, rgba(255, 246, 221, 0.2), transparent 38%),
          rgba(111, 37, 55, 0.52);
        font-family: Georgia, "Times New Roman", serif;
        font-size: 13px;
        font-weight: 700;
        box-shadow: inset 0 -8px 14px rgba(0, 0, 0, 0.22);
      }

      .identity-text {
        display: grid;
        gap: 1px;
        min-width: 0;
      }

      h1 {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 19px;
        line-height: 1.2;
        font-weight: 700;
        letter-spacing: 0;
      }

      .tagline {
        margin: 0;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.1;
        font-style: italic;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 30px;
        max-width: 46vw;
        padding: 0 9px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background:
          linear-gradient(135deg, rgba(28, 64, 54, 0.84), rgba(15, 24, 21, 0.78)),
          rgba(15, 24, 21, 0.78);
        font-size: 12px;
        font-weight: 650;
        white-space: nowrap;
        backdrop-filter: blur(10px);
      }

      .dot {
        width: 8px;
        height: 8px;
        flex: 0 0 auto;
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

      .status-age {
        color: var(--muted);
        font-weight: 600;
      }

      .empty {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: grid;
        place-items: center;
        padding: 80px 18px 24px;
        background: rgba(5, 8, 7, 0.62);
        color: var(--muted);
      }

      .empty.hidden {
        display: none;
      }

      .empty-panel {
        display: grid;
        gap: 12px;
        width: min(260px, 100%);
        padding: 16px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background:
          linear-gradient(145deg, rgba(38, 80, 66, 0.48), rgba(20, 39, 32, 0.96)),
          var(--panel-strong);
        text-align: center;
        box-shadow: 0 16px 42px rgba(0, 0, 0, 0.32);
      }

      .empty-title {
        color: var(--text);
        font-family: Georgia, "Times New Roman", serif;
        font-size: 18px;
        font-weight: 700;
      }

      .controls {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 3;
        padding: 46px 10px max(10px, env(safe-area-inset-bottom));
        background: linear-gradient(
          to top,
          rgba(5, 8, 7, 0.96),
          rgba(5, 8, 7, 0.78),
          rgba(5, 8, 7, 0)
        );
        pointer-events: none;
      }

      .controls[hidden] {
        display: none;
      }

      .controls-panel {
        width: min(920px, 100%);
        margin: 0 auto;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(190px, 0.82fr);
        gap: 10px;
        align-items: end;
        pointer-events: auto;
      }

      .panel {
        min-width: 0;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background:
          linear-gradient(180deg, rgba(255, 246, 221, 0.04), transparent 28%),
          repeating-linear-gradient(
            90deg,
            transparent 0,
            transparent 13px,
            rgba(229, 188, 91, 0.035) 13px,
            rgba(229, 188, 91, 0.035) 14px
          ),
          var(--panel);
        box-shadow:
          inset 0 1px 0 rgba(255, 246, 221, 0.08),
          0 14px 38px rgba(0, 0, 0, 0.24);
      }

      .panel h2 {
        margin: 0 0 8px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.2;
        font-weight: 650;
        text-transform: uppercase;
        text-shadow: 0 1px 0 rgba(0, 0, 0, 0.32);
      }

      .action-button,
      .control-button {
        width: 100%;
        border: 1px solid rgba(216, 181, 109, 0.42);
        border-radius: 8px;
        background: var(--button);
        color: var(--text);
        font: inherit;
        cursor: pointer;
        touch-action: manipulation;
        user-select: none;
      }

      .action-button:hover,
      .control-button:hover {
        border-color: var(--brass);
        background: var(--button-2);
      }

      .action-button {
        min-height: 44px;
        color: #17120b;
        background:
          linear-gradient(180deg, var(--brass-soft), var(--brass)),
          var(--brass);
        font-weight: 750;
        box-shadow:
          inset 0 1px 0 rgba(255, 246, 221, 0.42),
          0 10px 22px rgba(0, 0, 0, 0.24);
      }

      .control-grid {
        width: max-content;
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(3, var(--button-size));
        gap: 6px;
        --button-size: clamp(46px, 13vw, 72px);
      }

      .control-button {
        aspect-ratio: 1;
        min-height: 0;
        display: grid;
        place-items: center;
        font-size: clamp(20px, 5vw, 28px);
        line-height: 1;
        font-weight: 700;
        color: #fff8e6;
        text-shadow: 0 2px 0 rgba(0, 0, 0, 0.34);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.08),
          0 8px 18px rgba(0, 0, 0, 0.22);
      }

      .control-button:active {
        transform: translateY(1px) scale(0.98);
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
        background: var(--burgundy);
        border-color: rgba(233, 138, 143, 0.72);
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
        grid-template-columns: 42px minmax(0, 1fr) 34px;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        color: var(--muted);
        font-size: 12px;
      }

      input[type="range"] {
        width: 100%;
        accent-color: var(--rose);
      }

      .range-row strong,
      .control-state {
        color: var(--text);
        font-size: 12px;
        font-weight: 600;
      }

      .trim-panel {
        display: grid;
        gap: 6px;
      }

      .control-state {
        min-height: 16px;
        overflow-wrap: anywhere;
        color: var(--muted);
      }

      @media (max-width: 820px) {
        .controls-panel {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        }

        .trim-panel {
          grid-column: 1 / -1;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          align-items: center;
        }

        .control-state {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 430px) {
        .masthead {
          padding-left: 8px;
          padding-right: 8px;
        }

        .identity {
          padding: 7px 8px 7px 7px;
        }

        .chauffeur-mark {
          width: 28px;
          height: 28px;
          font-size: 16px;
        }

        h1 {
          font-size: 17px;
        }

        .tagline {
          display: none;
        }

        .status {
          max-width: 48vw;
          min-height: 28px;
          font-size: 11px;
        }

        .controls {
          padding-left: 8px;
          padding-right: 8px;
        }

        .controls-panel {
          gap: 8px;
        }

        .panel {
          padding: 8px;
        }

        .control-grid {
          gap: 5px;
        }

        .range-row {
          grid-template-columns: 38px minmax(0, 1fr) 30px;
          gap: 6px;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <main class="stage">
        <img id="feed" class="feed" alt="Herbert live camera feed">
        <header class="masthead">
          <div class="identity">
            <div class="chauffeur-mark">HC</div>
            <div class="identity-text">
              <h1>Herbert Cam</h1>
              <p class="tagline">Cheerio, ready</p>
            </div>
          </div>
          <div id="status" class="status offline">
            <span class="dot"></span>
            <span id="statusText">Waiting</span>
            <span id="ageText" class="status-age">-</span>
          </div>
        </header>
        <div id="empty" class="empty">
          <div class="empty-panel">
            <div id="emptyTitle" class="empty-title">Awaiting Herbert Cam</div>
            <button id="reconnect" class="action-button" type="button">Reconnect</button>
          </div>
        </div>
        <section id="controls" class="controls" hidden>
          <div class="controls-panel">
            <section class="panel">
              <h2>Drive</h2>
              <div class="control-grid">
                <button class="control-button forward" type="button" data-control-action="forward" title="Forward" aria-label="Forward">&#8593;</button>
                <button class="control-button left" type="button" data-control-action="steer-left" title="Turn wheels left" aria-label="Turn wheels left">&#8592;</button>
                <button class="control-button stop" type="button" data-control-action="stop" title="Stop" aria-label="Stop">&#9632;</button>
                <button class="control-button right" type="button" data-control-action="steer-right" title="Turn wheels right" aria-label="Turn wheels right">&#8594;</button>
                <button class="control-button backward" type="button" data-control-action="backward" title="Backward" aria-label="Backward">&#8595;</button>
              </div>
            </section>
            <section class="panel">
              <h2>Camera</h2>
              <div class="control-grid">
                <button class="control-button tilt-up" type="button" data-control-action="tilt-up" title="Tilt camera up" aria-label="Tilt camera up">&#8593;</button>
                <button class="control-button pan-left" type="button" data-control-action="pan-left" title="Pan camera left" aria-label="Pan camera left">&#8592;</button>
                <button class="control-button pan-right" type="button" data-control-action="pan-right" title="Pan camera right" aria-label="Pan camera right">&#8594;</button>
                <button class="control-button tilt-down" type="button" data-control-action="tilt-down" title="Tilt camera down" aria-label="Tilt camera down">&#8595;</button>
              </div>
            </section>
            <section class="panel trim-panel">
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
              <div id="controlState" class="control-state">Ready</div>
            </section>
          </div>
        </section>
      </main>
    </div>
    <script>
      const staleThresholdMs = 5000;

      const statusEl = document.getElementById("status");
      const statusTextEl = document.getElementById("statusText");
      const ageTextEl = document.getElementById("ageText");
      const feedEl = document.getElementById("feed");
      const emptyEl = document.getElementById("empty");
      const emptyTitleEl = document.getElementById("emptyTitle");
      const controlsEl = document.getElementById("controls");
      const reconnectEl = document.getElementById("reconnect");
      const controlStateEl = document.getElementById("controlState");
      const speedEl = document.getElementById("speed");
      const speedValueEl = document.getElementById("speedValue");
      const pulseEl = document.getElementById("pulse");
      const pulseValueEl = document.getElementById("pulseValue");

      function reconnect() {
        feedEl.src = "${videoMjpegPath}?t=" + Date.now();
      }

      function setStatus(name, text, ageText) {
        statusEl.className = "status " + name;
        statusTextEl.textContent = text;
        ageTextEl.textContent = ageText;
      }

      function formatAge(value) {
        if (value === null) return "-";
        if (value < 1000) return "<1s";
        if (value < 60000) return Math.round(value / 1000) + "s";
        return Math.round(value / 60000) + "m";
      }

      function setConnected(connected) {
        controlsEl.hidden = !connected;
        emptyEl.classList.toggle("hidden", connected);
      }

      function renderDisconnected(title, statusText, ageText) {
        setConnected(false);
        emptyTitleEl.textContent = title;
        setStatus("offline", statusText, ageText);
      }

      function renderStatus(status) {
        if (!status.hasFrame) {
          renderDisconnected("Awaiting Herbert Cam", "Waiting", "-");
          return;
        }

        const ageText = formatAge(status.ageMs);

        if (status.ageMs !== null && status.ageMs > staleThresholdMs) {
          setConnected(false);
          emptyTitleEl.textContent = "Feed is stale";
          setStatus("stale", "Stale", ageText);
          return;
        }

        setConnected(true);
        setStatus("live", "Connected", ageText);
      }

      async function refreshStatus() {
        try {
          const response = await fetch("${videoStatusPath}", { cache: "no-store" });
          renderStatus(await response.json());
        } catch {
          renderDisconnected("Herbert is unreachable", "Offline", "-");
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
        if (controlsEl.hidden) return;

        controlStateEl.textContent = "Sending...";

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

          controlStateEl.textContent = "Right away: " + payload.command.type;
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
        if (event.target instanceof HTMLInputElement || controlsEl.hidden) return;

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
      setInterval(refreshStatus, 1000);
    </script>
  </body>
</html>`;
