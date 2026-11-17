import type { ButtonHTMLAttributes, ReactNode } from 'react'

import styles from './IconButton.module.css'

export type IconButtonVariant = 'ghost' | 'outline' | 'primary'
export type IconButtonSize = 'sm' | 'md' | 'lg'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 无障碍名称，同时作为悬停提示 */
  label: string
  variant?: IconButtonVariant
  size?: IconButtonSize
  children: ReactNode
}

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  type = 'button',
  className,
  children,
  ...rest
}: IconButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  )
}
