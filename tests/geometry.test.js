import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCoverTransform,
  mapLandmarkToViewport,
  smoothLandmarks,
} from "../src/core/geometry.js";

test("portrait cover transform crops a landscape camera feed horizontally", () => {
  const transform = calculateCoverTransform(640, 480, 390, 844);
  assert.equal(transform.drawHeight, 844);
  assert.ok(transform.drawWidth > 390);
  assert.ok(transform.offsetX < 0);
  assert.equal(transform.offsetY, 0);
});

test("landmark mapping mirrors the front camera around the viewport center", () => {
  const transform = calculateCoverTransform(640, 480, 640, 480);
  const left = mapLandmarkToViewport({ x: 0.25, y: 0.5, z: 0 }, transform, true);
  const right = mapLandmarkToViewport({ x: 0.75, y: 0.5, z: 0 }, transform, true);
  assert.deepEqual(left, { x: 480, y: 240, z: 0, visibility: 1 });
  assert.deepEqual(right, { x: 160, y: 240, z: 0, visibility: 1 });
});

test("landscape cover transform crops a portrait feed vertically", () => {
  const transform = calculateCoverTransform(480, 640, 844, 390);
  assert.equal(transform.drawWidth, 844);
  assert.ok(transform.drawHeight > 390);
  assert.equal(transform.offsetX, 0);
  assert.ok(transform.offsetY < 0);
});

test("landmark smoothing interpolates without mutating either input", () => {
  const previous = [{ x: 0, y: 0, z: 0 }];
  const current = [{ x: 1, y: 0.5, z: -0.2 }];
  const result = smoothLandmarks(previous, current, 0.25);
  assert.deepEqual(result[0], { x: 0.25, y: 0.125, z: -0.05, visibility: 1 });
  assert.deepEqual(previous[0], { x: 0, y: 0, z: 0 });
  assert.deepEqual(current[0], { x: 1, y: 0.5, z: -0.2 });
});

test("invalid dimensions fail fast", () => {
  assert.throws(() => calculateCoverTransform(0, 480, 390, 844), TypeError);
});
