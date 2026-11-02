let activeVideo: HTMLVideoElement | null = null;

export function activateVideo(video: HTMLVideoElement) {
  if (activeVideo === video) return;
  activeVideo?.pause();
  activeVideo = video;
}

export function deactivateVideo(video: HTMLVideoElement) {
  if (activeVideo !== video) return;
  activeVideo = null;
  if (typeof window !== "undefined") window.dispatchEvent(new Event("mv:video-released"));
}

export function hasActiveVideo() {
  return activeVideo !== null;
}

export function isVideoActive(video: HTMLVideoElement) {
  return activeVideo === video;
}
