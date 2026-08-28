import { z } from 'zod';

const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z
    .object({
      message_id: z.number(),
      chat: z.object({ id: z.number() }),
      from: z.object({ id: z.number() }).optional(),
      text: z.string().optional(),
      caption: z.string().optional(),
      photo: z
        .array(
          z.object({
            file_id: z.string(),
            width: z.number(),
            height: z.number(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export interface ParsedTelegramMessage {
  readonly chatId: string;
  readonly telegramUserId: string;
  readonly text: string | null;
  /** file_id de Telegram: requiere el flujo getFile de su API para bajar la imagen. */
  readonly photoFileId: string | null;
  /** URL directa (solo vía de test): se baja con un fetch normal, sin pasar por Telegram. */
  readonly photoUrl: string | null;
}

/**
 * Anti-corruption layer del lado inbound: valida el Update de Telegram
 * contra un schema antes de que cualquier campo entre a la lógica de la app.
 */
export function parseTelegramUpdate(rawBody: string): ParsedTelegramMessage | null {
  const parsed = TelegramUpdateSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success || !parsed.data.message?.from) return null;

  const { message } = parsed.data;
  // Telegram devuelve las variantes de foto ordenadas de menor a mayor resolución.
  const largestPhoto = message.photo?.at(-1);

  return {
    chatId: String(message.chat.id),
    telegramUserId: String(message.from!.id),
    text: message.text ?? message.caption ?? null,
    photoFileId: largestPhoto?.file_id ?? null,
    photoUrl: null,
  };
}

const TestPayloadSchema = z.object({
  text: z.string(),
  userId: z.string(),
  photoUrl: z.string().optional(),
});

/**
 * Payload simplificado para pruebas manuales (curl/Postman) autenticadas por
 * `x-api-key`, fuera de Telegram — se mapea al mismo DTO que consumen los
 * casos de uso, que no distinguen el origen.
 */
export function parseTestPayload(rawBody: string): ParsedTelegramMessage | null {
  const parsed = TestPayloadSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) return null;

  return {
    chatId: parsed.data.userId,
    telegramUserId: parsed.data.userId,
    text: parsed.data.text,
    photoFileId: null,
    photoUrl: parsed.data.photoUrl ?? null,
  };
}
