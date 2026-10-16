# Pacta Private Payment — estado de entrega

Participante: Danilo Contreras (DNO8). Red: exclusivamente Stellar Testnet.

**Entrega incompleta. No anunciar DEPLOYED.** Este documento registra evidencia
del starter oficial; las transacciones del experimento separado `DNO8/pacta`
no son evidencia de cumplimiento de este concurso.

## Repositorio y alcance

- Fork: https://github.com/DNO8/zk-pay-starter
- Origen: https://github.com/blessedux/zk-pay-starter
- Base: `7cfe7f1fe99d775898ff2ec01ae04cc48d58cc6a`
- Propuesta del participante: [PRD.md](PRD.md), pendiente de aprobación.
- Se conservan sin cambios `vendor/`, `contracts/verifier-*` y
  `packages/shared/vectors/`.

## Evidencia disponible

- Fork creado en la cuenta del participante.
- Herramientas fijadas instaladas: Rust 1.92.0, Stellar CLI 28.1.0,
  nargo 1.0.0-beta.9, bb 0.87.0, circom 2.1.9 y Bun 1.4.3.
- `bun run doctor`: pasa; testnet informa protocolo 29.
- Instalación congelada de dependencias: pasa.
- `bun run test:given`: pasa (pruebas compartidas, Noir, Circom y siete
  pruebas de contratos). Esto excluye las pruebas GAP pendientes.
- Compilación de contratos y circuitos hello: pasa.
- M0/M1: despliegue del pipeline GIVEN y verificación real de hello en ambas
  rutas. [Noir](https://stellar.expert/explorer/testnet/tx/240e296607ad6664f3bd4a1080554699e596539ba7b31a0cf451b07fdadb3438),
  [Groth16](https://stellar.expert/explorer/testnet/tx/2f310a4c6534e0ff93f6a885f8cac21122b5d63b3aa30fdfa3d2c897a053648b),
  [hello-gate](https://stellar.expert/explorer/testnet/tx/f93f75f3ef8125a9b49f7678921fa6590f982dda535892e25f9c96f72d8f50b1).
  Se comprobaron los retornos booleanos de Groth16 y hello-gate.
- Evidencia pública: [hello-testnet.json](docs/evidence/hello-testnet.json),
  con direcciones, transacciones y hashes SHA-256 de los artefactos.
- `cd apps/web && bun run build`: pasa; solo acredita compilación del
  frontend actual, cuya pantalla de pago todavía es un esqueleto.

## Evidencia todavía pendiente

- Implementación y pruebas individuales de GAP-1 a GAP-7.
- Dos depósitos de igual denominación desde cuentas distintas.
- Retiro válido a una dirección nueva financiada independientemente.
- Rechazo en testnet de doble gasto y prueba alterada.
- Llamada real a OpenRouter con presupuesto aprobado, sin datos sensibles.
- Checklist GAP-8 con referencias verificables.
- Publicación de los cambios en este fork y despliegue web del participante.

Los campos pendientes no se sustituyen con transacciones de otro contrato,
respuestas simuladas de IA ni resultados de pruebas que aceptan errores esperados.

## Reproducción de la preparación

Instalar las herramientas fijadas y ejecutar `bun install --frozen-lockfile`.
La ruta original es `bun run setup`; para entornos donde el transporte RPC
de la CLI falla, `bun run setup:sdk` usa el SDK contra el endpoint oficial
de testnet, confirma su passphrase y verifica los recibos. Ambas rutas son
solo para GIVEN, no completan el circuito de retiro.

Se corrigió la compilación por paquetes para Stellar CLI 28.1.0 y se ocultó
la credencial en la impresión del comando de verificación. El fallback
conserva claves únicamente en `.env` ignorado por Git y registra públicamente
solo direcciones y evidencia. Nunca publicar ese archivo de entorno.

El chequeo TypeScript aislado del nuevo fallback pasa. El chequeo global
del starter sigue con problemas previos de configuración de tipos y errores
en `scripts/cost.ts` y `scripts/tokens.ts`; no se declara limpio.

## Advertencia del verificador didáctico

El verificador Groth16 incluido permite reemplazar su VK mediante `set_vk`
sin autenticación. Se conserva intacto por las reglas del concurso y se usa
solo para hello. El diseño de retiro debe usar el verificador Noir con VK
de constructor o resolver este riesgo conforme a las reglas antes de
afirmar seguridad. El pool desplegado aquí sigue siendo el esqueleto GIVEN.

## Publicación web

Consultar [docs/VERCEL.md](docs/VERCEL.md). El starter contiene una web Vite y
un servidor Bun con ejecutables de pruebas nativas. Publicar solo la web estática
no despliega automáticamente ese servidor ni acredita un pago privado.

## Límites de privacidad

El objetivo del diseño es ocultar qué depósito se gasta, dentro del conjunto
de depósitos elegibles. El tiempo, el monto fijo, un conjunto pequeño y la
financiación de las cuentas pueden permitir correlaciones. La demo no prueba
anonimato absoluto, no ha sido auditada y no debe utilizar dinero real.
