import test from "node:test";
import assert from "node:assert/strict";
import {
  ExponentialSmoother,
  ExpressionProcessor,
  RisingThresholdTrigger,
} from "../src/core/signals.js";

test("exponential smoothing removes abrupt jumps", () => {
  const smoother = new ExponentialSmoother(0.25);
  assert.equal(smoother.update(0), 0);
  assert.equal(smoother.update(1), 0.25);
  assert.equal(smoother.update(1), 0.4375);
});

test("blink gate fires only on a rising edge and observes cooldown", () => {
  const gate = new RisingThresholdTrigger({
    threshold: 0.55,
    releaseThreshold: 0.34,
    cooldownMs: 250,
  });

  assert.equal(gate.update(0.7, 1000), true);
  assert.equal(gate.update(0.8, 1050), false);
  assert.equal(gate.update(0.2, 1100), false);
  assert.equal(gate.update(0.8, 1200), false);
  assert.equal(gate.update(0.2, 1220), false);
  assert.equal(gate.update(0.8, 1260), true);
});

test("expression processor maps MediaPipe category names", () => {
  const processor = new ExpressionProcessor();
  const frame = processor.update([
    { categoryName: "jawOpen", score: 0.8 },
    { categoryName: "eyeBlinkLeft", score: 0.9 },
    { categoryName: "eyeBlinkRight", score: 0.1 },
  ], 1000);

  assert.equal(frame.jawOpen, 0.8);
  assert.equal(frame.blinkLeft, 0.9);
  assert.equal(frame.blinkRight, 0.1);
  assert.equal(frame.blinkLeftTriggered, true);
  assert.equal(frame.blinkRightTriggered, false);
});
