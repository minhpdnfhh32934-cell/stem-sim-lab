import { Camera, FlipHorizontal2, RefreshCw, Settings2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/app/i18n';
import { useWorkspaceStore, type SettingsSection } from '@/app/workspaceStore';

interface CameraDialogProps {
  open: boolean;
  busy: boolean;
  error: string;
  /** The Settings page that helps with `error` (null or absent: none does). */
  errorSection?: SettingsSection | null;
  onClose: () => void;
  onCapture: (photo: string) => void;
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

/**
 * Photographs a problem with the device camera. The stream starts only while the
 * dialog is open and every track is stopped when it closes, after a capture, on
 * retake, or on unmount. Nothing is uploaded by the dialog itself: the photo only
 * goes to an AI reader after "Lấy ảnh".
 */
export function CameraDialog({
  open,
  busy,
  error,
  errorSection = null,
  onClose,
  onCapture,
}: CameraDialogProps) {
  const t = useT();
  const openSettingsAt = useWorkspaceStore((s) => s.openSettingsAt);
  const video = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [denied, setDenied] = useState('');
  /** 'unsupported': no camera API (retry pointless). 'denied': permission problem (retry). */
  const [deniedKind, setDeniedKind] = useState<'unsupported' | 'denied' | null>(null);
  /** Mirror preview (selfie-style). Defaults on for the front camera. */
  const [mirror, setMirror] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [session, setSession] = useState(0);

  const request = () => {
    setDenied('');
    setDeniedKind(null);
    setLive(false);
    setSession((n) => n + 1);
  };

  useEffect(() => {
    if (!open) {
      stopStream(streamRef.current);
      streamRef.current = null;
      return;
    }
    let cancelled = false;
    const hasCamera =
      typeof (navigator.mediaDevices as MediaDevices | undefined)?.getUserMedia === 'function';
    if (!hasCamera) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setDeniedKind('unsupported');
        setDenied(t('camera.unsupported'));
      });
      return () => {
        cancelled = true;
      };
    }
    const devices = navigator.mediaDevices;
    void devices
      .getUserMedia({ video: true, audio: false })
      .then((next) => {
        if (cancelled) {
          stopStream(next);
          return;
        }
        stopStream(streamRef.current);
        streamRef.current = next;
        try {
          const facing = next.getVideoTracks()[0]?.getSettings().facingMode;
          if (facing === 'user') setMirror(true);
        } catch {
          /* keep the current mirror choice */
        }
        if (video.current) video.current.srcObject = next;
        setLive(true);
      })
      .catch(() => {
        if (cancelled) return;
        // The browser asks for permission on every getUserMedia call while the site
        // permission is still "prompt". A permanent "block" must be lifted by the user
        // in the site settings — hence the retry button plus the hint below.
        setDeniedKind('denied');
        setDenied(t('camera.denied'));
      });
    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [open, session, t]);

  if (!open) return null;

  const capture = () => {
    const node = video.current;
    const active = streamRef.current;
    if (!node || !active || node.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = node.videoWidth;
    canvas.height = node.videoHeight;
    const context = canvas.getContext('2d');
    if (mirror) {
      context?.translate(canvas.width, 0);
      context?.scale(-1, 1);
    }
    context?.drawImage(node, 0, 0);
    const url = canvas.toDataURL('image/jpeg', 0.85);
    stopStream(active);
    streamRef.current = null;
    setLive(false);
    setPhoto(url);
  };

  const retake = () => {
    setPhoto(null);
    setDenied('');
    setLive(false);
    setSession((n) => n + 1);
  };

  return (
    <div className="camera-dialog__backdrop" role="presentation">
      <section
        className="camera-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('camera.title')}
      >
        <header className="camera-dialog__header">
          <span className="camera-dialog__title">
            <Camera size={16} aria-hidden="true" />
            {t('camera.title')}
          </span>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={busy}
            aria-label={t('camera.close')}
          >
            <X size={15} />
          </button>
        </header>
        <div className="camera-dialog__preview">
          {photo ? (
            <img src={photo} alt={t('camera.photoAlt')} />
          ) : (
            <video
              ref={video}
              autoPlay
              playsInline
              muted
              aria-label={t('camera.preview')}
              className={mirror ? 'is-mirrored' : undefined}
            />
          )}
        </div>
        {denied && (
          <>
            <p className="camera-dialog__error" role="alert">
              {denied}
            </p>
            {deniedKind === 'denied' && (
              <>
                <p className="muted small">{t('camera.blockedHint')}</p>
                <button type="button" className="btn" disabled={busy} onClick={request}>
                  <RefreshCw size={15} aria-hidden="true" />
                  {t('camera.retry')}
                </button>
              </>
            )}
          </>
        )}
        {error && (
          <p className="camera-dialog__error" role="alert">
            {error}
          </p>
        )}
        {error && errorSection && (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => {
              onClose();
              openSettingsAt(errorSection);
            }}
          >
            <Settings2 size={15} aria-hidden="true" />
            {t('chat.settings')}
          </button>
        )}
        <p className="muted small">{t('camera.privacy')}</p>
        <footer className="camera-dialog__footer">
          {photo ? (
            <>
              <button type="button" className="btn" disabled={busy} onClick={retake}>
                <RefreshCw size={15} aria-hidden="true" />
                {t('camera.retake')}
              </button>
              <button
                type="button"
                className="btn btn--accent"
                disabled={busy}
                onClick={() => {
                  onCapture(photo);
                }}
              >
                {busy ? t('camera.reading') : t('camera.usePhoto')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn--accent"
                disabled={busy || !live}
                onClick={capture}
              >
                <Camera size={15} aria-hidden="true" />
                {t('camera.capture')}
              </button>
              <button
                type="button"
                className={mirror ? 'btn btn--accent' : 'btn'}
                disabled={busy || !live}
                onClick={() => {
                  setMirror((v) => !v);
                }}
                aria-pressed={mirror}
                title={t('camera.mirror')}
              >
                <FlipHorizontal2 size={15} aria-hidden="true" />
                {t('camera.mirror')}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
