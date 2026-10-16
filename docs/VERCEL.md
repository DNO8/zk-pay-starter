# Publicación manual en Vercel

El frontend final hace el pago Groth16 directamente desde el navegador:
notas, generación de prueba y firmas de cuentas efímeras testnet. El servidor
Bun local ya no es necesario para el flujo público. No subir ese servidor
local como servicio abierto.

## Ajustes para este fork

- Repositorio: `DNO8/zk-pay-starter`, rama `main`.
- Root Directory: `apps/web`.
- Framework: Vite.
- Runtime de instalación probado: Bun 1.4.3.
- Build: `bun run build`.
- Output: `dist`.
- Conservar acceso a archivos fuera de Root Directory para el workspace
  `packages/shared` y la función educativa que importa `apps/api/src/openrouter`.
- Los cuatro archivos públicos de `apps/web/public/payment` se incluyen en el
  commit, vinculados por hashes a la evidencia del retiro confirmado.

El `vercel.json` de esa carpeta incluye rutas SPA y preserva `/api`, `/payment`
y `/assets`. Las claves de prueba creadas en el navegador no se envían al backend.
Guardar la nota y el respaldo privado de la cuenta receptora antes de cerrar.

## OpenRouter: necesario para completar el concurso

El paso se entrega desactivado por seguridad. El participante debe configurar
privadamente las variables de servidor `OPENROUTER_API_KEY`,
`OPENROUTER_MAX_CALLS=1` y `AI_ACCESS_TOKEN` (al menos 32 caracteres). Nunca usar
prefijo `VITE_`. La clave de OpenRouter debe tener límite de gasto en el proveedor;
el contador en memoria de la función no es un presupuesto global.

El token de acceso se introduce en la página y no se publica en el bundle.
La llamada solo lleva un prompt educativo fijo, sin datos del pago. Aún no hay
una llamada real registrada: no declarar GAP-7 terminado hasta comprobarla.

## Verificación pendiente en la URL publicada

Abrir `/app`, crear cuentas testnet, guardar nota, depositar, generar prueba en
el navegador, retirar desde la cuenta receptora y abrir el hash en Stellar Expert.
Comprobar que la confirmación proviene del RPC. Probar también un intento de
reutilización. Validar OpenRouter por separado con su configuración privada.

Las pruebas y la compilación local pasan; Chromium local no pudo iniciarse por
restricción de sockets del entorno. No se afirma una prueba visual ni E2E del
navegador público. El participante realizará el despliegue manual.

Detalles: [apps/web/DEPLOYMENT.md](../apps/web/DEPLOYMENT.md).
