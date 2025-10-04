/**
 * Servicio para generar SQL a partir de consultas en lenguaje natural
 * Usa Gemini para interpretar la intención del usuario y crear queries SQL
 */

import { queryGemini } from './gemini';

// Schema de la base de datos para que Gemini entienda la estructura
export const DB_SCHEMA = `
Base de datos SQLite con las siguientes tablas:

**Product** (Catálogo de productos de sex shop)
- id: INTEGER PRIMARY KEY
- name: TEXT (nombre del producto)
- category: TEXT (juguetes, lubricantes, lenceria, etc)
- description: TEXT (descripción completa)
- price: REAL (precio en USD)
- inStock: INTEGER (1=en stock, 0=agotado)
- tags: TEXT (tags separados por comas)
- imageUrl: TEXT (URL de imagen)
- createdAt: TEXT (fecha ISO)
- updatedAt: TEXT (fecha ISO)

**Contact** (Clientes)
- id: INTEGER PRIMARY KEY
- alias: TEXT (nombre o alias)
- realName: TEXT (nombre real, opcional)
- number: TEXT UNIQUE (número de contacto)
- email: TEXT
- privacyMode: INTEGER (1=usar alias, 0=usar nombre real)

**Advisor** (Asesores)
- id: INTEGER PRIMARY KEY
- name: TEXT
- email: TEXT UNIQUE
- role: TEXT (advisor, supervisor)
- isActive: INTEGER (1=activo, 0=inactivo)

**Session** (Sesiones de conversación)
- id: INTEGER PRIMARY KEY
- contactId: INTEGER (FK a Contact)
- channel: TEXT (whatsapp, web, phone, presencial)
- status: TEXT (active, closed)
- geminiThreadId: TEXT
- startedAt: TEXT (fecha ISO)
- closedAt: TEXT (fecha ISO)

**Consultation** (Consultas clasificadas)
- id: INTEGER PRIMARY KEY
- contactId: INTEGER (FK a Contact)
- sessionId: INTEGER (FK a Session)
- advisorId: INTEGER (FK a Advisor)
- category: TEXT (producto, recomendacion, soporte_uso, queja_sugerencia)
- topic: TEXT
- description: TEXT
- response: TEXT
- status: TEXT (pending, in_progress, resolved, escalated)
- priority: TEXT (low, normal, high)
- createdAt: TEXT (fecha ISO)
- resolvedAt: TEXT (fecha ISO)
`;

const SQL_GENERATION_PROMPT = `Eres un experto en SQL y análisis de consultas en lenguaje natural.

Tu trabajo es convertir preguntas del usuario en queries SQL válidas para SQLite.

${DB_SCHEMA}

INSTRUCCIONES IMPORTANTES:
1. Genera SOLO la query SQL, sin explicaciones ni texto adicional
2. Usa sintaxis SQLite válida
3. Para búsquedas de texto usa LIKE con % (ej: WHERE name LIKE '%vibrador%')
4. Para búsquedas case-insensitive usa LOWER() (ej: WHERE LOWER(name) LIKE LOWER('%texto%'))
5. Limita resultados con LIMIT (máximo 10 productos)
6. Si preguntan por categorías, usa: SELECT DISTINCT category FROM Product
7. Si preguntan por productos disponibles, agrega: WHERE inStock = 1
8. Si preguntan por precio, incluye: ORDER BY price ASC/DESC según contexto
9. Si la pregunta no requiere base de datos, responde: NO_SQL_NEEDED

EJEMPLOS:

Usuario: "¿Qué categorías tienen?"
SQL: SELECT DISTINCT category FROM Product;

Usuario: "Muéstrame vibradores"
SQL: SELECT * FROM Product WHERE LOWER(name) LIKE '%vibrador%' OR LOWER(description) LIKE '%vibrador%' LIMIT 10;

Usuario: "¿Tienen lubricantes en stock?"
SQL: SELECT * FROM Product WHERE LOWER(category) = 'lubricantes' AND inStock = 1 LIMIT 10;

Usuario: "Productos más baratos"
SQL: SELECT * FROM Product WHERE inStock = 1 ORDER BY price ASC LIMIT 10;

Usuario: "Hola"
SQL: NO_SQL_NEEDED

Usuario: "Gracias"
SQL: NO_SQL_NEEDED

Ahora convierte esta consulta del usuario en SQL:`;

/**
 * Genera SQL a partir de una consulta en lenguaje natural
 */
export async function generateSQLFromQuery(userQuery: string): Promise<string | null> {
  console.log('generateSQLFromQuery: userQuery=', userQuery.slice(0, 100));

  try {
    const fullPrompt = `${SQL_GENERATION_PROMPT}\n\nUsuario: "${userQuery}"\nSQL:`;
    const sqlResponse = await queryGemini(fullPrompt, process.env.GEMINI_MODEL ?? 'gemini-2.5-flash');

    // Limpiar respuesta
    let sql = sqlResponse.trim();

    // Detectar si no se necesita SQL
    if (sql.includes('NO_SQL_NEEDED')) {
      console.log('generateSQLFromQuery: NO_SQL_NEEDED');
      return null;
    }

    // Remover bloques de código markdown si existen
    sql = sql.replace(/```sql\n?/gi, '').replace(/```\n?/g, '').trim();

    // Remover texto explicativo antes/después del SQL
    const lines = sql.split('\n');
    const sqlLines = lines.filter((line) => {
      const l = line.trim().toUpperCase();
      return (
        l.startsWith('SELECT') ||
        l.startsWith('FROM') ||
        l.startsWith('WHERE') ||
        l.startsWith('ORDER') ||
        l.startsWith('LIMIT') ||
        l.startsWith('AND') ||
        l.startsWith('OR') ||
        l.includes('JOIN')
      );
    });

    if (sqlLines.length > 0) {
      sql = sqlLines.join('\n').trim();
    }

    // Validación básica de seguridad: solo permitir SELECT
    if (!sql.toUpperCase().startsWith('SELECT')) {
      console.warn('generateSQLFromQuery: query no comienza con SELECT, rechazada por seguridad');
      return null;
    }

    // Validación: no permitir DELETE, DROP, INSERT, UPDATE
    const forbidden = ['DELETE', 'DROP', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'TRUNCATE'];
    for (const keyword of forbidden) {
      if (sql.toUpperCase().includes(keyword)) {
        console.warn('generateSQLFromQuery: query contiene keyword prohibida:', keyword);
        return null;
      }
    }

    console.log('generateSQLFromQuery: SQL generada=', sql);
    return sql;
  } catch (error: any) {
    console.error('generateSQLFromQuery: error', error?.message ?? error);
    return null;
  }
}

/**
 * Formatea resultados de DB para que sean legibles por humanos
 */
export function formatResultsForDisplay(results: any[], tableName?: string): string {
  if (!results || results.length === 0) {
    return 'No se encontraron resultados.';
  }

  // Si son categorías (solo una columna)
  if (results.length > 0 && Object.keys(results[0]).length === 1 && results[0].category) {
    const categories = results.map((r) => r.category).filter(Boolean);
    return `Categorías disponibles:\n${categories.map((c) => `- ${c}`).join('\n')}`;
  }

  // Si son productos
  if (results.length > 0 && results[0].name !== undefined) {
    // Limitar a máximo 5 productos para mostrar
    const limited = results.slice(0, 5);
    const lines = limited.map((p, idx) => {
      const price = p.price != null ? `$${p.price}` : 'precio no disponible';
      const stock = p.inStock ? 'Disponible' : 'Agotado';
      const desc = p.description ? p.description.replace(/\s+/g, ' ').trim().slice(0, 100) : '';
      return `${idx + 1}. ${p.name} — ${price} — ${stock}${desc ? ' — ' + desc : ''}`;
    });
    const header = `Resultados (${limited.length}):`;
    return `${header}\n\n${lines.join('\n')}\n\n¿Quieres que te muestre más detalles o enlaces de algún producto?`;
  }

  // Formato genérico para otros resultados
  const lines = results.slice(0, 10).map((row) => {
    const entries = Object.entries(row)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    return `• ${entries}`;
  });

  return `Resultados (${results.length}):\n${lines.join('\n')}`;
}
