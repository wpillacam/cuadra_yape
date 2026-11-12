# Cuadra Yape

PWA en español para registrar ventas por Yape y en efectivo en un teléfono. La hora sale del reloj del celular y los días se agrupan en la zona horaria de Ayacucho (`America/Lima`). La app registra ventas manualmente.

## Estructura

```text
C:/yape/
├── package.json                   # Comandos para iniciar ambos servicios
├── frontend/
│   ├── app/                       # Next.js 14 App Router y estilos Tailwind
│   ├── components/Caja.jsx         # PIN, Hoy, Registrar, Cierre e Historial
│   ├── lib/ledger.js               # IndexedDB, montos, fotos y sincronización
│   ├── public/                    # Manifiesto e íconos instalables
│   └── next.config.js             # next-pwa y conexión con Express
└── backend/
    ├── .env.example
    ├── src/server.js              # API Express
    └── prisma/
        ├── schema.prisma          # ventas y cierre_dia
        └── migrations/            # Migración inicial para SQLite
```

## Ejecutar en Windows

Usa Node.js 22 LTS (22.18 o superior) y npm. Desde la raíz, en PowerShell:

```powershell
npm install
Copy-Item backend/.env.example backend/.env
if (!(Test-Path backend/prisma/cuadra.db)) { New-Item -ItemType File backend/prisma/cuadra.db | Out-Null }
npm run db:setup
npm run dev
```

Abre `http://localhost:3000`. La primera vez, crea un PIN de cuatro dígitos. Express escucha en el puerto 4000 en la misma máquina. El navegador usa el puerto 3000 tanto para la app como para la API. La base de datos se crea en `backend/prisma/cuadra.db`.

Para probar la PWA y el modo sin conexión, detén el servidor de desarrollo y ejecuta:

```powershell
npm run build
npm start
```

Abre la app con conexión y espera a que se instale el service worker. En Chrome de escritorio puedes verificarlo en **DevTools → Application → Service workers**. Luego activa **Offline**, recarga, abre la caja con el PIN, registra una venta y cierra el día. Desactiva **Offline** y comprueba que desaparezca el contador de sincronización. Para probar una compilación distinta en el mismo origen, desregistra el service worker anterior si Chrome sigue mostrando la versión anterior.

## Cómo funciona sin internet

Cuadra Yape usa un enfoque **offline-first**. Guarda los datos en el celular y los envía al servidor cuando vuelve la conexión.

1. **Abrir la app.** En la primera visita con conexión a la versión de producción, el service worker generado por `next-pwa` guarda en caché la interfaz. Una vez instalado, permite volver a abrirla en modo avión.
2. **Registrar ventas y cierres.** Al tocar **GUARDAR**, la venta queda en IndexedDB con la hora del celular, la nota y el voucher, si lo adjuntaste. El total de hoy se actualiza de inmediato. **CERRAR DÍA** también guarda el cierre en el celular.
3. **Sincronizar.** Cuando vuelve internet y la app está abierta y desbloqueada, envía lo pendiente a Express, que lo guarda en SQLite. Cada venta conserva su identificador único en los reintentos para evitar duplicados. El aviso **«por sincronizar»** desaparece cuando el servidor confirma todos los registros pendientes.

## Instalar en Android

1. Sirve la compilación de producción mediante una URL **HTTPS** accesible desde el teléfono. Puedes usar un proxy HTTPS delante de Next.js en el puerto 3000. Si Express está en otra máquina o contenedor, configura `API_ORIGIN` para el frontend antes de compilar, por ejemplo `http://backend:4000`.
2. Abre la URL en Chrome con conexión. En el menú **⋮**, elige **Instalar aplicación** o **Agregar a pantalla principal** y confirma.
3. Abre Cuadra Yape desde su ícono, crea el PIN y haz una primera visita con conexión. Después puedes abrirla y registrar ventas en modo avión.
4. Al recuperar internet, abre y desbloquea la app para que envíe lo pendiente automáticamente.

`localhost` sirve para probar en la computadora. En Android, usa HTTPS, incluso si ambos equipos están en el mismo Wi‑Fi. El menú puede variar según la versión de Chrome.

## API

Todas las rutas reciben `Authorization: Bearer <token>`. El cliente genera y conserva un token aleatorio por instalación en IndexedDB. El servidor usa su hash para identificar la caja. Los montos de la API se expresan en céntimos enteros.

| Método y ruta | Operación |
| --- | --- |
| `POST /api/ventas` | Guarda una venta. Recibe `id` UUID v4, `fecha` ISO UTC, `metodo` (`YAPE` o `EFECTIVO`), `montoCentimos`, `descripcion` y `nota` (pueden ir vacías) y `foto` opcional como JPEG en base64. |
| `GET /api/ventas/:dia` | Lista las ventas del día, del registro más reciente al más antiguo. |
| `PUT /api/cierre/:dia` | Guarda el cierre. Recibe `cerradoEn` en formato ISO UTC. |
| `GET /api/cierre/:dia` | Devuelve la hora de cierre, los totales y la cantidad de ventas. |

`:dia` usa el formato `AAAA-MM-DD`. Los reintentos conservan la venta original por UUID y el primer cierre por día. Los totales se calculan con todas las ventas registradas para la fecha, incluidas las que se sincronizan después del cierre.

## Desplegar en Vercel con Supabase

1. Importa el repositorio desde GitHub y selecciona `main` como rama de producción. En **Root Directory**, elige `frontend` y activa **Include source files outside of the Root Directory** para incluir el backend y los archivos del workspace.
2. En Supabase, abre **Connect** en un proyecto PostgreSQL. Copia la URL **Transaction pooler** (puerto 6543) a `POSTGRES_PRISMA_URL` en Vercel. Añade los parámetros `pgbouncer=true`, `sslmode=require` y `schema=cuadra_yape`.
3. Copia la URL **Session pooler** (puerto 5432) a `POSTGRES_URL_NON_POOLING` para que Prisma aplique las migraciones. Añade `sslmode=require` y `schema=cuadra_yape`. Mantén el schema `cuadra_yape` fuera de los schemas expuestos por la Data API de Supabase. Si habilitas despliegues Preview, asigna una base separada a ese entorno.
4. Despliega. El comando definido en `frontend/vercel.json` genera el cliente Prisma de PostgreSQL y aplica sus migraciones antes de compilar Next.js. La API Express se sirve en `/api` en el mismo dominio. Ambas URL son variables privadas del servidor.

Consulta la [guía de conexión de Prisma con Supabase](https://supabase.com/docs/guides/database/prisma).

El desarrollo local usa el schema de SQLite. Las migraciones de PostgreSQL están en `backend/prisma/postgresql`. El despliegue crea sus tablas en PostgreSQL. Si necesitas conservar ventas de una instalación local previa, hay que transferir los registros de ambas tablas, conservando el campo `caja` y los identificadores. El navegador trata la URL local y la URL de producción como sitios independientes.

## Datos y alcance

- Cada instalación funciona como una caja independiente. La app usa su historial local y envía los registros pendientes con la app abierta y desbloqueada. El servidor conserva los datos sincronizados. Esta versión carece de restauración automática en otro teléfono. Al borrar los datos del sitio se pierden el PIN, el identificador de caja y las ventas pendientes.
- El PIN bloquea la interfaz al abrir o recargar la app y mediante **Bloquear**. IndexedDB conserva las ventas y fotos sin cifrado adicional. WhatsApp requiere conexión para enviar el resumen.

Referencias del stack: [next-pwa](https://github.com/shadowwalker/next-pwa) y [Prisma Migrate](https://www.prisma.io/docs/orm/v6/prisma-cli-reference).
