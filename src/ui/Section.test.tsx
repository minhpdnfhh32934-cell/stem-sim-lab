import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Section } from './Section';

describe('Section', () => {
  it('a lesson title keeps its case; other titles stay upper case (UI-47)', () => {
    render(
      <>
        <Section title="ADN → mARN → Protein" keepCase>
          body
        </Section>
        <Section title="Thông số">body</Section>
      </>,
    );
    expect(screen.getByRole('heading', { name: 'ADN → mARN → Protein' })).toHaveClass(
      'section__title',
      'section__title--keep-case',
    );
    expect(screen.getByRole('heading', { name: 'Thông số' })).not.toHaveClass(
      'section__title--keep-case',
    );
  });
});
