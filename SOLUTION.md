# Pacta Private Payment — entrega del taller

Participante: Danilo Contreras (DNO8). Red: exclusivamente Stellar Testnet.

**Pago ZK verificado en testnet. OpenRouter real y validación web pública pendientes.**
No anunciar el concurso completo hasta reunir toda la evidencia requerida.
El fork es https://github.com/DNO8/zk-pay-starter y su origen es
https://github.com/blessedux/zk-pay-starter. El experimento separado `DNO8/pacta`
no sustituye la evidencia de este starter.

## Alcance y diseño

El [PRD](PRD.md) fue aprobado por el participante. Se implementaron:

- Commitments y nullifiers con los parámetros Poseidon/BN254 originales.
- Circuitos Noir y Circom de profundidad 8, con índices booleanos, raíz,
  nullifier, destinatario y comisión vinculados a las pruebas.
- Pool de denominación fija, depósitos financiados y distintos commitments,
  árbol Merkle, ventana de 32 raíces y nullifiers persistentes.
- Retiro con verificación Groth16, pago atómico y protección de repetición.
- La VK queda fijada en el pool. Cada retiro reinstala esa VK en el verificador
  original y verifica dentro de la misma invocación. Requiere resultado `true`.
- El receptor debe autorizar el retiro desde una cuenta G. Esto evita redirigir
  a otra dirección con el mismo valor tras reducir su payload módulo Fr.
- Interfaz con notas y pruebas en el navegador, consulta directa a testnet,
  recibos enlazados a Stellar Expert y artefactos verificados por SHA-256.
- Paso educativo OpenRouter con prompt sintético fijo; sin notas, claves,
  documentos ni datos del pago en el prompt. Desactivado hasta configuración
  y autorización; no se presenta una respuesta simulada como llamada real.

Los archivos `vendor/`, `contracts/verifier-*` y
`packages/shared/vectors/` permanecen sin modificaciones.

## Decisiones importantes sobre privacidad

El verificador Noir protegido usa **UltraKeccakFlavor no-ZK**. Sirve para el
 ejercicio de prueba de pertenencia, pero no acredita privacidad criptográfica.
La ruta de pago utiliza **Circom/Groth16**.

El verificador Groth16 original tiene `set_vk` público. En lugar de cambiarlo,
el pool conserva su propia VK inmutable y ejecuta `set_vk(pinned)` y `verify`
atómicamente. No hay intercalación de transacciones ni callbacks en esas dos
operaciones del verificador original. Se prueba el caso de VK externa hostil.

El setup Groth16 incorpora contribuciones aleatorias de fase 1 y fase 2, pero
sigue siendo un setup de desarrollo de una sola parte; no es una ceremonia
multiparte ni una auditoría. Nunca usar mainnet o fondos reales.

Las notas son exclusivas de este pool/red y no deben reutilizarse. Dos depósitos
son un conjunto pequeño; tiempo, financiación, destinatario y monto fijo siguen
siendo públicos y pueden permitir correlaciones. La dirección receptora paga
su propia comisión de red, financiada independientemente con Friendbot.

## Evidencia y pruebas

- Herramientas fijadas instaladas; doctor pasa y confirma protocolo 29.
- GIVEN pasa. La preparación hello histórica está en
  [hello-testnet.json](docs/evidence/hello-testnet.json).
- [Hello Noir](https://stellar.expert/explorer/testnet/tx/240e296607ad6664f3bd4a1080554699e596539ba7b31a0cf451b07fdadb3438),
  [hello Groth16](https://stellar.expert/explorer/testnet/tx/2f310a4c6534e0ff93f6a885f8cac21122b5d63b3aa30fdfa3d2c897a053648b)
  y [hello-gate](https://stellar.expert/explorer/testnet/tx/f93f75f3ef8125a9b49f7678921fa6590f982dda535892e25f9c96f72d8f50b1)
  confirmados. Los retornos booleanos se comprobaron.
- 13 pruebas nativas del pool con pruebas Groth16 reales: pago, repetición,
  entradas alteradas, autorización, alias de receptor, reemplazo hostil de VK,
  historial de raíces, árbol lleno y rollback.
- Pruebas reales de ambos circuitos: válido aceptado y cada una de las cuatro
  entradas públicas alterada rechazada. Noir se etiqueta como no-ZK.
- Compilación de frontend y chequeos TypeScript pasan en la preparación.
- Pruebas de seguridad API y utilidades del navegador pasan, sin gastar IA.
- Pago real confirmado: [retiro Groth16](https://stellar.expert/explorer/testnet/tx/771a8123910dfecdc6779c3c53a51166ae379111ad6ddbebe15fea1dd0cc9b32).
  Dos depósitos de cuentas distintas y 1 XLM bruto recibido, menos la comisión
  de red del receptor. [Evidencia](docs/evidence/private-payment.json) y
  [checklist](docs/lessons/UNLINKABILITY.md) completos. Los rechazos de simulación se identifican como tales,
  no como transacciones fallidas publicadas en cadena.
- Browser E2E no verificado: Chromium local no pudo iniciar por restricción de
  sockets. La compilación y los tests no sustituyen probar la URL pública.

El comando `bun run gaps` solo indica si quedan marcadores en los archivos de
implementación; **NO TODO no significa verificado**. Se corrigió el scanner que
se encontraba a sí mismo. El runner de tests ahora devuelve fallo cuando falla
un GAP, en vez de tratarlo como fallo esperado del template.

## Reproducción

Usar Bun 1.4.3 y los pins de `scripts/pins.ts`:

```sh
bun install --frozen-lockfile
bun run doctor
bun run build
bun run test:given
bun run setup:sdk
node scripts/setup-withdraw-groth16.mjs
bun run payment:testnet
```

`setup:sdk` es el fallback de hello para entornos donde falla el transporte de
la CLI. Usa el endpoint oficial, comprueba la passphrase, guarda hashes antes
 de enviar y valida recibos. La preparación GIVEN ya no despliega un pool de
pago usando la VK de hello: el pool requiere la VK de retiro de cuatro entradas.

No regenerar los artefactos de Groth16 después de desplegar el pool. El flujo
rechaza reanudar evidencia si los hashes de artefactos cambian. Una regeneración
requiere un despliegue nuevo y evidencia nueva, sin sobrescribir la anterior.

Las claves y notas de prueba solo se guardan en archivos ignorados privados.
Nunca publicar `.env`, `*.secret`, witnesses o los directorios de trabajo del
prover. Las carpetas de fixtures contienen exclusivamente datos de prueba.

## Pendientes para declarar entrega completa

1. Configurar OpenRouter con autorización y verificar una llamada real.
2. Publicación manual y prueba de la web en Vercel por el participante.

Ver [docs/VERCEL.md](docs/VERCEL.md) para el estado e instrucciones de publicación.
