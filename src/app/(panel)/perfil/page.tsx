import type { Metadata } from "next";
import { cerrarSesion } from "@/app/acciones-sesion";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { ETIQUETA_ROL } from "@/lib/auth/permisos";
import { requerirUsuario } from "@/lib/auth/sesion";
import { envServidor } from "@/lib/env";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearTelefono } from "@/lib/telefono";
import { desconectarGoogle } from "./acciones";
import { FormularioPerfil } from "./formulario";

export const metadata: Metadata = { title: "Mi perfil" };

const MENSAJES_GOOGLE: Record<string, { tipo: "ok" | "error"; texto: string }> = {
  conectado: { tipo: "ok", texto: "Listo: tu Google Calendar quedó conectado. El agente ya respeta tu agenda." },
  cancelado: { tipo: "error", texto: "Cancelaste la conexión con Google." },
  invalido: { tipo: "error", texto: "El enlace de conexión venció o no es válido. Inténtalo de nuevo." },
  permisos: { tipo: "error", texto: "Faltó autorizar el acceso al calendario. Vuelve a conectar y marca todos los permisos." },
  en_uso: { tipo: "error", texto: "Esa cuenta de Google ya está conectada por otro usuario de InmoCRM." },
  no_configurado: { tipo: "error", texto: "Google Calendar todavía no está configurado en el servidor." },
  error: { tipo: "error", texto: "No pudimos conectar con Google. Inténtalo de nuevo." },
};

export default async function PaginaPerfil({ searchParams }: PageProps<"/perfil">) {
  const usuario = await requerirUsuario();
  const { google } = await searchParams;
  const supabase = await crearClienteServidor();
  const [{ data: yo }, { data: calendario }] = await Promise.all([
    supabase.from("usuarios").select("nombre, telefono, google_calendar_id").eq("id", usuario.id).single(),
    supabase.from("integraciones").select("identificador_externo, activa").eq("proveedor", "google_calendar").eq("usuario_id", usuario.id).maybeSingle(),
  ]);
  const mensaje = typeof google === "string" ? MENSAJES_GOOGLE[google] : undefined;
  const googleConfigurado = Boolean(envServidor().GOOGLE_CLIENT_ID);

  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="mt-1 text-sm text-slate-600">
          {usuario.email} · {ETIQUETA_ROL[usuario.rol]} en {usuario.inmobiliaria.nombre}
        </p>
      </div>
      {mensaje ? <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">Google Calendar</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          Conéctalo para que el agente sólo ofrezca horarios en los que estás libre y tus visitas aparezcan solas en tu
          calendario. InmoCRM sólo ve si estás ocupado (no el detalle de tus eventos) y administra las visitas que agenda.
        </p>
        {calendario?.activa ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
            <span>
              Conectado como <span className="font-medium">{calendario.identificador_externo}</span>
            </span>
            <form action={desconectarGoogle}>
              <BotonEnviar variante="secundario" textoEnviando="…">Desconectar</BotonEnviar>
            </form>
          </div>
        ) : googleConfigurado ? (
          <>
            {calendario ? (
              <p className="mb-3 text-sm text-red-700">Google retiró el acceso a {calendario.identificador_externo}. Vuelve a conectarlo.</p>
            ) : null}
            {/* Enlace normal (no <Link>): la ruta redirige a Google. */}
            <a
              href="/api/integraciones/google/iniciar"
              className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
            >
              Conectar Google Calendar
            </a>
          </>
        ) : (
          <p className="text-sm text-amber-800">Google Calendar todavía no está configurado en el servidor.</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Tus datos</h2>
        <FormularioPerfil
          inicial={{
            nombre: yo?.nombre ?? usuario.nombre,
            telefono: yo?.telefono ? formatearTelefono(yo.telefono) : "",
            googleCalendarId: yo?.google_calendar_id ?? "primary",
          }}
        />
      </div>

      <form action={cerrarSesion}>
        <BotonEnviar variante="secundario" textoEnviando="Saliendo…">
          Cerrar sesión
        </BotonEnviar>
      </form>
    </section>
  );
}
