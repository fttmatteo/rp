# CLAUDE.md

Guía para Claude (y para cualquier persona) que trabaje en este repositorio. Complementa al `README.md` (qué hace la app, cómo instalarla y desplegarla), `PRODUCT.md` (para quién es y sus principios) y `DESIGN.md` (sistema visual). Si algo de aquí choca con el código, manda el código: corrige este archivo en el mismo PR.

## Qué es

**RP Software**: aplicación web para una granja productora de huevos (clasificación diaria, inventario, clientes con precios especiales, pedidos, rutas de entrega, ventas con recibo PDF, cartera o fiado, caja diaria, compras a terceros, galpones de aves, reportes y libro mensual en Excel). Se usa en el computador de la oficina y en el celular de los repartidores, desde el navegador. No es PWA y no tiene modo sin conexión (la fase 7 del plan es opcional y no está hecha).

- Dueño del repo: Matteo (`fttmatteo`).
- Producción: un PC con Windows 10 de la empresa, con Docker Compose y un túnel de Cloudflare, en `https://rp.plak.digital`. Ese servidor no usa GitHub ni GHCR: se actualiza a mano (la guía está fuera del repo, en los archivos del proyecto: `guias/instalar-servidor-windows10.md`).
- Escala: unos 10 usuarios, unas 50 entregas diarias por repartidor.

## Idioma (obligatorio)

Todo va en **español**: textos de la interfaz, mensajes de error, nombres de variables, funciones, archivos, carpetas, rutas, tablas y columnas, comentarios y pruebas (`registrarEntrega`, `exigirCajaAbierta`, `src/pruebas/`, `/mi-ruta`). Los textos para el usuario son sencillos y sin jerga técnica: los usuarios son gente de granja, no de oficina. Solo quedan en inglés las palabras del framework (`page.tsx`, `route.ts`, `layout.tsx`) y los mensajes de commit y títulos de PR siguen la costumbre del repo (en español, cortos).

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions, `output: "standalone"`), **React 19**, **TypeScript** estricto.
- **PostgreSQL 16** con **Prisma 7** (`prisma/schema.prisma`, migraciones SQL en `prisma/migrations/`, configuración en `prisma.config.ts`). El cliente se conecta con el adaptador `@prisma/adapter-pg` (`src/lib/db.ts`); Prisma 7 no lee el `.env` solo: lo carga `prisma.config.ts` y `db:demo` usa `--env-file-if-exists`.
- **Tailwind CSS 4** sin librería de componentes (nada de shadcn, Radix, MUI, etc.) y **sin animaciones**.
- **pdf-lib** para recibos y reportes en PDF; los Excel (.xlsx) se generan con código propio en `src/modules/xlsx.ts` (no hay librería de Excel).
- **zod** disponible, **bcryptjs** para claves. Sesiones propias con cookie (no Auth.js).
- **Vitest 5** (proyectos `unitarias` e `integracion`) con cobertura v8.
- Node 22. Alias de importación `@/` → `src/`.

## Comandos

```bash
npm install                 # también corre prisma generate
cp .env.example .env        # DATABASE_URL, SEED_ADMIN_PASSWORD, EMPRESA_NOMBRE
npm run db:deploy           # aplica migraciones
npm run db:seed             # productos con precios y usuario "admin"
npm run db:demo             # solo en una base de pruebas vacía: ~90 días de datos simulados (DEMO_DIAS=180 para más)
npm run dev                 # http://localhost:3000

npm run typecheck           # tsc --noEmit
npm test                    # pruebas unitarias (src/**/*.test.ts, sin base de datos)
npm run test:integracion    # src/pruebas/**, contra PostgreSQL real (rp_pruebas)
npm run test:cobertura      # todas con cobertura y umbrales; es lo que corre CI
npm run build

npm run db:migrate          # crea una migración nueva en desarrollo (prisma migrate dev)
```

Base de pruebas: `createdb -O rp rp_pruebas` (o la de `DATABASE_URL_PRUEBAS`). Las pruebas de integración la vacían antes de cada prueba y se niegan a correr si el nombre de la base no contiene "prueba" o "test". Nunca apuntes las pruebas ni `db:demo` a la base real.

**Antes de cada push** corre lo mismo que CI: `npm run typecheck`, `npm run test:cobertura` y `npm run build`. Si cambiaste `schema.prisma`, comprueba también que la migración coincide con el esquema (ver "Base de datos").

## Organización del código

```
prisma/schema.prisma       modelo de datos (nombres en español)
prisma/migrations/         migraciones SQL, una carpeta por cambio
prisma/seed.ts             productos iniciales y usuario admin (idempotente; corre en cada arranque de Docker)
prisma/demo.ts             simulación de datos de ejemplo (npm run db:demo)
src/app/(app)/<modulo>/    pantallas por módulo: page.tsx (servidor) + acciones.ts ("use server") + componentes del módulo
src/app/login, operacion, sin-acceso   inicio de sesión, elección de operación, acceso denegado
src/app/recibos/venta|pago/[id]/route.ts   recibos en PDF
src/app/(app)/reportes/exportar|libro/route.ts   descargas de reportes (.xlsx y PDF) y libro mensual
src/lib/                   servidor: sesión, permisos, base de datos, caja, cartera, existencias, pagos, entregas, rutas, PDF, formatos
src/modules/               reglas de negocio PURAS (sin base de datos), cada una con su .test.ts
src/components/            componentes de interfaz propios (HTML + Tailwind)
src/pruebas/               pruebas de integración y sus utilidades (datos.ts, entorno.ts, next.ts, preparar-bd.ts)
scripts/                   utilidades de CI
.github/workflows/ci.yml   CI/CD
```

Módulos en `src/app/(app)/`: `acerca`, `aves` (galpones), `caja` (+ `reporte`), `cartera`, `clasificacion`, `clientes`, `egresos`, `ingresos`, `inventario`, `mi-ruta`, `pedidos`, `por-pagar`, `precios`, `proveedores`, `reparto`, `reportes`, `rutas`, `usuarios`.

Dónde poner cada cosa:
- Cálculo o regla que no necesita base de datos → `src/modules/<tema>.ts` con prueba unitaria al lado.
- Lectura/escritura compartida por varias acciones → `src/lib/<tema>-db.ts` (o el archivo existente del tema), con `import "server-only"`.
- Acción de un formulario → `acciones.ts` del módulo.

## Roles y permisos

- Tres operaciones (enum `Acceso`): `ADMIN` (Administrador), `VENTAS`, `REPARTIDOR`. El administrador asigna a cada usuario las que puede usar (combinables). No existe "galponero" (se quitó).
- Tras el login el usuario **elige la operación** (`/operacion`); si no la tiene asignada ve "Acceso denegado". La operación activa se guarda en la sesión.
- La matriz está en `src/lib/permisos.ts` (`puede(operacion, permiso)`). ADMIN puede todo menos `ruta.propia` (Mi ruta es solo del repartidor). VENTAS maneja clientes, pedidos, pagos, cartera, caja (incluido el cierre), compras, reportes y ve rutas, pero **no** aprueba rutas, ni anula, ni toca precios, usuarios, aves, clasificación ni ajustes de inventario. REPARTIDOR solo tiene `pedidos.entregar`, `pagos.registrar` y `ruta.propia`: trabaja únicamente desde Mi ruta y solo sobre pedidos de su propia ruta.
- **Los permisos se verifican en el servidor en cada página y en cada acción** con `await requerir("permiso")` de `src/lib/sesion.ts` (redirige a `/login`, `/operacion` o `/sin-acceso`). Esconder un botón o una entrada del menú no basta. Si agregas un permiso, actualiza `permisos.ts`, `permisos.test.ts`, el menú (`src/app/(app)/layout.tsx` y `src/components/secciones.tsx`) y las pruebas de integración.
- Solo el administrador: anular, aprobar el precierre de una ruta, reabrir una caja cerrada, precios, usuarios, inventario (ajustes), aves y clasificación.

## Patrones del servidor

**Acción de formulario** (ver por ejemplo `src/app/(app)/clasificacion/acciones.ts`):

```ts
"use server";
export async function hacerAlgo(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("permiso");          // siempre primero, fuera del try
  try {
    const valor = entero(form, "valor", "Valor");      // leer con texto/textoOpcional/entero/decimal de @/lib/form
    if (!valor) throw new ErrorUsuario("Mensaje claro para el usuario.");
    await db.$transaction(async (tx) => {
      // bloqueos (FOR UPDATE / advisory locks) → validar → escribir → auditar
      await auditar(tx, sesion.usuario.id, "Entidad", id, "accion", { ...detalle });
    });
  } catch (e) {
    return { error: mensajeError(e) };                // traduce ErrorUsuario y errores de Prisma
  }
  revalidatePath("/modulo");
  return { ok: "Confirmación en lenguaje sencillo." };
}
```

- Los formularios del cliente usan `<Formulario accion={...}>` de `src/components/formulario.tsx` (`useActionState`, muestra error u ok, conserva lo escrito si hay error, `confirmar` para anulaciones). Para pasar un id, se enlaza: `anularX.bind(null, id)`.
- Errores para el usuario: `throw new ErrorUsuario("...")`. Nunca muestres mensajes técnicos; `mensajeError` cubre los de Prisma (P2002, P2025, P2034, conexión...).
- Todo cambio de datos que importe va dentro de `db.$transaction` y deja registro con `auditar(...)` (tabla `Auditoria`).
- `redirect()` va fuera del `try` (lanza una excepción).
- Las páginas son Server Components `async` que llaman `requerir(...)` y consultan con Prisma directamente; `params` y `searchParams` son `Promise` (Next 16) y se esperan con `await`.
- No hay `middleware.ts`/`proxy.ts`: la protección está en `requerir` de cada página/acción/ruta.

**Concurrencia** (no la rompas): las existencias se bloquean por producto con `bloquearExistencias(tx, ids)` (en orden de id) y toda entrada o salida pasa por `registrarMovimientos(tx, [...])`, que mantiene `Producto.existencias`. Clientes, cajas y rutas usan advisory locks o `SELECT ... FOR UPDATE` (`bloquearCliente`, `bloquearCaja`/`exigirCajaAbierta`, `bloquearRuta`/`exigirRutaAbierta`). Respeta el orden de bloqueo que ya usa cada flujo para no crear bloqueos cruzados.

## Reglas de negocio que no se negocian

- **Dinero en pesos enteros** (`Int`), sin decimales ni floats. Formato con `formatoPesos`. Zona horaria `America/Bogota`; un "día" se guarda como fecha UTC a medianoche (`diaUTC(hoyISO())`).
- **Inventario de huevos en huevos**, mostrado en cubetas de 30 (`HUEVOS_POR_CUBETA`, `huevosDe`, `formatoHuevos`). Gallinas en unidades; gallinaza en bulto, kilo o viaje (configurable en Precios).
- **Nada se borra: se anula.** Inventario, ventas, pagos, compras, clasificaciones y movimientos de caja tienen anulación (solo administrador) que deja movimientos inversos y auditoría. El inventario siempre es la suma de sus movimientos.
- **Precios**: precio general por producto y precio especial por cliente; el pedido **congela** el precio al crearse. Los cambios quedan en `HistorialPrecio`.
- **Recibos** con consecutivo (`RP-000001` ventas, `AB-000001` abonos) vía `siguienteConsecutivo(tx, "VENTA" | "PAGO")` dentro de la transacción.
- **Cartera (fiado)**: un abono se aplica a la deuda más antigua (FIFO) o al recibo que el cliente elija, y lo que sobre va FIFO (`src/modules/cartera.ts`). No hay anticipos: un pago no puede superar la deuda. Clientes con cupo y días de crédito.
- **Caja diaria**: cada día tiene su caja; la base es lo contado en el último cierre. Todo dinero entra a la caja de hoy, que debe estar abierta (`exigirCajaAbierta`). Al cerrar se cuenta el efectivo; si no cuadra se exige observación. Un día cerrado no recibe dinero; solo el administrador lo reabre (queda en auditoría). Ventas y administrador pueden cerrar. Las transferencias van aparte y se pueden marcar como verificadas en el banco.
- **Rutas**: el repartidor toma desde Mi ruta los pedidos del día que nadie ha tomado (y puede soltarlos), entrega (total, parcial —lo no entregado vuelve al inventario— o "no entregado" con motivo), cobra abonos y hace el **precierre** declarando el efectivo. El **administrador** aprueba o devuelve el precierre; la diferencia queda en la caja con su explicación.
- **Libro mensual** (.xlsx) solo se descarga si todas las cajas del periodo están cerradas.
- **Aves**: galpones con grupos de aves (`GrupoAves`, con `etapa`), novedades (`NovedadAves`: muerte, descarte, paso a venta, traslado). El paso a venta suma gallinas al inventario. La clasificación se registra por galpón para calcular postura y mortalidad.
- **WhatsApp**: solo enlaces `wa.me` con el mensaje listo (`src/modules/mensajes.ts`); el usuario pulsa Enviar. Nada de APIs no oficiales; si algún día se automatiza, será con la API oficial de WhatsApp Cloud.
- **Marca**: el encabezado, el login, los recibos y los reportes llevan el nombre de la empresa (`nombreEmpresa()` de `src/lib/marca.ts`, desde `EMPRESA_NOMBRE`). RP Software solo firma con "Generado con RP Software" al pie, el ícono, "Acerca de" y el pie de la app.
- Reportes en **.xlsx y PDF** (ya no hay CSV).

## Interfaz

Lee `DESIGN.md` antes de tocar pantallas. Lo esencial:

- Minimalista, muy liviana, **sin animaciones, transiciones ni desplazamiento suave** (lo anula `globals.css`; no lo quites). Sin sombras, degradados ni librerías de UI. Fuente del sistema.
- Reutiliza `Boton`, `BotonLink`, `BotonTexto`, `Campo`, `Titulo`, `Tarjeta`, `Alerta`, `Tabla`, `Vacio`, `Etiqueta`, `Vistas`, `Pestanas` de `src/components/ui.tsx`, además de `Formulario`, `Buscador`, `Paginacion` (`leerPagina`, `rango`), `SelectorDia` y las pestañas de sección de `src/components/secciones.tsx`.
- Ámbar solo para la acción principal, la pestaña activa, lo elegido y el foco; texto en tinta (nunca blanco) sobre ámbar. Rojo = deuda, verde = al día, azul = aviso, siempre con una palabra al lado.
- Texto de 16px o más (nada de `text-xs`), objetos táctiles de al menos 44px de alto. Pensado para celular: el menú baja de línea, no hay hamburguesa.
- Menú: Inicio, Mi ruta (solo repartidor), **Pedidos** (Pedidos, Rutas y liquidación, Resumen del reparto), **Contabilidad** (Ingresos, Egresos, Precios, Caja y cierre, Cartera, Por pagar, Reportes), Inventario (con Clasificación y Aves), **Usuarios** (Clientes, Proveedores, Empleados; solo crear, ver y editar).
- Páginas largas se dividen con vistas en la misma página (`?ver=`, componente `Vistas`), no con barras de anclas. Un formulario largo a la vez; lo poco frecuente va en `<details>`.
- Listas largas paginadas y con buscador; los totales van arriba, en la franja de totales.
- Textos de ayuda breves en los campos que lo necesiten.

## Base de datos

- Cambios de esquema: edita `prisma/schema.prisma` y crea la migración con `npm run db:migrate -- --name descripcion_en_espanol` (o escribe el SQL a mano en una carpeta nueva `prisma/migrations/AAAAMMDDHHMMSS_nombre/migration.sql`). CI comprueba que las migraciones coinciden exactamente con el esquema (`prisma migrate diff`).
- **Las migraciones no pueden perder datos de producción.** Para renombrar tablas o columnas usa `ALTER TABLE ... RENAME` en el SQL en lugar de borrar y crear; si hace falta transformar datos, hazlo en la misma migración. Nunca edites una migración ya publicada en `main`.
- No uses `prisma migrate reset` contra nada que no sea una base desechable; para empezar de cero en local, borra y crea la base con `dropdb`/`createdb`.
- Las migraciones se aplican solas al arrancar Docker (servicio `migrar`: `prisma migrate deploy && npm run db:seed`). El seed debe seguir siendo idempotente.
- Si cambias el esquema o una regla de negocio, revisa también `prisma/demo.ts`: duplica reglas (pagos FIFO o a un recibo, base de la caja, liquidación de rutas) y debe seguir dejando datos coherentes (existencias = suma de movimientos, saldos = ventas menos aplicaciones no anuladas, cajas y rutas cuadradas). `db:demo` continúa los ids desde el `MAX(id)` de cada tabla y se niega a correr si la base ya tiene clientes, galpones, proveedores, caja o inventario.

## Pruebas y cobertura

- Unitarias: junto al archivo (`src/modules/cartera.test.ts`, `src/lib/permisos.test.ts`).
- Integración: `src/pruebas/*.test.ts`, llaman directamente a las acciones del servidor. `entorno.ts` simula `next/headers` (cookies), `next/cache` y `next/navigation` (`redirect` lanza `Redireccion`), vacía la base y crea productos antes de cada prueba. Usa las utilidades de `src/pruebas/datos.ts`: `form({...})`, `ok(r)`, `fallo(r, /mensaje/)`, `usuario([...])`, `producto("AA")`, `cliente()`, `pedido(...)`, `deuda(...)`, `hoy()`, `ayer()`; para iniciar sesión, `comoOperacion("VENTAS")` o `entrarComo(usuario, operacion)`.
- Cobertura medida sobre `src/**/*.ts` (las pantallas `.tsx` no): mínimo **90%** de líneas, instrucciones y funciones y **85%** de ramas; si baja, CI falla. **Toda acción o ruta nueva necesita su prueba de integración**, incluidos los caminos de permiso denegado y de error del usuario.
- Nunca saltes, desactives ni marques como pendiente una prueba para que pase CI.

## CI/CD y despliegue

- `.github/workflows/ci.yml` corre en cada PR y en `main`: `prisma validate`, chequeo de migraciones contra el esquema, `typecheck`, `test:cobertura` con PostgreSQL de servicio, `build`, `npm audit` (solo informa) y build de la imagen Docker. En `main` y en etiquetas `vX.Y.Z` publica `ghcr.io/fttmatteo/rp` y `ghcr.io/fttmatteo/rp-migrar`.
- No hay despliegue automático. El servidor de producción (Windows 10) no usa GHCR: se actualiza a mano siguiendo la guía de instalación del proyecto. No hagas cambios en producción desde aquí.
- Docker Compose (`docker-compose.yml`): `db`, `migrar`, `app` (solo en `127.0.0.1:3000`), `tunel` (cloudflared) y `respaldo` (pg_dump diario en `respaldos/`). Variables en `produccion.env` (nunca se sube; plantilla en `produccion.env.example`).
- La sesión exige HTTPS en producción (cookie `secure`); `next.config.ts` pone las cabeceras de seguridad. El login se bloquea 15 minutos tras 5 fallos y usa el mismo mensaje para cualquier fallo.
- Si Docker Hub limita las descargas en el sandbox, usa las imágenes base desde `mirror.gcr.io/library/*`.

## Forma de trabajar

- Trabaja en una rama y abre PR hacia `main`; CI debe quedar en verde. Commits y PR en español, describiendo lo que el usuario verá.
- Cambios mínimos y en el estilo del código vecino: misma densidad de comentarios (comentarios cortos en español que explican el porqué), mismos nombres y mismas utilidades. No agregues dependencias sin necesidad clara.
- Si cambias algo que el usuario ve (pantallas, menú, flujos), actualiza el `README.md` cuando corresponda. El manual de usuario vive fuera del repo (Excel en los archivos del proyecto) y también hay que actualizarlo.
- Nunca subas secretos (`.env`, `produccion.env`, tokens de Cloudflare o GitHub).
