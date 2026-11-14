import { useState, type ReactNode } from 'react';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { hasScene } from '@/physics/registry';
import { SceneStill } from './SceneStill';
import { shelfPreviewUrl } from './shelfPreviews';

/**
 * A topic's picture on the shelf (docs/BENCH_DESIGN.md §9.3): a physics topic's own engine frame,
 * a chemistry or biology topic's stage picture in the current look, else `fallback`.
 * Decorative (aria-hidden, empty alt): the card's title says what it is.
 */
export function TopicPicture({
  topic,
  className,
  fallback = null,
}: {
  topic: string;
  className: string;
  fallback?: ReactNode;
}) {
  const theme = useResolvedTheme();
  const [failed, setFailed] = useState<string | null>(null);
  if (hasScene(topic)) return <SceneStill topic={topic} className={className} grid={false} />;
  const src = shelfPreviewUrl(topic, theme);
  if (!src || src === failed) return fallback;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={className}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => {
        setFailed(src);
      }}
    />
  );
}
