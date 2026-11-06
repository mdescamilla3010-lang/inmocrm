export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      asesor_zonas: {
        Row: {
          asesor_id: string;
          inmobiliaria_id: string;
          zona_id: string;
        };
        ComputedFields: never;
        Insert: {
          asesor_id: string;
          inmobiliaria_id: string;
          zona_id: string;
        };
        Update: {
          asesor_id?: string;
          inmobiliaria_id?: string;
          zona_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asesor_zonas_inmobiliaria_id_asesor_id_fkey";
            columns: ["inmobiliaria_id", "asesor_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
          {
            foreignKeyName: "asesor_zonas_inmobiliaria_id_zona_id_fkey";
            columns: ["inmobiliaria_id", "zona_id"];
            isOneToOne: false;
            referencedRelation: "zonas";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
        ];
      };
      capturas_lead: {
        Row: {
          actualizado_en: string;
          creado_en: string;
          detalle: string | null;
          fuente: Database["public"]["Enums"]["fuente_lead"];
          id: string;
          id_externo: string | null;
          inmobiliaria_id: string;
          lead_id: string | null;
          payload: NonNullable<Json>;
          resultado: Database["public"]["Enums"]["resultado_captura"];
        };
        ComputedFields: never;
        Insert: {
          actualizado_en?: string;
          creado_en?: string;
          detalle?: string | null;
          fuente: Database["public"]["Enums"]["fuente_lead"];
          id?: string;
          id_externo?: string | null;
          inmobiliaria_id: string;
          lead_id?: string | null;
          payload?: NonNullable<Json>;
          resultado?: Database["public"]["Enums"]["resultado_captura"];
        };
        Update: {
          actualizado_en?: string;
          creado_en?: string;
          detalle?: string | null;
          fuente?: Database["public"]["Enums"]["fuente_lead"];
          id?: string;
          id_externo?: string | null;
          inmobiliaria_id?: string;
          lead_id?: string | null;
          payload?: NonNullable<Json>;
          resultado?: Database["public"]["Enums"]["resultado_captura"];
        };
        Relationships: [
          {
            foreignKeyName: "capturas_lead_inmobiliaria_id_fkey";
            columns: ["inmobiliaria_id"];
            isOneToOne: false;
            referencedRelation: "inmobiliarias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "capturas_lead_inmobiliaria_id_lead_id_fkey";
            columns: ["inmobiliaria_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
        ];
      };
      citas: {
        Row: {
          actualizado_en: string;
          asesor_id: string;
          creado_en: string;
          estado: Database["public"]["Enums"]["estado_cita"];
          fin: string;
          google_event_id: string | null;
          id: string;
          inicio: string;
          inmobiliaria_id: string;
          lead_id: string;
          motivo_cancelacion: string | null;
          notas: string | null;
          origen: string;
          propiedad_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          actualizado_en?: string;
          asesor_id: string;
          creado_en?: string;
          estado?: Database["public"]["Enums"]["estado_cita"];
          fin: string;
          google_event_id?: string | null;
          id?: string;
          inicio: string;
          inmobiliaria_id: string;
          lead_id: string;
          motivo_cancelacion?: string | null;
          notas?: string | null;
          origen?: string;
          propiedad_id?: string | null;
        };
        Update: {
          actualizado_en?: string;
          asesor_id?: string;
          creado_en?: string;
          estado?: Database["public"]["Enums"]["estado_cita"];
          fin?: string;
          google_event_id?: string | null;
          id?: string;
          inicio?: string;
          inmobiliaria_id?: string;
          lead_id?: string;
          motivo_cancelacion?: string | null;
          notas?: string | null;
          origen?: string;
          propiedad_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "citas_inmobiliaria_id_asesor_id_fkey";
            columns: ["inmobiliaria_id", "asesor_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
          {
            foreignKeyName: "citas_inmobiliaria_id_lead_id_fkey";
            columns: ["inmobiliaria_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
          {
            foreignKeyName: "citas_inmobiliaria_id_propiedad_id_fkey";
            columns: ["inmobiliaria_id", "propiedad_id"];
            isOneToOne: false;
            referencedRelation: "propiedades";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
        ];
      };
      conversaciones: {
        Row: {
          actualizado_en: string;
          canal: string;
          cerrada_en: string | null;
          creado_en: string;
          ia_activa: boolean;
          id: string;
          inmobiliaria_id: string;
          lead_id: string;
          resumen: string | null;
          ultimo_entrante_en: string | null;
        };
        ComputedFields: never;
        Insert: {
          actualizado_en?: string;
          canal?: string;
          cerrada_en?: string | null;
          creado_en?: string;
          ia_activa?: boolean;
          id?: string;
          inmobiliaria_id: string;
          lead_id: string;
          resumen?: string | null;
          ultimo_entrante_en?: string | null;
        };
        Update: {
          actualizado_en?: string;
          canal?: string;
          cerrada_en?: string | null;
          creado_en?: string;
          ia_activa?: boolean;
          id?: string;
          inmobiliaria_id?: string;
          lead_id?: string;
          resumen?: string | null;
          ultimo_entrante_en?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversaciones_inmobiliaria_id_lead_id_fkey";
            columns: ["inmobiliaria_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
        ];
      };
      eventos_lead: {
        Row: {
          creado_en: string;
          datos: NonNullable<Json>;
          id: number;
          inmobiliaria_id: string;
          lead_id: string;
          tipo: string;
          usuario_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          creado_en?: string;
          datos?: NonNullable<Json>;
          id?: never;
          inmobiliaria_id: string;
          lead_id: string;
          tipo: string;
          usuario_id?: string | null;
        };
        Update: {
          creado_en?: string;
          datos?: NonNullable<Json>;
          id?: never;
          inmobiliaria_id?: string;
          lead_id?: string;
          tipo?: string;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "eventos_lead_inmobiliaria_id_lead_id_fkey";
            columns: ["inmobiliaria_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
          {
            foreignKeyName: "eventos_lead_inmobiliaria_id_usuario_id_fkey";
            columns: ["inmobiliaria_id", "usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
        ];
      };
      inmobiliarias: {
        Row: {
          actualizado_en: string;
          agente_instrucciones: string | null;
          agente_nombre: string;
          clave_landing: string;
          creado_en: string;
          duracion_cita_min: number;
          estrategia_asignacion: Database["public"]["Enums"]["estrategia_asignacion"];
          horario_visitas: NonNullable<Json>;
          id: string;
          nombre: string;
          slug: string;
          zona_horaria: string;
        };
        ComputedFields: never;
        Insert: {
          actualizado_en?: string;
          agente_instrucciones?: string | null;
          agente_nombre?: string;
          clave_landing?: string;
          creado_en?: string;
          duracion_cita_min?: number;
          estrategia_asignacion?: Database["public"]["Enums"]["estrategia_asignacion"];
          horario_visitas?: NonNullable<Json>;
          id?: string;
          nombre: string;
          slug: string;
          zona_horaria?: string;
        };
        Update: {
          actualizado_en?: string;
          agente_instrucciones?: string | null;
          agente_nombre?: string;
          clave_landing?: string;
          creado_en?: string;
          duracion_cita_min?: number;
          estrategia_asignacion?: Database["public"]["Enums"]["estrategia_asignacion"];
          horario_visitas?: NonNullable<Json>;
          id?: string;
          nombre?: string;
          slug?: string;
          zona_horaria?: string;
        };
        Relationships: [];
      };
      integraciones: {
        Row: {
          activa: boolean;
          actualizado_en: string;
          config: NonNullable<Json>;
          creado_en: string;
          credenciales_cifradas: string | null;
          id: string;
          identificador_externo: string;
          inmobiliaria_id: string;
          proveedor: Database["public"]["Enums"]["proveedor_integracion"];
          usuario_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          activa?: boolean;
          actualizado_en?: string;
          config?: NonNullable<Json>;
          creado_en?: string;
          credenciales_cifradas?: string | null;
          id?: string;
          identificador_externo: string;
          inmobiliaria_id: string;
          proveedor: Database["public"]["Enums"]["proveedor_integracion"];
          usuario_id?: string | null;
        };
        Update: {
          activa?: boolean;
          actualizado_en?: string;
          config?: NonNullable<Json>;
          creado_en?: string;
          credenciales_cifradas?: string | null;
          id?: string;
          identificador_externo?: string;
          inmobiliaria_id?: string;
          proveedor?: Database["public"]["Enums"]["proveedor_integracion"];
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "integraciones_inmobiliaria_id_fkey";
            columns: ["inmobiliaria_id"];
            isOneToOne: false;
            referencedRelation: "inmobiliarias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integraciones_inmobiliaria_id_usuario_id_fkey";
            columns: ["inmobiliaria_id", "usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
        ];
      };
      leads: {
        Row: {
          actualizado_en: string;
          asesor_id: string | null;
          asignado_en: string | null;
          creado_en: string;
          credito_preaprobado: boolean | null;
          datos_crudos: Json | null;
          email: string | null;
          estado: Database["public"]["Enums"]["estado_lead"];
          forma_pago: Database["public"]["Enums"]["forma_pago"] | null;
          fuente: Database["public"]["Enums"]["fuente_lead"];
          fuente_detalle: NonNullable<Json>;
          id: string;
          inmobiliaria_id: string;
          mensaje_inicial: string | null;
          nombre: string | null;
          notas_calificacion: string | null;
          operacion_interes:
            Database["public"]["Enums"]["operacion_propiedad"] | null;
          opt_out: boolean;
          presupuesto_max: number | null;
          presupuesto_min: number | null;
          primer_contacto_en: string | null;
          propiedad_interes_id: string | null;
          recamaras_min: number | null;
          score: Database["public"]["Enums"]["score_lead"] | null;
          score_actualizado_en: string | null;
          score_motivo: string | null;
          score_puntos: number | null;
          telefono: string | null;
          tipo_propiedad_interes:
            Database["public"]["Enums"]["tipo_propiedad"] | null;
          ultimo_mensaje_en: string | null;
          urgencia: Database["public"]["Enums"]["urgencia_lead"] | null;
          zona_id: string | null;
          zona_interes: string | null;
        };
        ComputedFields: never;
        Insert: {
          actualizado_en?: string;
          asesor_id?: string | null;
          asignado_en?: string | null;
          creado_en?: string;
          credito_preaprobado?: boolean | null;
          datos_crudos?: Json | null;
          email?: string | null;
          estado?: Database["public"]["Enums"]["estado_lead"];
          forma_pago?: Database["public"]["Enums"]["forma_pago"] | null;
          fuente: Database["public"]["Enums"]["fuente_lead"];
          fuente_detalle?: NonNullable<Json>;
          id?: string;
          inmobiliaria_id: string;
          mensaje_inicial?: string | null;
          nombre?: string | null;
          notas_calificacion?: string | null;
          operacion_interes?:
            Database["public"]["Enums"]["operacion_propiedad"] | null;
          opt_out?: boolean;
          presupuesto_max?: number | null;
          presupuesto_min?: number | null;
          primer_contacto_en?: string | null;
          propiedad_interes_id?: string | null;
          recamaras_min?: number | null;
          score?: Database["public"]["Enums"]["score_lead"] | null;
          score_actualizado_en?: string | null;
          score_motivo?: string | null;
          score_puntos?: number | null;
          telefono?: string | null;
          tipo_propiedad_interes?:
            Database["public"]["Enums"]["tipo_propiedad"] | null;
          ultimo_mensaje_en?: string | null;
          urgencia?: Database["public"]["Enums"]["urgencia_lead"] | null;
          zona_id?: string | null;
          zona_interes?: string | null;
        };
        Update: {
          actualizado_en?: string;
          asesor_id?: string | null;
          asignado_en?: string | null;
          creado_en?: string;
          credito_preaprobado?: boolean | null;
          datos_crudos?: Json | null;
          email?: string | null;
          estado?: Database["public"]["Enums"]["estado_lead"];
          forma_pago?: Database["public"]["Enums"]["forma_pago"] | null;
          fuente?: Database["public"]["Enums"]["fuente_lead"];
          fuente_detalle?: NonNullable<Json>;
          id?: string;
          inmobiliaria_id?: string;
          mensaje_inicial?: string | null;
          nombre?: string | null;
          notas_calificacion?: string | null;
          operacion_interes?:
            Database["public"]["Enums"]["operacion_propiedad"] | null;
          opt_out?: boolean;
          presupuesto_max?: number | null;
          presupuesto_min?: number | null;
          primer_contacto_en?: string | null;
          propiedad_interes_id?: string | null;
          recamaras_min?: number | null;
          score?: Database["public"]["Enums"]["score_lead"] | null;
          score_actualizado_en?: string | null;
          score_motivo?: string | null;
          score_puntos?: number | null;
          telefono?: string | null;
          tipo_propiedad_interes?:
            Database["public"]["Enums"]["tipo_propiedad"] | null;
          ultimo_mensaje_en?: string | null;
          urgencia?: Database["public"]["Enums"]["urgencia_lead"] | null;
          zona_id?: string | null;
          zona_interes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leads_inmobiliaria_id_asesor_id_fkey";
            columns: ["inmobiliaria_id", "asesor_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
          {
            foreignKeyName: "leads_inmobiliaria_id_fkey";
            columns: ["inmobiliaria_id"];
            isOneToOne: false;
            referencedRelation: "inmobiliarias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_inmobiliaria_id_propiedad_interes_id_fkey";
            columns: ["inmobiliaria_id", "propiedad_interes_id"];
            isOneToOne: false;
            referencedRelation: "propiedades";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
          {
            foreignKeyName: "leads_inmobiliaria_id_zona_id_fkey";
            columns: ["inmobiliaria_id", "zona_id"];
            isOneToOne: false;
            referencedRelation: "zonas";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
        ];
      };
      mensajes: {
        Row: {
          asesor_id: string | null;
          autor: Database["public"]["Enums"]["autor_mensaje"];
          contenido: string | null;
          conversacion_id: string;
          creado_en: string;
          direccion: Database["public"]["Enums"]["direccion_mensaje"];
          error: string | null;
          estado: Database["public"]["Enums"]["estado_mensaje"];
          id: string;
          inmobiliaria_id: string;
          metadatos: NonNullable<Json>;
          proveedor_mensaje_id: string | null;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          asesor_id?: string | null;
          autor: Database["public"]["Enums"]["autor_mensaje"];
          contenido?: string | null;
          conversacion_id: string;
          creado_en?: string;
          direccion: Database["public"]["Enums"]["direccion_mensaje"];
          error?: string | null;
          estado: Database["public"]["Enums"]["estado_mensaje"];
          id?: string;
          inmobiliaria_id: string;
          metadatos?: NonNullable<Json>;
          proveedor_mensaje_id?: string | null;
          tipo?: string;
        };
        Update: {
          asesor_id?: string | null;
          autor?: Database["public"]["Enums"]["autor_mensaje"];
          contenido?: string | null;
          conversacion_id?: string;
          creado_en?: string;
          direccion?: Database["public"]["Enums"]["direccion_mensaje"];
          error?: string | null;
          estado?: Database["public"]["Enums"]["estado_mensaje"];
          id?: string;
          inmobiliaria_id?: string;
          metadatos?: NonNullable<Json>;
          proveedor_mensaje_id?: string | null;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mensajes_inmobiliaria_id_asesor_id_fkey";
            columns: ["inmobiliaria_id", "asesor_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
          {
            foreignKeyName: "mensajes_inmobiliaria_id_conversacion_id_fkey";
            columns: ["inmobiliaria_id", "conversacion_id"];
            isOneToOne: false;
            referencedRelation: "conversaciones";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
        ];
      };
      propiedad_fotos: {
        Row: {
          creado_en: string;
          es_portada: boolean;
          id: string;
          inmobiliaria_id: string;
          orden: number;
          propiedad_id: string;
          ruta_storage: string;
        };
        ComputedFields: never;
        Insert: {
          creado_en?: string;
          es_portada?: boolean;
          id?: string;
          inmobiliaria_id: string;
          orden?: number;
          propiedad_id: string;
          ruta_storage: string;
        };
        Update: {
          creado_en?: string;
          es_portada?: boolean;
          id?: string;
          inmobiliaria_id?: string;
          orden?: number;
          propiedad_id?: string;
          ruta_storage?: string;
        };
        Relationships: [
          {
            foreignKeyName: "propiedad_fotos_inmobiliaria_id_propiedad_id_fkey";
            columns: ["inmobiliaria_id", "propiedad_id"];
            isOneToOne: false;
            referencedRelation: "propiedades";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
        ];
      };
      propiedades: {
        Row: {
          acepta_credito_bancario: boolean;
          acepta_fovissste: boolean;
          acepta_infonavit: boolean;
          actualizado_en: string;
          amenidades: string[];
          asesor_responsable_id: string | null;
          banos: number | null;
          clave: string | null;
          codigo_postal: string | null;
          colonia: string | null;
          creado_en: string;
          creado_por: string | null;
          descripcion: string | null;
          direccion: string | null;
          entidad_federativa: string | null;
          estacionamientos: number | null;
          estado: Database["public"]["Enums"]["estado_propiedad"];
          id: string;
          inmobiliaria_id: string;
          latitud: number | null;
          longitud: number | null;
          m2_construccion: number | null;
          m2_terreno: number | null;
          moneda: string;
          municipio: string | null;
          operacion: Database["public"]["Enums"]["operacion_propiedad"];
          precio: number;
          recamaras: number | null;
          tipo: Database["public"]["Enums"]["tipo_propiedad"];
          titulo: string;
          zona_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          acepta_credito_bancario?: boolean;
          acepta_fovissste?: boolean;
          acepta_infonavit?: boolean;
          actualizado_en?: string;
          amenidades?: string[];
          asesor_responsable_id?: string | null;
          banos?: number | null;
          clave?: string | null;
          codigo_postal?: string | null;
          colonia?: string | null;
          creado_en?: string;
          creado_por?: string | null;
          descripcion?: string | null;
          direccion?: string | null;
          entidad_federativa?: string | null;
          estacionamientos?: number | null;
          estado?: Database["public"]["Enums"]["estado_propiedad"];
          id?: string;
          inmobiliaria_id: string;
          latitud?: number | null;
          longitud?: number | null;
          m2_construccion?: number | null;
          m2_terreno?: number | null;
          moneda?: string;
          municipio?: string | null;
          operacion?: Database["public"]["Enums"]["operacion_propiedad"];
          precio: number;
          recamaras?: number | null;
          tipo: Database["public"]["Enums"]["tipo_propiedad"];
          titulo: string;
          zona_id?: string | null;
        };
        Update: {
          acepta_credito_bancario?: boolean;
          acepta_fovissste?: boolean;
          acepta_infonavit?: boolean;
          actualizado_en?: string;
          amenidades?: string[];
          asesor_responsable_id?: string | null;
          banos?: number | null;
          clave?: string | null;
          codigo_postal?: string | null;
          colonia?: string | null;
          creado_en?: string;
          creado_por?: string | null;
          descripcion?: string | null;
          direccion?: string | null;
          entidad_federativa?: string | null;
          estacionamientos?: number | null;
          estado?: Database["public"]["Enums"]["estado_propiedad"];
          id?: string;
          inmobiliaria_id?: string;
          latitud?: number | null;
          longitud?: number | null;
          m2_construccion?: number | null;
          m2_terreno?: number | null;
          moneda?: string;
          municipio?: string | null;
          operacion?: Database["public"]["Enums"]["operacion_propiedad"];
          precio?: number;
          recamaras?: number | null;
          tipo?: Database["public"]["Enums"]["tipo_propiedad"];
          titulo?: string;
          zona_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "propiedades_creado_por_fkey";
            columns: ["creado_por"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propiedades_inmobiliaria_id_asesor_responsable_id_fkey";
            columns: ["inmobiliaria_id", "asesor_responsable_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
          {
            foreignKeyName: "propiedades_inmobiliaria_id_fkey";
            columns: ["inmobiliaria_id"];
            isOneToOne: false;
            referencedRelation: "inmobiliarias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propiedades_inmobiliaria_id_zona_id_fkey";
            columns: ["inmobiliaria_id", "zona_id"];
            isOneToOne: false;
            referencedRelation: "zonas";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
        ];
      };
      seguimientos: {
        Row: {
          cita_id: string | null;
          creado_en: string;
          ejecutado_en: string | null;
          estado: Database["public"]["Enums"]["estado_seguimiento"];
          id: string;
          inmobiliaria_id: string;
          intentos: number;
          lead_id: string;
          programado_para: string;
          tipo: Database["public"]["Enums"]["tipo_seguimiento"];
          ultimo_error: string | null;
        };
        ComputedFields: never;
        Insert: {
          cita_id?: string | null;
          creado_en?: string;
          ejecutado_en?: string | null;
          estado?: Database["public"]["Enums"]["estado_seguimiento"];
          id?: string;
          inmobiliaria_id: string;
          intentos?: number;
          lead_id: string;
          programado_para: string;
          tipo: Database["public"]["Enums"]["tipo_seguimiento"];
          ultimo_error?: string | null;
        };
        Update: {
          cita_id?: string | null;
          creado_en?: string;
          ejecutado_en?: string | null;
          estado?: Database["public"]["Enums"]["estado_seguimiento"];
          id?: string;
          inmobiliaria_id?: string;
          intentos?: number;
          lead_id?: string;
          programado_para?: string;
          tipo?: Database["public"]["Enums"]["tipo_seguimiento"];
          ultimo_error?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "seguimientos_inmobiliaria_id_cita_id_fkey";
            columns: ["inmobiliaria_id", "cita_id"];
            isOneToOne: false;
            referencedRelation: "citas";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
          {
            foreignKeyName: "seguimientos_inmobiliaria_id_lead_id_fkey";
            columns: ["inmobiliaria_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["inmobiliaria_id", "id"];
          },
        ];
      };
      usuarios: {
        Row: {
          activo: boolean;
          actualizado_en: string;
          creado_en: string;
          email: string;
          google_calendar_id: string | null;
          id: string;
          inmobiliaria_id: string;
          nombre: string;
          recibe_leads: boolean;
          rol: Database["public"]["Enums"]["rol_usuario"];
          telefono: string | null;
          ultima_asignacion_en: string | null;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          actualizado_en?: string;
          creado_en?: string;
          email: string;
          google_calendar_id?: string | null;
          id: string;
          inmobiliaria_id: string;
          nombre: string;
          recibe_leads?: boolean;
          rol: Database["public"]["Enums"]["rol_usuario"];
          telefono?: string | null;
          ultima_asignacion_en?: string | null;
        };
        Update: {
          activo?: boolean;
          actualizado_en?: string;
          creado_en?: string;
          email?: string;
          google_calendar_id?: string | null;
          id?: string;
          inmobiliaria_id?: string;
          nombre?: string;
          recibe_leads?: boolean;
          rol?: Database["public"]["Enums"]["rol_usuario"];
          telefono?: string | null;
          ultima_asignacion_en?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "usuarios_inmobiliaria_id_fkey";
            columns: ["inmobiliaria_id"];
            isOneToOne: false;
            referencedRelation: "inmobiliarias";
            referencedColumns: ["id"];
          },
        ];
      };
      zonas: {
        Row: {
          alias: string[];
          creado_en: string;
          id: string;
          inmobiliaria_id: string;
          nombre: string;
        };
        ComputedFields: never;
        Insert: {
          alias?: string[];
          creado_en?: string;
          id?: string;
          inmobiliaria_id: string;
          nombre: string;
        };
        Update: {
          alias?: string[];
          creado_en?: string;
          id?: string;
          inmobiliaria_id?: string;
          nombre?: string;
        };
        Relationships: [
          {
            foreignKeyName: "zonas_inmobiliaria_id_fkey";
            columns: ["inmobiliaria_id"];
            isOneToOne: false;
            referencedRelation: "inmobiliarias";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      crear_inmobiliaria: {
        Args: { p_nombre: string; p_nombre_dueno: string; p_slug: string };
        Returns: string;
      };
      siguiente_asesor_round_robin: {
        Args: { p_candidatos: string[]; p_inmobiliaria_id: string };
        Returns: string;
      };
    };
    Enums: {
      autor_mensaje: "prospecto" | "agente" | "asesor" | "sistema";
      direccion_mensaje: "entrante" | "saliente";
      estado_cita:
        "programada" | "confirmada" | "realizada" | "no_asistio" | "cancelada";
      estado_lead:
        | "nuevo"
        | "en_conversacion"
        | "calificado"
        | "cita_agendada"
        | "visita_realizada"
        | "ganado"
        | "perdido"
        | "descartado";
      estado_mensaje:
        "recibido" | "en_cola" | "enviado" | "entregado" | "leido" | "fallido";
      estado_propiedad:
        | "borrador"
        | "disponible"
        | "apartada"
        | "vendida"
        | "rentada"
        | "inactiva";
      estado_seguimiento:
        "pendiente" | "procesando" | "enviado" | "cancelado" | "fallido";
      estrategia_asignacion: "round_robin" | "zona";
      forma_pago:
        "contado" | "credito_bancario" | "infonavit" | "fovissste" | "otro";
      fuente_lead:
        | "meta_ads"
        | "landing"
        | "inmuebles24"
        | "lamudi"
        | "vivanuncios"
        | "whatsapp"
        | "manual";
      operacion_propiedad: "venta" | "renta";
      proveedor_integracion:
        "whatsapp_cloud" | "twilio" | "google_calendar" | "meta_leads";
      resultado_captura:
        "procesando" | "creado" | "recapturado" | "descartado" | "error";
      rol_usuario: "dueno" | "asesor";
      score_lead: "caliente" | "tibio" | "frio";
      tipo_propiedad:
        | "casa"
        | "departamento"
        | "terreno"
        | "local_comercial"
        | "oficina"
        | "bodega"
        | "otro";
      tipo_seguimiento:
        | "recordatorio_24h"
        | "recordatorio_2h"
        | "reactivacion_3d"
        | "reactivacion_7d"
        | "reactivacion_15d";
      urgencia_lead:
        | "menos_1_mes"
        | "uno_a_tres_meses"
        | "tres_a_seis_meses"
        | "mas_de_seis_meses"
        | "sin_definir";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      autor_mensaje: ["prospecto", "agente", "asesor", "sistema"],
      direccion_mensaje: ["entrante", "saliente"],
      estado_cita: [
        "programada",
        "confirmada",
        "realizada",
        "no_asistio",
        "cancelada",
      ],
      estado_lead: [
        "nuevo",
        "en_conversacion",
        "calificado",
        "cita_agendada",
        "visita_realizada",
        "ganado",
        "perdido",
        "descartado",
      ],
      estado_mensaje: [
        "recibido",
        "en_cola",
        "enviado",
        "entregado",
        "leido",
        "fallido",
      ],
      estado_propiedad: [
        "borrador",
        "disponible",
        "apartada",
        "vendida",
        "rentada",
        "inactiva",
      ],
      estado_seguimiento: [
        "pendiente",
        "procesando",
        "enviado",
        "cancelado",
        "fallido",
      ],
      estrategia_asignacion: ["round_robin", "zona"],
      forma_pago: [
        "contado",
        "credito_bancario",
        "infonavit",
        "fovissste",
        "otro",
      ],
      fuente_lead: [
        "meta_ads",
        "landing",
        "inmuebles24",
        "lamudi",
        "vivanuncios",
        "whatsapp",
        "manual",
      ],
      operacion_propiedad: ["venta", "renta"],
      proveedor_integracion: [
        "whatsapp_cloud",
        "twilio",
        "google_calendar",
        "meta_leads",
      ],
      resultado_captura: [
        "procesando",
        "creado",
        "recapturado",
        "descartado",
        "error",
      ],
      rol_usuario: ["dueno", "asesor"],
      score_lead: ["caliente", "tibio", "frio"],
      tipo_propiedad: [
        "casa",
        "departamento",
        "terreno",
        "local_comercial",
        "oficina",
        "bodega",
        "otro",
      ],
      tipo_seguimiento: [
        "recordatorio_24h",
        "recordatorio_2h",
        "reactivacion_3d",
        "reactivacion_7d",
        "reactivacion_15d",
      ],
      urgencia_lead: [
        "menos_1_mes",
        "uno_a_tres_meses",
        "tres_a_seis_meses",
        "mas_de_seis_meses",
        "sin_definir",
      ],
    },
  },
} as const;
