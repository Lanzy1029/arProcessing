import {
  FACE_OVAL,
  LEFT_BROW,
  LEFT_EYE,
  OUTER_LIPS,
  RIGHT_BROW,
  RIGHT_EYE,
} from "./core/landmark-groups.js";
import { ExpressionProcessor } from "./core/signals.js";

function setRing(points, indices, centerX, centerY, radiusX, radiusY, phase = 0) {
  indices.forEach((index, position) => {
    const angle = phase + (position / indices.length) * Math.PI * 2;
    points[index] = {
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
      z: -0.03,
      visibility: 1,
    };
  });
}

export class SyntheticFace {
  constructor() {
    this.expressions = new ExpressionProcessor();
  }

  frame(timestampMs) {
    const time = timestampMs / 1000;
    const centerX = 0.5 + Math.sin(time * 0.42) * 0.035;
    const centerY = 0.49 + Math.cos(time * 0.31) * 0.018;
    const points = Array.from({ length: 478 }, (_, index) => {
      const angle = (index / 478) * Math.PI * 2;
      return {
        x: centerX + Math.cos(angle) * 0.12,
        y: centerY + Math.sin(angle) * 0.17,
        z: 0,
        visibility: 1,
      };
    });

    setRing(points, FACE_OVAL, centerX, centerY, 0.18, 0.26, -Math.PI / 2);
    setRing(points, LEFT_EYE, centerX - 0.065, centerY - 0.045, 0.045, 0.021);
    setRing(points, RIGHT_EYE, centerX + 0.065, centerY - 0.045, 0.045, 0.021);
    setRing(points, LEFT_BROW, centerX - 0.065, centerY - 0.095, 0.052, 0.014, Math.PI);
    setRing(points, RIGHT_BROW, centerX + 0.065, centerY - 0.095, 0.052, 0.014, Math.PI);

    const jawOpen = Math.max(0, Math.sin(time * 1.15) * 0.62);
    setRing(points, OUTER_LIPS, centerX, centerY + 0.115, 0.062, 0.018 + jawOpen * 0.022);

    const blinkWave = Math.sin(time * 2.05);
    const blink = blinkWave > 0.92 ? 0.86 : 0.04;
    const categories = [
      { categoryName: "jawOpen", score: jawOpen },
      { categoryName: "eyeBlinkLeft", score: blink },
      { categoryName: "eyeBlinkRight", score: blink },
    ];

    return {
      timestamp: timestampMs,
      landmarks: points,
      expressions: this.expressions.update(categories, timestampMs),
      transformationMatrix: null,
    };
  }
}
