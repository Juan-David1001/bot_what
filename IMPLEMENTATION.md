# Sistema de Atención al Cliente - Sex Shop

## 🎯 Modelo Conceptual de Procesos (MCP) - Implementación Completa

Se ha diseñado e implementado un sistema completo de atención al cliente siguiendo todos los requisitos especificados.

## ✅ Implementación Completada

### 1. Base de Datos (Prisma + SQLite)

**Modelos creados**:
- ✅ **Contact**: Clientes con alias/nombre real y modo privacidad
- ✅ **Session**: Sesiones con historial persistente Gemini
- ✅ **Message**: Mensajes IN/OUT con metadatos
- ✅ **Consultation**: Consultas clasificadas (producto, recomendación, soporte_uso, queja_sugerencia)
- ✅ **Advisor**: Asesores y supervisores
- ✅ **Escalation**: Escalamientos con asignación
- ✅ **SatisfactionSurvey**: Encuestas 1-5 estrellas
- ✅ **Product**: Catálogo de productos

### 2. Servicios Implementados

**Conversación persistente con Gemini** (`src/services/geminiConversation.ts`):
- ✅ Historial completo de conversación (no queries aisladas)
- ✅ Contexto mantenido en cada respuesta
- ✅ Clasificación automática de consultas
- ✅ Respuestas profesionales y discretas

**Integración WhatsApp** (`src/services/whatsapp.ts`):
- ✅ Cliente whatsapp-web.js
- ✅ Autenticación por QR
- ✅ Envío automático de respuestas

### 3. Controladores y Rutas

**MCP Controller** (`src/controllers/mcpController.ts`):
- ✅ `handleClientMessage`: Proceso principal completo (1-7)
- ✅ `resolveConsultation`: Cierre de consultas
- ✅ `escalateConsultation`: Escalamiento a supervisores
- ✅ `closeSession`: Cierre con solicitud de encuesta
- ✅ `submitSurvey`: Registro de satisfacción
- ✅ `getSessionHistory`: Historial completo (DB + Gemini)
- ✅ `getMetrics`: Reportes y métricas

**Product Controller** (`src/controllers/productController.ts`):
- ✅ CRUD de productos
- ✅ Búsqueda por nombre, categoría, tags

**Advisor Controller** (`src/controllers/advisorController.ts`):
- ✅ Gestión de asesores/empleados

### 4. Flujo Completo Implementado

```
Cliente → WhatsApp → Sistema
    ↓
1. Registro/Recuperación (alias o nombre real)
    ↓
2. Recepción y almacenamiento con metadatos
    ↓
3. Clasificación automática (4 categorías)
    ↓
4. Consulta a Gemini con historial completo
    ↓
5. Respuesta registrada y enviada por WhatsApp
    ↓
6. [Opcional] Escalamiento a supervisor
    ↓
7. Cierre de sesión
    ↓
8. Encuesta de satisfacción automática
    ↓
Métricas y reportes disponibles
```

## 🚀 Cómo Usar

### 1. Iniciar el sistema

```powershell
npm run dev
```

- Escanea el QR de WhatsApp que aparece en consola
- El servidor estará en http://localhost:3000

### 2. Enviar mensaje de cliente

```bash
POST http://localhost:3000/mcp/message
Content-Type: application/json

{
  "message": "Hola, busco recomendaciones para principiantes",
  "contactNumber": "5215512345678",
  "contactAlias": "María",
  "channel": "whatsapp"
}
```

**El sistema automáticamente**:
- Registra el cliente con alias
- Crea sesión con Gemini
- Clasifica como "recomendacion"
- Genera respuesta profesional
- Envía por WhatsApp
- Guarda todo en DB

### 3. Ver historial de conversación

```bash
GET http://localhost:3000/mcp/session/1/history
```

Retorna mensajes completos + historial Gemini

### 4. Cerrar sesión y solicitar encuesta

```bash
POST http://localhost:3000/mcp/session/1/close
```

Envía automáticamente mensaje de encuesta por WhatsApp

### 5. Ver métricas

```bash
GET http://localhost:3000/mcp/reports/metrics
```

Retorna:
- Total de consultas
- Consultas resueltas
- Consultas escaladas
- Rating promedio
- Distribución por categoría

## 📊 Entradas y Salidas

### Entradas
✅ Alias/nombre del cliente
✅ Número de contacto
✅ Mensaje/consulta
✅ Canal (whatsapp, web, teléfono, presencial)
✅ [Opcional] ID de asesor

### Salidas
✅ Respuesta enviada al cliente (automático por WhatsApp)
✅ Historial completo en base de datos
✅ Métricas de satisfacción y reportes
✅ Clasificación de consultas
✅ Estado de escalamientos

## 🔒 Restricciones Cumplidas

✅ **No pagos/facturación**: Sistema solo atiende consultas
✅ **Privacidad garantizada**: Uso de alias permitido, campo privacyMode
✅ **Registro completo**: Todas las consultas en DB
✅ **Conversación persistente**: Gemini mantiene historial, no queries aisladas
✅ **Múltiples canales**: WhatsApp, web, teléfono, presencial
✅ **Escalamiento**: Casos complejos a supervisor
✅ **Encuestas**: Solicitud automática al cerrar

## 📁 Archivos Creados/Modificados

### Nuevos archivos
- `prisma/schema.prisma` - Esquema completo MCP (8 modelos)
- `src/services/geminiConversation.ts` - Conversaciones persistentes
- `src/controllers/mcpController.ts` - 7 funciones para procesos MCP
- `src/controllers/productController.ts` - Gestión de catálogo
- `src/controllers/advisorController.ts` - Gestión de asesores
- `src/routes/mcp.ts` - Rutas MCP completas
- `src/routes/products.ts` - Rutas de productos
- `src/routes/advisors.ts` - Rutas de asesores

### Archivos modificados
- `src/app.ts` - Montaje de nuevas rutas
- `README.md` - Documentación completa del MCP
- `.env` - Variables configuradas

## 🎨 Arquitectura del Sistema

```
┌─────────────────────────────────────────────┐
│            Cliente (WhatsApp/Web)           │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│       POST /mcp/message (Entrada)           │
└─────────────────┬───────────────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
    ▼                           ▼
┌─────────┐               ┌──────────┐
│ Contact │               │ Session  │
│  (DB)   │               │ + Gemini │
└─────────┘               └──────────┘
                               │
                               ▼
                          ┌──────────┐
                          │  Gemini  │
                          │ (History)│
                          └──────────┘
                               │
                               ▼
                     ┌─────────────────┐
                     │  Consultation   │
                     │  (Clasificada)  │
                     └─────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
          ┌─────────┐    ┌─────────┐   ┌──────────┐
          │ Message │    │WhatsApp │   │ Metrics  │
          │  (DB)   │    │ (Send)  │   │ (Report) │
          └─────────┘    └─────────┘   └──────────┘
```

## 🎯 Siguiente Acción Recomendada

1. **Configurar Gemini real**: Edita `.env` con tu API key de Gemini
2. **Iniciar servidor**: `npm run dev`
3. **Escanear QR**: Autenticar WhatsApp
4. **Cargar productos**: `POST /products` con datos de tu catálogo
5. **Crear asesores**: `POST /advisors`
6. **Probar flujo**: Envía mensaje de prueba con `POST /mcp/message`
7. **Ver resultados**: `GET /mcp/reports/metrics` y `npm run prisma:studio`

---

**Sistema MCP completo implementado y listo para uso** ✨
