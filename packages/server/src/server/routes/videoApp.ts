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
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>Herbert Cam</title>
    <style>
      :root {
        color-scheme: dark;
        --stage-bg: #0c0907;
        --shell-bg: #1a130d;
        --cream: #f5ead0;
        --cream-soft: #fbf5e1;
        --cream-warm: #ead9ac;
        --cream-deep: #d9c690;
        --brown: #2b1c0e;
        --brown-soft: #4a3320;
        --brown-muted: #7a5d3b;
        --honey: #f0c64a;
        --honey-soft: #f8d670;
        --honey-deep: #b88a1e;
        --burgundy: #962b3a;
        --burgundy-soft: #b54250;
        --burgundy-deep: #5a1820;
        --teal: #2c5847;
        --line: rgba(43, 28, 14, 0.16);
        --line-strong: rgba(43, 28, 14, 0.28);
        --shadow-card: 0 8px 22px rgba(0, 0, 0, 0.28), 0 1px 2px rgba(0, 0, 0, 0.14);
        --shadow-soft: 0 4px 12px rgba(0, 0, 0, 0.18);
      }

      * { box-sizing: border-box; }

      html, body {
        margin: 0;
        height: 100svh;
        overflow: hidden;
        background: var(--shell-bg);
        color: var(--cream);
        font-family:
          ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", "Helvetica Neue", sans-serif;
        overscroll-behavior: none;
        -webkit-tap-highlight-color: transparent;
      }

      .shell {
        height: 100svh;
        display: flex;
        flex-direction: column;
        background:
          radial-gradient(ellipse at 50% 0%, rgba(240, 198, 74, 0.07), transparent 55%),
          var(--shell-bg);
      }

      .stage {
        position: relative;
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        background: var(--stage-bg);
      }

      .feed-wrap {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .feed {
        display: block;
        width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      .masthead {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 4;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: max(12px, env(safe-area-inset-top)) 14px 26px;
        background: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0.55),
          rgba(0, 0, 0, 0.18),
          transparent
        );
        pointer-events: none;
      }

      .identity {
        display: inline-flex;
        align-items: center;
        gap: 11px;
        padding: 7px 16px 7px 7px;
        border-radius: 999px;
        background: var(--cream);
        color: var(--brown);
        box-shadow: var(--shadow-card);
        pointer-events: auto;
      }

      .badge {
        width: 38px;
        height: 38px;
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background:
          radial-gradient(circle at 32% 28%, var(--honey-soft), var(--honey) 55%, var(--honey-deep));
        color: var(--brown);
        font-family: Georgia, "Times New Roman", serif;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.01em;
        box-shadow:
          inset 0 -3px 6px rgba(43, 28, 14, 0.32),
          inset 0 2px 3px rgba(255, 255, 255, 0.55),
          0 1px 1px rgba(0, 0, 0, 0.18);
      }

      .identity-text {
        display: grid;
        gap: 2px;
        min-width: 0;
      }

      h1 {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 18px;
        line-height: 1;
        font-weight: 700;
        color: var(--brown);
        letter-spacing: -0.005em;
      }

      .tagline {
        margin: 0;
        color: var(--brown-muted);
        font-size: 11.5px;
        line-height: 1.1;
        font-style: italic;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 12px;
        border-radius: 999px;
        background: var(--cream);
        color: var(--brown);
        font-size: 12px;
        font-weight: 650;
        box-shadow: var(--shadow-card);
        pointer-events: auto;
      }

      .status[hidden] { display: none; }

      .status .dot {
        width: 8px;
        height: 8px;
        flex: 0 0 auto;
        border-radius: 999px;
      }

      .status.stale { background: #fbecbe; color: #6a4514; }
      .status.stale .dot { background: #d99a14; }
      .status.offline { background: #f5d3d3; color: #7a1d22; }
      .status.offline .dot { background: #c43838; }

      .empty {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: grid;
        place-items: center;
        padding: 110px 22px 28px;
        background: rgba(10, 8, 7, 0.78);
      }

      .empty.hidden { display: none; }

      .empty-panel {
        display: grid;
        gap: 14px;
        width: min(300px, 100%);
        padding: 22px 22px 20px;
        border-radius: 18px;
        background: var(--cream);
        color: var(--brown);
        text-align: center;
        box-shadow: 0 22px 60px rgba(0, 0, 0, 0.5);
      }

      .empty-title {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 20px;
        line-height: 1.15;
        font-weight: 700;
      }

      .empty-sub {
        margin: 0;
        font-size: 13px;
        color: var(--brown-muted);
        font-style: italic;
        line-height: 1.3;
      }

      .action-button {
        display: inline-grid;
        place-items: center;
        justify-self: center;
        min-height: 42px;
        padding: 0 22px;
        border: none;
        border-radius: 999px;
        background: var(--honey);
        color: var(--brown);
        font: inherit;
        font-weight: 750;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 3px 0 var(--honey-deep);
        transition: transform 0.06s ease, box-shadow 0.06s ease, background 0.12s;
      }

      .action-button:hover { background: var(--honey-soft); }

      .action-button:active {
        transform: translateY(2px);
        box-shadow: 0 1px 0 var(--honey-deep);
      }

      .center-button {
        width: 100%;
        min-height: 38px;
        margin-top: 2px;
        font-size: 13px;
      }

      .controls {
        position: relative;
        z-index: 3;
        flex: 0 0 auto;
        padding: 14px 14px max(14px, env(safe-area-inset-bottom));
        background: var(--cream);
        border-top: 2px solid var(--honey);
        color: var(--brown);
        box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.4);
      }

      .controls[hidden] { display: none; }

      .controls-inner {
        max-width: 1100px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 14px;
        align-items: stretch;
      }

      .pad {
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 8px;
        padding: 10px 12px 12px;
        border-radius: 14px;
        background: var(--cream-soft);
        border: 1px solid var(--line);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.65),
          0 1px 2px rgba(43, 28, 14, 0.05);
      }

      .pad-title {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 11.5px;
        line-height: 1;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: var(--brown-muted);
        text-transform: uppercase;
        text-align: center;
      }

      .pad-grid {
        --btn-size: 46px;
        display: grid;
        grid-template-columns: repeat(3, var(--btn-size));
        grid-template-rows: repeat(3, var(--btn-size));
        gap: 6px;
        margin: 0 auto;
      }

      .ctl {
        all: unset;
        position: relative;
        display: grid;
        place-items: center;
        border-radius: 10px;
        background: var(--cream);
        color: var(--brown);
        font-size: 18px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        touch-action: manipulation;
        user-select: none;
        box-shadow:
          0 2px 0 var(--line-strong),
          inset 0 1px 0 rgba(255, 255, 255, 0.5);
        transition: transform 0.05s ease, box-shadow 0.05s ease, background 0.12s;
      }

      .ctl:hover { background: var(--cream-warm); }

      .ctl:active {
        transform: translateY(1px);
        box-shadow: 0 1px 0 var(--line-strong);
      }

      .ctl.drive {
        background: var(--honey);
        box-shadow:
          0 2px 0 var(--honey-deep),
          inset 0 1px 0 rgba(255, 255, 255, 0.42);
      }
      .ctl.drive:hover { background: var(--honey-soft); }
      .ctl.drive:active { box-shadow: 0 1px 0 var(--honey-deep); }

      .ctl.stop {
        background: var(--burgundy);
        color: var(--cream-soft);
        box-shadow:
          0 2px 0 var(--burgundy-deep),
          inset 0 1px 0 rgba(255, 255, 255, 0.18);
      }
      .ctl.stop:hover { background: var(--burgundy-soft); }
      .ctl.stop:active { box-shadow: 0 1px 0 var(--burgundy-deep); }

      .ctl .hk {
        position: absolute;
        bottom: 2px;
        right: 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 0.04em;
        opacity: 0.5;
        pointer-events: none;
      }

      .ctl.stop .hk { color: var(--cream-soft); opacity: 0.7; }

      @media (hover: none) and (pointer: coarse) {
        .ctl .hk { display: none; }
      }

      .pad-grid .pos-up { grid-column: 2; grid-row: 1; }
      .pad-grid .pos-left { grid-column: 1; grid-row: 2; }
      .pad-grid .pos-center { grid-column: 2; grid-row: 2; }
      .pad-grid .pos-right { grid-column: 3; grid-row: 2; }
      .pad-grid .pos-down { grid-column: 2; grid-row: 3; }

      .trim {
        display: grid;
        align-content: center;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 14px;
        background: var(--cream-soft);
        border: 1px solid var(--line);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.65),
          0 1px 2px rgba(43, 28, 14, 0.05);
        min-width: 0;
      }

      .trim-row {
        display: grid;
        grid-template-columns: 54px minmax(0, 1fr) 40px;
        align-items: center;
        gap: 12px;
      }

      .trim-label {
        font-size: 12px;
        font-weight: 700;
        color: var(--brown-soft);
        letter-spacing: 0.02em;
      }

      .trim-value {
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        font-size: 14px;
        color: var(--brown);
      }

      input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 22px;
        background: transparent;
        cursor: pointer;
        margin: 0;
      }

      input[type="range"]::-webkit-slider-runnable-track {
        height: 6px;
        background: var(--cream-warm);
        border-radius: 999px;
        border: 1px solid var(--line);
      }

      input[type="range"]::-moz-range-track {
        height: 6px;
        background: var(--cream-warm);
        border-radius: 999px;
        border: 1px solid var(--line);
      }

      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        margin-top: -8px;
        border-radius: 50%;
        background: var(--honey);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
        border: 2px solid var(--cream-soft);
        cursor: grab;
      }

      input[type="range"]::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--honey);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
        border: 2px solid var(--cream-soft);
        cursor: grab;
      }

      input[type="range"]:focus-visible::-webkit-slider-thumb {
        outline: 2px solid var(--honey-deep);
        outline-offset: 1px;
      }

      .controls-tip {
        max-width: 1100px;
        margin: 10px auto 0;
        text-align: center;
        font-size: 10.5px;
        color: var(--brown-muted);
        font-style: italic;
        letter-spacing: 0.02em;
      }

      .kbd {
        display: inline-block;
        padding: 1px 5px;
        margin: 0 1px;
        border-radius: 4px;
        background: var(--cream-warm);
        color: var(--brown);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10px;
        font-weight: 700;
        font-style: normal;
        border: 1px solid var(--line);
      }

      @media (hover: none) and (pointer: coarse) {
        .controls-tip { display: none; }
      }

      @media (max-width: 720px) {
        .controls {
          padding: 12px 12px max(12px, env(safe-area-inset-bottom));
        }

        .controls-inner {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          grid-template-areas:
            "trim trim"
            "cam drive";
          gap: 10px;
        }

        .pad--camera { grid-area: cam; }
        .pad--drive { grid-area: drive; }

        .trim {
          grid-area: trim;
          padding: 9px 14px 8px;
          gap: 4px;
        }

        .pad {
          padding: 9px 10px 11px;
        }

        .pad-grid {
          --btn-size: clamp(52px, 17vw, 64px);
          gap: 7px;
        }

        .ctl {
          font-size: 22px;
        }

        .controls-tip { display: none; }

        .masthead {
          padding-bottom: 18px;
        }

        .tagline { display: none; }

        h1 { font-size: 16.5px; }

        .badge {
          width: 34px;
          height: 34px;
          font-size: 13px;
        }

        .identity {
          padding: 6px 13px 6px 6px;
        }

        .status {
          padding: 6px 11px;
          font-size: 11.5px;
        }
      }

      @media (max-width: 380px) {
        .controls {
          padding-left: 10px;
          padding-right: 10px;
        }

        .controls-inner { gap: 8px; }
        .pad { padding: 8px 8px 10px; }
        .trim { padding: 8px 12px; }
        .trim-row { grid-template-columns: 48px 1fr 36px; gap: 10px; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <main class="stage">
        <div class="feed-wrap">
          <img id="feed" class="feed" alt="Herbert live camera feed">
        </div>
        <header class="masthead">
          <div class="identity">
            <div class="badge">HC</div>
            <div class="identity-text">
              <h1>Herbert Cam</h1>
              <p class="tagline">Ready for action. Cheerio!</p>
            </div>
          </div>
          <div id="status" class="status" hidden>
            <span class="dot"></span>
            <span id="statusText"></span>
          </div>
        </header>
        <div id="empty" class="empty">
          <div class="empty-panel">
            <div id="emptyTitle" class="empty-title">Waiting for Herbert</div>
            <p id="emptySub" class="empty-sub">Just polishing the lens, one moment...</p>
            <button id="reconnect" class="action-button" type="button">Give him a nudge</button>
          </div>
        </div>
      </main>
      <section id="controls" class="controls" hidden>
        <div class="controls-inner">
          <section class="pad pad--camera">
            <h2 class="pad-title">Camera</h2>
            <div class="pad-grid">
              <button class="ctl pos-up" type="button" data-control-action="tilt-up" title="Tilt camera up (W)" aria-label="Tilt camera up">&#8593;<span class="hk">W</span></button>
              <button class="ctl pos-left" type="button" data-control-action="pan-left" title="Pan camera left (A)" aria-label="Pan camera left">&#8592;<span class="hk">A</span></button>
              <button class="ctl pos-right" type="button" data-control-action="pan-right" title="Pan camera right (D)" aria-label="Pan camera right">&#8594;<span class="hk">D</span></button>
              <button class="ctl pos-down" type="button" data-control-action="tilt-down" title="Tilt camera down (S)" aria-label="Tilt camera down">&#8595;<span class="hk">S</span></button>
            </div>
          </section>
          <section class="trim">
            <label class="trim-row">
              <span class="trim-label">Speed</span>
              <input id="speed" type="range" min="15" max="80" step="5" value="45">
              <strong class="trim-value" id="speedValue">45</strong>
            </label>
            <label class="trim-row">
              <span class="trim-label">Pulse</span>
              <input id="pulse" type="range" min="100" max="800" step="50" value="300">
              <strong class="trim-value" id="pulseValue">300</strong>
            </label>
            <button class="action-button center-button" type="button" data-control-action="center" title="Center wheels and camera (C)" aria-label="Center wheels and camera">Center</button>
          </section>
          <section class="pad pad--drive">
            <h2 class="pad-title">Drive</h2>
            <div class="pad-grid">
              <button class="ctl drive pos-up" type="button" data-control-action="forward" title="Forward (↑)" aria-label="Forward">&#8593;<span class="hk">↑</span></button>
              <button class="ctl drive pos-left" type="button" data-control-action="steer-left" title="Steer left (←)" aria-label="Steer left">&#8592;<span class="hk">←</span></button>
              <button class="ctl stop pos-center" type="button" data-control-action="stop" title="Stop (Space)" aria-label="Stop">&#9632;<span class="hk">␣</span></button>
              <button class="ctl drive pos-right" type="button" data-control-action="steer-right" title="Steer right (→)" aria-label="Steer right">&#8594;<span class="hk">→</span></button>
              <button class="ctl drive pos-down" type="button" data-control-action="backward" title="Backward (↓)" aria-label="Backward">&#8595;<span class="hk">↓</span></button>
            </div>
          </section>
        </div>
        <p class="controls-tip">Arrows to drive · <span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span> for camera · <span class="kbd">C</span> to center · <span class="kbd">Space</span> to stop</p>
      </section>
    </div>
    <script>
      const freshThresholdMs = 2000;
      const staleThresholdMs = 5000;

      const statusEl = document.getElementById("status");
      const statusTextEl = document.getElementById("statusText");
      const feedEl = document.getElementById("feed");
      const emptyEl = document.getElementById("empty");
      const emptyTitleEl = document.getElementById("emptyTitle");
      const emptySubEl = document.getElementById("emptySub");
      const controlsEl = document.getElementById("controls");
      const reconnectEl = document.getElementById("reconnect");
      const speedEl = document.getElementById("speed");
      const speedValueEl = document.getElementById("speedValue");
      const pulseEl = document.getElementById("pulse");
      const pulseValueEl = document.getElementById("pulseValue");

      function reconnect() {
        feedEl.src = "${videoMjpegPath}?t=" + Date.now();
      }

      function showStatus(name, text) {
        statusEl.className = "status " + name;
        statusTextEl.textContent = text;
        statusEl.hidden = false;
      }

      function hideStatus() {
        statusEl.hidden = true;
      }

      function formatAge(value) {
        if (value === null || value === undefined) return "";
        if (value < 1000) return "<1s";
        if (value < 60000) return Math.round(value / 1000) + "s";
        return Math.round(value / 60000) + "m";
      }

      function setConnected(connected) {
        controlsEl.hidden = !connected;
        emptyEl.classList.toggle("hidden", connected);
      }

      function showEmpty(title, sub) {
        emptyTitleEl.textContent = title;
        emptySubEl.textContent = sub;
      }

      function renderStatus(status) {
        if (!status.hasFrame) {
          setConnected(false);
          showEmpty(
            "Waiting for Herbert",
            "Just polishing the lens, one moment..."
          );
          showStatus("offline", "Connecting");
          return;
        }

        const ageMs = status.ageMs ?? 0;

        if (ageMs >= staleThresholdMs) {
          setConnected(false);
          showEmpty(
            "Feed's gone quiet",
            "Last frame " + formatAge(ageMs) + " ago. Try reconnecting."
          );
          showStatus("stale", "Stale " + formatAge(ageMs));
          return;
        }

        setConnected(true);

        if (ageMs >= freshThresholdMs) {
          showStatus("stale", "Lagging " + formatAge(ageMs));
        } else {
          hideStatus();
        }
      }

      async function refreshStatus() {
        try {
          const response = await fetch("${videoStatusPath}", {
            cache: "no-store",
          });
          renderStatus(await response.json());
        } catch {
          setConnected(false);
          showEmpty(
            "Herbert is unreachable",
            "We can't reach the server. Check that he's running."
          );
          showStatus("offline", "Offline");
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
        if (action === "center") return { type: "center" };
        return undefined;
      }

      function actionForKey(event) {
        if (event.key === "ArrowUp") return "forward";
        if (event.key === "ArrowDown") return "backward";
        if (event.key === "ArrowLeft") return "steer-left";
        if (event.key === "ArrowRight") return "steer-right";
        const lower = event.key.toLowerCase();
        if (lower === "w") return "tilt-up";
        if (lower === "s") return "tilt-down";
        if (lower === "a") return "pan-left";
        if (lower === "d") return "pan-right";
        if (lower === "c") return "center";
        if (event.key === " " || lower === "space" || lower === "escape") return "stop";
        return undefined;
      }

      let lastSent = 0;
      async function sendControl(command) {
        if (controlsEl.hidden) return;
        const now = Date.now();
        if (now - lastSent < 80) return;
        lastSent = now;

        try {
          const response = await fetch("${webControlCommandPath}", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(command),
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.message ?? "Control command failed.");
          }
        } catch (error) {
          showStatus(
            "offline",
            error instanceof Error ? error.message : "Control failed"
          );
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
        if (event.repeat) return;

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
