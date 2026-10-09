/**
 * Video Sharing & Playback Utilities for NirmTalk
 */

/**
 * Formats a duration in seconds to "MM:SS" or "H:MM:SS".
 */
export function formatVideoDuration(seconds: number): string {
  if (isNaN(seconds) || seconds === Infinity || seconds < 0) return "0:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const formattedSecs = secs.toString().padStart(2, "0");
  if (hrs > 0) {
    const formattedMins = mins.toString().padStart(2, "0");
    return `${hrs}:${formattedMins}:${formattedSecs}`;
  }
  return `${mins}:${formattedSecs}`;
}

/**
 * Formats file size in bytes into a human-readable string (e.g. "4.2 MB", "840 KB").
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Generates an automatic video thumbnail from a video file or blob object by rendering it
 * off-screen on a canvas, seeking to 0.5s-1s and grabbing the frame.
 */
export async function generateVideoThumbnailAndDuration(file: File): Promise<{ thumbnailUrl: string; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.autoplay = false;
    video.muted = true;
    video.playsInline = true;
    
    // Create an object URL from file
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    let duration = 0;

    // Timeout fallback after 10 seconds to avoid getting stuck
    const timeoutId = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Thumbnail generation timed out"));
    }, 10000);

    video.onloadedmetadata = () => {
      duration = video.duration;
      // Seek slightly past 0 to avoid blank startup screens
      video.currentTime = Math.min(1.0, duration / 3 || 0.5);
    };

    video.onseeked = () => {
      try {
        clearTimeout(timeoutId);
        const canvas = document.createElement("canvas");
        
        // Downscale slightly for storage efficiency while maintaining aspect ratio
        const maxDim = 480;
        let width = video.videoWidth || 640;
        let height = video.videoHeight || 360;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve({ thumbnailUrl: dataUrl, duration });
        } else {
          resolve({ thumbnailUrl: "", duration }); // Return empty thumbnail but valid duration
        }
      } catch (err) {
        console.error("Error capturing canvas from video frame:", err);
        resolve({ thumbnailUrl: "", duration }); // Resolve anyway with empty string as fallback
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    video.onerror = (e) => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load video file for thumbnail generation. Format may be unsupported."));
    };
  });
}
