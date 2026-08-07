import {
  LEFT_EYE,
  MASK_EMITTERS,
  OUTER_LIPS,
  RIGHT_EYE,
} from "./core/landmark-groups.js";
import { averagePoints, deriveFacePose } from "./core/geometry.js";
import {
  DEFAULT_EMOJI_SELECTION,
  emojiSetFor,
  normalizeEmojiSelection,
} from "./core/emoji-presets.js";

const AMBIENT_EMOJIS = Object.freeze(["✨", "🫧", "⭐"]);

export class ParticleMask {
  constructor(p, selection = DEFAULT_EMOJI_SELECTION) {
    this.p = p;
    this.particles = [];
    this.emissionCarry = 0;
    this.mouthCarry = 0;
    this.facePresence = 0;
    this.selection = normalizeEmojiSelection(selection);
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize(window.innerWidth);
  }

  setEmojiSelection(selection) {
    this.selection = normalizeEmojiSelection(selection);
  }

  resize(width) {
    this.maxParticles = this.reducedMotion ? 90 : width <= 430 ? 180 : 240;
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
      particle.vx += Math.cos(noiseAngle) * 0.003 * dt;
      particle.vy += Math.sin(noiseAngle) * 0.003 * dt + particle.gravity * dt;
      particle.x += particle.vx * (dt / 16.67);
      particle.y += particle.vy * (dt / 16.67);
      particle.rotation += particle.spin * (dt / 16.67);
      particle.life -= dt;
      particle.vx *= 0.986;
      particle.vy *= 0.986;

      if (particle.life <= 0) this.particles.splice(index, 1);
    }

    if (this.particles.length > this.maxParticles) {
      this.particles.splice(0, this.particles.length - this.maxParticles);
    }
  }

  emitContinuous(faceFrame, dt) {
    const baseRate = this.reducedMotion ? 7 : 15;
    this.emissionCarry += (dt / 1000) * baseRate;
    const pose = deriveFacePose(faceFrame.landmarks);
    if (!pose) return;

    while (this.emissionCarry >= 1) {
      this.emissionCarry -= 1;
      const landmarkIndex = this.pick(MASK_EMITTERS);
      const point = faceFrame.landmarks[landmarkIndex];
      if (point) this.spawn(point, pose.center, 0.42, "ambient", this.pick(AMBIENT_EMOJIS));
    }
  }

  emitExpressionParticles(faceFrame, dt) {
    const { expressions, landmarks } = faceFrame;
    const pose = deriveFacePose(landmarks);
    if (!pose) return;

    const mouthStrength = Math.max(0, (expressions.jawOpen - 0.35) / 0.65);
    this.mouthCarry += (dt / 1000) * mouthStrength * (this.reducedMotion ? 20 : 48);
    const mouthEmojis = emojiSetFor("mouth", this.selection.mouth);
    while (this.mouthCarry >= 1) {
      this.mouthCarry -= 1;
      const point = landmarks[this.pick(OUTER_LIPS)];
      this.spawn(point, pose.center, 0.9 + mouthStrength, "mouth", this.pick(mouthEmojis));
    }

    const blinkEmojis = emojiSetFor("blink", this.selection.blink);
    if (expressions.blinkLeftTriggered) {
      this.burst(LEFT_EYE.map((index) => landmarks[index]).filter(Boolean), pose.center, blinkEmojis);
    }
    if (expressions.blinkRightTriggered) {
      this.burst(RIGHT_EYE.map((index) => landmarks[index]).filter(Boolean), pose.center, blinkEmojis);
    }
  }

  burst(points, center, emojis) {
    if (!points.length) return;
    const eyeCenter = averagePoints(points);
    const count = this.reducedMotion ? 8 : 15;
    for (let index = 0; index < count; index += 1) {
      const point = points[index % points.length] ?? eyeCenter;
      this.spawn(point, center, 1.4, "blink", this.pick(emojis));
    }
  }

  spawn(point, center, strength, kind, emoji) {
    if (!point || !emoji) return;
    const outwardAngle = Math.atan2(point.y - center.y, point.x - center.x);
    const angle = outwardAngle + this.p.random(-0.72, 0.72);
    const speed = this.p.random(0.34, 1.08) * strength;
    const expressive = kind !== "ambient";
    const maxLife = this.p.random(expressive ? 720 : 900, expressive ? 1450 : 1750)
      / Math.max(0.85, strength * 0.7);

    this.particles.push({
      x: point.x + this.p.random(-3, 3),
      y: point.y + this.p.random(-3, 3),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: kind === "mouth" ? 0.004 : -0.0015,
      life: maxLife,
      maxLife,
      size: this.p.random(expressive ? 22 : 12, expressive ? 38 : 22),
      emoji,
      rotation: this.p.random(-0.3, 0.3),
      spin: this.p.random(-0.035, 0.035),
      seed: this.p.random(1000),
      expressive,
    });
  }

  pick(items) {
    return items[Math.floor(this.p.random(items.length))];
  }

  draw() {
    const p = this.p;
    const context = p.drawingContext;
    p.push();
    p.textAlign(p.CENTER, p.CENTER);
    p.textStyle(p.NORMAL);
    p.textFont("Apple Color Emoji, Segoe UI Emoji, sans-serif");

    for (const particle of this.particles) {
      const progress = Math.max(0, particle.life / particle.maxLife);
      const fade = Math.sin(progress * Math.PI) * this.facePresence;
      const pop = 0.72 + Math.sin(Math.min(1, 1 - progress) * Math.PI) * 0.36;
      context.globalAlpha = fade;
      context.shadowColor = particle.expressive ? "rgba(255,255,255,.48)" : "rgba(255,255,255,.2)";
      context.shadowBlur = particle.expressive ? 12 : 6;
      p.push();
      p.translate(particle.x, particle.y);
      p.rotate(particle.rotation);
      p.textSize(particle.size * pop);
      p.text(particle.emoji, 0, 0);
      p.pop();
    }

    context.globalAlpha = 1;
    context.shadowBlur = 0;
    p.pop();
  }

  drawDebug(faceFrame) {
    if (!faceFrame) return;
    const p = this.p;
    p.push();
    p.noFill();
    p.stroke(255, 255, 255, 130);
    p.strokeWeight(1);
    for (const index of MASK_EMITTERS) {
      const point = faceFrame.landmarks[index];
      if (point) p.circle(point.x, point.y, 2.4);
    }
    p.pop();
  }
}
