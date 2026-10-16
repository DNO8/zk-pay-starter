# PRD: Pacta Private Payment — entrega del taller
Hacker: Danilo Contreras (DNO8). Fecha: 2026-10-16.
Estado: alcance propuesto, pendiente de aprobación explícita del participante antes de completar los GAP.

## Objetivo y límites
Depositar desde A y C (cuentas distintas) y retirar a una nueva B en Stellar Testnet, con prueba de pertenencia sin revelar la nota. Denominación fija de 1 XLM de prueba. Nunca mainnet. La app debe incluir una llamada real a OpenRouter; programar con ChatGPT no sustituye esa llamada. No se declara anonimato absoluto ni liquidación legal de un préstamo.

## Arquitectura y alcance de cada GAP
- GAP-1: commitment = Poseidon2(nullifier, secret); nullifierHash = Poseidon2(nullifier,1), con parámetros y vectores originales BN254.
- GAP-2 y GAP-2c: circuitos Noir y Circom de retiro. Entradas públicas, en orden: root, nullifierHash, recipient, fee. Privadas: nullifier, secret y camino Merkle de profundidad 8. Restringir índices booleanos, pertenencia, nullifier y vinculación del destinatario/comisión. Verificar prueba válida y rechazar cambios de entradas.
- GAP-3: inserción on-chain y ventana de 32 raíces históricas. Solo depósitos financiados; evitar doble inserción de un commitment, rechazar campos no canónicos y árbol lleno.
- GAP-4: nullifiers persistentes, consumidos atómicamente antes del pago, rechazo de doble gasto, sin borrado que permita reutilización.
- GAP-5: conectar el pool al verificador original, sin editarlo. Serialización y orden exactos de las entradas. Validar raíz, destinatario, comisión y relayer; monto fijo, comisión no negativa ni superior al monto.
- GAP-6: interfaz depositar → guardar nota → generar prueba → retirar a B → consultar confirmación. Cuentas y notas de prueba locales; la UI no anuncia éxito basándose solo en simulación. Integración conceptual con cuota de Pacta, sin afirmar pago legal del contrato.
- GAP-7: explicación educativa sintética en el flujo, mediante OpenRouter servidor. Nunca enviar claves, notas, witnesses, documentos ni datos personales. Sin clave, estado explícito pendiente; no fabricar respuesta de IA. Presupuesto y uso de credenciales pendientes de autorización/configuración. Preparar límite de llamadas y max_tokens bajo; ninguna llamada pagada automática durante preparación.
- GAP-8: checklist con hashes reales: financiación de B independiente de A; dos depósitos de cuentas diferentes; mismo monto; retiro; doble gasto y prueba alterada rechazados. Explicar correlaciones por tiempo, tamaño del conjunto y financiación. No marcar casillas por el solo hecho de existir código.

## Entrega y validación
M0 herramientas fijadas y tests GIVEN; M1 hello verificado en testnet; M2 pruebas locales válidas e inválidas; M3 pool, dos depósitos distintos y retiro real; M4 OpenRouter real con evidencia sin secretos; M5 SOLUTION.md, checklist y push a DNO8/zk-pay-starter. Vercel lo publica manualmente el participante.

No se modifican vendor/, contracts/verifier-* ni packages/shared/vectors/. El experimento BLS12-381 de DNO8/pacta permanece separado y sus transacciones no cuentan como evidencia de este starter.
