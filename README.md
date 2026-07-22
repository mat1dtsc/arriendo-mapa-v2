# 🏠 ArriendoMapa v2 — Mapa + IA conversacional

Plataforma de arriendos para Santiago con **el mapa como eje** y un **copiloto IA** que lo controla. Arquitectura calcada de [CotizadorIA (Treck)](https://github.com/mat1dtsc/CotizadorIA-v2): backend **NestJS** modular con function calling + frontend **React (Vite)**.

```
Usuario ─ chat ─▶ POST /api/ai/chat
                    │  Claude (loop agéntico, máx 5 pasos)
                    │  ├─ buscar_casas(filtros)      ─▶ filtra pins del mapa
                    │  ├─ informe_critico(id)        ─▶ vuela a la casa
                    │  └─ estadisticas_zona(comuna)  ─▶ centra la comuna
                    ▼
              { respuesta, acciones[] } ─▶ el mapa las ejecuta
```

## El calco CotizadorIA → ArriendoMapa

| CotizadorIA (Demian) | ArriendoMapa v2 |
|---|---|
| `tool-declarations.ts` (buscar_productos, ficha técnica…) | `tool-declarations.ts` (buscar_casas, informe_critico, estadisticas_zona) |
| `tool-executor.service.ts` → HANA/SQL | `tool-executor.service.ts` → datos.json (F2: Supabase/PostGIS) |
| `claude-ai.service.ts` | `claude.service.ts` (loop agéntico + acciones de mapa) |
| `AiChatbot.jsx` + `useAiChat.js` | `ChatWindow.tsx` + `useAiChat.ts` |
| Pinecone RAG | F3: pgvector en Supabase |

**El twist propio**: cada tool devuelve `datos` (para el LLM) **y** `accion` (para el mapa). El chat no solo responde: mueve, filtra y vuela el mapa.

## Datos únicos (ya precalculados en `backend/data/datos.json`)
- 💧 **Riesgo de invierno**: 154 puntos críticos oficiales geocodificados (GORE RM, 14-jul-2026) + canales San Carlos y Zanjón de la Aguada → nivel por propiedad.
- 🚌 **Locomoción real**: recorridos de micros, buses/hora punta, paradero y Metro más cercanos (GTFS Red Movilidad DTPM, 04-jul-2026) → score 0-100.
- 💰 Precio $/m² vs mediana comunal. 136 avisos reales.

## Correr en local
```bash
# Backend (puerto 3000)
cd backend && cp .env.example .env   # pega tu ANTHROPIC_API_KEY
npm install && npm run start:dev

# Frontend (puerto 5173, proxy a /api)
cd frontend && npm install && npm run dev
```
Pruébalo: *"casas de 3 dormitorios bajo 500 mil en Puente Alto que no se inunden"* · *"¿cómo es arrendar en La Florida?"* · *"dame el informe de la casa 2"*.

## Roadmap
- **F1 (este repo)**: esqueleto + chat con tools sobre datos estáticos ✅
- **F2**: Supabase/PostGIS + ingesta viva de avisos (API Mercado Libre)
- **F3**: RAG (pgvector), memoria de usuario, guardrails y router semántico — patrón CotizadorIA completo

Fuentes: GORE RM (puntos críticos), DTPM (GTFS), OpenStreetMap (ODbL), CARTO.
