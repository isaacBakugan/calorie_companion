# Calorie Companion

Bot conversacional (Telegram) para trackear comidas preparadas en bulk-cooking y calcular cuánto servirse según el objetivo diario de cada usuario. Proyecto personal, presupuesto casi $0.

## Decisiones de producto

- **Input**: texto o foto describiendo lo que se preparó o lo que hay disponible.
- **Output**: sugerencia de porción (gramos) basada en el objetivo diario restante del usuario que pregunta.
- **Flujo de bulk cooking**: se registra un "batch" (lote preparado) una sola vez con su nutrición total; cada consulta posterior de "cuánto me sirvo" es matemática pura sobre ese batch, no requiere IA.
- **Filosofía "infinite craft"**: la primera vez que aparece un platillo, la IA lo analiza y el resultado se cachea de forma determinista. La siguiente vez que se menciona ese platillo (o uno normalizado como equivalente), la respuesta sale de caché — cero costo de IA.

## Por qué Telegram y no WhatsApp

WhatsApp Cloud API es gratis hoy dentro de la ventana de servicio de 24h, pero Meta elimina esa ventana gratuita a nivel mundial el **1 de octubre de 2026** — desde esa fecha todo mensaje de servicio saliente por API tiene tarifa fija por mensaje y país. Para un proyecto de 2 usuarios que necesita ser casi gratis indefinidamente, no vale la pena construir sobre un modelo de cobro que cambia en semanas.

**Telegram Bot API**: gratuito sin límite de mensajes, sin categorías de plantillas, sin ventanas de facturación, sin verificación de negocio. Mismo soporte de texto/foto vía `sendPhoto`/`getFile`. Es el frontend del proyecto — no hay app móvil ni frontend web en el MVP.

## Stack

- **IaC**: AWS CDK (TypeScript)
- **Cómputo**: Lambda (Node.js/TypeScript)
- **API**: API Gateway (HTTP API, no REST — más barato)
- **Datos**: DynamoDB, single-table design
- **Media**: S3 con lifecycle corto (30-60 días) para fotos
- **IA**: OpenAI `gpt-4o-mini` (texto + visión), solo para batches nuevos
- **Arquitectura de código**: Hexagonal (ports & adapters)

Todo el cómputo/datos vive dentro de free tier de AWS a este volumen (2 usuarios). El único gasto real es OpenAI, y el diseño minimiza las llamadas.

## Arquitectura hexagonal + IA

No existe (todavía) un patrón que reemplace hexagonal cuando hay IA de por medio — la IA se trata como **un puerto más** del dominio, con dos matices:

1. **Anti-corruption layer en el borde de la IA**: el LLM devuelve texto/JSON no determinista. El adapter de OpenAI valida la respuesta contra un schema (zod/io-ts) antes de que cualquier DTO entre al dominio. Si el LLM devuelve basura, falla en el adapter, no tres capas después.

2. **Cache como decorator del mismo puerto**: `CachedNutritionAnalyzer` implementa el mismo `NutritionAnalyzerPort` que el adapter real de OpenAI. El caso de uso nunca sabe si la respuesta vino de DynamoDB (cache hit) o de la API (cache miss) — es el mismo patrón de circuit breaker que se usa en microservicios normales, aplicado aquí al presupuesto de IA en vez de a disponibilidad.

El concepto de **"tool as adapter"** (arquitecturas agénticas, donde el LLM decide qué función invocar) no aplica todavía: el flujo (registrar batch vs. consultar porción) lo decide la lógica de la app, no la IA. Si en el futuro el bot necesita interpretar mensajes ambiguos y decidir qué hacer, ahí cada capacidad se vuelve un adapter detrás de un `ToolPort`.

## Estructura de carpetas

```
calorie-companion/
├── infra/                                   # CDK app
│   ├── bin/app.ts
│   ├── lib/
│   │   ├── stacks/
│   │   │   ├── api-stack.ts                 # API Gateway + Lambda integration
│   │   │   ├── data-stack.ts                # DynamoDB single-table
│   │   │   └── storage-stack.ts             # S3 + lifecycle policy
│   │   └── constructs/
│   │       └── telegram-webhook-lambda.ts
│   ├── cdk.json
│   └── tsconfig.json
│
├── src/
│   ├── domain/                              # núcleo puro, sin AWS ni SDKs
│   │   ├── entities/
│   │   │   ├── batch.ts
│   │   │   ├── user-profile.ts
│   │   │   └── consumption-log.ts
│   │   ├── value-objects/
│   │   │   ├── macros.ts
│   │   │   └── serving.ts
│   │   └── services/
│   │       ├── serving-calculator.ts        # matemática pura, cero IA
│   │       └── batch-matcher.ts             # normaliza nombre → cache key
│   │
│   ├── application/
│   │   ├── ports/
│   │   │   ├── nutrition-analyzer.port.ts   # el puerto IA
│   │   │   ├── batch-repository.port.ts
│   │   │   ├── user-repository.port.ts
│   │   │   ├── log-repository.port.ts
│   │   │   ├── media-storage.port.ts
│   │   │   └── messaging.port.ts
│   │   └── use-cases/
│   │       ├── register-new-batch.ts
│   │       ├── get-serving-suggestion.ts
│   │       ├── log-consumption.ts
│   │       └── get-daily-summary.ts
│   │
│   ├── adapters/
│   │   ├── inbound/
│   │   │   └── telegram/
│   │   │       ├── telegram-webhook-handler.ts   # entrypoint Lambda
│   │   │       └── telegram-message-parser.ts
│   │   └── outbound/
│   │       ├── ai/
│   │       │   ├── openai-nutrition-analyzer.adapter.ts
│   │       │   └── cached-nutrition-analyzer.decorator.ts   # "infinite craft"
│   │       ├── persistence/dynamodb/
│   │       │   ├── dynamo-batch-repository.adapter.ts
│   │       │   ├── dynamo-user-repository.adapter.ts
│   │       │   ├── dynamo-log-repository.adapter.ts
│   │       │   └── single-table-schema.ts
│   │       ├── storage/s3-media-storage.adapter.ts
│   │       └── messaging/telegram-messaging.adapter.ts
│   │
│   └── shared/
│       ├── config/env.ts
│       ├── types/result.ts                  # Result<T,E>, sin excepciones a lo loco
│       └── logger.ts
│
├── test/
│   ├── unit/domain/
│   └── integration/
│
├── package.json
├── tsconfig.json
└── README.md
```

## DynamoDB — single-table (esquema preliminar)

| PK | SK | Uso |
|---|---|---|
| `USER#<id>` | `PROFILE` | targets diarios (calorías, macros) |
| `BATCH#<id>` | `META` | nutrición total del lote preparado |
| `USER#<id>` | `LOG#<timestamp>` | consumo registrado, resta contra el target del día |

## Próximos pasos

- [ ] Definir schema de validación (zod) para la respuesta del `NutritionAnalyzerPort`
- [ ] Prompt de extracción para OpenAI (texto/foto → JSON estructurado)
- [ ] Scaffold real: `package.json`, `tsconfig.json`, CDK boilerplate mínimo
- [ ] Lógica de normalización de nombres de batch para cache matching