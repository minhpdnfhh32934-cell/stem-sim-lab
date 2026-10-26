import { useLocalized } from '@/app/i18n/localized';
import type { Params, PhysicsScene } from '@/physics/types';

/**
 * One-click changes a scene offers while its parameters are invalid (e.g. "Dùng f₄"). They
 * are applied only when the learner presses them, never automatically.
 */
export function ValidationFixes({
  scene,
  params,
  onApply,
}: {
  scene: PhysicsScene;
  params: Params;
  onApply: (change: Params) => void;
}) {
  const Lz = useLocalized();
  const fixes = scene.fixes?.(params) ?? [];
  if (fixes.length === 0) return null;
  return (
    <div className="stage__fixes">
      {fixes.map((fix) => (
        <button
          key={fix.label.vi}
          type="button"
          className="btn"
          onClick={() => {
            onApply(fix.params);
          }}
        >
          {Lz(fix.label)}
        </button>
      ))}
    </div>
  );
}
