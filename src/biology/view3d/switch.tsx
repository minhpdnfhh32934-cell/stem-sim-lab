/**
 * The "3D / 2D" choice of a biology lesson (no three.js here: the 2D views import it). The 3D
 * view itself is loaded only when it is shown.
 */
import { Suspense, type ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { L } from '../common';
import { Segmented } from '../ui';
import { set3d, use3dWanted, type Bio3DLesson } from './prefs';
import { useShow3d } from './support';

export function Bio3DSwitch({ lesson }: { lesson: Bio3DLesson }) {
  const wanted = use3dWanted(lesson);
  return (
    <Segmented<'3d' | '2d'>
      label={L('Kiểu hiển thị', 'Display')}
      value={wanted ? '3d' : '2d'}
      options={[
        { id: '3d', label: L('3D', '3D') },
        { id: '2d', label: L('2D', '2D') },
      ]}
      onChange={(v) => {
        set3d(lesson, v === '3d');
      }}
    />
  );
}

/** The switch and, when the 3D view cannot be shown, why (for a 2D view's toolbar). */
export function Bio3DToolbar({ lesson }: { lesson: Bio3DLesson }) {
  const { notice } = useShow3d(lesson);
  return (
    <>
      <Bio3DSwitch lesson={lesson} />
      {notice && <span className="chem-chip chem-chip--qual">{notice}</span>}
    </>
  );
}

/**
 * For lessons whose stage is a page of text and tables (genetic code, Punnett square): above the
 * page a 3D figure of the same model when 3D is on, with the 3D/2D switch in its top-right
 * corner (like every 3D view's toolbar); in 2D the switch stays in that place, in a bar over the
 * page. `figure` is the (lazy) 3D body; the page below never changes.
 */
export function Bio3DFigure({ lesson, figure }: { lesson: Bio3DLesson; figure: ReactNode }) {
  const Lz = useLocalized();
  const { show3d, notice } = useShow3d(lesson);
  return (
    <>
      {!show3d && (
        <div className="chem-toolbar bio3d-figure__bar">
          {notice && <span className="chem-chip chem-chip--qual">{notice}</span>}
          <Bio3DSwitch lesson={lesson} />
        </div>
      )}
      {show3d && (
        <Suspense
          fallback={
            <div className="bio3d-figure" aria-busy="true">
              <span className="sr-only">{Lz(L('Đang tải hình 3D', 'Loading the 3D picture'))}</span>
              <div className="bio3d__hud">
                <div className="bio3d__side">
                  <Bio3DSwitch lesson={lesson} />
                </div>
              </div>
            </div>
          }
        >
          {figure}
        </Suspense>
      )}
    </>
  );
}
