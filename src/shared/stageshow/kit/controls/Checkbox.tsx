import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Check } from '../parts/Check'
import './Checkbox.css'

export interface CheckboxProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  label?: ReactNode
  variant?: 'row' | 'tile'
  onChange?: (checked: boolean) => void
}

export function Checkbox({ checked, label, variant = 'row', onChange, className, disabled, ...rest }: CheckboxProps) {
  return (
    <button
      {...rest}
      type="button"
      className={`ss-checkbox${className ? ` ${className}` : ''}`}
      data-checked={checked || undefined}
      data-variant={variant}
      disabled={disabled}
      aria-pressed={checked}
      onClick={(event) => {
        rest.onClick?.(event)
        if (!event.defaultPrevented && !disabled) onChange?.(!checked)
      }}
    >
      <Check on={checked} size={variant === 'tile' ? 15 : 18} />
      {label != null && <span className="ss-checkbox__label">{label}</span>}
    </button>
  )
}
