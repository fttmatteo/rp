# RP Software

Aplicación web para la empresa de huevos: clasificación diaria, inventario, clientes con precios especiales, pedidos, rutas de entrega, ventas con recibo en PDF, cartera (fiado), caja, compras a terceros, galpones de aves y reportes. Funciona en el computador y en el celular desde el navegador.

## Qué incluye

- **Base:** login con usuario y clave, accesos por operación (Administrador, Ventas, Repartidor). Después de ingresar, el usuario elige entre las operaciones que el administrador le asignó (si tiene una sola, entra directo). Los permisos se verifican en el servidor en cada página y acción. Administración de usuarios y bitácora de auditoría.
- **Clientes, precios e inventario:** clientes con cupo y días de crédito; precio general por producto y precio especial por cliente (el pedido congela el precio); clasificación diaria en cubetas y huevos sueltos, con el peso en gramos de cada tipo de huevo como guía (lo define el administrador en Precios); inventario calculado a partir de movimientos, con ajustes y anulaciones.
- **Pedidos, ventas y cartera:** pedidos por cliente, entrega con pago total, parcial o fiado; recibos en PDF con consecutivo (`RP-000001` para ventas y `AB-000001` para pagos); abonos aplicados a la deuda más antigua o al recibo que el cliente elija; estado de cuenta, antigüedad de cartera, aviso de cupo, carga de saldos iniciales y anulaciones (solo administrador).
- **Pedidos recurrentes:** al crear un pedido se pueden elegir días de la semana para que se repita. Desde la fecha de entrega, cada día elegido el pedido se carga solo a Pedidos como **por aprobar**, con el precio del cliente de ese día; el **administrador** lo aprueba (uno por uno o todos los de hoy) y solo entonces el repartidor lo puede tomar en Mi ruta. Pedidos > Pedidos recurrentes lista los que se repiten y permite dejar de repetirlos.
- **Pedidos y reparto por fecha:** al filtrar pedidos por fecha se ve el total del día por clasificación y su valor. La pestaña **Resumen del reparto** (dentro de **Pedidos**) muestra, para una fecha, cada cliente con clasificación, cantidad, valor, lo pagado en la entrega y lo pendiente, y arriba el cierre del reparto: cantidad por clasificación, valor pagado (efectivo y transferencia) y valor pendiente. Se puede buscar por cliente o zona.
- **Caja diaria:** cada día tiene su caja con base, cobros (salen solos de los pagos), otros ingresos, gastos y retiros. Al cerrar se cuenta el efectivo y, si no cuadra, se exige una observación. Un día cerrado no recibe más dinero; solo el administrador lo reabre y el cierre anterior queda en la auditoría. Las transferencias se muestran aparte. El reporte quincenal suma los cierres diarios. La pueden manejar Ventas y el administrador.
- **Ingresos y egresos:** todo el dinero se registra en dos secciones. **Ingresos**: venta en la granja (pedido entregado en un paso, con recibo, inventario y cobro), abono de cliente y otros ingresos; muestra también los cobros de las rutas. **Egresos**: compra de huevo, pago a proveedor y gastos o retiros. Cada una lista lo del día con su origen y totales por medio. Caja queda para el cuadre y el cierre. El historial de compras está al final de Egresos.

- **Rutas de entrega:** cada repartidor toma desde **Mi ruta** los pedidos del día que va a llevar (los que nadie ha tomado) y puede soltar los que no vaya a llevar. Mi ruta muestra sus paradas con llamar, WhatsApp y Maps; entrega con un toque, entrega parcial (lo que no se entregó vuelve al inventario) o "no entregado" con motivo para reprogramar. Puede cobrar abonos de deudas viejas. Al terminar, el repartidor hace el **precierre**: declara el efectivo que entrega. El **administrador** lo revisa en Pedidos > Rutas y liquidación (lo llevado, lo entregado, lo devuelto, el efectivo esperado y el declarado) y aprueba el cierre o se lo devuelve para que corrija; la diferencia queda en la caja con su explicación. Ventas ve las rutas pero no las aprueba. Mi ruta solo aparece para el repartidor. El repartidor no ve Pedidos, Reparto ni Clientes: trabaja solo desde Mi ruta, donde ya tiene los datos y la deuda de cada cliente de su ruta.
- **Menú:** Inicio, Mi ruta (solo repartidor), **Pedidos** (pestañas Pedidos, Rutas y liquidación, Resumen del reparto), **Contabilidad** (Ingresos, Egresos, Precios, Caja y cierre, Cartera, Por pagar, Reportes), Inventario y **Usuarios** (Clientes, Proveedores, Empleados). Usuarios es solo para crear, ver y editar; lo que debe cada cliente se abre desde Contabilidad > Cartera (con buscador) y lo que se le debe a cada proveedor desde Contabilidad > Por pagar.
- **Gallinaza y compras a terceros:** la gallinaza se vende por bulto, kilo o viaje (se elige en Precios). Huevo comprado a proveedores, clasificado o por clasificar (se clasifica después en Clasificación), de contado (sale de la caja) o a crédito (cuenta por pagar con abonos). Lo que ya se le debía a un proveedor antes de usar la app se carga como saldo inicial en Por pagar (solo administrador).
- **Aves:** galpones con las aves que tienen (raza, fecha y edad de ingreso, etapa); novedades (muerte, descarte, paso a venta y traslado entre galpones); la clasificación se registra por galpón para calcular la postura diaria y la mortalidad acumulada. El paso a venta suma gallinas al inventario. Cada entrada de aves a un galpón queda guardada como un grupo de aves (tabla `GrupoAves`), así el galpón conserva el historial de las aves que tuvo.
- **Panel, reportes y WhatsApp:** Inicio muestra ventas del día, cartera y vencida, cuentas por pagar, efectivo en caja, producción y postura, inventario, y alertas (existencias bajo el mínimo, deudas vencidas, cajas sin cerrar, transferencias sin verificar, rutas sin liquidar, compras vencidas, huevo por clasificar, pedidos recurrentes por aprobar). **Reportes** por rango de fechas (ventas por cliente y por producto, producción propia y comprada, galpones, cartera, compras) con descarga en Excel (.xlsx) y en PDF, con el nombre de la empresa arriba. **Libro mensual** en Excel (.xlsx) con fecha, concepto, ingreso, egreso y saldo de cada cobro, ingreso, egreso y diferencia de cierre de caja; se descarga por mes o por un periodo con fecha inicial y final, solo si todas las cajas de esas fechas están cerradas (lo que incluya hoy sale hasta hoy). Mensajes listos para WhatsApp con enlaces `wa.me` (el usuario revisa y pulsa Enviar): confirmación de pedido, recibo, estado de cuenta, recordatorio de deuda vencida y "va en camino".

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · PostgreSQL · Prisma 7 · Tailwind CSS sin librería de componentes ni animaciones · pdf-lib para recibos y reportes · Docker Compose y Cloudflare Tunnel para el despliegue · Vitest.

## Cómo correrlo

Requisitos: Node 22 y PostgreSQL 16.

```bash
cp .env.example .env        # ajusta DATABASE_URL y SEED_ADMIN_PASSWORD
npm install
npm run db:deploy           # crea las tablas
npm run db:seed             # productos con sus precios y el usuario "admin"
npm run dev                 # http://localhost:3000
```

Ingresa con el usuario `admin` y la clave de `SEED_ADMIN_PASSWORD`, y cámbiala desde **Usuarios > Empleados**.

### Datos de ejemplo (pruebas y preproducción)

Para ver la app como si llevara meses en uso, en una base **de pruebas** recién creada:

```bash
npm run db:demo             # después de db:deploy y db:seed
```

Simula 90 días hasta hoy (`DEMO_DIAS=180` para más) y deja algo que ver en cada pantalla: unos 170 clientes con precios especiales (algunos cambiados o quitados), deudas que traían y cupos pasados; pedidos diarios que cada repartidor toma en su zona, con precierre y aprobación del administrador, entregas parciales, no entregadas, reprogramadas y abonos en la parada; ventas en la granja de gallinaza y gallinas; cartera al día y vencida, abonos a la deuda más antigua o a un recibo, pagos anulados; cajas cerradas con gastos, consignaciones y diferencias; transferencias verificadas y por verificar; galpones con aves en cría, levante y postura, y aves anteriores con producción, mortalidad, traslados y gallinas pasadas a la venta; clasificación diaria (una anulada); compras de contado y a crédito, por clasificar, anuladas y vencidas, con abonos parciales y uno anulado; un proveedor y un galpón inactivos; ajustes y roturas.

Ayer queda con la caja sin cerrar, una ruta con el precierre devuelto y dos pedidos atrasados. Hoy queda con la caja abierta, una ruta a medio entregar, otra con el precierre por aprobar, pedidos sin tomar, un pedido recurrente por aprobar, huevo comprado por clasificar y Jumbo bajo el mínimo, así que el inicio muestra todas las alertas. Al cerrar la caja de ayer ya se puede sacar el libro del mes.

Crea los usuarios `laura` (ventas), `carlos` y `andres` (repartidores) y `diana` (ventas y repartidor), con la clave de `DEMO_PASSWORD` (si no está, la de `SEED_ADMIN_PASSWORD`). Solo corre en una base sin clientes, galpones, proveedores, caja ni inventario, así que no toca la de producción.

Para borrar los datos de ejemplo y volver a cargarlos, en tu computador (nunca en el servidor), con la base de `DATABASE_URL` del `.env` (por defecto `rp`):

```bash
dropdb rp && createdb -O rp rp   # borra la base y la crea vacía
npm run db:deploy                # crea las tablas
npm run db:seed                  # productos y usuario "admin"
npm run db:demo                  # datos de ejemplo
```

Con Docker: `docker compose --env-file pruebas.env run --rm migrar npm run db:demo`.

## Servidor de producción

La app corre en un PC de la empresa (Windows 10) con Docker Desktop y Docker Compose, en la carpeta `C:\rp`, y se publica con un túnel de Cloudflare: HTTPS en el dominio de la empresa sin abrir puertos del router ni tener IP fija. El servidor no usa GitHub: el código llega en un ZIP de `main` y Docker arma la app en el mismo PC. La guía completa, paso a paso, está en los archivos del proyecto (`guias/instalar-servidor-windows10.md`).

### Instalar por primera vez

1. En GitHub, en la rama `main`: **Code > Download ZIP**. Descomprímelo en `C:\rp` (debe quedar `C:\rp\docker-compose.yml`).
2. En Cloudflare: **Zero Trust > Networks > Tunnels > Create a tunnel** (tipo Cloudflared), copia el token que aparece en la opción Docker. En **Public Hostname** agrega el dominio con servicio `HTTP` y URL `app:3000`.
3. Copia `produccion.env.example` como `produccion.env` y llena las claves, el token y `EMPRESA_NOMBRE` (el nombre de la empresa que usa el software).
4. En PowerShell:

   ```powershell
   cd C:\rp
   docker compose --env-file produccion.env up -d --build
   ```

   Esto arma la app, levanta la base de datos, aplica las migraciones, crea los productos y el usuario `admin` (solo la primera vez), arranca la app y el túnel. Entra por el dominio con `admin` y la clave de `SEED_ADMIN_PASSWORD`, y cámbiala en **Usuarios > Empleados**.

La app solo escucha en `127.0.0.1:3000` del servidor; desde otros equipos se entra por el dominio (la sesión exige HTTPS). Opcional: en Cloudflare **Access** se puede pedir un código por correo antes de llegar al login.

### Actualizar a una versión nueva

Los datos viven en la base de datos de Docker, no en los archivos de `C:\rp`, así que cambiar el código no los toca. Antes de actualizar, revisa en GitHub que el último cambio de `main` tenga la marca verde (pasó las comprobaciones).

1. En tu portátil: **Code > Download ZIP** de `main` y pásalo a la USB. Ponle la fecha al nombre (por ejemplo `rp-2026-10-19.zip`) y guarda también el anterior, por si hay que volver atrás.
2. En el servidor, saca una copia de la base antes de tocar nada:

   ```powershell
   cd C:\rp
   docker compose --env-file produccion.env exec respaldo sh -c 'pg_dump -Fc -f /respaldos/antes-de-actualizar.dump'
   ```

   Revisa que aparezca `C:\rp\respaldos\antes-de-actualizar.dump`.
3. Descomprime el ZIP nuevo **encima** de `C:\rp` y acepta reemplazar los archivos. `produccion.env` y la carpeta `respaldos` no vienen en el ZIP, así que se conservan. No borres la carpeta `C:\rp`.
4. Arma y arranca la versión nueva:

   ```powershell
   docker compose --env-file produccion.env up -d --build
   ```

   Mientras se arma (puede tardar de 10 a 20 minutos), la versión anterior sigue atendiendo; el corte es de pocos segundos al final. Las migraciones de la base se aplican solas.
5. Comprueba que quedó bien:

   ```powershell
   docker compose --env-file produccion.env ps -a
   ```

   `migrar` debe decir `Exited (0)` y `app` debe decir `healthy`. Entra a la app y revisa que todo esté como antes.

**Si algo sale mal:** descomprime el ZIP anterior encima de `C:\rp` y repite el paso 4. Si la versión nueva traía cambios en la base de datos, restaura además `antes-de-actualizar.dump` (ver "Copias de seguridad").

**Nunca** uses `docker compose down -v` ni borres el volumen `rp_datos` en Docker Desktop: ahí está la base de datos.

**Limpieza ocasional** (cada varias actualizaciones, para recuperar espacio en disco):

```powershell
docker image prune -f
docker builder prune -f
```

### Copias de seguridad

El servicio `respaldo` guarda una copia diaria de la base de datos en `C:\rp\respaldos` y borra las de más de `DIAS_RESPALDO` días. Esa carpeta debe copiarse también fuera del servidor (una USB, un disco externo o una carpeta de Google Drive u OneDrive), porque si el PC se daña se pierden ambas.

Restaurar una copia (por ejemplo, para probar que sirve, en una base aparte):

```powershell
docker compose --env-file produccion.env exec respaldo createdb prueba
docker compose --env-file produccion.env exec respaldo pg_restore -d prueba /respaldos/rp-AAAA-MM-DD_HHMM.dump
```

Para reemplazar la base real, detén la app (`docker compose --env-file produccion.env stop app`), restaura con `pg_restore --clean -d rp ...` y vuelve a arrancarla.

## Comprobaciones

Lo mismo que corre GitHub Actions en cada PR y en cada cambio a `main` (`.github/workflows/ci.yml`):

```bash
npm run typecheck
npm test                  # pruebas unitarias (no necesitan base de datos)
npm run test:integracion  # acciones, cartera, caja, rutas, inventario... contra PostgreSQL real
npm run test:cobertura    # todas, con el informe en coverage/ y el mínimo exigido
npm run build
```

Las pruebas de integración usan una base aparte que vacían antes de cada prueba: por defecto `postgresql://rp:rp@localhost:5432/rp_pruebas` (se cambia con `DATABASE_URL_PRUEBAS`). Por seguridad se niegan a correr si el nombre de la base no contiene "prueba" o "test", así nunca borran la base real. Se crea con `createdb -O rp rp_pruebas`; las migraciones se aplican solas.

La cobertura se mide sobre el código del servidor (`src/**/*.ts`: reglas de negocio, acceso a datos, acciones y rutas de recibos y reportes) y debe quedar en al menos 90% de líneas, instrucciones y funciones y 85% de ramas; si baja, el PR queda en rojo. Las pantallas (`.tsx`) se comprueban con el chequeo de tipos y el build.

En GitHub Actions además se valida el esquema de Prisma, que las migraciones coincidan con `schema.prisma`, la auditoría de dependencias (solo informa) y que la imagen de Docker compile. Dependabot propone una vez al mes las actualizaciones de dependencias, de las acciones de GitHub y de la imagen de Docker (solo versiones de Node con soporte largo).

## Organización

```
prisma/schema.prisma      modelo de datos
src/app/(app)/...         pantallas por módulo (pedidos, clientes, cartera, inventario, ...)
src/app/recibos/...       recibos en PDF
src/app/(app)/reportes/   reportes y su exportación a Excel y PDF; libro mensual en Excel
src/lib/                  sesión, permisos, base de datos, formatos
src/modules/              reglas de negocio puras con pruebas (cartera, precios, inventario, rutas, aves, mensajes)
src/pruebas/              pruebas de integración contra PostgreSQL (acciones del servidor, reportes y recibos)
.github/workflows/ci.yml  CI: tipos, migraciones, pruebas con cobertura, build e imagen de Docker
src/components/           componentes de interfaz (HTML + Tailwind)
```

Identidad: el software es **RP Software** (ícono de la app, "Acerca de" y pie de página); la empresa que lo usa se configura con `EMPRESA_NOMBRE` y su nombre sale en el encabezado de la app, el inicio de sesión, los recibos y los reportes, que solo llevan al pie "Generado con RP Software". Los textos de marca están en `src/lib/marca.ts`.

Reglas de diseño: el dinero se guarda en pesos enteros; inventario, ventas y pagos no se borran, se anulan; el inventario de huevos se lleva en huevos y se muestra en cubetas de 30.
