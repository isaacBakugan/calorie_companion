import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getConfig, getSecret } from '../../../shared/config/env';
import { logger } from '../../../shared/logger';
import { RegisterNewBatchUseCase } from '../../../application/use-cases/register-new-batch';
import { GetServingSuggestionUseCase } from '../../../application/use-cases/get-serving-suggestion';
import { LogConsumptionUseCase } from '../../../application/use-cases/log-consumption';
import { GetDailySummaryUseCase } from '../../../application/use-cases/get-daily-summary';
import { OpenAiNutritionAnalyzer } from '../../outbound/ai/openai-nutrition-analyzer.adapter';
import { CachedNutritionAnalyzer } from '../../outbound/ai/cached-nutrition-analyzer.decorator';
import { createElectroEntities } from '../../outbound/persistence/dynamodb/electrodb-schema';
import { DynamoBatchRepository } from '../../outbound/persistence/dynamodb/dynamo-batch-repository.adapter';
import { DynamoUserRepository } from '../../outbound/persistence/dynamodb/dynamo-user-repository.adapter';
import { DynamoLogRepository } from '../../outbound/persistence/dynamodb/dynamo-log-repository.adapter';
import { DynamoNutritionCacheRepository } from '../../outbound/persistence/dynamodb/dynamo-nutrition-cache-repository.adapter';
import { TelegramMessaging } from '../../outbound/messaging/telegram-messaging.adapter';
import { authenticateTelegramRequest, isAllowedTelegramUserId } from '../telegram/telegram-auth.middleware';
import { parseTelegramUpdate, parseTestPayload } from './telegram-message-parser';

// Módulo se reusa entre invocaciones "warm" del mismo contenedor Lambda: el
// client de Dynamo y las entidades de ElectroDB se arman una sola vez por
// cold start, no en cada request.
const config = getConfig();
const electro = createElectroEntities(
  DynamoDBDocumentClient.from(new DynamoDBClient({})),
  config.tableName,
);
const batches = new DynamoBatchRepository(electro.entities.batch);
const users = new DynamoUserRepository(electro.entities.userProfile);
const logs = new DynamoLogRepository(electro.entities.consumptionLog);
const nutritionCache = new DynamoNutritionCacheRepository(electro.entities.nutritionCache);

const HELP_TEXT = [
  'Comandos disponibles:',
  '/registrar <nombre> | <descripción> — registra un batch nuevo (puedes adjuntar foto)',
  '/porcion <batchId> — cuánto servirte hoy de ese batch',
  '/consumo <batchId> <gramos> — registra lo que te serviste',
  '/resumen — tus macros consumidos y restantes de hoy',
].join('\n');

async function downloadTelegramPhotoAsBase64(botToken: string, fileId: string): Promise<string> {
  const fileInfoResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
  );
  const fileInfo = (await fileInfoResponse.json()) as { result?: { file_path?: string } };
  const filePath = fileInfo.result?.file_path;
  if (!filePath) throw new Error('Telegram getFile no devolvió file_path');

  const fileResponse = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  const arrayBuffer = await fileResponse.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

async function downloadUrlAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

export const handler: APIGatewayProxyHandlerV2 = async (event: APIGatewayProxyEventV2) => {
  // Primero que nada: sin credencial válida, ni Dynamo ni OpenAI se tocan.
  const auth = await authenticateTelegramRequest(event.headers ?? {});
  if (!auth.authenticated) {
    logger.warn('Webhook rechazado: sin credencial válida');
    return { statusCode: 401, body: '' };
  }

  const parsedMessage =
    auth.source === 'telegram'
      ? parseTelegramUpdate(event.body ?? '{}')
      : parseTestPayload(event.body ?? '{}');
  if (!parsedMessage) {
    // Update sin mensaje de texto/foto (p.ej. edición, reacción): se ignora sin error.
    return { statusCode: 200, body: 'ok' };
  }

  // El secret_token solo prueba que la request es de Telegram, no de quién:
  // cualquiera que le escriba al bot llega hasta acá. Esta es la segunda
  // barrera, exclusiva de la vía Telegram (la de test ya tiene su propio
  // secreto). Silencioso a propósito: mismo shape que un update ignorado,
  // sin pista de que el bot existe ni de por qué no respondió.
  if (auth.source === 'telegram' && !(await isAllowedTelegramUserId(parsedMessage.telegramUserId))) {
    logger.warn('Telegram user no autorizado', { telegramUserId: parsedMessage.telegramUserId });
    return { statusCode: 200, body: 'ok' };
  }

  const botToken = await getSecret('TELEGRAM_TOKEN_PARAM_NAME');
  const openAiApiKey = await getSecret('OPENAI_API_KEY_PARAM_NAME');

  // Composition root manual: a esta escala (2 usuarios) un contenedor de DI
  // sería puro overhead. Los repos de Dynamo se arman a nivel de módulo
  // (arriba); acá solo lo que depende de un secreto async.
  const messaging = new TelegramMessaging(botToken);
  const analyzer = new CachedNutritionAnalyzer(
    new OpenAiNutritionAnalyzer(openAiApiKey),
    nutritionCache,
  );

  const userId = parsedMessage.telegramUserId;
  const [command, ...rest] = (parsedMessage.text ?? '').trim().split(/\s+/);
  const argsText = rest.join(' ');

  try {
    switch (command) {
      case '/registrar': {
        const [name, description = ''] = argsText.split('|').map((part) => part.trim());
        if (!name) {
          await messaging.sendText(parsedMessage.chatId, 'Uso: /registrar <nombre> | <descripción>');
          break;
        }
        const imageBase64 = parsedMessage.photoFileId
          ? await downloadTelegramPhotoAsBase64(botToken, parsedMessage.photoFileId)
          : parsedMessage.photoUrl
            ? await downloadUrlAsBase64(parsedMessage.photoUrl)
            : undefined;
        const batch = await new RegisterNewBatchUseCase(analyzer, batches).execute({
          userId,
          name,
          description,
          imageBase64,
        });
        await messaging.sendText(
          parsedMessage.chatId,
          `Batch registrado: ${batch.name} (id ${batch.id}), ${batch.totalGrams} g, ${Math.round(batch.totalMacros.kcal)} kcal total.`,
        );
        break;
      }
      case '/porcion': {
        const [batchId] = rest;
        if (!batchId) {
          await messaging.sendText(parsedMessage.chatId, 'Uso: /porcion <batchId>');
          break;
        }
        const serving = await new GetServingSuggestionUseCase(batches, users, logs).execute({
          userId,
          batchId,
          todayIsoDate: new Date().toISOString().slice(0, 10),
        });
        await messaging.sendText(
          parsedMessage.chatId,
          `Serví ${Math.round(serving.grams)} g (${Math.round(serving.macros.kcal)} kcal).`,
        );
        break;
      }
      case '/consumo': {
        const [batchId, gramsText] = rest;
        const servedGrams = Number(gramsText);
        if (!batchId || !Number.isFinite(servedGrams)) {
          await messaging.sendText(parsedMessage.chatId, 'Uso: /consumo <batchId> <gramos>');
          break;
        }
        await new LogConsumptionUseCase(batches, logs).execute({ userId, batchId, servedGrams });
        await messaging.sendText(parsedMessage.chatId, 'Consumo registrado.');
        break;
      }
      case '/resumen': {
        const summary = await new GetDailySummaryUseCase(users, logs).execute(
          userId,
          new Date().toISOString().slice(0, 10),
        );
        await messaging.sendText(
          parsedMessage.chatId,
          `Hoy consumiste ${Math.round(summary.consumed.kcal)} kcal. Te quedan ${Math.round(summary.remaining.kcal)} kcal.`,
        );
        break;
      }
      default: {
        await messaging.sendText(parsedMessage.chatId, HELP_TEXT);
      }
    }
  } catch (error) {
    logger.error('Error procesando update de Telegram', { error: String(error), userId });
    await messaging.sendText(parsedMessage.chatId, 'Algo salió mal procesando tu mensaje.');
  }

  return { statusCode: 200, body: 'ok' };
};
