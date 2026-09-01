import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda';
import OpenAI from 'openai';
import { getSecret } from '../../../shared/config/env';

export const handler: APIGatewayProxyHandlerV2 = async (_event: APIGatewayProxyEventV2) => {
  try {
    const openAiApiKey = await getSecret('OPENAI_API_KEY_PARAM_NAME');
    const client = new OpenAI({ apiKey: openAiApiKey });

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Di "¡Hola, mundo! Esto es una prueba de Calorie Companion."' }],
    });

    const responseText = completion.choices[0]?.message.content ?? 'Sin respuesta';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: responseText }),
    };
  } catch (error) {
    console.error('Error in ping-openai:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: String(error) }),
    };
  }
};
