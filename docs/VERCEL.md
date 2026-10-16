# Publicación manual: requisitos y estado

Estado: preparación; el flujo privado del starter todavía está incompleto.
El participante realizará la publicación manual.

## Arquitectura actual del starter

- `apps/web`: React + Vite, salida estática `apps/web/dist`.
- `apps/api`: servidor Bun, puerto 43122; invoca programas nativos de circuitos
  y Stellar para las rutas de prueba.
- El proxy `/api` de `vite.config.ts` funciona en desarrollo. No queda
  incorporado al sitio estático generado por `vite build`.

## Compilación del frontend

Desde la raíz del repositorio:

Usar Bun 1.4.3, versión probada con este lockfile; Bun 1.3 no interpretó el
`lockfileVersion: 2` del repositorio durante la preparación.

```sh
bun install --frozen-lockfile
cd apps/web && bun run build
```

Para una importación del monorepo, conservar la raíz como directorio del proyecto
y usar `apps/web/dist` como directorio de salida. Las rutas de React requieren
una reescritura de navegación a `index.html` que no intercepte `/api`.

## Condiciones antes de una demo pública funcional

1. Implementar el flujo del participante y verificarlo en testnet.
2. Definir dónde se ejecuta la generación de pruebas y las operaciones del backend.
   El servidor Bun actual requiere ejecutables nativos y archivos locales; no
   basta con subir el frontend a un alojamiento estático.
3. Configurar un destino HTTPS real para `/api`, o adaptar expresamente las
   funciones para el alojamiento elegido. No hay un endpoint listo todavía.
4. Revisar las rutas de depuración antes de exponer el backend. El starter puede
   devolver claves de cuentas de prueba y salidas de procesos; no publicarlas
   tal cual junto con una clave OpenRouter o una cuenta firmante.
5. Mantener `OPENROUTER_API_KEY` y las claves Stellar exclusivamente en el entorno
   privado apropiado. Nunca usar prefijo `VITE_` para secretos, ni subir `.env`.
6. Validar en la URL pública una operación confirmada y los casos de error.

Este documento no afirma que el backend esté desplegado ni que las variables
de entorno estén configuradas. Los valores definitivos y las instrucciones
de producción se completarán al verificar la implementación.
