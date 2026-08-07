import {
  LEFT_EYE,
  MASK_EMITTERS,
  OUTER_LIPS,
  RIGHT_EYE,
} from "./core/landmark-groups.js";
import { averagePoints, deriveFacePose } from "./core/geometry.js";

const PALETTE = [
  [77, 245, 221],
  [111, 160, 255],
  [222, 101, 255],
  [255, 112, 182],
  [255, 191, 92],
];

export class ParticleMask {
  constructor(p) {
    this.p = p;
    this.particles = [];
    this.emissionCarry = 0;
    this.mouthCarry = 0;
    this.facePresence = 0;
    this.maxParticles = window.innerWidth <= 430 ? 520 : 680;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (this.reducedMotion) this.maxParticles = 300;
  }

  resize(width) {
    this.maxParticles = this.reducedMotion ? 300 : width <= 430 ? 520 : 680;
  }

  update(faceFrame, deltaMs) {
    const dt = Math.min(40, Math.max(4, deltaMs));
    this.facePresence += ((faceFrame ? 1 : 0) - this.facePresence) * 0.12;

    if (faceFrame) {
      this.emitContinuous(faceFrame, dt);
      this.emitExpressionParticles(faceFrame, dt);
    }

    const driftTime = this.p.millis() * 0.00032;
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      const noiseAngle = this.p.noise(particle.seed, driftTime) * this.p.TWO_PI * 2;
      particle.vx += Math.cos(noiseAngle) * 0.004 * dt;
      particle.vy += Math.sin(noiseAngle) * 0.004 * dt - 0.0008 * dt;
      particle.x += particle.vx * (dt / 16.67);
      particle.y += particle.vy * (dt / 16.67);
      particle.life -= dt;
      particle.vx *= 0.988;
      particle.vy *= 0.988;

      if (particle.life <= 0) this.particles.splice(index, 1);
    }

    if (this.particles.length > this.maxParticles) {
      this.particles.splice(0, this.particles.length - this.maxParticles);
    }
  }

  emitContinuous(faceFrame, dt) {
    const baseRate = this.reducedMotion ? 30 : 62;
    this.emissionCarry += (dt / 1000) * baseRate;
    const pose = deriveFacePose(faceFrame.landmarks);
    if (!pose) return;

    while (this.emissionCarry >= 1) {
      this.emissionCarry -= 1;
      const landmarkIndex = MASK_EMITTERS[Math.floor(this.p.random(MASK_EMITTERS.length))];
      const point = faceFrame.landmarks[landmarkIndex];
      if (point) this.spawn(point, pose.center, 0.54, false);
    }
  }

  emitExpressionParticles(faceFrame, dt) {
    const { expressions, landmarks } = faceFrame;
    const pose = deriveFacePose(landmarks);
    if (!pose) return;

    const mouthStrength = Math.max(0, (expressions.jawOpen - 0.35) / 0.65);
    this.mouthCarry += (dt / 1000) * mouthStrength * (this.reducedMotion ? 58 : 145);
    while (this.mouthCarry >= 1) {
      this.mouthCarry -= 1;
      const index = OUTER_LIPS[Math.floor(this.p.random(OUTER_LIPS.length))];
      this.spawn(landmarks[index], pose.center, 0.9 + mouthStrength, true);
    }

    if (expressions.blinkLeftTriggered) {
      this.burst(LEFT_EYE.map((index) => landmarks[index]).filter(Boolean), pose.center);
    }
    if (expressions.blinkRightTriggered) {
      this.burst(RIGHT_EYE.map((index) => landmarks[index]).filter(Boolean), pose.center);
    }
  }

  burst(points, center) {
    if (!points.length) return;
    const eyeCenter = averagePoints(points);
    const count = this.reducedMotion ? 18 : 32;
    for (let index = 0; index < count; index += 1) {
      const point = points[index % points.length] ?? eyeCenter;
      this.spawn(point, center, 1.35, true);
    }
  }

  spawn(point, center, strength, bright) {
    if (!point) return;
    const outwardAngle = Math.atan2(point.y - center.y, point.x - center.x);
    const angle = outwardAngle + this.p.random(-0.78, 0.78);
    const speed = this.p.random(0.26, 1.02) * strength;
    const paletteIndex = Math.floor(this.p.random(PALETTE.length));
    const maxLife = this.p.random(620, 1360) / Math.max(0.8, strength * 0.78);

    this.particles.push({
      x: point.x + this.p.random(-2.5, 2.5),
      y: point.y + this.p.random(-2.5, 2.5),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: maxLife,
      maxLife,
      size: this.p.random(bright ? 1.8 : 1.1, bright ? 4.6 : 3.1),
      color: PALETTE[paletteIndex],
      seed: this.p.random(1000),
      bright,
    });
  }

  draw() {
    const p = this.p;
    p.push();
    p.blendMode(p.ADD);
    p.noStroke();

    for (const particle of this.particles) {
      const progress = Math.max(0, particle.life / particle.maxLife);
      const fade = Math.sin(progress * Math.PI) * this.facePresence;
      const [red, green, blue] = particle.color;
      p.fill(red, green, blue, fade * (particle.bright ? 54 : 28));
      p.circle(particle.x, particle.y, particle.size * 3.8);
      p.fill(red, green, blue, fade * (particle.bright ? 230 : 168));
      p.circle(particle.x, particle.y, particle.size);
    }

    p.pop();
  }

  drawDebug(faceFrame) {
    if (!faceFrame) return;
    const p = this.p;
    p.push();
    p.noFill();
    p.stroke(94, 241, 219, 118);
    p.strokeWeight(1);
    for (const index of MASK_EMITTERS) {
      const point = faceFrame.landmarks[index];
      if (point) p.circle(point.x, point.y, 2.4);
    }
    p.pop();
  }
}
