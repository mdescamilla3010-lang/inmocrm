import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Navegacion } from "@/components/panel/navegacion";
import { cerrarSesion } from "@/app/acciones-sesion";
import { ETIQUETA_ROL, navegacionPara } from "@/lib/auth/permisos";
import { requerirUsuario } from "@/lib/auth/sesion";

export default async function LayoutPanel({ children }: LayoutProps<"/">) {
  const usuario = await requerirUsuario();
  const items = navegacionPara(usuario.rol).map(({ href, etiqueta }) => ({ href, etiqueta }));

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:border-b-0">
        <div className="px-4 pt-4 md:px-5 md:pt-6">
          <p className="text-lg font-bold tracking-tight text-emerald-800">InmoCRM</p>
          <p className="truncate text-sm text-slate-600" title={usuario.inmobiliaria.nombre}>
            {usuario.inmobiliaria.nombre}
          </p>
        </div>
        <div className="px-2 py-3 md:flex-1 md:px-3 md:py-6">
          <Navegacion items={items} />
        </div>
        <div className="hidden border-t border-slate-200 p-4 md:block">
          <p className="truncate text-sm font-medium">{usuario.nombre}</p>
          <p className="text-xs text-slate-500">{ETIQUETA_ROL[usuario.rol]}</p>
          <form action={cerrarSesion} className="mt-3">
            <BotonEnviar variante="secundario" textoEnviando="Saliendo…" className="w-full">
              Cerrar sesión
            </BotonEnviar>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
