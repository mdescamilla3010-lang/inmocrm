import { PestanasConfiguracion } from "@/components/panel/pestanas";
import { PESTANAS_CONFIGURACION } from "@/lib/auth/permisos";
import { requerirDueno } from "@/lib/auth/sesion";

export default async function LayoutConfiguracion({ children }: LayoutProps<"/configuracion">) {
  await requerirDueno();
  return (
    <div className="space-y-6">
      <PestanasConfiguracion pestanas={[...PESTANAS_CONFIGURACION]} />
      {children}
    </div>
  );
}
