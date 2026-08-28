import OpenAI from 'openai';
import { z } from 'zod';
import type {
  NutritionAnalysisInput,
  NutritionAnalysisResult,
  NutritionAnalyzerPort,
} from '../../../application/ports/nutrition-analyzer.port';

const MODEL = 'gpt-4o-mini';

const NutritionAnalysisSchema = z.object({
  totalGrams: z.number().positive(),
  totalMacros: z.object({
    kcal: z.number().nonnegative(),
    proteinG: z.number().nonnegative(),
    carbsG: z.number().nonnegative(),
    fatG: z.number().nonnegative(),
  }),
});

const SYSTEM_PROMPT = `Eres un nutricionista que analiza descripciones de comidas preparadas en
bulk-cooking. A partir del nombre, la descripción (y opcionalmente una foto), estima el peso
total en gramos y los macros totales de TODO el lote preparado (no de una porción).
Responde ÚNICAMENTE con JSON con esta forma exacta:
{"totalGrams": number, "totalMacros": {"kcal": number, "proteinG": number, "carbsG": number, "fatG": number}}`;

/**
 * Adapter real del puerto de IA. El schema de zod es el anti-corruption
 * layer: si el LLM devuelve algo que no calza, falla acá, no 3 capas después
 * en el dominio.
 */
export class OpenAiNutritionAnalyzer implements NutritionAnalyzerPort {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async analyze(input: NutritionAnalysisInput): Promise<NutritionAnalysisResult> {
    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: 'text', text: `Platillo: ${input.name}\nDescripción: ${input.description}` },
    ];

    if (input.imageBase64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${input.imageBase64}` },
      });
    }

    const completion = await this.client.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });

    const rawContent = completion.choices[0]?.message.content;
    if (!rawContent) throw new Error('OpenAI no devolvió contenido en la respuesta');

    const parsed = NutritionAnalysisSchema.safeParse(JSON.parse(rawContent));
    if (!parsed.success) {
      throw new Error(`Respuesta de OpenAI no cumple el schema esperado: ${parsed.error.message}`);
    }

    return parsed.data;
  }
}
