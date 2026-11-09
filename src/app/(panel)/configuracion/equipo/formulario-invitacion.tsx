"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/formularios";
import { invitarMiembro } from "./acciones";

export function FormularioInvitacion() {
  const [estado, accion] = useActionState(invitarMiembro, estadoInicial);
  const v = estado.valores ?? {};
  const e = estado.errores ?? {};
  return (
    // key: tras una invitación exitosa se limpia el formulario.
    <form key={estado.ok} action={accion} className="mt-4 space-y-4" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" name="nombre" required defaultValue={v.nombre} error={e.nombre} />
        <Campo etiqueta="Correo" name="email" type="email" required defaultValue={v.email} error={e.email} />
        <Campo etiqueta="WhatsApp (opcional)" name="telefono" type="tel" placeholder="55 1234 5678" defaultValue={v.telefono} error={e.telefono} />
        <div>
          <label htmlFor="rol" className="mb-1 block text-sm font-medium text-slate-700">
            Rol
          </label>
          <select
            id="rol"
            name="rol"
            defaultValue={v.rol ?? "asesor"}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          >
            <option value="asesor">Asesor</option>
            <option value="dueno">Dueño / director</option>
          </select>
          {e.rol ? <p className="mt-1 text-sm text-red-600">{e.rol}</p> : null}
        </div>
      </div>
      <BotonEnviar textoEnviando="Enviando invitación…">Enviar invitación</BotonEnviar>
    </form>
  );
}
