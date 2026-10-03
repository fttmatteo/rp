# RP Software

Aplicación web para la empresa de huevos: clasificación diaria, inventario de cubetas y gallinas, clientes con precios especiales, pedidos, ventas con recibo en PDF y cartera (fiado). Funciona en el computador y en el celular desde el navegador.

El plan completo está en el documento del proyecto (`plan-rp-software.md`). Este código cubre las fases 0, 1 y 2.

## Qué incluye

- **Fase 0 · Base:** login con usuario y clave, accesos por operación (Administrador, Ventas, Repartidor, Galponero). Después de ingresar, el usuario elige la operación; si el administrador no se la asignó, ve "Acceso denegado". Los permisos se verifican en el servidor en cada página y acción. Administración de usuarios y bitácora de auditoría.
- **Fase 1 · Clientes, precios e inventario:** clientes con cupo y días de crédito; precio general por producto y precio especial por cliente (el pedido congela el precio); clasificación diaria en cubetas y huevos sueltos; inventario calculado a partir de movimientos, con ajustes y anulaciones.
- **Fase 2 · Pedidos, ventas y cartera:** pedidos por cliente, entrega con pago total, parcial o fiado; recibos en PDF con consecutivo (`RP-000001` para ventas y `AB-000001` para pagos); abonos aplicados a la deuda más antigua; estado de cuenta, antigüedad de cartera, aviso de cupo, carga de saldos iniciales y anulaciones (solo administrador).

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · PostgreSQL · Prisma · Tailwind CSS sin librería de componentes ni animaciones · pdf-lib para los recibos · Vitest.

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
src/lib/                  sesión, permisos, base de datos, formatos
src/modules/              reglas de negocio puras con pruebas (cartera, precios, inventario)
src/components/           componentes de interfaz (HTML + Tailwind)
```

Reglas de diseño: el dinero se guarda en pesos enteros; inventario, ventas y pagos no se borran, se anulan; el inventario de huevos se lleva en huevos y se muestra en cubetas de 30.
