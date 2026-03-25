"use client";

import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} className="max-w-[500px] m-4">
      <div className="rounded-3xl bg-white p-6 dark:bg-gray-900">
        <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h4>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? "Please wait..." : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
