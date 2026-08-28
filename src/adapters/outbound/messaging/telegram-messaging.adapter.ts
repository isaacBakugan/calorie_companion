import type { MessagingPort } from '../../../application/ports/messaging.port';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Sin librería de Telegram: la API HTTP es simple y usar fetch nativo evita
 * una dependencia más que auditar en un repo público.
 */
export class TelegramMessaging implements MessagingPort {
  constructor(private readonly botToken: string) {}

  async sendText(chatId: string, text: string): Promise<void> {
    const response = await fetch(`${TELEGRAM_API_BASE}/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram sendMessage falló (${response.status}): ${body}`);
    }
  }
}
