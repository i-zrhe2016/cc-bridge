'use client';

import type { ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { IconX } from '@tabler/icons-react';

export default function AdminDialog({ title, description, children, onClose, drawer = false, busy = false }: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
  busy?: boolean;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="admin-backdrop" />
        <Dialog.Popup className={`admin-dialog ${drawer ? 'admin-drawer' : ''}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted-foreground">{description}</Dialog.Description>
            </div>
            <Dialog.Close disabled={busy} className="admin-icon-button" aria-label="关闭对话框"><IconX size={20} /></Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
