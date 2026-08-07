import test from "node:test";
import assert from "node:assert/strict";
import { ParticleMask } from "../src/particle-mask.js";

function createP5Stub() {
  return {
    TWO_PI: Math.PI * 2,
    millis: () => 0,
    noise: () => 0.5,
    random: (minimum = 1, maximum) => (
      maximum === undefined ? minimum * 0.5 : (minimum + maximum) * 0.5
    ),
  };
}

function createFace(expressions = {}) {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 200, y: 300 }));
  landmarks[454] = { x: 300, y: 300 };
  landmarks[234] = { x: 100, y: 300 };
  landmarks[263] = { x: 250, y: 260 };
  landmarks[33] = { x: 150, y: 260 };
  landmarks[10] = { x: 200, y: 160 };
  landmarks[152] = { x: 200, y: 440 };

  return {
    landmarks,
    expressions: {
      jawOpen: 0,
      blinkLeftTriggered: false,
      blinkRightTriggered: false,
      ...expressions,
    },
  };
}

test("a neutral face never produces decorative emoji", () => {
  const previousWindow = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  try {
    const mask = new ParticleMask(createP5Stub());
    const neutralFace = createFace();
    for (let frame = 0; frame < 180; frame += 1) mask.update(neutralFace, 16.67);
    assert.equal(mask.particles.length, 0);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("emoji appear only after a blink or mouth action", () => {
  const previousWindow = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  try {
    const mask = new ParticleMask(createP5Stub());
    mask.update(createFace({ jawOpen: 0.9, blinkLeftTriggered: true }), 40);
    assert.ok(mask.particles.length > 0);
    assert.ok(mask.particles.every((particle) => ["💗", "❤️", "💕", "💩", "💨"].includes(particle.emoji)));
  } finally {
    globalThis.window = previousWindow;
  }
});
