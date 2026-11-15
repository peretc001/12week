import type { ReactNode } from 'react'
import { Icon } from '../parts/Icon'
import { Button } from './Button'
import './Dialog.css'

export interface DialogProps {
  open: boolean
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  className?: string
}

export function Dialog({ open, title, subtitle, children, footer, onClose, className }: DialogProps) {
  if (!open) return null

  return (
    <div className="ss-dialog__backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`ss-dialog${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true">
        <header className="ss-dialog__header">
          <div>
            <div className="ss-dialog__title">{title}</div>
            {subtitle != null && <div className="ss-dialog__subtitle">{subtitle}</div>}
          </div>
          <Button variant="ghost" aria-label="Закрыть" onClick={onClose}><Icon name="close" size={18} /></Button>
        </header>
        <div className="ss-dialog__body">{children}</div>
        {footer != null && <footer className="ss-dialog__footer">{footer}</footer>}
      </section>
    </div>
  )
}
