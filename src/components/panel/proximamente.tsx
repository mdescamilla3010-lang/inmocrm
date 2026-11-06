export function Proximamente({ titulo, fase, descripcion }: { titulo: string; fase: number; descripcion: string }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm font-medium text-slate-900">Disponible en la fase {fase}</p>
        <p className="mt-1 text-sm text-slate-600">{descripcion}</p>
      </div>
    </section>
  );
}
