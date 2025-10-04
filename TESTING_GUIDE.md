# 🧪 Guía de Pruebas - Sistema WhatsApp Bot con IA

## ✅ Estado Actual del Sistema

### Migración Completada
- ❌ **whatsapp-web.js** (removido - inestable)
- ✅ **@whiskeysockets/baileys** (instalado - más eficiente)
- ✅ **Integración MCP automática** (mensajes procesados automáticamente)
- ✅ **Gemini AI conversacional** (historial persistente)

---

## 🚀 Cómo Probar el Sistema

### 1. Verificar que el Servidor Esté Ejecutándose

```bash
npm run dev
```

Deberías ver:
```
✅ WhatsApp client is ready and connected!
Server listening on port 3000
```

---

### 2. Autenticación WhatsApp (Primera Vez)

Si ves un código QR en la terminal:
1. Abre WhatsApp en tu teléfono
2. Ve a **Configuración** → **Dispositivos vinculados**
3. Toca **"Vincular un dispositivo"**
4. Escanea el código QR de la terminal

Una vez vinculado, verás:
```
✅ WhatsApp client is ready and connected!
```

---

### 3. Enviar Mensajes de Prueba

Desde tu WhatsApp personal, envía mensajes al número vinculado:

#### 🗣️ **Prueba 1: Saludo Básico**
```
Hola
```

**Comportamiento esperado:**
- El mensaje aparece en la terminal del servidor:
  ```
  📩 INCOMING WhatsApp message:
    From: 5731XXXXXXXX
    Body: Hola
  ```
- El sistema MCP procesa el mensaje automáticamente
- Gemini genera una respuesta de bienvenida
- Recibes una respuesta por WhatsApp automáticamente

---

#### 🛍️ **Prueba 2: Consulta de Productos**
```
¿Qué vibradores tienen disponibles?
```

**Comportamiento esperado:**
- El sistema clasifica la consulta como categoría `producto`
- Gemini genera SQL para buscar en la base de datos
- Se ejecuta la query y se obtienen productos
- Recibes una lista de productos con detalles (nombre, precio, descripción)

---

#### 💬 **Prueba 3: Recomendación Personalizada**
```
Busco algo para principiantes, discreta y con buenas opiniones
```

**Comportamiento esperado:**
- Consulta clasificada como `recomendacion`
- Gemini analiza las características solicitadas
- Genera respuesta con productos filtrados
- Responde con recomendaciones personalizadas

---

#### ❓ **Prueba 4: Soporte de Uso**
```
¿Cómo se limpia un vibrador de silicona?
```

**Comportamiento esperado:**
- Consulta clasificada como `soporte_uso`
- Gemini proporciona instrucciones detalladas
- Respuesta profesional y educativa

---

#### 🏪 **Prueba 5: Información del Local**
```
¿Cuál es su horario de atención?
```

**Comportamiento esperado:**
- Respuesta automática con horarios y dirección
- No se requiere procesamiento con Gemini (respuesta directa)

---

## 📊 Monitoreo en Terminal

Durante las pruebas, observa los logs en la terminal:

```bash
📩 INCOMING WhatsApp message:
  From: 573114340586
  Body: Hola
  Timestamp: 2025-10-04T02:51:30.414Z
  Message ID: AC05D92AFA6474989E01B6B679E8B413

handleClientMessage: received request body: { 
  message: 'Hola',
  contactNumber: '573114340586',
  channel: 'whatsapp' 
}

handleClientMessage: contact upserted: { 
  id: 1, 
  alias: 'Cliente-0586', 
  number: '573114340586' 
}

handleClientMessage: using session: { 
  id: 1, 
  status: 'active' 
}

handleClientMessage: received aiResponse preview= ¡Hola! 👋 Bienvenido...

✅ sendWhatsAppMessage: success to= 573114340586
📤 OUTGOING WhatsApp message sent
✅ Message processed through MCP system
```

---

## 🔍 Verificar en Base de Datos

Puedes inspeccionar los datos guardados con Prisma Studio:

```bash
npm run prisma:studio
```

Abre: http://localhost:5555

### Tablas a revisar:
- **Contact** - Clientes registrados
- **Session** - Sesiones de conversación activas
- **Message** - Historial de mensajes
- **Consultation** - Consultas clasificadas
- **Product** - Catálogo de productos

---

## 🐛 Solución de Problemas

### Problema: "WhatsApp client not initialized"
**Solución:** Espera a que aparezca `✅ WhatsApp client is ready and connected!`

### Problema: No recibo respuestas
**Solución:** 
1. Verifica que `GEMINI_API_KEY` esté configurada en `.env`
2. Revisa los logs en terminal por errores de Gemini
3. Confirma que hay productos en la base de datos: `npm run prisma:seed`

### Problema: "Stream Errored (restart required)"
**Solución:** 
- Esto es normal, Baileys reconecta automáticamente
- Verifica que apareció: `Reconnecting...` → `✅ WhatsApp client is ready`

### Problema: Mensajes duplicados
**Solución:** 
- WhatsApp puede enviar notificaciones duplicadas
- El sistema está diseñado para manejar esto (verifica que cada mensaje tenga ID único)

---

## 📈 Funcionalidades Avanzadas para Probar

### 🔄 Historial de Conversación Persistente
```
Mensaje 1: "Hola, busco vibradores"
Mensaje 2: "El primero que mencionaste"  ← Debería recordar el contexto
```

### 🛒 Flujo de Compra (Con Handoff a Agente)
```
"Quiero comprar el vibrador modelo X"
```
- Inicia flujo de pago manual
- Se crea pedido en la base de datos
- Se activa handoff a agente humano
- Recibes instrucciones de pago bancario

### 📸 Envío de Comprobante (Imagen)
```
[Envía una foto del comprobante de pago]
```
- Sistema detecta imagen
- Activa handoff para validación manual
- Agente revisa y confirma

---

## ✅ Checklist de Pruebas Completas

- [ ] Servidor inicia sin errores
- [ ] WhatsApp se autentica correctamente
- [ ] Recibe y registra mensajes entrantes
- [ ] Consultas de productos funcionan (SQL generado)
- [ ] Respuestas de Gemini son coherentes
- [ ] WhatsApp envía respuestas automáticamente
- [ ] Historial de conversación se mantiene
- [ ] Base de datos registra todas las interacciones
- [ ] Flujo de compra inicia correctamente
- [ ] Handoff a agente funciona

---

## 🎯 Próximos Pasos

1. **Agregar más productos** con `prisma:seed` o manualmente
2. **Personalizar respuestas** de Gemini en `geminiConversation.ts`
3. **Configurar webhook** para notificaciones a agentes
4. **Implementar panel web** para visualizar sesiones activas
5. **Agregar análisis de imágenes** con Gemini Vision

---

**¡Tu sistema está listo para recibir y procesar mensajes automáticamente! 🚀**
