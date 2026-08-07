export function calculateCoverTransform(videoWidth, videoHeight, viewportWidth, viewportHeight) {
  const values = [videoWidth, videoHeight, viewportWidth, viewportHeight];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new TypeError("Video and viewport dimensions must be positive finite numbers.");
  }

  const scale = Math.max(viewportWidth / videoWidth, viewportHeight / videoHeight);
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;

  return {
    scale,
    drawWidth,
    drawHeight,
    offsetX: (viewportWidth - drawWidth) / 2,
    offsetY: (viewportHeight - drawHeight) / 2,
  };
}

export function mapLandmarkToViewport(landmark, transform, mirrored = true) {
  const normalizedX = mirrored ? 1 - landmark.x : landmark.x;
  return {
    x: transform.offsetX + normalizedX * transform.drawWidth,
    y: transform.offsetY + landmark.y * transform.drawHeight,
    z: landmark.z ?? 0,
    visibility: landmark.visibility ?? 1,
  };
}

export function mapLandmarksToViewport(landmarks, transform, mirrored = true) {
  return landmarks.map((landmark) => mapLandmarkToViewport(landmark, transform, mirrored));
}

export function smoothLandmarks(previous, current, alpha = 0.34) {
  if (!previous || previous.length !== current.length) {
    return current.map((point) => ({ ...point }));
  }

  const amount = Math.min(1, Math.max(0, alpha));
  return current.map((point, index) => {
    const old = previous[index];
    return {
      x: old.x + (point.x - old.x) * amount,
      y: old.y + (point.y - old.y) * amount,
      z: (old.z ?? 0) + ((point.z ?? 0) - (old.z ?? 0)) * amount,
      visibility: point.visibility ?? old.visibility ?? 1,
    };
  });
}

export function distance2D(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function averagePoints(points) {
  if (!points.length) return { x: 0, y: 0 };
  const sum = points.reduce(
    (accumulator, point) => ({ x: accumulator.x + point.x, y: accumulator.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

export function deriveFacePose(landmarks) {
  const leftEdge = landmarks[454];
  const rightEdge = landmarks[234];
  const leftEye = landmarks[263];
  const rightEye = landmarks[33];
  const forehead = landmarks[10];
  const chin = landmarks[152];

  if (![leftEdge, rightEdge, leftEye, rightEye, forehead, chin].every(Boolean)) {
    return null;
  }

  return {
    center: {
      x: (leftEdge.x + rightEdge.x + forehead.x + chin.x) / 4,
      y: (leftEdge.y + rightEdge.y + forehead.y + chin.y) / 4,
    },
    width: distance2D(leftEdge, rightEdge),
    height: distance2D(forehead, chin),
    roll: Math.atan2(leftEye.y - rightEye.y, leftEye.x - rightEye.x),
  };
}
