import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

export type IconAnimation = 'pop' | 'spin' | 'nudge' | 'none';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  /** Accessible name; also shown as the tooltip. */
  label: string;
  /** Pressed/selected state for toggle buttons. */
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'solid' | 'accent';
  /** Micro-animation played on hover/focus (disabled by prefers-reduced-motion). */
  animation?: IconAnimation;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
}

const ICON_SIZE = { sm: 15, md: 17, lg: 20 } as const;

export function IconButton({
  icon: Icon,
  label,
  active,
  size = 'md',
  variant = 'ghost',
  animation = 'pop',
  tooltipSide = 'bottom',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={active}
      data-tip={label}
      data-tip-side={tooltipSide}
      className={cx(
        'icon-btn',
        `icon-btn--${size}`,
        `icon-btn--${variant}`,
        `anim-${animation}`,
        active && 'is-active',
        className,
      )}
      {...rest}
    >
      <Icon size={ICON_SIZE[size]} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
