import { useEffect, useState } from 'react';
import { inspectSmiles } from './rdkit';
import './smilesPicture.css';

/**
 * A structural formula drawn by RDKit from a SMILES string, with a caption; while RDKit is
 * missing (it failed to load) the SMILES text stands in for the picture. Shared by the organic
 * lessons (isomers, esters).
 */
export function SmilesPicture({
  smiles,
  caption,
  className,
}: {
  smiles: string;
  caption: string;
  className?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    inspectSmiles(smiles)
      .then((info) => {
        if (live) setSvg(info?.svg ?? null);
      })
      .catch(() => {
        if (live) setSvg(null);
      });
    return () => {
      live = false;
    };
  }, [smiles]);
  return (
    <figure className={`smiles-picture${className ? ` ${className}` : ''}`}>
      {svg ? (
        // As an image, like the molecule lesson: scripts inside an SVG image never run.
        <img
          className="smiles-picture__svg"
          alt=""
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
        />
      ) : (
        <div className="smiles-picture__svg mono" aria-hidden="true">
          {smiles}
        </div>
      )}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
