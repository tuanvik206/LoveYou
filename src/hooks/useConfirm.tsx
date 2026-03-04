"use client";

import { useState, useCallback } from "react";
import ConfirmDialog, { type ConfirmOptions } from "@/components/ui/ConfirmDialog";

/**
 * useConfirm — hook xác nhận đồng bộ toàn app.
 *
 * Usage:
 *   const { confirm, ConfirmNode } = useConfirm();
 *
 *   // Gọi trong handler:
 *   confirm({
 *     title: "Xoá ước mơ này?",
 *     message: "Hành động không thể hoàn tác.",
 *     confirmLabel: "Xoá",
 *     variant: "danger",
 *     onConfirm: () => handleDelete(id),
 *   });
 *
 *   // Render 1 lần trong JSX của page:
 *   return <main>...</main>{ConfirmNode}
 */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setState({ ...options, open: true });
  }, []);

  const handleCancel = useCallback(() => {
    setState(null);
  }, []);

  const ConfirmNode = state ? (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      variant={state.variant}
      onConfirm={state.onConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, ConfirmNode };
}
