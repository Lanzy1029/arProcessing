import p5 from "p5";
import "./styles.css";
import { cameraErrorMessage, startFrontCamera, stopCamera } from "./camera.js";
import { FaceTracker } from "./face-tracker.js";
import {
  calculateCoverTransform,
  deriveFacePose,
  mapLandmarksToViewport,
} from "./core/geometry.js";
import {
  DEFAULT_EMOJI_SELECTION,
  EMOJI_PRESETS,
  normalizeEmojiSelection,
} from "./core/emoji-presets.js";
import { ParticleMask } from "./particle-mask.js";
import { SyntheticFace } from "./synthetic-face.js";

const params = new URLSearchParams(window.location.search);
const debugEnabled = params.get("debug") === "1";
const demoMode = params.get("demo");
const demoEnabled = demoMode === "1" || demoMode === "empty";
const STORAGE_KEY = "emoji-face-ar-selection-v2";

const elements = {
  video: document.querySelector("#camera"),
  startupOverlay: document.querySelector("#startup-overlay"),
  startupTitle: document.querySelector("#startup-title"),
  startupDescription: document.querySelector("#startup-description"),
  loadingSpinner: document.querySelector("#loading-spinner"),
  retryButton: document.querySelector("#retry-button"),
  statusPill: document.querySelector("#status-pill"),
  statusText: document.querySelector("#status-text"),
  faceGuide: document.querySelector("#face-guide"),
  debugPanel: document.querySelector("#debug-panel"),
  debugOutput: document.querySelector("#debug-output"),
  blinkCaption: document.querySelector("#blink-caption"),
  mouthCaption: document.querySelector("#mouth-caption"),
  effectButtons: [...document.querySelectorAll("[data-effect-kind]")],
};

if (debugEnabled) {
  document.body.classList.add("debug-mode");
  elements.debugPanel.hidden = false;
}
if (demoEnabled) document.body.classList.add("demo-mode");

function readSavedSelection() {
  try {
    return normalizeEmojiSelection(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
  } catch {
    return { ...DEFAULT_EMOJI_SELECTION };
  }
}

class EmojiFaceApp {
  constructor() {
    this.tracker = demoEnabled ? null : new FaceTracker();
    this.syntheticFace = demoEnabled ? new SyntheticFace() : null;
    this.stream = null;
    this.running = false;
    this.booting = false;
    this.paused = false;
    this.modelPromise = null;
    this.startTimestamp = 0;
    this.lastFaceTimestamp = 0;
    this.lastDebugUpdate = 0;
    this.latestRawFrame = null;
    this.latestScreenFrame = null;
    this.mask = null;
    this.p = null;
    this.selection = readSavedSelection();
    this.bindEffectControls();
    this.renderEffectControls();
  }

  bindEffectControls() {
    for (const button of elements.effectButtons) {
      button.addEventListener("click", () => {
        const { effectKind, effectPreset } = button.dataset;
        this.selection = normalizeEmojiSelection({
          ...this.selection,
          [effectKind]: effectPreset,
        });
        this.mask?.setEmojiSelection(this.selection);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.selection));
        } catch {
          // The experience still works when Safari disables storage.
        }
        this.renderEffectControls();
      });
    }
  }

  renderEffectControls() {
    for (const button of elements.effectButtons) {
      const selected = this.selection[button.dataset.effectKind] === button.dataset.effectPreset;
      button.setAttribute("aria-pressed", String(selected));
    }
    elements.blinkCaption.textContent = EMOJI_PRESETS.blink[this.selection.blink].caption;
    elements.mouthCaption.textContent = EMOJI_PRESETS.mouth[this.selection.mouth].caption;
  }

  ensureModel() {
    if (demoEnabled) return Promise.resolve();
    if (!this.modelPromise) {
      this.modelPromise = this.tracker.init().catch((error) => {
        this.modelPromise = null;
        throw error;
      });
    }
    return this.modelPromise;
  }

  async openCamera() {
    if (this.stream) stopCamera(elements.video);
    const stream = await startFrontCamera(elements.video);
    this.stream = stream;
    document.body.classList.add("camera-preview");
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => this.handleCameraEnded(), { once: true });
    });
    return stream;
  }

  async boot() {
    if (this.booting) return;
    this.booting = true;
    this.running = false;
    document.body.classList.add("app-loading");
    document.body.classList.remove("app-error", "camera-live");
    elements.faceGuide.classList.remove("is-visible");
    this.showStartup(
      demoEnabled ? "正在准备演示" : "正在准备相机",
      demoEnabled ? "使用模拟表情，不会请求摄像头。" : "首次使用时，请在 Safari 中允许摄像头。",
      false,
    );
    this.showStatus(demoEnabled ? "正在生成模拟表情" : "模型与前摄正在准备");

    try {
      const jobs = [this.ensureModel()];
      if (!demoEnabled) jobs.push(this.openCamera());
      await Promise.all(jobs);

      this.running = true;
      this.paused = false;
      this.startTimestamp = performance.now();
      this.lastFaceTimestamp = 0;
      document.body.classList.add("camera-live");
      document.body.classList.remove("app-loading", "app-error", "camera-preview");
      this.hideStartup();
      this.showStatus(demoEnabled ? "模拟表情已开启" : "正在寻找人脸");
    } catch (error) {
      console.warn("AR startup failed.", error);
      const isModelError = !demoEnabled && !this.modelPromise;
      this.showError(
        isModelError ? "模型没有加载成功" : "需要开启摄像头",
        isModelError
          ? "请检查网络后再试。模型只会下载到当前设备。"
          : cameraErrorMessage(error),
      );
    } finally {
      this.booting = false;
    }
  }

  handleCameraEnded() {
    if (!this.running) return;
    this.running = false;
    document.body.classList.remove("camera-live");
    this.showError("摄像头已停止", "返回页面后，轻点“再试一次”重新启动。");
  }

  updateFrame(timestampMs) {
    if (!this.running || this.paused || !this.p) return null;

    if (demoEnabled) {
      this.latestRawFrame = demoMode === "empty" ? null : this.syntheticFace.frame(timestampMs);
    } else {
      this.latestRawFrame = this.tracker.predict(elements.video, timestampMs);
    }

    if (!this.latestRawFrame) {
      this.updateTrackingUi(false, timestampMs);
      this.latestScreenFrame = null;
      return null;
    }

    const videoWidth = demoEnabled ? 640 : elements.video.videoWidth;
    const videoHeight = demoEnabled ? 480 : elements.video.videoHeight;
    if (!videoWidth || !videoHeight) return this.latestScreenFrame;

    const transform = calculateCoverTransform(videoWidth, videoHeight, this.p.width, this.p.height);
    const landmarks = mapLandmarksToViewport(this.latestRawFrame.landmarks, transform, true);
    this.latestScreenFrame = { ...this.latestRawFrame, landmarks };
    this.updateTrackingUi(true, timestampMs);
    return this.latestScreenFrame;
  }

  updateTrackingUi(hasFace, timestampMs) {
    if (hasFace) {
      this.lastFaceTimestamp = timestampMs;
      elements.faceGuide.classList.remove("is-visible");
      if (timestampMs - this.startTimestamp < 2600) this.showStatus("人脸已锁定 · 本地运行");
      else this.hideStatus();
    } else if (timestampMs - this.startTimestamp > 900 && timestampMs - this.lastFaceTimestamp > 700) {
      elements.faceGuide.classList.add("is-visible");
      this.showStatus("没有看到人脸");
    }
  }

  updateDebug(timestampMs) {
    if (!debugEnabled || timestampMs - this.lastDebugUpdate < 220 || !this.p) return;
    this.lastDebugUpdate = timestampMs;
    const expressions = this.latestRawFrame?.expressions;
    const pose = this.latestScreenFrame ? deriveFacePose(this.latestScreenFrame.landmarks) : null;
    const inference = demoEnabled ? 0 : this.tracker.inferenceMs;
    const delegate = demoEnabled ? "SYNTHETIC" : this.tracker.delegate;
    elements.debugOutput.textContent = [
      `MODE       ${delegate}`,
      `FPS        ${this.p.frameRate().toFixed(1)}`,
      `INFERENCE  ${inference.toFixed(1)} ms`,
      `EMOJI      ${this.mask?.particles.length ?? 0}`,
      `FACE       ${pose ? "LOCKED" : "SEARCHING"}`,
      `JAW        ${(expressions?.jawOpen ?? 0).toFixed(2)}`,
      `BLINK L/R  ${(expressions?.blinkLeft ?? 0).toFixed(2)} / ${(expressions?.blinkRight ?? 0).toFixed(2)}`,
    ].join("\n");
  }

  showStatus(message) {
    elements.statusText.textContent = message;
    elements.statusPill.classList.remove("is-hidden");
  }

  hideStatus() {
    elements.statusPill.classList.add("is-hidden");
  }

  showStartup(title, description, canRetry) {
    elements.startupTitle.textContent = title;
    elements.startupDescription.textContent = description;
    elements.retryButton.hidden = !canRetry;
    elements.loadingSpinner.hidden = canRetry;
    elements.startupOverlay.classList.remove("is-hidden");
  }

  hideStartup() {
    elements.startupOverlay.classList.add("is-hidden");
  }

  showError(title, message) {
    this.running = false;
    stopCamera(elements.video);
    this.stream = null;
    document.body.classList.remove("app-loading", "camera-live", "camera-preview");
    document.body.classList.add("app-error");
    elements.faceGuide.classList.remove("is-visible");
    this.showStartup(title, message, true);
    this.showStatus("需要你的操作");
  }

  destroy() {
    this.running = false;
    stopCamera(elements.video);
    this.tracker?.close();
  }
}

const app = new EmojiFaceApp();
elements.retryButton.addEventListener("click", () => app.boot());

new p5((p) => {
  p.setup = () => {
    p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
    const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
    canvas.parent("canvas-host");
    p.clear();
    p.noiseSeed(29071999);
    p.randomSeed(29071999);
    p.frameRate(60);
    app.p = p;
    app.mask = new ParticleMask(p, app.selection);
    queueMicrotask(() => app.boot());
  };

  p.draw = () => {
    p.clear();
    const now = performance.now();
    const frame = app.updateFrame(now);
    app.mask.update(frame, p.deltaTime);
    app.mask.draw();
    if (debugEnabled) app.mask.drawDebug(frame);
    app.updateDebug(now);
  };

  p.windowResized = () => {
    p.resizeCanvas(window.innerWidth, window.innerHeight);
    app.mask.resize(window.innerWidth);
  };
});

document.addEventListener("visibilitychange", async () => {
  app.paused = document.hidden;
  if (!document.hidden && app.running && !demoEnabled) {
    try {
      await elements.video.play();
    } catch (error) {
      console.warn("Camera resume requires user interaction.", error);
      app.handleCameraEnded();
    }
  }
});

window.addEventListener("pagehide", (event) => {
  if (!event.persisted) app.destroy();
});
