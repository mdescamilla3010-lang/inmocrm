/** Estado que devuelven las server actions usadas con useActionState. */
export type EstadoFormulario = {
  error?: string;
  errores?: Record<string, string>;
  ok?: string;
  /** Valores enviados, para no vaciar el formulario cuando hay error. */
  valores?: Record<string, string>;
};

export const estadoInicial: EstadoFormulario = {};
