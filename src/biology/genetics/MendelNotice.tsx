import { TriangleAlert } from 'lucide-react';
import { useLocalized } from '@/app/i18n/localized';
import { INVALID_GENOTYPE } from './mendelCard';

/**
 * The notice of a genotype the model cannot read (a `GenotypeError`, e.g. a file saved with
 * another number of traits): the 2D page and the 3D view show the same one.
 */
export function InvalidGenotype({ error }: { error: string }) {
  const Lz = useLocalized();
  return (
    <p className="chem-note chem-note--warn" role="alert">
      <TriangleAlert size={15} aria-hidden="true" />
      <span>
        {Lz(INVALID_GENOTYPE)}
        {error}
      </span>
    </p>
  );
}
