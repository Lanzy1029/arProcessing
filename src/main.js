import p5 from "p5";
import "./styles.css";
import { cameraErrorMessage, startFrontCamera, stopCamera } from "./camera.js";
import { FaceTracker } from "./face-tracker.js";
import {
  calculateCoverTransform,
  deriveFacePose,
  mapLandmarksToViewport,
} from "./core/geometry.js";
import { ParticleMask } from "./particle-mask.js";
import { SyntheticFace } from "./synthetic-face.js";

const params = new URLSearchParams(window.location.search);
const debugEnabled = params.get("debug") === "1";
const demoMode = params.get("demo");
const demoEnabled = demoMode === "1" || demoMode === "empty";

const elements = {
  video: document.querySelector("#camera"),
  landing: document.querySelector("#landing"),
  headline: document.querySelector("#headline"),
  description: document.querySelector("#description"),
  button: document.querySelector("#start-button"),
  buttonLabel: document.querySelector("#button-label"),
  statusPill: document.querySelector("#status-pill"),
  statusText: document.querySelector("#status-text"),
  faceGuide: document.querySelector("#face-guide"),
  debugPanel: document.querySelector("#debug-panel"),
  debugOutput: document.querySelector("#debug-output"),
};

if (debugEnabled) {
  document.body.classList.add("debug-mode");
  elements.debugPanel.hidden = false;
}
if (demoEnabled) document.body.classList.add("demo-mode");

class ParticleVeilApp {
  constructor() {
    this.tracker = demoEnabled ? null : new FaceTracker();
    this.syntheticFace = demoEnabled ? new SyntheticFace() : null;
    this.stream = null;
    this.running = false;
    this.paused = false;
    this.ready = false;
    this.startTimestamp = 0;
    this.lastFaceTimestamp = 0;
    this.lastDebugUpdate = 0;
    this.latestRawFrame = null;
    this.latestScreenFrame = null;
    this.mask = null;
    this.p = null;
  }

  async prepare() {
    this.showStatus(demoEnabled ? "演示数据准备中" : "正在加载本地人脸模型");
    this.setButton("正在准备…", true);

    try {
      if (!demoEnabled) await this.tracker.init();
      this.ready = true;
      this.showStatus(demoEnabled ? "演示模式已准备" : "本地模型已准备好");
      this.setButton(demoEnabled ? "启动粒子演示" : "开始 AR", false);
      window.setTimeout(() => this.hideStatus(), 1300);
    } catch (error) {
      console.error("Face model initialization failed.", error);
      this.showError(
        "模型没有加载成功",
        "请检查网络后重试。模型只会下载到当前设备，不会上传摄像头画面。",
        "重新加载",
      );
    }
  }

  async start() {
    if (!this.ready) {
      this.resetLanding();
      await this.prepare();
      if (!this.ready) return;
    }

    this.setButton("正在打开摄像头…", true);
    this.showStatus(demoEnabled ? "正在启动演示" : "正在请求摄像头权限");

    try {
      if (!demoEnabled) {
        if (this.stream) stopCamera(elements.video);
        this.stream = await startFrontCamera(elements.video);
        this.stream.getVideoTracks().forEach((track) => {
          track.addEventListener("ended", () => this.handleCameraEnded(), { once: true });
        });
      }

      this.running = true;
      this.paused = false;
      this.startTimestamp = performance.now();
      this.lastFaceTimestamp = 0;
      document.body.classList.add("camera-live");
      elements.landing.classList.remove("is-error");
      this.showStatus(demoEnabled ? "模拟人脸已锁定" : "正在寻找人脸");
    } catch (error) {
      console.warn("Camera start failed.", error);
      this.showError("无法打开摄像头", cameraErrorMessage(error), "重试");
    }
  }

  handleCameraEnded() {
    if (!this.running) return;
    this.running = false;
    document.body.classList.remove("camera-live");
    this.showError("摄像头已停止", "返回此页面后，轻点下方按钮重新启动。", "重新启动");
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
      if (timestampMs - this.startTimestamp < 2200) this.showStatus("粒子已锁定 · 本地运行");
      else this.hideStatus();
    } else if (timestampMs - this.startTimestamp > 900 && timestampMs - this.lastFaceTimestamp > 700) {
      elements.faceGuide.classList.add("is-visible");
      this.showStatus("未检测到人脸");
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
      `PARTICLES  ${this.mask?.particles.length ?? 0}`,
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

  setButton(label, disabled) {
    elements.buttonLabel.textContent = label;
    elements.button.disabled = disabled;
  }

  resetLanding() {
    elements.landing.classList.remove("is-error");
    elements.headline.innerHTML = "让粒子<br />贴上你的脸";
    elements.description.innerHTML = "张嘴唤醒粒子喷发，眨眼触发光脉冲。<br />所有识别只发生在你的手机里。";
  }

  showError(title, message, buttonLabel) {
    this.running = false;
    document.body.classList.remove("camera-live");
    elements.faceGuide.classList.remove("is-visible");
    elements.landing.classList.add("is-error");
    elements.headline.textContent = title;
    elements.description.textContent = message;
    this.setButton(buttonLabel, false);
    this.showStatus("需要你的操作");
  }

  destroy() {
    this.running = false;
    stopCamera(elements.video);
    this.tracker?.close();
  }
}

const app = new ParticleVeilApp();

elements.button.addEventListener("click", () => app.start());

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
    app.mask = new ParticleMask(p);
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

app.prepare();
