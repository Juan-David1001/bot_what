import { GoogleGenAI } from '@google/genai';

// If a GEMINI_API_KEY is provided prefer API-key auth; otherwise the
// client library will try Application Default Credentials (ADC).
const apiKeyAtStartup = process.env.GEMINI_API_KEY;
if (apiKeyAtStartup) {
  // Some Google client libraries also respect GOOGLE_API_KEY env var.
  process.env.GOOGLE_API_KEY = apiKeyAtStartup;
}
const ai = new GoogleGenAI({ apiKey: apiKeyAtStartup });

export async function queryGemini(prompt: string, model?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = model ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

  console.log('queryGemini: model=', modelName);
  console.log('queryGemini: promptPreview=', prompt.slice(0, 200));

  if (!apiKey) {
    console.warn('queryGemini: GEMINI_API_KEY not configured - returning fallback response');
    // Development fallback
    return `GEMINI_NOT_CONFIGURED: ${prompt}`;
  }

  const response: any = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
  });

  // Prefer .text when available, otherwise try common response paths
  const text = response?.text ?? response?.output?.[0]?.content?.[0]?.text ?? JSON.stringify(response);
  console.log('queryGemini: responsePreview=', (text || '').slice(0, 200));
  return text;
}

/**
 * Query Gemini con historial de conversación usando la API nativa de chat
 */
export async function queryGeminiChat(
  messages: Array<{ role: 'user' | 'model'; parts: string }>,
  model?: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = model ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

  console.log('queryGeminiChat: model=', modelName, 'messages=', messages.length);

  if (!apiKey) {
    console.warn('queryGeminiChat: GEMINI_API_KEY not configured');
    return 'Lo siento, el servicio de IA no está disponible en este momento.';
  }

  try {
    const formattedMessages = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.parts }],
    }));

    const response: any = await ai.models.generateContent({
      model: modelName,
      contents: formattedMessages as any,
    });

    const text = response?.text ?? response?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sin respuesta';
    console.log('queryGeminiChat: responsePreview=', text.slice(0, 200));
    return text;
  } catch (error: any) {
    if (error && typeof error.message === 'string' && error.message.includes('default credentials')) {
      console.error('queryGeminiChat: authentication error - could not load default credentials.');
      console.error(' - Ensure GEMINI_API_KEY is set in your environment or set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file.');
      console.error(' - Example (PowerShell): $env:GEMINI_API_KEY = "<YOUR_KEY>"');
      console.error(' - For service accounts: set GOOGLE_APPLICATION_CREDENTIALS to the JSON path.');
      throw new Error('Gemini authentication error: missing credentials. Configure GEMINI_API_KEY or GOOGLE_APPLICATION_CREDENTIALS.');
    }
    console.error('queryGeminiChat: error', error?.message ?? error);
    throw error;
  }
}
