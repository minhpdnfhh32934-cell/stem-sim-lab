import { useState } from 'react';
import { useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore, type SettingsSection } from '@/app/workspaceStore';
import { CameraDialog } from '@/app/learner/CameraDialog';
import { useSafetyStore } from '@/safety/safetyStore';
import { readProblemPhoto } from './photoVision';

/** Longest photo edge: keeps captures fast and inside the models' image limits. */
const MAX_PHOTO_EDGE = 1600;
/** Refuses absurd uploads before decoding (bytes of base64 text). */
const MAX_PHOTO_BASE64 = 10_000_000;

function downscalePhoto(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(image.width, image.height));
      if (scale >= 1) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    image.onerror = () => {
      resolve(dataUrl);
    };
    image.src = dataUrl;
  });
}

/**
 * Photograph-a-problem flow shared by the home page and the simulation top bar: camera dialog
 * state plus "Lấy ảnh" transcription (`readProblemPhoto`: safety gates, the learner's own AI, the
 * output filter). The text always lands in the problem box for review; analysis (with its input
 * checks) stays separate. `cameraAllowed` is false while the safety gates are closed: the camera
 * buttons are then hidden.
 */
export function usePhotoCapture() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const setProblemText = useWorkspaceStore((s) => s.setProblemText);
  const cameraAllowed = useSafetyStore((s) => s.status?.aiAllowed ?? false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setError] = useState('');
  /** The Settings page that helps with the error shown (null: none does). */
  const [cameraErrorSection, setErrorSection] = useState<SettingsSection | null>(null);
  const setCameraError = (message: string, section: SettingsSection | null = null) => {
    setError(message);
    setErrorSection(message ? section : null);
  };

  const openCamera = () => {
    setCameraError('');
    setCameraOpen(true);
  };
  const closeCamera = () => {
    if (!cameraBusy) setCameraOpen(false);
  };

  const onPhoto = async (photo: string) => {
    setCameraError('');
    const small = await downscalePhoto(photo);
    const comma = small.indexOf(',');
    const base64 = comma >= 0 ? small.slice(comma + 1) : small;
    if (!base64 || base64.length > MAX_PHOTO_BASE64) {
      setCameraError(t('camera.readFailed'));
      return;
    }
    setCameraBusy(true);
    try {
      const reading = await readProblemPhoto(base64, locale);
      if (reading.kind === 'error') {
        setCameraError(reading.message, reading.section);
        return;
      }
      setProblemText(reading.text);
      setCameraOpen(false);
    } catch {
      setCameraError(t('camera.readFailed'));
    } finally {
      setCameraBusy(false);
    }
  };

  return {
    cameraAllowed,
    cameraOpen,
    cameraBusy,
    cameraError,
    cameraErrorSection,
    openCamera,
    closeCamera,
    onPhoto,
    CameraDialog,
  };
}
