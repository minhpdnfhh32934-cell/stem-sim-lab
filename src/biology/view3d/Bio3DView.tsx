/**
 * Layouts of a biology lesson's 3D view (three.js side: loaded with the lesson's 3D module).
 *
 * - `Bio3DView`: the 3D picture fills the stage; the lesson's chips and controls sit over its
 *   top edge, the 3D/2D switch and "Đặt lại góc nhìn" in the top-right corner, a caption and
 *   any playback controls at the bottom. The camera keeps the subject clear of all of them.
 * - `Bio3DFigureBody`: a 3D figure block at the top of a lesson's page of text and tables, with
 *   the same top-right corner as every 3D view: the 3D/2D switch, then "Đặt lại góc nhìn".
 */
import { Focus } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { IconButton } from '@/ui/IconButton';
import { L } from '../common';
import { Bio3DCanvas } from './Bio3DCanvas';
import type { LookPreset } from '@/ui/three/lighting';
import type { Bio3DScene, SceneKit, Vec3 } from './kit';
import type { Bio3DLesson } from './prefs';
import type { RendererFactory } from './renderer';
import { Bio3DSwitch } from './switch';
import '../bio.css';

export interface SceneSpec {
  build: (kit: SceneKit) => Bio3DScene;
  /** Changes whenever the model's inputs change (the scene is rebuilt). */
  buildKey: string;
  /** What the picture shows now (accessible name). */
  label: string;
  time?: number;
  running?: boolean;
  viewDir?: Vec3;
  aspect?: number;
  /** Light preset (habitats: outdoor). */
  look?: LookPreset;
  /** A tap on the picture: the id of what the scene's `pick` hit, or null. */
  onPick?: (id: string | null) => void;
  /** The picked part's id (the scene marks it). */
  selected?: string | null;
}

function ResetView({ onReset }: { onReset: () => void }) {
  const Lz = useLocalized();
  return (
    <IconButton
      icon={Focus}
      size="lg"
      label={Lz(L('Đặt lại góc nhìn', 'Reset view'))}
      tooltipSide="left"
      onClick={onReset}
    />
  );
}

export function Bio3DView({
  lesson,
  scene,
  top,
  bottom,
  caption,
  createRenderer,
}: {
  lesson: Bio3DLesson;
  scene: SceneSpec;
  /** The lesson's chips and buttons (the same as over its 2D picture). */
  top?: ReactNode;
  /** Playback or step controls under the picture. */
  bottom?: ReactNode;
  /** What the picture shows and what in it is illustration. */
  caption?: ReactNode;
  createRenderer?: RendererFactory;
}) {
  const hudRef = useRef<HTMLDivElement>(null);
  const [reset, setReset] = useState(0);
  return (
    <div className="bio-view bio3d" data-lesson={lesson}>
      <Bio3DCanvas
        lesson={lesson}
        {...scene}
        hudRef={hudRef}
        resetNonce={reset}
        {...(createRenderer ? { createRenderer } : {})}
      />
      <div ref={hudRef} className="bio3d__hud">
        <div className="chem-overlay bio3d__top" data-inset="top">
          {top}
        </div>
        <div className="bio3d__side" data-inset="corner">
          <Bio3DSwitch lesson={lesson} />
          <ResetView
            onReset={() => {
              setReset((n) => n + 1);
            }}
          />
        </div>
        {(bottom !== undefined || caption !== undefined) && (
          <div className="bio3d__bottom" data-inset="bottom">
            {bottom}
            {caption !== undefined && <p className="bio3d__caption">{caption}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export function Bio3DFigureBody({
  lesson,
  scene,
  top,
  bottom,
  info,
  caption,
  className,
  createRenderer,
}: {
  lesson: Bio3DLesson;
  scene: SceneSpec;
  /** Chips over the figure's top edge (left of the switch). */
  top?: ReactNode;
  /** Playback or step controls under the picture. */
  bottom?: ReactNode;
  /** The picked part's card (right, between the top and the bottom rows). */
  info?: ReactNode;
  caption?: ReactNode;
  /** Extra class of the figure block (a lesson's own height). */
  className?: string;
  createRenderer?: RendererFactory;
}) {
  const hudRef = useRef<HTMLDivElement>(null);
  const [reset, setReset] = useState(0);
  return (
    <div className={`bio3d-figure bio3d${className ? ` ${className}` : ''}`} data-lesson={lesson}>
      <Bio3DCanvas
        lesson={lesson}
        {...scene}
        hudRef={hudRef}
        resetNonce={reset}
        {...(createRenderer ? { createRenderer } : {})}
      />
      <div ref={hudRef} className="bio3d__hud">
        {top !== undefined && (
          <div className="chem-overlay bio3d__top" data-inset="top">
            {top}
          </div>
        )}
        <div className="bio3d__side" data-inset="corner">
          <Bio3DSwitch lesson={lesson} />
          <ResetView
            onReset={() => {
              setReset((n) => n + 1);
            }}
          />
        </div>
        {info}
        {(bottom !== undefined || caption !== undefined) && (
          <div className="bio3d__bottom" data-inset="bottom">
            {bottom}
            {caption !== undefined && <p className="bio3d__caption">{caption}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
