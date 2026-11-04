export async function requestMicrophone(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is not available in this browser.");
  }

  return navigator.mediaDevices.getUserMedia({ audio: true });
}
