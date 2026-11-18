const shapes = {
  Hoy: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /><path d="M9 16h6" /></>,
  Cierre: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 14h3m-3 3h3m4-2 2 2 3-4" /></>,
  Historial: <><path d="M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7" /><path d="M12 7v5l3 2" /></>,
  Guardar: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" /><path d="M7 3v6h10V3M7 21v-8h10v8" /></>,
};

export default function ButtonIcon({ name }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className="shrink-0">
      {shapes[name]}
    </svg>
  );
}
