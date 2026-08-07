export class ExponentialSmoother {
  constructor(alpha = 0.28, initialValue = 0) {
    this.alpha = Math.min(1, Math.max(0, alpha));
    this.value = initialValue;
    this.initialized = false;
  }

  update(nextValue) {
    const safeValue = Number.isFinite(nextValue) ? nextValue : 0;
    if (!this.initialized) {
      this.value = safeValue;
      this.initialized = true;
      return this.value;
    }
    this.value += (safeValue - this.value) * this.alpha;
    return this.value;
  }

  reset(value = 0) {
    this.value = value;
    this.initialized = false;
  }
}

export class RisingThresholdTrigger {
  constructor({ threshold, releaseThreshold, cooldownMs }) {
    this.threshold = threshold;
    this.releaseThreshold = releaseThreshold;
    this.cooldownMs = cooldownMs;
    this.active = false;
    this.lastTriggeredAt = Number.NEGATIVE_INFINITY;
  }

  update(value, timestampMs) {
    let triggered = false;
    if (!this.active && value >= this.threshold && timestampMs - this.lastTriggeredAt >= this.cooldownMs) {
      this.active = true;
      this.lastTriggeredAt = timestampMs;
      triggered = true;
    } else if (this.active && value <= this.releaseThreshold) {
      this.active = false;
    }
    return triggered;
  }

  reset() {
    this.active = false;
    this.lastTriggeredAt = Number.NEGATIVE_INFINITY;
  }
}

export function blendshapeMap(categories = []) {
  return Object.fromEntries(
    categories.map((category) => [category.categoryName || category.displayName, category.score]),
  );
}

export class ExpressionProcessor {
  constructor() {
    this.jaw = new ExponentialSmoother(0.3);
    this.leftBlink = new ExponentialSmoother(0.42);
    this.rightBlink = new ExponentialSmoother(0.42);
    this.leftTrigger = new RisingThresholdTrigger({
      threshold: 0.55,
      releaseThreshold: 0.34,
      cooldownMs: 250,
    });
    this.rightTrigger = new RisingThresholdTrigger({
      threshold: 0.55,
      releaseThreshold: 0.34,
      cooldownMs: 250,
    });
  }

  update(categories, timestampMs) {
    const values = blendshapeMap(categories);
    const jawOpen = this.jaw.update(values.jawOpen ?? 0);
    const blinkLeft = this.leftBlink.update(values.eyeBlinkLeft ?? 0);
    const blinkRight = this.rightBlink.update(values.eyeBlinkRight ?? 0);

    return {
      jawOpen,
      blinkLeft,
      blinkRight,
      blinkLeftTriggered: this.leftTrigger.update(blinkLeft, timestampMs),
      blinkRightTriggered: this.rightTrigger.update(blinkRight, timestampMs),
    };
  }

  reset() {
    this.jaw.reset();
    this.leftBlink.reset();
    this.rightBlink.reset();
    this.leftTrigger.reset();
    this.rightTrigger.reset();
  }
}
