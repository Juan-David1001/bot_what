# 📊 Guía de Configuración de Google Sheets

## ✅ Integración Completada

He integrado exitosamente Google Sheets con tu sistema de WhatsApp Bot. Ahora Gemini consultará automáticamente los datos de tu hoja de cálculo en lugar de usar una base de datos.

---

## 🔧 Configuración Actual

- **Spreadsheet ID**: `1p79w-78L2WOVp8qiomaCvTpe-iEyN714eaR3gIc_0Ec`
- **Service Account**: `node-374@gen-lang-client-0594774333.iam.gserviceaccount.com`
- **Credenciales**: `gen-lang-client-0594774333-95a18bb02c4b.json` ✅
- **Variables de entorno**: Configuradas en `.env` ✅

---

## 📋 Cómo Estructurar tu Hoja de Cálculo

### ⚠️ **IMPORTANTE**: Compartir la Hoja

1. Abre tu hoja de cálculo: https://docs.google.com/spreadsheets/d/1p79w-78L2WOVp8qiomaCvTpe-iEyN714eaR3gIc_0Ec
2. Click en **"Compartir"** (esquina superior derecha)
3. Agrega este email con permiso de **Visualizador**:
   ```
   node-374@gen-lang-client-0594774333.iam.gserviceaccount.com
   ```
4. Click en **"Enviar"**

---

### 📑 Opción 1: Usar Múltiples Hojas (Recomendado)

Crea dos hojas separadas en tu spreadsheet:

#### Hoja 1: "informacion"

| Campo | Valor |
|-------|-------|
| nombre_negocio | Euforia |
| direccion | calle 49#50-31, San Pedro de los Milagros |
| horario | Todos los días de 11:00 AM a 8:00 PM |
| telefono | +57 311 434 0586 |
| email | contacto@euforia.com |
| metodos_pago | Efectivo, Transferencia, Nequi, Daviplata |
| envio_nacional | Sí - $16,000 COP |
| politica_privacidad | Respetamos tu privacidad. Envíos discretos. |
| politica_devolucion | 30 días para devoluciones de productos sin abrir |

#### Hoja 2: "productos"

| nombre | categoria | precio | descripcion | stock | tags |
|--------|-----------|--------|-------------|-------|------|
| Vibrador Clásico | Vibradores | 45000 | Vibrador clásico de silicona médica, 7 velocidades, recargable USB | 15 | vibrador,principiantes,recargable |
| Lubricante Base Agua | Lubricantes | 18000 | Lubricante a base de agua, 100ml, hipoalergénico | 30 | lubricante,agua,seguro |
| Anillo Vibrador | Anillos | 25000 | Anillo vibrador para parejas, silicona suave | 20 | parejas,anillo,vibrador |
| Kit Principiantes | Kits | 89000 | Kit completo para principiantes: vibrador + lubricante + limpiador | 10 | kit,principiantes,completo |

---

### 📑 Opción 2: Todo en Una Sola Hoja

Si prefieres mantener todo en "Hoja 1", usa esta estructura:

**Filas 1-10: Información del negocio**

| Campo | Valor |
|-------|-------|
| nombre_negocio | Euforia |
| direccion | calle 49#50-31, San Pedro de los Milagros |
| horario | Todos los días de 11:00 AM a 8:00 PM |
| ... | ... |

**Filas 12 en adelante: Productos**

| nombre | categoria | precio | descripcion | stock | tags |
|--------|-----------|--------|-------------|-------|------|
| Vibrador Clásico | Vibradores | 45000 | ... | 15 | vibrador,... |
| ... | ... | ... | ... | ... | ... |

---

## 🔄 Actualizar el Código para tu Estructura

### Si usas Opción 1 (Múltiples Hojas):

El código ya está preparado. Solo necesitas renombrar:
- La primera hoja a "informacion"
- La segunda hoja a "productos"

### Si usas Opción 2 (Una Sola Hoja):

Necesitas actualizar `src/services/googleSheets.ts`:

```typescript
// Para información del negocio (filas 1-10)
range: 'A1:B10'

// Para productos (desde fila 12)
range: 'A12:Z100'
```

---

## 🧪 Probar la Integración

Una vez que hayas llenado la hoja de cálculo:

```powershell
# Ver contenido de la hoja
npx ts-node src/tests/viewSheet.ts

# Probar integración completa
npx ts-node src/tests/testGoogleSheets.ts
```

---

## 🚀 Cómo Funciona

Cuando un usuario envía un mensaje por WhatsApp:

1. **Mensaje recibido** → Baileys lo captura
2. **Análisis automático** → El sistema detecta si necesita datos del negocio o productos:
   - "¿Qué horarios tienen?" → Consulta hoja de información
   - "¿Tienes vibradores?" → Consulta hoja de productos
   - "Busco algo para principiantes" → Busca en productos
3. **Consulta a Sheets** → Lee los datos actualizados en tiempo real
4. **Gemini procesa** → Genera respuesta con los datos obtenidos
5. **Respuesta automática** → Enviada por WhatsApp

---

## 💡 Ventajas de Google Sheets

✅ **Actualización en tiempo real** - Cambios inmediatos sin reiniciar servidor
✅ **Fácil de editar** - Interface familiar de hojas de cálculo
✅ **Sin base de datos** - No necesitas gestionar SQL ni Prisma
✅ **Colaborativo** - Varios usuarios pueden actualizar el catálogo
✅ **Respaldo automático** - Google Drive guarda versiones
✅ **Acceso desde cualquier lugar** - Solo necesitas internet

---

## 📝 Plantilla de Productos Completa

Copia y pega esta estructura en tu hoja "productos":

| nombre | categoria | precio | descripcion | stock | tags |
|--------|-----------|--------|-------------|-------|------|
| Vibrador Clásico 7" | Vibradores | 45000 | Vibrador clásico de 7 pulgadas, silicona médica, 7 velocidades, recargable USB, resistente al agua | 15 | vibrador,clasico,principiantes,recargable,silicona |
| Vibrador Punto G | Vibradores | 55000 | Diseño curvo para estimulación del punto G, 10 modos de vibración, silicona premium | 12 | vibrador,punto-g,curvo,silicona |
| Vibrador Rabbit | Vibradores | 75000 | Doble estimulación, motor silencioso, control remoto, recargable | 8 | vibrador,rabbit,doble,control-remoto |
| Lubricante Base Agua 100ml | Lubricantes | 18000 | Lubricante a base de agua, 100ml, hipoalergénico, compatible con juguetes | 30 | lubricante,agua,hipoalergenico,seguro |
| Lubricante Base Silicona 100ml | Lubricantes | 25000 | Lubricante premium de silicona, larga duración, 100ml | 20 | lubricante,silicona,premium,larga-duracion |
| Anillo Vibrador Parejas | Anillos | 25000 | Anillo vibrador para parejas, silicona suave, 3 velocidades, recargable | 20 | parejas,anillo,vibrador,recargable |
| Kit Principiantes | Kits | 89000 | Kit completo: vibrador + lubricante + limpiador + guía de uso | 10 | kit,principiantes,completo,guia |
| Bolas Chinas | Ejercitadores | 35000 | Set de 2 bolas chinas, silicona médica, fortalecimiento pélvico | 15 | bolas-chinas,ejercitador,salud |
| Plug Anal Pequeño | Plugs | 30000 | Plug anal pequeño para principiantes, base ancha, silicona suave | 18 | plug,anal,principiantes,pequeño |
| Aceite de Masaje | Masajes | 22000 | Aceite de masaje comestible, aroma vainilla, 100ml | 25 | masaje,aceite,comestible,vainilla |

---

## ⚠️ Solución de Problemas

### Error: "Unable to parse range"
- Verifica que los nombres de las hojas sean exactos (case-sensitive)
- USA sin espacios o con comillas especiales

### Error: "Permission denied" o "403"
- La cuenta de servicio NO tiene acceso al spreadsheet
- **Solución**: Compartir la hoja con `node-374@gen-lang-client-0594774333.iam.gserviceaccount.com`

### La hoja está vacía
- Llena la hoja con datos siguiendo las plantillas de arriba
- Verifica con: `npx ts-node src/tests/viewSheet.ts`

---

## 🎯 Próximos Pasos

1. ✅ Compartir la hoja con la cuenta de servicio
2. ✅ Llenar las hojas con información y productos
3. ✅ Probar con: `npx ts-node src/tests/testGoogleSheets.ts`
4. ✅ Iniciar el bot: `npm run dev`
5. ✅ Enviar mensaje de prueba por WhatsApp: "¿Qué productos tienen?"

---

**¡Tu sistema está listo! Gemini ahora consultará Google Sheets automáticamente cuando los usuarios hagan preguntas sobre productos o información del negocio.** 🚀
