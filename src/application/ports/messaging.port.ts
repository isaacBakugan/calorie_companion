export interface MessagingPort {
  sendText(chatId: string, text: string): Promise<void>;
}
