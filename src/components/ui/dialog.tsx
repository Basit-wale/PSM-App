"use client";

import { useEffect, useId, useRef } from "react";

type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
};

const sizes = {
  sm: "24rem",
  md: "28rem",
  lg: "32rem",
  xl: "36rem",
  "2xl": "48rem",
};

export function Dialog({
  open,
  title,
  onClose,
  children,
  size = "md",
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const generatedId = useId();
  const titleId = `app-dialog-title-${generatedId}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }

    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-[#E0E1D9] bg-[#FBFAF7] p-0 text-[#343B35] shadow-2xl backdrop:bg-black/50"
      style={{
        position: "fixed",
        inset: 0,
        margin: "auto",
        width: sizes[size],
        maxWidth: "calc(100vw - 2rem)",
      }}
    >
      <div className="flex items-center justify-between border-b border-[#E7E7DF] px-5 py-4">
        <h2
          id={titleId}
          className="text-[15px] font-semibold tracking-[-0.01em] text-[#39443B]"
        >
          {title}
        </h2>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="flex size-8 items-center justify-center rounded-md text-lg text-[#858D84] transition-colors hover:bg-[#ECEFE9] hover:text-[#39443B]"
        >
          ×
        </button>
      </div>

      <div className="p-5">{children}</div>
    </dialog>
  );
}
