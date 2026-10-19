import { isTauri } from '@tauri-apps/api/core';
import { useState } from 'react';
import { gemmaChatText, gemmaReady } from '@/ai/gemmaTransport';
import { useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore, type SettingsSection } from '@/app/workspaceStore';
import { useChatStore } from '@/teacher/chat/chatStore';
import { CameraDialog } from '@/app/learner/CameraDialog';
import { analysisEngine } from './engineChoice';
import {
  PHOTO_SYSTEM,
  cleanTranscription,
  readPhotoOnComputer,
  transcribeWithCloud,
} from './photoVision';

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
 * Photograph-a-problem flow shared by the home page and the simulation top bar:
 * camera dialog state plus "Lấy ảnh" transcription. Chain: cloud API (when the
 * browser has a key) → local Gemma → an honest error. With a runtime on this computer
 * chosen as the AI (Settings → AI trên máy khác) the photo never goes online: that
 * runtime reads it when its model was seen reading pictures here, else the in-app
 * Gemma, else the learner is told plainly what reading a photo needs. A runtime that
 * does not answer, or no runtime picked, gets its own sentence and Settings page. The
 * text always lands in the problem box for review; analysis (with its safety checks)
 * stays separate.
 */
export function usePhotoCapture() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const setProblemText = useWorkspaceStore((s) => s.setProblemText);
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
    /** Remembers a cloud failure so the final message names the real cause. */
    let cloudIssue: 'badKey' | 'badModel' | null = null;
    try {
      let raw: string | null = null;
      const engine = await analysisEngine();
      // The learner chose AI on this computer: the photo stays on this computer.
      const onComputer = engine === 'local' || engine === 'local-missing';
      if (onComputer) {
        const local = await readPhotoOnComputer(engine, base64, locale);
        if (local.kind === 'error') {
          setCameraError(local.message, local.section);
          return;
        }
        if (local.kind === 'text') {
          // The runtime read it (an empty reading: "chụp lại rõ hơn"); Gemma is not asked too.
          const text = cleanTranscription(local.text);
          if (!text) {
            setCameraError(t('camera.readFailed'));
            return;
          }
          setProblemText(text);
          setCameraOpen(false);
          return;
        }
      }
      // Desktop builds have no cloud image endpoint: straight to the local model.
      if (!isTauri() && !onComputer) {
        try {
          raw = await transcribeWithCloud(base64, locale);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          const status = /^\s*(\d{3})/.exec(message)?.[1];
          if (status === '400' || status === '401' || status === '403') cloudIssue = 'badKey';
          else if (status === '404') cloudIssue = 'badModel';
          raw = null;
        }
      }
      if (raw === null || raw.trim() === '') {
        const chat = useChatStore.getState();
        if (!(await gemmaReady(chat.gemmaModel))) {
          if (onComputer) setCameraError(t('camera.localNoVision'), 'runtimes');
          else if (cloudIssue === 'badKey') setCameraError(t('camera.badKey'), 'ai');
          else if (cloudIssue === 'badModel') setCameraError(t('camera.badModel'), 'ai');
          else setCameraError(t('camera.needVision'));
          return;
        }
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const answer = await gemmaChatText({
          model: chat.gemmaModel,
          system: PHOTO_SYSTEM[locale],
          messages: [{ role: 'user', content: 'Đề bài trong ảnh là gì?' }],
          images: [bytes.buffer],
        });
        raw = answer.content;
      }
      const text = cleanTranscription(raw);
      if (!text) {
        setCameraError(t('camera.readFailed'));
        return;
      }
      setProblemText(text);
      setCameraOpen(false);
    } catch {
      setCameraError(t('camera.readFailed'));
    } finally {
      setCameraBusy(false);
    }
  };

  return {
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
