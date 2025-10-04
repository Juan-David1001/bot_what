# Sistema de Atención al Cliente - Sex Shop 🛍️

Sistema backend completo para gestión de atención al cliente con WhatsApp, Gemini AI y base de datos SQLite.

## 🎯 Modelo Conceptual de Procesos (MCP)

### Objetivo Principal
Atender consultas de clientes de manera rápida, organizada y discreta, proporcionando orientación sobre productos, recomendaciones y soporte, **sin gestionar pagos ni facturación**.

### Actores
- **Cliente**: Puede identificarse con alias o nombre real (privacidad garantizada)
- **Asesor/Empleado**: Atiende consultas profesionalmente
- **Sistema de soporte**: WhatsApp, web, teléfono o presencial con IA Gemini

### Procesos Implementados
1. ✅ **Registro del cliente** (opcional, con alias para privacidad)
2. ✅ **Recepción y registro** de consultas con metadatos (fecha, canal, tema)
3. ✅ **Clasificación automática**: producto, recomendación, soporte_uso, queja_sugerencia
4. ✅ **Atención con IA**: Gemini mantiene historial de conversación persistente
5. ✅ **Escalamiento** a supervisor para casos complejos
6. ✅ **Cierre de consulta** con registro completo
7. ✅ **Encuesta de satisfacción** automática

## 📊 Base de Datos (SQLite + Prisma)

**Modelos**:
- `Contact`: Clientes (alias, nombre real opcional, privacyMode)
- `Session`: Conversaciones continuas con historial Gemini
- `Message`: Registro completo de mensajes IN/OUT
- `Consultation`: Consultas clasificadas y rastreadas
- `Advisor`: Asesores y supervisores
- `Escalation`: Casos escalados a supervisión
- `SatisfactionSurvey`: Encuestas de satisfacción (1-5 estrellas)
- `Product`: Catálogo de productos

## 🚀 Instalación y Configuración

### Requisitos
- Node.js >= 18
- npm

### Comandos (PowerShell)

```powershell
# Instalar dependencias
npm install

# Copiar variables de entorno
Copy-Item .env.example .env

# Ejecutar migraciones de Prisma
npm run prisma:migrate

# Modo desarrollo (incluye WhatsApp QR)
npm run dev

# Construir para producción
npm run build

# Ejecutar producción
npm start

# Prisma Studio (GUI para ver la DB)
npm run prisma:studio

# Tests
npm test

# Lint y formato
npm run lint
npm run format
```

### Variables de Entorno (.env)

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="file:./dev.db"

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here  # ¡NO subir esta clave a git!
GEMINI_MODEL=gemini-2.5-flash
```

**Obtener API Key de Gemini**: https://aistudio.google.com/app/apikey

## 📡 API Endpoints

### Sistema MCP - Atención al Cliente

#### POST /mcp/message
**Proceso principal**: Recibir y responder mensaje del cliente con conversación persistente

**Body**:
```json
{
  "message": "Hola, busco un producto para...",
  "contactNumber": "5215512345678",
  "contactAlias": "Ana",
  "contactRealName": "Ana García",
  "channel": "whatsapp",
  "advisorId": 1
}
```

**Response**:
```json
{
  "success": true,
  "response": "¡Hola Ana! Con gusto te ayudo...",
  "sessionId": 1,
  "consultationId": 1,
  "category": "producto"
}
```

#### POST /mcp/consultation/:id/resolve
Marcar consulta como resuelta

#### POST /mcp/consultation/:id/escalate
Escalar consulta a supervisor

**Body**:
```json
{
  "reason": "Consulta técnica compleja",
  "assignedToId": 2
}
```

#### POST /mcp/session/:id/close
Cerrar sesión y enviar solicitud de encuesta automáticamente

#### POST /mcp/survey
Registrar encuesta de satisfacción

**Body**:
```json
{
  "consultationId": 1,
  "rating": 5,
  "comments": "Excelente atención"
}
```

#### GET /mcp/session/:id/history
Obtener historial completo de conversación (DB + Gemini)

#### GET /mcp/reports/metrics
Métricas de atención: total, resueltas, escaladas, rating promedio, por categoría

### Productos

#### GET /products
Listar productos (filtros: `?category=juguetes&inStock=true`)

#### POST /products
Crear producto en catálogo

#### GET /products/search?q=texto
Buscar por nombre, categoría, descripción o tags

### Asesores

#### GET /advisors
Listar asesores activos

#### POST /advisors
Crear nuevo asesor

## 🔄 Flujo de Trabajo Completo (Automático vía WhatsApp)

### Flujo Principal
1. **Cliente envía mensaje** de tipo "chat" por WhatsApp (ej: "Hola", "Busco...")
2. WhatsApp service **filtra** y detecta mensaje válido (ignora notificaciones)
3. Sistema **registra/recupera contacto** automáticamente
4. Sistema **crea/recupera sesión activa** con thread ID de Gemini
5. **Gemini procesa** mensaje usando **historial completo de conversación nativa**
6. Sistema **clasifica automáticamente** la consulta
7. **Respuesta enviada** automáticamente por WhatsApp al cliente
8. Todo se **registra en base de datos** (mensajes IN/OUT, consulta, sesión)
9. Al cerrar sesión: **solicitud de encuesta** enviada automáticamente
10. **Métricas disponibles** para análisis de calidad

### Características del Chat
- ✅ **Conversación nativa de Gemini**: usa API de chat, no concatenación manual
- ✅ **Historial persistente**: cada sesión mantiene contexto completo
- ✅ **Filtrado inteligente**: solo mensajes tipo "chat" con body
- ✅ **Sin duplicación**: ignora mensajes propios (fromMe=true)
- ✅ **Logging minimalista**: solo info relevante, sin JSON gigantes

## 🔒 Restricciones y Cumplimiento

✅ **NO gestiona pagos ni facturación**  
✅ **Privacidad garantizada** - uso de alias permitido  
✅ **Registro completo** de todas las consultas  
✅ **Conversación persistente** con Gemini (no queries aisladas)  
✅ **Múltiples canales** de atención soportados  
✅ **Escalamiento** profesional de casos complejos  
✅ **Métricas y reportes** de calidad de atención  

## 📂 Estructura del Proyecto

```
src/
├── app.ts                      # Configuración Express
├── server.ts                   # Punto de entrada
├── db/
│   └── prisma.ts              # Cliente Prisma
├── controllers/
│   ├── mcpController.ts       # Lógica MCP completa (7 procesos)
│   ├── productController.ts   # Gestión de catálogo
│   └── advisorController.ts   # Gestión de asesores
├── routes/
│   ├── mcp.ts                 # Rutas MCP
│   ├── products.ts            # Rutas productos
│   ├── advisors.ts            # Rutas asesores
│   └── health.ts              # Health check
├── services/
│   ├── whatsapp.ts            # Cliente WhatsApp
│   ├── gemini.ts              # Cliente Gemini básico
│   └── geminiConversation.ts  # Conversaciones persistentes
└── middleware/
    └── errorHandler.ts        # Manejo de errores

prisma/
├── schema.prisma              # Esquema completo MCP
└── migrations/                # Migraciones SQL

tests/
└── health.test.ts            # Tests
```

## 💡 Características Destacadas

### Conversaciones Persistentes con Gemini
- **No son queries aisladas**: cada sesión mantiene historial completo
- Contexto completo en cada respuesta
- Almacenamiento en memoria (migrar a Redis para producción)

### WhatsApp Integrado
- Autenticación por QR al iniciar (`npm run dev`)
- Envío automático de respuestas
- Persistencia de sesión con LocalAuth (`.wwebjs_auth/`)

### Clasificación Inteligente
- Automática por palabras clave
- Categorías: producto, recomendación, soporte_uso, queja_sugerencia
- Extensible para usar clasificación con IA

### Privacidad y Discreción
- Campo `privacyMode` en contactos
- Uso de alias en lugar de nombre real
- Mensajes profesionales y sin prejuicios

## 🎯 Próximos Pasos Sugeridos

1. Configurar API real de Gemini en `.env`
2. Ejecutar `npm run dev` y escanear QR de WhatsApp
3. Cargar productos: `POST /products`
4. Crear asesores: `POST /advisors`
5. Probar flujo con cliente de prueba: `POST /mcp/message`
6. Revisar métricas: `GET /mcp/reports/metrics`
7. Ver conversaciones: `npm run prisma:studio`
8. Agregar autenticación JWT para endpoints administrativos
9. Implementar webhooks WhatsApp Business API (alternativa a whatsapp-web.js)

## 📌 Notas Técnicas

- **WhatsApp session**: `.wwebjs_auth/` (ignorado en git)
- **Base de datos**: `dev.db` SQLite (ignorado en git)
- **Conversaciones Gemini**: En memoria - considerar Redis para producción
- **Para producción**: PostgreSQL + autenticación + rate limiting

---

**Sistema diseñado con enfoque en privacidad, profesionalismo y eficiencia** ✨
