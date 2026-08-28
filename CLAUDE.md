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
  sin costo). Guarda: `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, `TELEGRAM_WEBHOOK_SECRET`,
  `TEST_API_KEY` (esta última solo la usa `telegram-webhook` para autenticar pruebas manuales
  vía `x-api-key`, sin pasar por Telegram — ver `telegram-auth.middleware.ts`).
- **CloudFormation/CDK NO puede crear parámetros `SecureString`** (limitación conocida de
  `AWS::SSM::Parameter`). Por eso estos 4 parámetros se crean **a mano, una sola vez**, fuera de
  CDK:
  ```
  aws ssm put-parameter --name /calorie-companion/prod/telegram-bot-token --type SecureString --value "..."
  aws ssm put-parameter --name /calorie-companion/prod/openai-api-key --type SecureString --value "..."
  aws ssm put-parameter --name /calorie-companion/prod/telegram-webhook-secret --type SecureString --value "..."
  aws ssm put-parameter --name /calorie-companion/prod/test-api-key --type SecureString --value "..."
  ```
  El path lleva el stage (`/calorie-companion/<stage>/...`, ver `ssmParamPrefix` en
  `infra/lib/constructs/discovered-lambda.ts`) aunque hoy solo exista `prod` — evita que un
  stage nuevo choque con estos parámetros o, peor, los lea por error.
  El nombre del parámetro (no el valor) sí vive en CDK, como env var del Lambda — ver
  `infra/lib/constructs/discovered-lambda.ts`. El Lambda solo tiene permiso
  `ssm:GetParameter` sobre los ARN puntuales que usa (3 para el resto de los Lambdas
  descubiertos, 4 para `telegram-webhook`), nada más (least privilege).
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
- Sin contenedor de DI: la composición de dependencias es manual en cada `handler.ts`. A esta
  escala, un DI container es overhead puro.

## Lambdas: un Lambda por trigger externo, con auto-discovery

Ni single-use por caso de uso ni lambdalith por módulo de dominio: **un Lambda por trigger
externo real** (un webhook, un cron, una cola). Los casos de uso ya están aislados detrás de
ports — partirlos en Lambdas separadas no gana nada salvo que exista más de un trigger físico
que los dispare. Cuando aparezca un segundo trigger (p. ej. un cron de limpieza), ahí nace su
propio Lambda — no antes.

La infra **no tiene un `NodejsFunction` hardcodeado por función**. Convención de auto-discovery,
sin redundancia entre `src/` e `infra/`:

- Cada carpeta `src/adapters/inbound/<nombre>/` con un `trigger.config.ts` es un Lambda
  desplegable. `infra/lib/discover-lambdas.ts` escanea esa carpeta en tiempo de `synth` y arma
  el `NodejsFunction` (`infra/lib/constructs/discovered-lambda.ts`) + su trigger (ruta HTTP,
  regla de EventBridge, etc.) en `infra/lib/stacks/api-stack.ts`.
- Contrato: `handler.ts` (el entrypoint real) + `trigger.config.ts` (metadata declarativa pura,
  tipada contra `TriggerConfig` en `src/shared/types/trigger-config.ts`: tipo de trigger,
  path/método o cron, memoria, timeout).
- **Agregar un trigger nuevo = agregar esa carpeta del lado de `src/`. Cero cambios en
  `infra/`.** Si te encontrás editando `api-stack.ts` o `discover-lambdas.ts` para "registrar" un
  Lambda nuevo, algo se rompió en la convención — no lo hardcodees, arreglá el discovery.
- `trigger.config.ts` debe ser **puro y sin efectos secundarios**: solo importa el tipo
  (`import type`) y exporta un objeto literal. Nunca importe adapters, SDKs, ni nada que se
  ejecute — `infra/` lo `require()`a directamente en tiempo de synth para leer su metadata, no
  para correrlo.
- Tipos de trigger soportados hoy: `http` (ruta en el HTTP API compartido) y `schedule` (regla de
  EventBridge). Agregar uno nuevo (`sqs`, `s3`, etc.) es una variante más en `TriggerConfig` +
  una rama más en el switch de `api-stack.ts`.

## Stack (decisiones ya tomadas al scaffoldear)

- **pnpm**, TypeScript, **CommonJS** (no ESM) — evita fricción de interop entre `ts-node`, CDK y
  el bundling de `NodejsFunction`.
- Node 22.x tanto local (`.nvmrc`) como en Lambda (`Runtime.NODEJS_22_X`).
- Imports **absolutos** vía path aliases de `tsconfig.json`: `@domain/*`, `@application/*`,
  `@adapters/*`, `@shared/*`. Igual que en el resto de mis repos — nada de `../../../../`.
- Bundling de Lambda con `aws-cdk-lib/aws-lambda-nodejs` (esbuild integrado, sin bundler aparte).
  El SDK v3 se empaqueta completo (no se marca `external`): ElectroDB trae su propia cadena de
  paquetes `@aws-sdk/*` (`util-dynamodb`, etc.) y no hay forma de verificar que el runtime de
  Lambda incluya exactamente esos paquetes. A este volumen, el bundle un poco más grande (~800kb)
  no cuesta nada — apostar a un supuesto no verificado sobre el runtime sí tiene costo (una falla
  en prod). Si en algún momento se audita qué trae realmente el runtime y se confirma, se puede
  volver a externalizar.
- **ElectroDB** sobre DynamoDB (`src/adapters/outbound/persistence/dynamodb/electrodb-schema.ts`):
  4 entidades (`batch`, `userProfile`, `consumptionLog`, `nutritionCache`) agrupadas en un
  `Service`, todas sobre la misma tabla single-table. Schema deliberadamente simple — sin
  `collections` de ElectroDB todavía (se agregan cuando exista un patrón de acceso real que las
  necesite). Los adapters de cada repo port reciben la entidad ElectroDB ya armada por
  constructor — ElectroDB es un detalle de implementación del adapter, el puerto no lo conoce.
- **vitest** para tests (no jest): nativo en TS/ESM, cero configuración de babel.
- Un solo ambiente activo (`prod`), pero el stage es un parámetro de CDK context
  (`-c stage=xxx`, default `prod`), no un valor hardcodeado — ver `infra/bin/app.ts`. Stack IDs,
  nombres de tabla/función y paths de SSM llevan el stage. Desvío consciente de mi estándar
  habitual de 3 ambientes reales en la misma cuenta — no se justifica esa complejidad (ni un
  segundo despliegue) para un proyecto personal de 2 usuarios. El día que aparezca un stage
  nuevo (p. ej. `dev`), es agregar una rama al `case` de `.github/workflows/deploy.yml` y crear
  a mano sus 3 parámetros SSM — cero cambios de estructura en `infra/`.
- HTTP API (API Gateway v2), no REST API — mismo resultado, más barato.
- Nada de argentinismos, usa español neutro

## Decisiones abiertas (no las resuelvas sin avisar)

- **Cache de nutrición por nombre, no por batch**: `CachedNutritionAnalyzer` cachea la densidad
  de macros asumiendo que la misma normalización de nombre = misma receta con las mismas
  proporciones. Si el usuario cocina la misma receta con proporciones distintas cada vez, esto
  da un resultado incorrecto silenciosamente. No lo "arregles" agregando lógica de detección de
  proporciones sin confirmar conmigo — es una simplificación consciente del MVP, documentada acá
  para no perderla de vista.
- **UX de conversación**: el router de `src/adapters/inbound/telegram-webhook/handler.ts` usa
  comandos explícitos (`/registrar`, `/porcion`, `/consumo`, `/resumen`) como placeholder
  funcional. El README dice que el flujo lo decide "la lógica de la app, no la IA", pero no
  define si eso significa comandos, texto libre parseado con reglas, o algo intermedio. Está
  pendiente en el README como "Próximos pasos" — no lo dejes fijo en comandos sin confirmar que
  es la UX deseada.
- **Un solo Lambda `telegram-webhook`** atiende registro y consulta (es un único trigger físico,
  ver "Lambdas" arriba). Si el volumen de fotos vs. consultas de texto diverge mucho, el criterio
  para separar sigue siendo el mismo: un trigger físico nuevo, no un caso de uso nuevo.
