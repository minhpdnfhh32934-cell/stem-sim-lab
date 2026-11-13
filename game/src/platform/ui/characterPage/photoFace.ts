import type { FaceLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import { FACE_PICTURE, FACE_PICTURE_MAX_CHARS } from '../../render/body/facePhoto';
import { faceFromPhoto, type PhotoFace, picturePlacement, type Pixel } from './faceFromPhoto';

/*
 * Reads a face from a photo in the browser (Phú 2026-11-12): MediaPipe's face landmarker and hair
 * segmenter (served from `public/models`, loaded the first time a photo is read), then
 * `faceFromPhoto`. The photo is drawn into a canvas, read, and dropped; what is kept of it is the
 * face's small picture (`FACE_PICTURE`), laid on the character's head.
 */

/** The longest side a photo is read at (larger ones are scaled down first). */
const READ_SIZE = 768;

let tools: Promise<{ faces: FaceLandmarker; hair: ImageSegmenter }> | null = null;

function load(): Promise<{ faces: FaceLandmarker; hair: ImageSegmenter }> {
  tools ??= (async () => {
    const { FaceLandmarker, ImageSegmenter } = await import('@mediapipe/tasks-vision');
    const files = { wasmLoaderPath, wasmBinaryPath };
    const base = import.meta.env.BASE_URL;
    const [faces, hair] = await Promise.all([
      FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${base}models/face_landmarker.task`, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numFaces: 1,
      }),
      ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${base}models/hair_segmenter.tflite`, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      }),
    ]);
    return { faces, hair };
  })();
  // A failed load is tried again next time.
  tools.catch(() => (tools = null));
  return tools;
}

export type PhotoRead =
  | (PhotoFace & { readonly picture: string | null })
  | { readonly ok: false; readonly reason: 'noFace' };

/** The face's picture cut from `photo` (a JPEG data URL small enough to share), or null. */
function cutPicture(photo: HTMLCanvasElement, points: readonly Pixel[]): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = FACE_PICTURE.size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.setTransform(...picturePlacement(points));
  ctx.drawImage(photo, 0, 0);
  try {
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const url = canvas.toDataURL('image/jpeg', quality);
      if (url.length <= FACE_PICTURE_MAX_CHARS) return url;
    }
    return null;
  } finally {
    canvas.width = 0;
  }
}

/** Reads the face in `source` (a video frame or a picture), or says why it could not. */
export async function readPhoto(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<PhotoRead> {
  const { faces, hair } = await load();
  const scale = Math.min(1, READ_SIZE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { ok: false, reason: 'noFace' };
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const found = faces.detect(canvas).faceLandmarks[0];
  if (!found) return { ok: false, reason: 'noFace' };
  const points = found.map((p) => ({ x: p.x * canvas.width, y: p.y * canvas.height }));
  const segmented = hair.segment(canvas);
  try {
    const mask = segmented.confidenceMasks?.[1];
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const read = faceFromPhoto({
      points,
      rgba,
      width: canvas.width,
      height: canvas.height,
      hair: mask ? mask.getAsFloat32Array() : null,
      maskWidth: mask?.width ?? canvas.width,
      maskHeight: mask?.height ?? canvas.height,
    });
    return { ...read, picture: cutPicture(canvas, points) };
  } finally {
    segmented.close();
    canvas.width = 0;
  }
}
