import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={`modal-content ${wide ? 'modal-wide' : ''}`}>
          <div className="modal-top">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close className="icon-button close-modal" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'teal' | 'purple' | 'amber' | 'blue';
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
