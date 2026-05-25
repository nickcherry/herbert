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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Fraunces:opsz,wght@9..144,600;9..144,800;9..144,900&family=Inter:wght@500;600;700;800&display=swap" rel="stylesheet">
    <style>
      :root {
        color-scheme: light;
        --paper: #f3e7c8;
        --paper-soft: #faf1d6;
        --paper-warm: #ecdaa6;
        --paper-deep: #d8c187;

        --ink: #211408;
        --ink-soft: #3d2a16;
        --ink-mid: #5e4524;
        --ink-muted: #8a6f44;

        --honey: #f1c34a;
        --honey-soft: #f7d572;
        --honey-deep: #bf8a18;

        --sage: #aac3a0;
        --sage-soft: #c4d6bc;
        --sage-deep: #7b9871;

        --postbox: #c8302f;
        --postbox-soft: #db4a48;
        --postbox-deep: #8a1c1b;

        --tweed: #5e3f1c;

        --shadow-card: 0 8px 22px rgba(48, 30, 12, 0.22), 0 1px 2px rgba(48, 30, 12, 0.12);
        --shadow-soft: 0 3px 8px rgba(48, 30, 12, 0.14);
      }

      * { box-sizing: border-box; }

      html, body {
        margin: 0;
        height: 100svh;
        overflow: hidden;
        background: var(--paper);
        color: var(--ink);
        font-family: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-feature-settings: "ss01", "cv11";
        overscroll-behavior: none;
        -webkit-tap-highlight-color: transparent;
      }

      .shell {
        height: 100svh;
        display: flex;
        flex-direction: column;
        background:
          repeating-linear-gradient(
            90deg,
            transparent 0,
            transparent 40px,
            rgba(122, 152, 113, 0.07) 40px,
            rgba(122, 152, 113, 0.07) 41px
          ),
          radial-gradient(ellipse 60% 40% at 14% 92%, rgba(94, 63, 28, 0.06), transparent 70%),
          radial-gradient(ellipse 50% 30% at 88% 8%, rgba(94, 63, 28, 0.05), transparent 70%),
          var(--paper);
      }

      .stage {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        padding: 14px 14px 0;
      }

      .feed-card {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        padding: 10px 10px 10px;
        border-radius: 22px;
        background: var(--paper-soft);
        border: 2.5px solid var(--ink);
        box-shadow:
          0 6px 0 var(--ink),
          0 14px 32px rgba(48, 30, 12, 0.32);
        display: flex;
        flex-direction: column;
      }

      .feed-wrap {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        border-radius: 14px;
        background: #0a0807;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .feed {
        display: block;
        width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      .masthead {
        position: absolute;
        top: 22px;
        left: 22px;
        right: 22px;
        z-index: 4;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        pointer-events: none;
      }

      .identity {
        display: inline-flex;
        align-items: center;
        gap: 11px;
        padding: 7px 18px 8px 7px;
        border-radius: 999px;
        background: var(--paper-soft);
        color: var(--ink);
        border: 2px solid var(--ink);
        box-shadow: 0 4px 0 var(--ink), 0 10px 26px rgba(0, 0, 0, 0.32);
        pointer-events: auto;
        transform: rotate(-1.6deg);
        transition: transform 0.25s ease;
        animation: tilt-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
        animation-delay: 0.15s;
      }

      .identity:hover { transform: rotate(0deg) translateY(-1px); }

      @keyframes tilt-in {
        0% { transform: rotate(-14deg) translateY(-22px); opacity: 0; }
        60% { transform: rotate(-2.5deg) translateY(0); opacity: 1; }
        100% { transform: rotate(-1.6deg) translateY(0); opacity: 1; }
      }

      .badge {
        width: 40px;
        height: 40px;
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background:
          radial-gradient(circle at 32% 26%, var(--honey-soft) 0%, var(--honey) 55%, var(--honey-deep) 100%);
        color: var(--ink);
        border: 2px solid var(--ink);
        font-family: "Fraunces", Georgia, serif;
        font-variation-settings: "SOFT" 100, "WONK" 1;
        font-size: 15px;
        font-weight: 900;
        letter-spacing: -0.02em;
        box-shadow:
          inset 0 -3px 6px rgba(48, 30, 12, 0.3),
          inset 0 2px 3px rgba(255, 255, 255, 0.55);
      }

      .identity-text {
        display: grid;
        gap: 1px;
        min-width: 0;
      }

      h1 {
        margin: 0;
        font-family: "Fraunces", Georgia, "Times New Roman", serif;
        font-variation-settings: "SOFT" 70, "WONK" 1;
        font-optical-sizing: auto;
        font-size: 20px;
        line-height: 1;
        font-weight: 800;
        color: var(--ink);
        letter-spacing: -0.012em;
      }

      .tagline {
        margin: 2px 0 0;
        font-family: "Caveat", "Bradley Hand", cursive;
        font-size: 17px;
        line-height: 1;
        color: var(--postbox);
        font-weight: 700;
        letter-spacing: 0.01em;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 13px;
        border-radius: 6px;
        background: var(--paper-soft);
        color: var(--ink);
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        border: 2px solid var(--ink);
        box-shadow: 0 3px 0 var(--ink), 0 6px 16px rgba(0, 0, 0, 0.3);
        pointer-events: auto;
        transform: rotate(2.2deg);
      }

      .status[hidden] { display: none; }

      .status .dot {
        width: 9px;
        height: 9px;
        flex: 0 0 auto;
        border-radius: 999px;
        border: 1.5px solid var(--ink);
      }

      .status.stale { background: #fbe6a9; color: #6a4514; }
      .status.stale .dot { background: var(--honey-deep); animation: pulse-amber 1.5s ease-in-out infinite; }
      .status.offline { background: #f5cdcd; color: #6e1f1f; }
      .status.offline .dot { background: var(--postbox); animation: pulse-red 1.2s ease-in-out infinite; }

      @keyframes pulse-amber {
        0%, 100% { box-shadow: 0 0 0 0 rgba(191, 138, 24, 0); }
        50% { box-shadow: 0 0 0 5px rgba(191, 138, 24, 0.22); }
      }
      @keyframes pulse-red {
        0%, 100% { box-shadow: 0 0 0 0 rgba(200, 48, 47, 0); }
        50% { box-shadow: 0 0 0 5px rgba(200, 48, 47, 0.25); }
      }

      .empty {
        position: absolute;
        inset: 10px;
        z-index: 2;
        display: grid;
        place-items: center;
        padding: 24px;
        background: rgba(10, 8, 7, 0.82);
        border-radius: 14px;
      }

      .empty.hidden { display: none; }

      .empty-panel {
        display: grid;
        gap: 14px;
        width: min(320px, 100%);
        padding: 28px 26px 22px;
        border-radius: 18px;
        background: var(--paper-soft);
        color: var(--ink);
        text-align: center;
        border: 2.5px solid var(--ink);
        box-shadow: 0 6px 0 var(--ink), 0 22px 60px rgba(0, 0, 0, 0.55);
        position: relative;
        transform: rotate(-0.8deg);
      }

      .empty-panel::before {
        content: "";
        position: absolute;
        top: -12px;
        left: 50%;
        transform: translateX(-50%) rotate(-4deg);
        width: 88px;
        height: 22px;
        background: rgba(241, 195, 74, 0.7);
        border: 1.5px dashed rgba(48, 30, 12, 0.35);
        border-radius: 3px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.18);
      }

      .empty-title {
        font-family: "Fraunces", Georgia, serif;
        font-variation-settings: "SOFT" 70, "WONK" 1;
        font-size: 22px;
        line-height: 1.15;
        font-weight: 800;
      }

      .empty-sub {
        margin: 0;
        font-family: "Caveat", cursive;
        font-size: 18px;
        color: var(--ink-mid);
        line-height: 1.2;
      }

      .action-button {
        display: inline-grid;
        place-items: center;
        justify-self: center;
        min-height: 42px;
        padding: 0 22px;
        border: 2.5px solid var(--ink);
        border-radius: 999px;
        background: var(--honey);
        color: var(--ink);
        font: inherit;
        font-weight: 800;
        font-size: 14px;
        letter-spacing: 0.01em;
        cursor: pointer;
        box-shadow: 0 4px 0 var(--ink);
        transition: transform 0.06s ease, box-shadow 0.06s ease, background 0.12s;
      }

      .action-button:hover { background: var(--honey-soft); }

      .action-button:active {
        transform: translateY(3px);
        box-shadow: 0 1px 0 var(--ink);
      }

      .action-button:focus-visible {
        outline: 3px solid var(--sage);
        outline-offset: 3px;
      }

      .center-button {
        width: 100%;
        min-height: 40px;
        border-radius: 12px;
        font-family: "Caveat", cursive;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0.01em;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
      }

      .straighten-icon {
        display: inline-block;
        font-size: 17px;
        line-height: 1;
        transform-origin: center;
        transition: transform 0.4s ease;
      }

      .center-button:hover .straighten-icon {
        transform: rotate(-360deg);
      }

      .center-button:active .straighten-icon {
        transition-duration: 0.15s;
      }

      .controls {
        position: relative;
        z-index: 3;
        flex: 0 0 auto;
        padding: 16px 14px max(14px, env(safe-area-inset-bottom));
        color: var(--ink);
        background:
          linear-gradient(to bottom, rgba(94, 63, 28, 0.04), transparent 30%),
          var(--paper);
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
        gap: 9px;
        padding: 10px 14px 12px;
        border-radius: 16px;
        background: var(--paper-soft);
        border: 2.5px solid var(--ink);
        box-shadow:
          0 4px 0 var(--ink),
          inset 0 1px 0 rgba(255, 255, 255, 0.55);
        position: relative;
      }

      .pad-title {
        margin: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        font-family: "Caveat", cursive;
        font-size: 18px;
        line-height: 1;
        font-weight: 700;
        letter-spacing: 0.01em;
        color: var(--ink);
        text-align: center;
      }

      .title-squiggle {
        width: 54px;
        height: 5px;
        color: var(--honey-deep);
        opacity: 0.6;
      }

      .pad-grid {
        --btn-size: 48px;
        display: grid;
        grid-template-columns: repeat(3, var(--btn-size));
        grid-template-rows: repeat(3, var(--btn-size));
        gap: 7px;
        margin: 0 auto;
      }

      .ctl {
        all: unset;
        position: relative;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: var(--paper-soft);
        color: var(--ink);
        font-size: 20px;
        font-weight: 800;
        line-height: 1;
        cursor: pointer;
        touch-action: manipulation;
        user-select: none;
        border: 2px solid var(--ink);
        box-shadow:
          0 3px 0 var(--ink),
          inset 0 1px 0 rgba(255, 255, 255, 0.5);
        transition: transform 0.05s ease, box-shadow 0.05s ease, background 0.12s;
      }

      .ctl:hover { background: var(--paper-warm); }

      .ctl:active {
        transform: translateY(2px);
        box-shadow:
          0 1px 0 var(--ink),
          inset 0 1px 0 rgba(255, 255, 255, 0.5);
      }

      .ctl:focus-visible {
        outline: 3px solid var(--sage);
        outline-offset: 3px;
      }

      .ctl.drive {
        background: var(--honey);
      }
      .ctl.drive:hover { background: var(--honey-soft); }

      .ctl.cam {
        background: var(--sage);
      }
      .ctl.cam:hover { background: var(--sage-soft); }

      .ctl.stop {
        background: var(--postbox);
        color: var(--paper-soft);
      }
      .ctl.stop:hover { background: var(--postbox-soft); }

      @keyframes stop-wiggle {
        0%, 100% { transform: translateY(2px) rotate(0deg); }
        20% { transform: translate(-2px, 2px) rotate(-3deg); }
        40% { transform: translate(2px, 2px) rotate(3deg); }
        60% { transform: translate(-1.5px, 2px) rotate(-2deg); }
        80% { transform: translate(1.5px, 2px) rotate(2deg); }
      }

      .ctl.stop.wiggle {
        animation: stop-wiggle 0.34s ease-out;
        box-shadow: 0 1px 0 var(--ink), inset 0 1px 0 rgba(255, 255, 255, 0.25);
      }

      .ctl .hk {
        position: absolute;
        bottom: 3px;
        right: 5px;
        font-family: "Inter", ui-monospace, monospace;
        font-size: 8.5px;
        font-weight: 800;
        letter-spacing: 0.04em;
        opacity: 0.55;
        pointer-events: none;
      }

      .ctl.stop .hk { color: var(--paper-soft); opacity: 0.78; }

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
        gap: 12px;
        padding: 14px 18px 12px;
        border-radius: 16px;
        background: var(--paper-soft);
        border: 2.5px solid var(--ink);
        box-shadow:
          0 4px 0 var(--ink),
          inset 0 1px 0 rgba(255, 255, 255, 0.55);
        min-width: 0;
      }

      .trim-row {
        display: grid;
        grid-template-columns: 64px minmax(0, 1fr) 58px;
        align-items: center;
        gap: 12px;
      }

      .trim-label {
        font-family: "Caveat", cursive;
        font-size: 17px;
        font-weight: 700;
        color: var(--ink);
        letter-spacing: 0.01em;
      }

      .trim-value {
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-weight: 900;
        font-size: 15px;
        color: var(--ink);
        font-family: "Fraunces", serif;
      }

      input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 24px;
        background: transparent;
        cursor: pointer;
        margin: 0;
      }

      input[type="range"]::-webkit-slider-runnable-track {
        height: 8px;
        background:
          radial-gradient(circle at 25% 50%, rgba(33, 20, 8, 0.32) 1.5px, transparent 1.8px),
          radial-gradient(circle at 50% 50%, rgba(33, 20, 8, 0.32) 1.5px, transparent 1.8px),
          radial-gradient(circle at 75% 50%, rgba(33, 20, 8, 0.32) 1.5px, transparent 1.8px),
          var(--paper-warm);
        border-radius: 999px;
        border: 1.5px solid var(--ink);
      }

      input[type="range"]::-moz-range-track {
        height: 8px;
        background:
          radial-gradient(circle at 25% 50%, rgba(33, 20, 8, 0.32) 1.5px, transparent 1.8px),
          radial-gradient(circle at 50% 50%, rgba(33, 20, 8, 0.32) 1.5px, transparent 1.8px),
          radial-gradient(circle at 75% 50%, rgba(33, 20, 8, 0.32) 1.5px, transparent 1.8px),
          var(--paper-warm);
        border-radius: 999px;
        border: 1.5px solid var(--ink);
      }

      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 22px;
        height: 22px;
        margin-top: -9px;
        border-radius: 50%;
        background: var(--honey);
        border: 2px solid var(--ink);
        box-shadow: 0 2px 0 var(--ink);
        cursor: grab;
      }

      input[type="range"]::-webkit-slider-thumb:active {
        cursor: grabbing;
        box-shadow: 0 0 0 var(--ink);
        transform: translateY(2px);
      }

      input[type="range"]::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--honey);
        border: 2px solid var(--ink);
        box-shadow: 0 2px 0 var(--ink);
        cursor: grab;
      }

      input[type="range"]:focus-visible::-webkit-slider-thumb {
        outline: 3px solid var(--sage);
        outline-offset: 2px;
      }

      .controls-tip {
        max-width: 1100px;
        margin: 14px auto 0;
        text-align: center;
        font-family: "Caveat", cursive;
        font-size: 15px;
        color: var(--ink-mid);
        letter-spacing: 0.01em;
      }

      .kbd {
        display: inline-grid;
        place-items: center;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        margin: 0 2px;
        border-radius: 5px;
        background: var(--paper-soft);
        color: var(--ink);
        font-family: "Inter", ui-monospace, monospace;
        font-size: 10px;
        font-weight: 800;
        border: 1.5px solid var(--ink);
        box-shadow: 0 1.5px 0 var(--ink);
        vertical-align: 2px;
        line-height: 1;
      }

      @media (hover: none) and (pointer: coarse) {
        .controls-tip { display: none; }
      }

      @media (max-width: 720px) {
        .stage { padding: 8px 8px 0; }

        .feed-card {
          padding: 8px;
          border-radius: 18px;
        }

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
          padding: 10px 14px 9px;
          gap: 6px;
        }

        .trim-row {
          grid-template-columns: 58px minmax(0, 1fr) 52px;
          gap: 10px;
        }

        .center-button { min-height: 36px; font-size: 16px; margin-top: 2px; }

        .pad { padding: 9px 12px 11px; }

        .pad-grid {
          --btn-size: clamp(54px, 17vw, 64px);
          gap: 8px;
        }

        .ctl { font-size: 22px; }

        .masthead {
          top: 14px;
          left: 16px;
          right: 16px;
        }

        .tagline { display: none; }
        h1 { font-size: 17px; }
        .badge { width: 36px; height: 36px; font-size: 14px; }
        .identity { padding: 6px 15px 6px 6px; }
        .status { padding: 6px 11px; font-size: 10.5px; }
      }

      @media (max-width: 380px) {
        .stage { padding: 6px 6px 0; }
        .feed-card { padding: 6px; border-radius: 16px; }
        .controls { padding-left: 10px; padding-right: 10px; }
        .controls-inner { gap: 8px; }
        .pad { padding: 8px 10px 10px; }
        .trim { padding: 8px 12px; }
        .trim-row { grid-template-columns: 52px 1fr 48px; gap: 8px; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <main class="stage">
        <div class="feed-card">
          <div class="feed-wrap">
            <img id="feed" class="feed" alt="Herbert live camera feed">
          </div>
          <div id="empty" class="empty">
            <div class="empty-panel">
              <div id="emptyTitle" class="empty-title">Waiting for Herbert</div>
              <p id="emptySub" class="empty-sub">Just polishing the lens, one moment...</p>
              <button id="reconnect" class="action-button" type="button">Give him a nudge</button>
            </div>
          </div>
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
      </main>
      <section id="controls" class="controls" hidden>
        <div class="controls-inner">
          <section class="pad pad--camera">
            <h2 class="pad-title">Camera<svg class="title-squiggle" viewBox="0 0 70 6" preserveAspectRatio="none" aria-hidden="true"><path d="M2 3 Q18 0.5 35 3 T68 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg></h2>
            <div class="pad-grid">
              <button class="ctl cam pos-up" type="button" data-control-action="tilt-up" title="Tilt camera up (W)" aria-label="Tilt camera up">&#8593;<span class="hk">W</span></button>
              <button class="ctl cam pos-left" type="button" data-control-action="pan-left" title="Pan camera left (A)" aria-label="Pan camera left">&#8592;<span class="hk">A</span></button>
              <button class="ctl cam pos-right" type="button" data-control-action="pan-right" title="Pan camera right (D)" aria-label="Pan camera right">&#8594;<span class="hk">D</span></button>
              <button class="ctl cam pos-down" type="button" data-control-action="tilt-down" title="Tilt camera down (S)" aria-label="Tilt camera down">&#8595;<span class="hk">S</span></button>
            </div>
          </section>
          <section class="trim">
            <label class="trim-row">
              <span class="trim-label">Speed</span>
              <input id="speed" type="range" min="15" max="80" step="5" value="80">
              <strong class="trim-value" id="speedValue">80</strong>
            </label>
            <label class="trim-row">
              <span class="trim-label">Pulse</span>
              <input id="pulse" type="range" min="100" max="3000" step="50" value="1500">
              <strong class="trim-value" id="pulseValue">1500ms</strong>
            </label>
            <button class="action-button center-button" type="button" data-control-action="center" title="Straighten wheels and camera (C)" aria-label="Straighten wheels and camera"><span class="straighten-icon" aria-hidden="true">&#8635;</span> Straighten up</button>
          </section>
          <section class="pad pad--drive">
            <h2 class="pad-title">Drive<svg class="title-squiggle" viewBox="0 0 70 6" preserveAspectRatio="none" aria-hidden="true"><path d="M2 3 Q18 0.5 35 3 T68 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg></h2>
            <div class="pad-grid">
              <button class="ctl drive pos-up" type="button" data-control-action="forward" title="Forward (↑)" aria-label="Forward">&#8593;<span class="hk">↑</span></button>
              <button class="ctl drive pos-left" type="button" data-control-action="steer-left" title="Steer left (←)" aria-label="Steer left">&#8592;<span class="hk">←</span></button>
              <button class="ctl stop pos-center" type="button" data-control-action="stop" title="Stop (Space)" aria-label="Stop">&#9632;<span class="hk">␣</span></button>
              <button class="ctl drive pos-right" type="button" data-control-action="steer-right" title="Steer right (→)" aria-label="Steer right">&#8594;<span class="hk">→</span></button>
              <button class="ctl drive pos-down" type="button" data-control-action="backward" title="Backward (↓)" aria-label="Backward">&#8595;<span class="hk">↓</span></button>
            </div>
          </section>
        </div>
        <p class="controls-tip">Arrows to drive · <span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span> for camera · <span class="kbd">C</span> to straighten · <span class="kbd">Space</span> to stop</p>
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
            "Last frame " + formatAge(ageMs) + " ago. Give him a nudge."
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
            "Can't reach the server. Is he switched on?"
          );
          showStatus("offline", "Offline");
        }
      }

      function updateRangeLabels() {
        speedValueEl.textContent = speedEl.value;
        pulseValueEl.textContent = pulseEl.value + "ms";
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

      function flashButton(action) {
        const button = document.querySelector(
          '[data-control-action="' + action + '"]'
        );
        if (!(button instanceof HTMLElement)) return;

        if (action === "stop") {
          button.classList.remove("wiggle");
          void button.offsetWidth;
          button.classList.add("wiggle");
          setTimeout(() => button.classList.remove("wiggle"), 340);
          return;
        }

        button.style.transform = "translateY(2px)";
        button.style.boxShadow =
          "0 1px 0 var(--ink), inset 0 1px 0 rgba(255, 255, 255, 0.5)";
        setTimeout(() => {
          button.style.transform = "";
          button.style.boxShadow = "";
        }, 110);
      }

      let lastSent = 0;
      async function sendControl(command, action) {
        if (controlsEl.hidden) return;
        const now = Date.now();
        if (now - lastSent < 80) return;
        lastSent = now;

        if (action) flashButton(action);

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
          const action = button.dataset.controlAction;
          const command = commandForAction(action);
          if (command !== undefined) void sendControl(command, action);
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
        void sendControl(command, action);
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
