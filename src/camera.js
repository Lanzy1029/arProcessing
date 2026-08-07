export function cameraErrorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "摄像头权限被拒绝。请在 Safari 网站设置中允许摄像头，然后重试。";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "没有找到可用的前置摄像头。";
    case "NotReadableError":
    case "TrackStartError":
      return "摄像头正被其他应用占用。关闭其他相机应用后再试。";
    case "OverconstrainedError":
      return "当前摄像头不支持所需的视频设置。";
    case "SecurityError":
      return "Safari 阻止了摄像头访问，请确认使用 HTTPS 链接。";
    default:
      return "无法启动摄像头。请刷新页面或检查 Safari 的摄像头权限。";
  }
}

export async function startFrontCamera(videoElement) {
  if (!navigator.mediaDevices?.getUserMedia) {
    const unsupported = new Error("Camera API unavailable");
    unsupported.name = "SecurityError";
    throw unsupported;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, max: 30 },
    },
  });

  videoElement.setAttribute("playsinline", "");
  videoElement.muted = true;
  videoElement.srcObject = stream;
  await videoElement.play();

  if (!videoElement.videoWidth || !videoElement.videoHeight) {
    await new Promise((resolve) => {
      videoElement.addEventListener("loadedmetadata", resolve, { once: true });
    });
  }

  return stream;
}

export function stopCamera(videoElement) {
  const stream = videoElement.srcObject;
  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  videoElement.srcObject = null;
}
