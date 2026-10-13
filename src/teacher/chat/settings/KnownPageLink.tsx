import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ReactNode } from 'react';

/**
 * External page link. In the desktop app the system browser opens it through Rust
 * (`open_known_page`, fixed list of ids); in a browser it is a normal new-tab link.
 */
export function KnownPageLink({
  id,
  href,
  className,
  children,
}: {
  id: string;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        if (!isTauri()) return;
        event.preventDefault();
        void invoke('open_known_page', { id });
      }}
    >
      {children}
    </a>
  );
}
