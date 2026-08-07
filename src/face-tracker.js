import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { smoothLandmarks } from "./core/geometry.js";
import { ExpressionProcessor } from "./core/signals.js";

const INFERENCE_INTERVAL_MS = 1000 / 24;
const FACE_HOLD_MS = 520;

export class FaceTracker {
  constructor({ assetBase = document.baseURI } = {}) {
    this.assetBase = assetBase;
    this.landmarker = null;
    this.delegate = "uninitialized";
    this.lastInferenceAt = Number.NEGATIVE_INFINITY;
    this.lastVideoTime = -1;
    this.lastFaceSeenAt = Number.NEGATIVE_INFINITY;
    this.smoothedLandmarks = null;
    this.frame = null;
    this.inferenceMs = 0;
    this.expressions = new ExpressionProcessor();
  }

  async init() {
    const wasmRoot = new URL("wasm/", this.assetBase).href.replace(/\/$/, "");
    const modelPath = new URL("models/face_landmarker.task", this.assetBase).href;
    const vision = await FilesetResolver.forVisionTasks(wasmRoot);

    const create = (delegate) => FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        ...(delegate ? { delegate } : {}),
      },
      runningMode: "VIDEO",
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });

    try {
      this.landmarker = await create("GPU");
      this.delegate = "GPU";
    } catch (gpuError) {
      console.warn("GPU face tracking unavailable; falling back to CPU.", gpuError);
      this.landmarker = await create(null);
      this.delegate = "CPU";
    }
  }

  predict(videoElement, timestampMs) {
    if (!this.landmarker || videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return this.frame;
    }

    const shouldInfer = timestampMs - this.lastInferenceAt >= INFERENCE_INTERVAL_MS;
    const hasFreshVideoFrame = videoElement.currentTime !== this.lastVideoTime;
    if (!shouldInfer || !hasFreshVideoFrame) return this.frame;

    this.lastInferenceAt = timestampMs;
    this.lastVideoTime = videoElement.currentTime;
    const startedAt = performance.now();
    const result = this.landmarker.detectForVideo(videoElement, timestampMs);
    this.inferenceMs = performance.now() - startedAt;

    const detectedLandmarks = result.faceLandmarks?.[0];
    if (detectedLandmarks) {
      this.lastFaceSeenAt = timestampMs;
      this.smoothedLandmarks = smoothLandmarks(this.smoothedLandmarks, detectedLandmarks, 0.36);
      const categories = result.faceBlendshapes?.[0]?.categories ?? [];
      this.frame = {
        timestamp: timestampMs,
        landmarks: this.smoothedLandmarks,
        expressions: this.expressions.update(categories, timestampMs),
        transformationMatrix: result.facialTransformationMatrixes?.[0]?.data ?? null,
      };
    } else if (timestampMs - this.lastFaceSeenAt > FACE_HOLD_MS) {
      this.frame = null;
      this.smoothedLandmarks = null;
      this.expressions.reset();
    }

    return this.frame;
  }

  close() {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
