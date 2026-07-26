/**
 * Herramientas del asistente — patrón calcado de tool-declarations.ts de CotizadorIA.
 * Cada tool devuelve datos para el LLM Y una acción de mapa para el frontend.
 */
export const TOOL_DECLARATIONS = [
  {
    name: 'buscar_casas',
    description:
      'Busca casas en arriendo según filtros. Úsala siempre que el usuario pida ver, buscar o filtrar propiedades. Devuelve lista compacta y filtra el mapa.',
    input_schema: {
      type: 'object',
      properties: {
        precio_max: { type: 'number', description: 'Precio máximo mensual en CLP (ej: 500000)' },
        precio_min: { type: 'number', description: 'Precio mínimo mensual en CLP' },
        dormitorios_min: { type: 'number', description: 'Mínimo de dormitorios' },
        banos_min: { type: 'number', description: 'Mínimo de baños' },
        m2_min: { type: 'number', description: 'Superficie mínima en m²' },
        tipo: { type: 'string', enum: ['casa', 'departamento', 'todos'],
          description: 'Tipo de propiedad. El catálogo actual son casas.' },
        amenidades: { type: 'array', items: { type: 'string', enum: ['estac', 'mascotas', 'piscina', 'condominio'] },
          description: 'Debe cumplir TODAS: estac (estacionamiento), mascotas, piscina, condominio' },
        comuna: { type: 'string', description: 'Comuna exacta, ej: "Puente Alto", "La Florida"' },
        riesgo_maximo: {
          type: 'string',
          enum: ['bajo', 'atento', 'medio', 'alto'],
          description:
            'Nivel máximo aceptable de riesgo de inundación por cercanía a calles que se anegan. "bajo" = solo propiedades lejos de calles inundables.',
        },
        locomocion_min: {
          type: 'number',
          description: 'Score mínimo de locomoción 0-100 (55+ = buena conectividad de micros y Metro)',
        },
        texto: { type: 'string', description: 'Búsqueda libre en sector/descripción' },
      },
    },
  },
  {
    name: 'informe_critico',
    description:
      'Entrega el informe crítico completo de una casa por su id: riesgo de inundación (punto crítico GORE más cercano, canales), locomoción real (recorridos de micros GTFS, buses/hora punta, Metro), precio vs mediana comunal, fotos y link. Úsala cuando pregunten por una propiedad específica o pidan detalles/riesgos de una. El mapa vuela a la casa.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'number', description: 'ID de la casa (viene de buscar_casas)' } },
      required: ['id'],
    },
  },
  {
    name: 'estadisticas_zona',
    description:
      'Estadísticas de una comuna: precio mediano, $/m², distribución de riesgo de inundación, recorridos de micros más frecuentes y cantidad de puntos críticos de lluvia. Úsala para preguntas tipo "¿cómo es arrendar en X comuna?" o comparaciones de zonas. Centra el mapa en la comuna.',
    input_schema: {
      type: 'object',
      properties: { comuna: { type: 'string', description: 'Nombre de la comuna' } },
      required: ['comuna'],
    },
  },
  {
    name: 'crear_alerta',
    description:
      'Guarda el perfil de búsqueda del usuario para avisarle cuando aparezcan propiedades que calcen. Úsala cuando diga que quiere que le avisen, recibir ofertas, guardar la búsqueda o que le lleguen novedades. Confirma en una frase qué quedó guardado.',
    input_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre corto para la alerta, ej: "Casa en Puente Alto"' },
        filtros: { type: 'object', description: 'Mismos campos que buscar_casas' },
        email: { type: 'string', description: 'Correo del usuario si lo dio (opcional)' },
      },
      required: ['nombre', 'filtros'],
    },
  },
];
