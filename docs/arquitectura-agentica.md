# Arquitectura agéntica de ArriendoMapa

**Estado:** propuesto · **Fecha:** 27-jul-2026 · **Decide:** Matías
**Alcance:** refactor del módulo `ai-assistant` del backend NestJS, en producción.

---

## 1. Contexto

Hoy el agente es **un solo loop de tool-calling**: un modelo, cinco herramientas, hasta 4 iteraciones.
Funciona y está medido en producción (0,55 CLP por mensaje, ~6 s de latencia). Pero es una pieza
única haciendo todo: no distingue un "hola" de "compárame tres comunas para una familia con perro",
y no tiene forma de verificarse a sí misma.

Los cuatro patrones agénticos resuelven cosas distintas. La decisión de fondo de este documento
**no es cuál usar, sino cuándo usar cada uno** — porque aplicarlos todos a toda consulta es caro y,
sobre todo, lento.

### Lo que ya existe y no se toca

| Pieza | Rol | Se conserva |
|---|---|---|
| `tool-declarations.ts` | 5 herramientas | ✅ sin cambios |
| `tool-executor.service.ts` | ejecuta y arma acciones de mapa | ✅ sin cambios |
| `modo-basico.service.ts` | fallback por reglas, sin IA | ✅ es el piso de todo |
| `llm.service.ts` | ahora expone primitivos reutilizables | ♻️ refactorizado |

---

## 2. Decisión central: enrutamiento adaptativo

> **No todas las consultas pagan el costo de toda la maquinaria.**

Un clasificador barato corre primero y decide qué camino toma la consulta. Las simples siguen
costando lo de hoy; solo las complejas activan planificador y evaluador.

```
mensaje
   │
   ▼
┌──────────────┐   saludo/charla   ┌─────────────────────┐
│   ROUTER     ├──────────────────►│ respuesta directa   │  1 llamada
│ (clasifica)  │                   └─────────────────────┘
└──────┬───────┘
       │ simple                    ┌─────────────────────┐
       ├──────────────────────────►│ PIPELINE            │  2 llamadas
       │                           │ tools → redacción   │
       │                           └──────────┬──────────┘
       │ compleja                             │
       │              ┌────────────────────┐  │
       └─────────────►│ PLANNER            │  │
                      │  ├─ ejecutor 1  ┐  │  │
                      │  ├─ ejecutor 2  ├──┤  │  paralelo
                      │  └─ ejecutor 3  ┘  │  │
                      │  └─ sintetizador   │  │
                      └──────────┬─────────┘  │
                                 │            │
                                 ▼            ▼
                      ┌────────────────────────────┐
                      │ EVALUADOR ↔ OPTIMIZADOR    │  solo si hay
                      │ ¿está fundado en los datos?│  datos en juego
                      └────────────┬───────────────┘
                                   ▼
                              respuesta + acciones de mapa
```

---

## 3. Los cuatro patrones, aterrizados a esta app

### 3.1 Router — clasificador de intención

**Qué problema resuelve aquí:** hoy "hola" gatilla un prompt de sistema de ~1.200 tokens con las
cinco herramientas declaradas. Es desperdicio de plata y de segundos.

**Contrato:**

```jsonc
// entrada: mensaje + últimos 4 turnos
// salida (temperatura 0, max_tokens 150):
{
  "intencion": "buscar | comparar | informe | reportar_calle | crear_agente | charla | fuera_de_alcance",
  "complejidad": "simple | compleja",
  "entidades": { "comunas": ["Puente Alto"], "dormitorios": 3, "precio_max": 600000 },
  "requiere_datos": true,
  "motivo": "una frase de por qué"
}
```

**Reglas de complejidad** (van en el prompt, no en código, para que sea ajustable):
- `compleja` si menciona **dos o más comunas**, pide comparar, o combina 3+ criterios que requieren
  herramientas distintas ("compara X con Y para familia con perro y buena micro").
- `simple` en todo lo demás.

**Si el router falla** → se asume `{intencion: "buscar", complejidad: "simple"}`, que es el
comportamiento actual. Nunca bloquea.

**Archivo:** `patrones/router.service.ts`

---

### 3.2 Pipeline — cadena secuencial

**Qué problema resuelve aquí:** es el camino por defecto y el que ya funciona. El patrón solo lo
hace **explícito y observable**: comprender → ejecutar herramientas → redactar.

La fase de "comprender" ya la hizo el router, así que sus entidades se **inyectan en el prompt**
como contexto ("el usuario busca en Puente Alto, 3 dormitorios, hasta $600.000"). Eso reduce
iteraciones del loop: el modelo ya no tiene que deducir los filtros desde cero.

**Ganancia esperada:** de 2 llamadas a veces 1, porque llega con los filtros masticados.

**Archivo:** `patrones/pipeline.service.ts` (envuelve `loopHerramientas`)

---

### 3.3 Planner + ejecutores — descomposición en paralelo

**Qué problema resuelve aquí:** hoy "compárame Puente Alto con La Florida" hace las llamadas
**en serie** dentro del loop. Con tres comunas son tres viajes secuenciales de ~6 s cada uno.

**Contrato del planificador:**

```jsonc
// salida (max_tokens 400):
{
  "subtareas": [
    { "id": "t1", "objetivo": "estadísticas de Puente Alto", "tool": "estadisticas_zona", "args": {"comuna": "Puente Alto"} },
    { "id": "t2", "objetivo": "estadísticas de La Florida",  "tool": "estadisticas_zona", "args": {"comuna": "La Florida"} },
    { "id": "t3", "objetivo": "casas que calzan",            "tool": "buscar_casas",      "args": {"dormitorios_min": 3, "amenidades": ["mascotas"]} }
  ],
  "sintesis": "comparar ambas comunas para una familia con perro y recomendar una"
}
```

**Ejecución:** `Promise.all()` sobre las subtareas. Como el planificador ya entrega `tool` y `args`,
los ejecutores llaman **directo a `ToolExecutorService`** — sin pasar por el modelo. Eso es clave:
las subtareas cuestan **cero tokens**, solo el planificador y el sintetizador gastan.

**Sintetizador:** una llamada final que recibe los resultados crudos y redacta la comparación.

**Guardas:** máximo 4 subtareas; si el planificador propone una tool inexistente, esa subtarea se
descarta y se sigue con las demás.

**Ganancia esperada:** latencia de ~18 s a ~8 s en comparaciones, con **menos** tokens que el loop
secuencial (porque las subtareas no pasan por el modelo).

**Archivo:** `patrones/planner.service.ts`

---

### 3.4 Evaluador ↔ optimizador — bucle adversario

**Qué problema resuelve aquí:** este es el que más valor tiene para tu producto, y no por elegancia
técnica. Tu app le dice a alguien **dónde va a vivir** y si su calle se inunda. Una cifra inventada
no es un bug cosmético.

**El evaluador recibe la respuesta redactada Y los datos crudos de las herramientas** (`datosTools`,
que el refactor ya captura). Verifica:

| Criterio | Por qué |
|---|---|
| Toda propiedad, precio y dirección citada **existe en `datosTools`** | evita alucinación de casas |
| Si alguna propiedad tiene tramo inundable a <200 m, **la respuesta lo menciona** | regla 10 del prompt |
| **No afirma seguridad absoluta** ("no se inunda", "es seguro") | el riesgo es referencial |
| Atribuye la fuente al hablar de riesgo o micros (GORE / GTFS) | trazabilidad del dato |
| Cierra con **una sola** pregunta | regla 11 |

**Contrato:**

```jsonc
{ "aprobada": false,
  "problemas": ["cita la casa #47 que no está en los resultados",
                "dice 'zona segura' sin matizar"],
  "instruccion_correccion": "Reescribe usando solo las casas listadas y cambia 'segura' por 'sin puntos críticos registrados a menos de 700 m'" }
```

**Optimizador:** regenera con la crítica como instrucción adicional. **Máximo 2 iteraciones** y si a
la segunda no aprueba, se devuelve la mejor versión con la advertencia registrada en la traza —
nunca se deja al usuario sin respuesta.

**Cuándo se activa** (esto es lo que evita que duplique el costo de todo):
- ✅ la respuesta cita propiedades concretas
- ✅ se habló de riesgo de inundación
- ✅ la ruta fue `planner`
- ❌ saludos, confirmaciones de alerta, reportes de calle

**Archivo:** `patrones/evaluador.service.ts`

---

## 4. Estructura de archivos

```
backend/src/ai-assistant/
├── llm.service.ts              ♻️  primitivos: completar(), completarJson(),
│                                   loopHerramientas(), contabilizar(), costos()
├── orquestador.service.ts      🆕  el director: router → ruta → evaluador → traza
├── patrones/
│   ├── router.service.ts       🆕
│   ├── pipeline.service.ts     🆕
│   ├── planner.service.ts      🆕
│   └── evaluador.service.ts    🆕
├── tool-declarations.ts        ✅
├── tool-executor.service.ts    ✅
├── modo-basico.service.ts      ✅  piso de degradación
└── ai-assistant.controller.ts  ♻️  ahora llama al orquestador
```

El controlador expone lo mismo que hoy (`POST /api/ai/chat`), más la traza en la respuesta.

---

## 5. Presupuesto: costo y latencia por ruta

Medido en producción: **0,55 CLP/mensaje**, 13.539 tokens de entrada y 1.556 de salida en 6 llamadas.
`deepseek-v4-flash` cuesta USD 0,14 (entrada) / 0,28 (salida) por millón, y **es un modelo de
razonamiento** — gasta tokens pensando, por eso el `max_tokens` va holgado.

| Ruta | Llamadas | Costo est. | Latencia est. | % del tráfico esperado |
|---|---|---|---|---|
| Charla | 1 | ~0,10 CLP | ~2 s | 15 % |
| Pipeline | 2 | ~0,55 CLP | ~6 s | 60 % |
| Pipeline + evaluador | 3–4 | ~0,90 CLP | ~10 s | 15 % |
| Planner + síntesis + evaluador | 4–5 | ~1,40 CLP | ~9 s | 10 % |

**Promedio ponderado: ~0,63 CLP/mensaje** — un 15 % más caro que hoy.
A 40 mensajes semanales: **~101 CLP/usuario/mes** contra los 89 actuales.

> **El costo no es el problema; la latencia sí.** Doce pesos más al mes por usuario es irrelevante
> frente a las 20 lucas que paga hoy por postular. Pero pasar de 6 a 10 segundos **sí se siente**.
> Por eso el evaluador es selectivo y las subtareas del planner no pasan por el modelo.

---

## 6. Degradación: nunca dejar al usuario sin respuesta

Cadena de caída, de más a menos sofisticado:

```
planner falla        → pipeline
evaluador falla      → se entrega la respuesta sin evaluar (marcado en la traza)
router falla         → pipeline con intención "buscar"
proveedor LLM falla  → modo básico (reglas, sin IA)
```

**Presupuesto duro por request:** máximo **8 llamadas** al modelo y **60 s** de reloj. Si se excede,
se corta y se devuelve lo mejor que haya. Esto evita que un bucle evaluador↔optimizador mal calibrado
se coma la cuota.

---

## 7. Observabilidad: la traza

Cada respuesta incluye un objeto de traza (visible en el chat con un toggle de debug):

```jsonc
"traza": {
  "ruta": "planner",
  "patrones": ["router", "planner", "evaluador"],
  "subtareas": 3,
  "iteraciones_evaluador": 1,
  "aprobada": true,
  "llamadas": 4,
  "ms": 8420,
  "costo_clp": 1.38
}
```

Sin esto, una arquitectura de cuatro patrones es una caja negra imposible de depurar. Con esto puedes
ver exactamente por qué una respuesta tardó o costó lo que costó.

---

## 8. Orden de implementación y verificación

| # | Paso | Cómo se verifica |
|---|---|---|
| 1 | Primitivos en `llm.service` | ✅ ya hecho — compila |
| 2 | `router.service` + orquestador mínimo (solo enruta a pipeline) | "hola" → 1 llamada; "3D en Puente Alto" → pipeline. Comportamiento idéntico al actual |
| 3 | `pipeline.service` con entidades inyectadas | mismas respuestas, menos iteraciones |
| 4 | `planner.service` | "compara Puente Alto con La Florida" → traza muestra 3 subtareas paralelas |
| 5 | `evaluador.service` | inyectar a propósito una respuesta con casa inexistente → debe rechazarla |
| 6 | Traza en el frontend | toggle de debug en el chat |

Cada paso queda funcionando antes de pasar al siguiente, y el loop actual sigue disponible como
red de seguridad hasta que el paso 4 esté verificado.

---

## 9. Riesgos y lo que te discutiría

**El evaluador puede volverse un censor.** Si el prompt del evaluador es muy estricto, va a rechazar
respuestas buenas y duplicar el costo sin ganancia. Mitigación: arrancar con los cinco criterios de
la tabla y **medir la tasa de rechazo**. Si supera el 30 %, el evaluador está mal calibrado, no el
redactor.

**El planner puede sobre-descomponer.** Un modelo entusiasta parte "busco casa" en seis subtareas.
Por eso el tope de 4 y la instrucción explícita de no descomponer lo que cabe en una sola herramienta.

**Cuatro patrones es mucha superficie para un proyecto de una persona.** Lo digo derecho: el que
más valor te da hoy es el **evaluador** (protege al usuario de datos inventados) y el que menos, el
**pipeline** (ya lo tienes, solo lo formaliza). Si en algún momento hay que recortar, el orden de
sacrificio sería pipeline → planner → router → evaluador.

**Esto no arregla el dataset.** Ninguna arquitectura agéntica compensa tener 136 avisos con fotos
repetidas. La ingesta real sigue siendo la prioridad de producto; esto es prioridad de plataforma.
