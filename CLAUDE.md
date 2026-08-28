# Calorie Companion — directrices del proyecto

Bot de Telegram para bulk-cooking, 2 usuarios, repo público. Contexto de producto en `README.md`
(léelo primero). Este archivo cubre lo operativo: costo, secretos y stack.

## Restricción dura: costo

- Presupuesto objetivo: **$0/mes**. Techo duro: **$10/mes**.
- Todo el cómputo/datos debe caer dentro de free tier a este volumen (2 usuarios):
  - DynamoDB **on-demand** (PAY_PER_REQUEST), nunca provisioned — cero costo en reposo.
  - Lambda + API Gateway HTTP API (no REST API): centavos por millón de requests.
  - S3 con lifecycle de 45 días en las fotos — no hay razón para pagar storage indefinido.
- El único gasto real esperado es **OpenAI** (`gpt-4o-mini`). Se minimiza con el patrón
  "infinite craft": `CachedNutritionAnalyzer` cachea el análisis por nombre normalizado de
  platillo, cache **global** (no por usuario) para maximizar hits entre los 2 usuarios.
- Antes de agregar cualquier servicio administrado nuevo (Secrets Manager, un logging service,
  un vector DB, etc.), pregunta: **¿esto tiene un costo fijo mensual, o escala a $0 con uso
  cero?** Si tiene costo fijo, no entra en este proyecto salvo que se apruebe explícitamente.

## Manejo de secretos (repo público)

No hay Secrets Manager — no se justifica su costo fijo para 2 usuarios. En su lugar:

- **SSM Parameter Store, tipo `SecureString`**, cifrado con la KMS key default de AWS (`aws/ssm`,
  sin costo). Guarda: `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, `TELEGRAM_WEBHOOK_SECRET`.
- **CloudFormation/CDK NO puede crear parámetros `SecureString`** (limitación conocida de
  `AWS::SSM::Parameter`). Por eso estos 3 parámetros se crean **a mano, una sola vez**, fuera de
  CDK:
  ```
  aws ssm put-parameter --name /calorie-companion/telegram-bot-token --type SecureString --value "..."
  aws ssm put-parameter --name /calorie-companion/openai-api-key --type SecureString --value "..."
  aws ssm put-parameter --name /calorie-companion/telegram-webhook-secret --type SecureString --value "..."
  ```
  El nombre del parámetro (no el valor) sí vive en CDK, como env var del Lambda — ver
  `infra/lib/constructs/telegram-webhook-lambda.ts`. El Lambda solo tiene permiso
  `ssm:GetParameter` sobre estos 3 ARN puntuales, nada más (least privilege).
- **Nunca** loguear el valor de un secreto. `src/shared/logger.ts` no sanitiza automáticamente —
  quien llame a `logger.*` es responsable de no pasarle un secreto en `meta`.
- `.env` es solo para desarrollo local y está en `.gitignore`. Antes de cualquier commit, revisa
  el diff si tocaste `env.ts`, adapters de SSM, o cualquier archivo con "token"/"key"/"secret" en
  el nombre — un secreto commiteado en un repo público es irreversible en la práctica (aunque se
  borre después, hay que rotarlo, no basta con `git revert`).
- **GitHub OIDC** para el deploy desde CI (`.github/workflows/deploy.yml`): sin access keys de
  AWS de larga duración en secrets de GitHub. El rol de deploy se crea a mano (o vía un stack de
  bootstrap aparte) y su ARN se guarda como **variable** de repo (`AWS_DEPLOY_ROLE_ARN`), no como
  secret — un ARN de rol no es sensible por sí solo.

## Arquitectura

Hexagonal (ports & adapters), con la IA tratada como un puerto más. Detalle completo en
`README.md` → "Arquitectura hexagonal + IA". Reglas duras:

- `src/domain/` no importa nada de AWS SDK, `openai`, ni ningún adapter. Si un archivo de
  `domain/` necesita un `import` fuera de `domain/` o de Node built-ins, es la señal de que esa
  lógica no pertenece ahí.
- Todo puerto nuevo va en `src/application/ports/` como interface pura. El adapter real y
  cualquier decorator (cache, retry, circuit breaker) implementan el mismo puerto — el caso de
  uso nunca hace `instanceof` ni sabe qué adapter concreto recibió.
- Validación de la respuesta de OpenAI con **zod** en el borde del adapter
  (`openai-nutrition-analyzer.adapter.ts`), antes de que el resultado se convierta en un DTO del
  dominio. Si el LLM devuelve algo fuera de schema, falla ahí — no 3 capas después.
- Sin contenedor de DI: la composición de dependencias es manual en
  `telegram-webhook-handler.ts` (el único entrypoint). A esta escala, un DI container es overhead
  puro.

## Stack (decisiones ya tomadas al scaffoldear)

- **pnpm**, TypeScript, **CommonJS** (no ESM) — evita fricción de interop entre `ts-node`, CDK y
  el bundling de `NodejsFunction`.
- Node 22.x tanto local (`.nvmrc`) como en Lambda (`Runtime.NODEJS_22_X`).
- Imports **absolutos** vía path aliases de `tsconfig.json`: `@domain/*`, `@application/*`,
  `@adapters/*`, `@shared/*`. Igual que en el resto de mis repos — nada de `../../../../`.
- Bundling de Lambda con `aws-cdk-lib/aws-lambda-nodejs` (esbuild integrado, sin bundler aparte).
  El SDK v3 se marca `external` (`@aws-sdk/*`) porque ya viene en el runtime de Lambda — no pagar
  bundle size ni cold start por algo que AWS ya provee gratis.
- **vitest** para tests (no jest): nativo en TS/ESM, cero configuración de babel.
- Un solo ambiente (no dev/stg/prod). Desvío consciente de mi estándar habitual de 3 ambientes
  en la misma cuenta — no se justifica la complejidad para un proyecto personal de 2 usuarios.
  Si esto escala, ahí sí se separan ambientes.
- HTTP API (API Gateway v2), no REST API — mismo resultado, más barato.

## Decisiones abiertas (no las resuelvas sin avisar)

- **Cache de nutrición por nombre, no por batch**: `CachedNutritionAnalyzer` cachea la densidad
  de macros asumiendo que la misma normalización de nombre = misma receta con las mismas
  proporciones. Si el usuario cocina la misma receta con proporciones distintas cada vez, esto
  da un resultado incorrecto silenciosamente. No lo "arregles" agregando lógica de detección de
  proporciones sin confirmar conmigo — es una simplificación consciente del MVP, documentada acá
  para no perderla de vista.
- **UX de conversación**: el router de `telegram-webhook-handler.ts` usa comandos explícitos
  (`/registrar`, `/porcion`, `/consumo`, `/resumen`) como placeholder funcional. El README dice
  que el flujo lo decide "la lógica de la app, no la IA", pero no define si eso significa
  comandos, texto libre parseado con reglas, o algo intermedio. Está pendiente en el README como
  "Próximos pasos" — no lo dejes fijo en comandos sin confirmar que es la UX deseada.
- **Un solo `TelegramWebhookLambda`** atiende registro y consulta. Si el volumen de fotos vs.
  consultas de texto diverge mucho, separar en dos funciones (una liviana para consultas
  matemáticas, otra para el flujo de IA) podría bajar el tiempo de cold start de las consultas
  simples — no vale la pena hoy a este volumen.
