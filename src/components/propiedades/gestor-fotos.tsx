"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Aviso } from "@/components/ui/aviso";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { BUCKET_FOTOS, MAX_FOTOS_POR_PROPIEDAD, rutaNuevaFoto, TIPOS_FOTO, validarArchivoFoto } from "@/lib/propiedades/fotos";

type Foto = { id: string; url: string; esPortada: boolean };

type Props = {
  inmobiliariaId: string;
  propiedadId: string;
  fotos: Foto[];
  registrar: (rutas: string[]) => Promise<{ error?: string }>;
  borrar: (fotoId: string) => Promise<void>;
  portada: (fotoId: string) => Promise<void>;
};

export function GestorFotos({ inmobiliariaId, propiedadId, fotos, registrar, borrar, portada }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [pendiente, iniciar] = useTransition();

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return;
    const lista = Array.from(archivos);
    const problemas: string[] = [];
    if (fotos.length + lista.length > MAX_FOTOS_POR_PROPIEDAD) {
      setErrores([`Máximo ${MAX_FOTOS_POR_PROPIEDAD} fotos por propiedad.`]);
      return;
    }

    const supabase = crearClienteNavegador();
    const subidas: string[] = [];
    for (const [i, archivo] of lista.entries()) {
      setProgreso(`Subiendo ${i + 1} de ${lista.length}…`);
      const invalida = validarArchivoFoto(archivo);
      const ruta = rutaNuevaFoto(inmobiliariaId, propiedadId, archivo.type, crypto.randomUUID().replaceAll("-", ""));
      if (invalida || !ruta) {
        problemas.push(`${archivo.name}: ${invalida ?? "formato no válido"}`);
        continue;
      }
      const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(ruta, archivo, { contentType: archivo.type });
      if (error) problemas.push(`${archivo.name}: no se pudo subir`);
      else subidas.push(ruta);
    }

    if (subidas.length) {
      setProgreso("Guardando…");
      const r = await registrar(subidas);
      if (r.error) problemas.push(r.error);
    }
    setProgreso(null);
    setErrores(problemas);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {errores.length ? (
        <Aviso tipo="error">
          <ul className="list-inside list-disc">
            {errores.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Aviso>
      ) : null}

      {fotos.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fotos.map((f) => (
            <li key={f.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- URLs de Storage, sin optimizador configurado */}
              <img src={f.url} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
              {f.esPortada ? (
                <span className="absolute left-2 top-2 rounded bg-emerald-700 px-2 py-0.5 text-xs font-medium text-white">Portada</span>
              ) : null}
              <div className="flex gap-1 p-2 text-xs">
                {!f.esPortada ? (
                  <button type="button" disabled={pendiente} onClick={() => iniciar(() => portada(f.id))} className="rounded px-2 py-1 text-slate-700 hover:bg-white">
                    Usar de portada
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => {
                    if (confirm("¿Borrar esta foto?")) iniciar(() => borrar(f.id));
                  }}
                  className="ml-auto rounded px-2 py-1 text-red-700 hover:bg-white"
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">Aún no hay fotos. La primera que subas será la portada.</p>
      )}

      <div>
        <input
          ref={input}
          id="fotos"
          type="file"
          multiple
          accept={TIPOS_FOTO.join(",")}
          className="sr-only"
          disabled={Boolean(progreso)}
          onChange={(e) => subir(e.target.files)}
        />
        <label
          htmlFor="fotos"
          className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          {progreso ?? "Subir fotos"}
        </label>
        <p className="mt-1 text-xs text-slate-500">JPG, PNG o WebP de hasta 10 MB.</p>
      </div>
    </div>
  );
}
