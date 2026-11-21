import { useOffline } from "../../controllers/OfflineContext.jsx";
export default function OfflineBanner() {
  const { online, pending } = useOffline();
  if (online && pending === 0) return null;
  return (
    <div className="bg-secondary text-white text-sm text-center py-1">
      {!online ? "Sin conexión — los datos se guardarán localmente" : `${pending} elemento(s) pendiente(s) de sincronización`}
    </div>
  );
}