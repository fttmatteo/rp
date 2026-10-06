# RP Software

Aplicación web para la empresa de huevos: clasificación diaria, inventario, clientes con precios especiales, pedidos, rutas de entrega, ventas con recibo en PDF, cartera (fiado), caja, compras a terceros, lotes de aves y reportes. Funciona en el computador y en el celular desde el navegador.

El plan completo está en el documento del proyecto (`plan-rp-software.md`). Este código cubre las fases 0 a 6. La fase 7 (modo sin conexión) es opcional y no está hecha.

## Qué incluye

- **Fase 0 · Base:** login con usuario y clave, accesos por operación (Administrador, Ventas, Repartidor, Galponero). Después de ingresar, el usuario elige la operación; si el administrador no se la asignó, ve "Acceso denegado". Los permisos se verifican en el servidor en cada página y acción. Administración de usuarios y bitácora de auditoría.
- **Fase 1 · Clientes, precios e inventario:** clientes con cupo y días de crédito; precio general por producto y precio especial por cliente (el pedido congela el precio); clasificación diaria en cubetas y huevos sueltos; inventario calculado a partir de movimientos, con ajustes y anulaciones.
- **Fase 2 · Pedidos, ventas y cartera:** pedidos por cliente, entrega con pago total, parcial o fiado; recibos en PDF con consecutivo (`RP-000001` para ventas y `AB-000001` para pagos); abonos aplicados a la deuda más antigua o al recibo que el cliente elija; estado de cuenta, antigüedad de cartera, aviso de cupo, carga de saldos iniciales y anulaciones (solo administrador).
- **Pedidos y reparto por fecha:** al filtrar pedidos por fecha se ve el total del día por clasificación y su valor. La pantalla **Reparto** muestra, para una fecha, cada cliente con clasificación, cantidad, valor, lo pagado en la entrega y lo pendiente, y abajo el cierre del reparto: cantidad por clasificación, valor pagado (efectivo y transferencia) y valor pendiente.
- **Fase 3 · Caja diaria:** cada día tiene su caja con base, cobros (salen solos de los pagos), otros ingresos, gastos y retiros. Al cerrar se cuenta el efectivo y, si no cuadra, se exige una observación. Un día cerrado no recibe más dinero; solo el administrador lo reabre y el cierre anterior queda en la auditoría. Las transferencias se muestran aparte. El reporte quincenal suma los cierres diarios. La pueden manejar Ventas y el administrador.

- **Fase 4 · Rutas de entrega:** se arma la ruta de cada repartidor por día, se ordena por zona o a mano. **Mi ruta** muestra al repartidor sus paradas en orden con llamar, WhatsApp y Maps; entrega con un toque, entrega parcial (lo que no se entregó vuelve al inventario) o "no entregado" con motivo para reprogramar. Puede cobrar abonos de deudas viejas. Al final se liquida la ruta: lo llevado, lo entregado, lo devuelto, el efectivo esperado y el contado; la diferencia queda en la caja con su explicación.
- **Fase 4b · Gallinaza y compras a terceros:** la gallinaza se vende por bulto, kilo o viaje (se elige en Precios). Huevo comprado a proveedores, clasificado o por clasificar (se clasifica después en Clasificación), de contado (sale de la caja) o a crédito (cuenta por pagar con abonos).
- **Fase 5 · Aves:** galpones y lotes con raza, fecha y edad de ingreso; novedades (muerte, descarte, paso a venta y traslado entre lotes); la clasificación se registra por lote para calcular la postura diaria y la mortalidad acumulada. El paso a venta suma gallinas al inventario.
- **Fase 6 · Panel, reportes y WhatsApp:** Inicio muestra ventas del día, cartera y vencida, cuentas por pagar, efectivo en caja, producción y postura, inventario, y alertas (existencias bajo el mínimo, deudas vencidas, cajas sin cerrar, transferencias sin verificar, rutas sin liquidar, compras vencidas, huevo por clasificar). **Reportes** por rango de fechas (ventas por cliente y por producto, producción propia y comprada, lotes, cartera, compras) con descarga en CSV para Excel y en PDF. **Libro mensual** en Excel (.xlsx) con fecha, concepto, ingreso, egreso y saldo de cada cobro, ingreso, egreso y diferencia de cierre de caja; se descarga por mes o por un periodo con fecha inicial y final (lo que incluya hoy sale hasta hoy). Mensajes listos para WhatsApp con enlaces `wa.me` (el usuario revisa y pulsa Enviar): confirmación de pedido, recibo, estado de cuenta, recordatorio de deuda vencida y "va en camino".

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · PostgreSQL · Prisma · Tailwind CSS sin librería de componentes ni animaciones · pdf-lib para recibos y reportes · Docker Compose y Cloudflare Tunnel para el despliegue · Vitest.

## Cómo correrlo

Requisitos: Node 22 y PostgreSQL 16.

```bash
cp .env.example .env        # ajusta DATABASE_URL y SEED_ADMIN_PASSWORD
npm install
npm run db:deploy           # crea las tablas
npm run db:seed             # productos con sus precios y el usuario "admin"
npm run dev                 # http://localhost:3000
```

Ingresa con el usuario `admin` y la clave de `SEED_ADMIN_PASSWORD`, y cámbiala desde **Usuarios**.

## Puesta en marcha en el servidor

La app corre en el servidor propio con Docker Compose y se publica con un túnel de Cloudflare: HTTPS en el dominio de la empresa sin abrir puertos del router ni tener IP fija.

1. En el servidor (Linux con Docker y Docker Compose) descarga este repositorio.
2. En Cloudflare: **Zero Trust > Networks > Tunnels > Create a tunnel** (tipo Cloudflared), copia el token que aparece en la opción Docker. En **Public Hostname** agrega el dominio (por ejemplo `app.tuempresa.com`) con servicio `HTTP` y URL `app:3000`.
3. Copia `produccion.env.example` como `produccion.env` y llena las claves y el token.
4. Arranca todo:

   ```bash
   docker compose --env-file produccion.env up -d --build
   ```

   Esto levanta la base de datos, aplica las migraciones, crea los productos y el usuario `admin` (solo la primera vez), arranca la app y el túnel. Entra por el dominio con `admin` y la clave de `SEED_ADMIN_PASSWORD`, y cámbiala en **Usuarios**.

5. Para actualizar a una versión nueva: descarga los cambios y repite el mismo comando; las migraciones se aplican solas.

La app solo escucha en `127.0.0.1:3000` del servidor; desde otros equipos se entra por el dominio (la sesión exige HTTPS). Opcional: en Cloudflare **Access** se puede pedir un código por correo antes de llegar al login.

### Copias de seguridad

El servicio `respaldo` guarda una copia diaria de la base de datos en la carpeta `respaldos/` del servidor y borra las de más de `DIAS_RESPALDO` días. Esa carpeta debe copiarse también fuera del servidor (un disco externo o una nube, por ejemplo con `rclone`), porque si el servidor se daña se pierden ambas.

Restaurar una copia (por ejemplo, para probar que sirve, en una base aparte):

```bash
docker compose --env-file produccion.env exec respaldo createdb prueba
docker compose --env-file produccion.env exec respaldo pg_restore -d prueba /respaldos/rp-AAAA-MM-DD_HHMM.dump
```

Para reemplazar la base real, detén la app (`docker compose --env-file produccion.env stop app`), restaura con `pg_restore --clean -d rp ...` y vuelve a arrancarla.

## Comprobaciones

```bash
npm run typecheck
npm test
npm run build
```

## Organización

```
prisma/schema.prisma      modelo de datos
src/app/(app)/...         pantallas por módulo (pedidos, clientes, cartera, inventario, ...)
src/app/recibos/...       recibos en PDF
src/app/(app)/reportes/   reportes y su exportación a CSV y PDF; libro mensual en Excel
src/lib/                  sesión, permisos, base de datos, formatos
src/modules/              reglas de negocio puras con pruebas (cartera, precios, inventario, rutas, aves, mensajes)
src/components/           componentes de interfaz (HTML + Tailwind)
```

Reglas de diseño: el dinero se guarda en pesos enteros; inventario, ventas y pagos no se borran, se anulan; el inventario de huevos se lleva en huevos y se muestra en cubetas de 30.
