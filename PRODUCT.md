# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personal no técnico de una sola empresa, RP Huevos Campesinos, con poca experiencia en software. Cada quien entra con su usuario y elige la operación (Administrador, Ventas o Repartidor) que el administrador le asignó.

- **Administrador (dueño):** en la oficina o la granja, en el computador y en el celular. Revisa el inicio y las alertas, aprueba la liquidación de las rutas, reabre cajas, anula, saca reportes y el libro mensual, y administra usuarios, galpones y lotes.
- **Ventas:** en la oficina o la granja, en el computador y en el celular. Toma pedidos, vende en la granja con recibo, recibe abonos, registra ingresos, egresos y compras, y cuadra y cierra la caja del día.
- **Repartidor:** en la calle, en el celular, con sol, con prisa y a menudo con una sola mano libre. Trabaja solo desde **Mi ruta**: toma los pedidos del día, llama, escribe por WhatsApp, abre Maps, entrega (total, parcial o no entregado), cobra abonos y hace el precierre declarando el efectivo.

## Product Purpose

Llevar en un solo lugar la operación diaria de la granja: clasificación diaria del huevo, inventario, clientes con precios especiales, pedidos, rutas de entrega, ventas con recibo en PDF, cartera (fiado), caja diaria, compras a terceros y cuentas por pagar, lotes de aves y reportes. Reemplaza cuadernos, hojas de Excel y WhatsApp sueltos.

Funciona si cada día se puede cuadrar: lo producido y comprado, lo vendido, lo entregado, lo cobrado y lo que se debe coinciden con el efectivo de la caja, y el dueño ve qué está pendiente sin tener que preguntar.

## Positioning

Software hecho a medida para RP Huevos Campesinos, no un producto genérico ni para varias granjas. Sigue exactamente cómo trabaja la granja: huevo contado en huevos y mostrado en cubetas de 30 por clasificación, fiado con cupo y días de crédito, precio especial por cliente que el pedido congela, rutas que cada repartidor toma y liquida con precierre, y caja diaria que no se cierra sin cuadrar o explicar la diferencia.

## Operating Context

- Se usa desde el navegador en el computador y en el celular; se puede instalar como app (PWA, `public/manifest.webmanifest`). Sin modo sin conexión (la fase 7 es opcional y no está hecha).
- Corre en el servidor propio de la empresa con Docker Compose y se publica por un túnel de Cloudflare (HTTPS en el dominio de la empresa).
- Ritmo diario: clasificación en la mañana, pedidos y reparto del día, cobros, precierre de las rutas, aprobación del administrador y cierre de caja. Libro mensual cuando todas las cajas del periodo están cerradas.
- Documentos que salen de la app: recibos en PDF con consecutivo (`RP-000001` ventas, `AB-000001` pagos), reportes en Excel (.xlsx) y PDF con el logo, libro mensual en Excel, y mensajes listos para WhatsApp (`wa.me`) que el usuario revisa y envía.

## Capabilities and Constraints

- Permisos verificados en el servidor en cada página y acción; el repartidor no ve Pedidos, Reparto ni Clientes.
- Menú: Inicio, Mi ruta (solo repartidor), Pedidos (Pedidos, Rutas y liquidación, Resumen del reparto), Contabilidad (Ingresos, Egresos, Precios, Caja y cierre, Cartera, Por pagar, Reportes), Inventario y Usuarios (Clientes, Proveedores, Empleados).
- Reglas: el dinero se guarda en pesos enteros; inventario, ventas y pagos no se borran, se anulan (solo el administrador anula); un día de caja cerrado no recibe más dinero y solo el administrador lo reabre; todo queda en la bitácora de auditoría.
- Terminología propia que la interfaz debe respetar: cubeta, clasificación, fiado/cartera, abono, precierre, liquidación, galpón, lote, postura, gallinaza (por bulto, kilo o viaje), consumidor final.
- Stack existente: Next.js 16 (App Router, Server Actions), TypeScript, PostgreSQL, Prisma, Tailwind CSS, pdf-lib.

## Brand Commitments

- Nombre: **RP Huevos Campesinos** (nombre corto "RP"). Idioma de la interfaz: español de Colombia, frases cortas y llanas, sin tecnicismos.
- Logos existentes: `public/icons/svg/` (icono, icono maskable, logo horizontal y vertical) y `public/icons/logo-recibo.png` para recibos y reportes. Los colores de marca en uso (terracota `#A63F1C`, crema `#F4E7CF`) no se declararon fijos.
- Créditos: autor fttmatteo (https://github.com/fttmatteo), página "Acerca de" y pie con derechos.
- Obligatorio en todo trabajo futuro:
  - **Sin animaciones ni transiciones.**
  - **Sin librerías de componentes de UI:** solo HTML + Tailwind.
  - **Lectura fácil:** texto y botones grandes y claros.

## Evidence on Hand

- Datos de ejemplo realistas con `npm run db:demo` (unos 170 clientes, 90 días de operación, todas las alertas activas) para ver cada pantalla con contenido.
- No hay testimonios, clientes externos, precios del software ni licencias: es software interno. No se deben inventar.

## Product Principles

1. **Cuadrar es el trabajo.** Cada pantalla ayuda a que el dinero, el huevo y lo que se debe coincidan; las diferencias se muestran y se explican, nunca se esconden.
2. **Nada se borra.** Corregir es anular con rastro; la interfaz deja claro qué está vigente y qué fue anulado.
3. **Cada rol ve solo su trabajo.** Sobre todo el repartidor: lo justo para entregar y cobrar, con un toque y en la calle.
4. **Hablar como la granja.** Cubetas, fiado, abono, precierre: las palabras y unidades del negocio, no las de un software contable.
5. **Rápido y claro antes que vistoso.** Celulares modestos, sol y prisa: carga inmediata, sin movimiento y con lectura sin esfuerzo.

## Accessibility & Inclusion

- Usuarios no técnicos, algunos mayores o con poca vista: texto grande, alto contraste y áreas de toque generosas.
- Uso en exteriores con sol y con una mano en el celular (repartidores).
- Sin movimiento en la interfaz (compromiso de marca, que además cubre la sensibilidad al movimiento).
