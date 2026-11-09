"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import type { Rol } from "@/lib/auth/permisos";
import { estadoInicial } from "@/lib/formularios";
import { actualizarMiembro } from "./acciones";

type Miembro = {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
  recibeLeads: boolean;
};

export function FilaMiembro({ miembro, esYo }: { miembro: Miembro; esYo: boolean }) {
  const [estado, accion] = useActionState(actualizarMiembro, estadoInicial);
  const idForm = `miembro-${miembro.id}`;
  return (
    <tr className={miembro.activo ? "" : "bg-slate-50 text-slate-500"}>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">
          {miembro.nombre} {esYo ? <span className="text-xs font-normal text-slate-500">(tú)</span> : null}
        </p>
        <p className="text-slate-500">{miembro.email}</p>
        {miembro.telefono ? <p className="text-slate-500">{miembro.telefono}</p> : null}
      </td>
      <td className="px-4 py-3">
        <select
          form={idForm}
          name="rol"
          defaultValue={miembro.rol}
          aria-label={`Rol de ${miembro.nombre}`}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1"
        >
          <option value="asesor">Asesor</option>
          <option value="dueno">Dueño / director</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <input form={idForm} type="checkbox" name="activo" defaultChecked={miembro.activo} aria-label={`${miembro.nombre} activo`} className="size-4 accent-emerald-700" />
      </td>
      <td className="px-4 py-3">
        <input form={idForm} type="checkbox" name="recibeLeads" defaultChecked={miembro.recibeLeads} aria-label={`${miembro.nombre} recibe leads`} className="size-4 accent-emerald-700" />
      </td>
      <td className="px-4 py-3 text-right">
        <form id={idForm} action={accion} className="inline-flex flex-col items-end gap-1">
          <input type="hidden" name="id" value={miembro.id} />
          <BotonEnviar variante="secundario" textoEnviando="Guardando…">
            Guardar
          </BotonEnviar>
          {estado.error ? <span role="alert" className="text-xs text-red-600">{estado.error}</span> : null}
          {estado.ok ? <span role="status" className="text-xs text-emerald-700">{estado.ok}</span> : null}
        </form>
      </td>
    </tr>
  );
}
