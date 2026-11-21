import { useEffect } from "react";

export default function Modal({ open, title, message, onConfirm, onCancel, confirmLabel = "Aceptar", cancelLabel = "Cancelar" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onCancel?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
        <h2 className="text-lg font-bold mb-2">{title}</h2>
        <p className="text-gray-700 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          {onCancel && <button className="px-4 py-2 rounded bg-gray-200" onClick={onCancel}>{cancelLabel}</button>}
          <button className="px-4 py-2 rounded bg-primary text-white" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}