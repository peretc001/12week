import { useState, type ReactNode } from 'react'
import { Icon } from '../parts/Icon'
import './Select.css'

export type SelectOption<T extends string = string> = { value: T; label: ReactNode }

export interface SelectProps<T extends string = string> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  label?: ReactNode
  className?: string
  ariaLabel?: string
}

export function Select<T extends string>({ value, options, onChange, label, className, ariaLabel }: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value) ?? options[0]

  return (
    <div className={`ss-select${className ? ` ${className}` : ''}`} data-open={open || undefined}>
      {label != null && <span className="ss-select__label">{label}</span>}
      <button type="button" className="ss-select__trigger" aria-label={ariaLabel} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{selected?.label}</span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="ss-select__menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className="ss-select__option"
              data-selected={option.value === value || undefined}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Icon name="check" size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
