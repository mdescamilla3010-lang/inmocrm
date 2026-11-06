import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioPropiedad } from "@/components/propiedades/formulario-propiedad";
import { GestorFotos } from "@/components/propiedades/gestor-fotos";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { requerirUsuario } from "@/lib/auth/sesion";
import { envPublico } from "@/lib/env";
import { urlPublicaFoto } from "@/lib/propiedades/fotos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { actualizarPropiedad, borrarFoto, borrarPropiedad, marcarPortada, registrarFotos } from "../acciones";
import { opcionesFormulario } from "../datos";

export const metadata: Metadata = { title: "Propiedad" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export default async function PaginaPropiedad({ params, searchParams }: PageProps<"/propiedades/[id]">) {
  const { id } = await params;
  const { nueva } = await searchParams;
  if (!UUID.test(id)) notFound();
  const usuario = await requerirUsuario();
  const supabase = await crearClienteServidor();

  const [{ data: p }, { data: fotos }, opcionesForm] = await Promise.all([
    supabase.from("propiedades").select("*").eq("id", id).maybeSingle(),
    supabase.from("propiedad_fotos").select("id, ruta_storage, es_portada").eq("propiedad_id", id).order("orden"),
    opcionesFormulario(),
  ]);
  if (!p) notFound();
  const supabaseUrl = envPublico().NEXT_PUBLIC_SUPABASE_URL;

  return (
    <section className="max-w-3xl space-y-6">
      <div>
        <Link href="/propiedades" className="text-sm text-slate-600 hover:underline">
          ← Propiedades
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{p.titulo}</h1>
        {p.clave ? <p className="text-sm text-slate-500">Clave {p.clave}</p> : null}
      </div>
      {nueva ? <Aviso tipo="ok">Propiedad guardada. Ahora sube sus fotos.</Aviso> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Fotos</h2>
        <GestorFotos
          inmobiliariaId={usuario.inmobiliariaId}
          propiedadId={p.id}
          fotos={(fotos ?? []).map((f) => ({ id: f.id, url: urlPublicaFoto(supabaseUrl, f.ruta_storage), esPortada: f.es_portada }))}
          registrar={registrarFotos.bind(null, p.id)}
          borrar={borrarFoto.bind(null, p.id)}
          portada={marcarPortada.bind(null, p.id)}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Datos</h2>
        <FormularioPropiedad
          accion={actualizarPropiedad.bind(null, p.id)}
          zonas={opcionesForm.zonas}
          asesores={opcionesForm.asesores}
          textoBoton="Guardar cambios"
          iniciales={{
            titulo: p.titulo,
            clave: texto(p.clave),
            descripcion: texto(p.descripcion),
            tipo: p.tipo,
            operacion: p.operacion,
            estado: p.estado,
            precio: texto(p.precio),
            moneda: p.moneda,
            zona_id: texto(p.zona_id),
            colonia: texto(p.colonia),
            municipio: texto(p.municipio),
            entidad_federativa: texto(p.entidad_federativa),
            codigo_postal: texto(p.codigo_postal),
            direccion: texto(p.direccion),
            recamaras: texto(p.recamaras),
            banos: texto(p.banos),
            estacionamientos: texto(p.estacionamientos),
            m2_construccion: texto(p.m2_construccion),
            m2_terreno: texto(p.m2_terreno),
            acepta_credito_bancario: p.acepta_credito_bancario ? "on" : "",
            acepta_infonavit: p.acepta_infonavit ? "on" : "",
            acepta_fovissste: p.acepta_fovissste ? "on" : "",
            amenidades: p.amenidades.join(", "),
            asesor_responsable_id: texto(p.asesor_responsable_id),
          }}
        />
      </div>

      {usuario.rol === "dueno" ? (
        <div className="rounded-xl border border-red-200 bg-white p-5">
          <h2 className="text-base font-semibold text-red-800">Borrar propiedad</h2>
          <p className="mt-1 text-sm text-slate-600">
            Se borran también sus fotos. Si sólo ya no está a la venta, mejor cambia su estado a vendida o inactiva.
          </p>
          <form action={borrarPropiedad.bind(null, p.id)} className="mt-3">
            <BotonEnviar variante="secundario" textoEnviando="Borrando…" className="!text-red-700">
              Borrar definitivamente
            </BotonEnviar>
          </form>
        </div>
      ) : null}
    </section>
  );
}
