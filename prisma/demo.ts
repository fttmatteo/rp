// Datos de ejemplo: varios meses de operación simulada (clientes, pedidos, rutas, cartera, caja,
// producción por grupo, compras a proveedores) para ver la app como si ya estuviera en uso.
// Cubre cada caso que la app muestra: rutas abiertas, con precierre por aprobar, devueltas y
// liquidadas (y una reabierta); la caja de ayer sin cerrar y la de hoy abierta con movimientos;
// pedidos de hoy sin tomar y atrasados; ventas en el punto; abonos a un recibo; compras vencidas,
// anuladas y por clasificar; abonos a proveedores parciales y anulados; galpones con aves en cría,
// levante, postura y aves anteriores; precios especiales que cambian o se quitan; existencias bajas.
// Solo se cargan en una base sin clientes, galpones, proveedores ni caja: nunca en producción.
// Uso: npm run db:seed && npm run db:demo   (DEMO_DIAS cambia cuántos días se simulan; 90 por defecto)
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// ---------- Azar reproducible: la misma semilla da los mismos datos ----------

let semilla = 20261006;
function azar(): number {
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = semilla;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1));
const prob = (p: number) => azar() < p;
const elegir = <T>(xs: readonly T[]): T => xs[Math.floor(azar() * xs.length)];
/** Redondea a miles hacia abajo (los pagos parciales se hacen en billetes). */
const miles = (valor: number) => Math.floor(valor / 1000) * 1000;

// ---------- Fechas: columnas @db.Date a medianoche UTC; instantes en hora de Bogotá ----------

const DIA = 86_400_000;
const HUEVOS = 30;
const hoy = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date())}T00:00:00.000Z`);
const sumar = (d: Date, dias: number) => new Date(d.getTime() + dias * DIA);
/** Instante de un día a una hora de Bogotá (UTC−5). */
const hora = (d: Date, h: number, min = 0) => new Date(d.getTime() + (h + 5) * 3_600_000 + min * 60_000);
const domingo = (d: Date) => d.getUTCDay() === 0;
const ultimoDelMes = (d: Date) => sumar(d, 1).getUTCDate() === 1;
const referencia = () => `${elegir(["Nequi", "Bancolombia", "Daviplata", "Davivienda"])} ${entre(100000, 999999)}`;

// ---------- Catálogo de la simulación ----------

const ZONAS_RUTA = [
  ["Centro", "San José", "El Prado", "Los Almendros", "Vereda La Palma"],
  ["La Floresta", "Villa Nueva", "Santa Rita", "El Carmen", "Vereda El Manzano"],
] as const;

type Tamano = "TIENDA" | "SUPER" | "RESTAURANTE" | "ASADERO" | "FINCA";
type Perfil = "CONTADO" | "TRANSFERENCIA" | "FIADO" | "MOROSO";

const NEGOCIOS: { tamano: Tamano; prefijo: string; cuantos: number }[] = [
  { tamano: "TIENDA", prefijo: "Tienda", cuantos: 55 },
  { tamano: "TIENDA", prefijo: "Minimercado", cuantos: 22 },
  { tamano: "TIENDA", prefijo: "Granero", cuantos: 12 },
  { tamano: "TIENDA", prefijo: "Autoservicio", cuantos: 12 },
  { tamano: "SUPER", prefijo: "Supermercado", cuantos: 8 },
  { tamano: "RESTAURANTE", prefijo: "Panadería", cuantos: 20 },
  { tamano: "RESTAURANTE", prefijo: "Restaurante", cuantos: 14 },
  { tamano: "RESTAURANTE", prefijo: "Cafetería", cuantos: 10 },
  { tamano: "ASADERO", prefijo: "Asadero", cuantos: 8 },
];
const NOMBRES = [
  "La Esquina", "Don Pedro", "Doña Rosa", "El Paisa", "La Bendición", "Mi Barrio", "El Vecino", "Las Palmas", "San Jorge",
  "El Porvenir", "La Economía", "Los Andes", "El Triunfo", "Santa Lucía", "La 14", "El Buen Precio", "Doña Marta", "Don Chucho",
  "La Fe", "El Progreso", "Villa Real", "La Granja", "El Rincón", "Los Primos", "La Abundancia", "El Sol", "La Estrella",
  "Don Fabio", "Doña Inés", "El Llanero", "La Sazón", "El Fogón", "Mi Pueblo", "La Cosecha", "Los Compadres",
  "Doña Gloria", "Don Hernán", "Doña Luz", "Don Álvaro", "Doña Carmen", "Don Jairo", "Doña Amparo", "Don Óscar", "Doña Fanny",
  "Don Rubén", "La Victoria", "El Cafetal", "La Pradera", "Los Pinos", "El Edén", "La Primavera", "San Martín", "El Bosque",
  "La Montaña", "Doña Blanca", "Don Gustavo", "La Unión", "El Recreo", "Santa Fe", "La Riviera",
];
const FINCAS = ["Finca El Retiro", "Vivero Las Orquídeas", "Finca La Esperanza", "Cultivos San Rafael", "Finca Los Naranjos", "Vivero El Jardín"];
const MOTIVOS_NO_ENTREGA = ["Tienda cerrada", "El cliente no estaba", "No tenía con qué pagar", "Pidió dejarlo para otro día"];

/** Lo que pide cada tipo de negocio: [código, probabilidad de pedirlo, mínimo, máximo] en cubetas o unidades. */
const CANASTA: Record<Tamano, [string, number, number, number][]> = {
  TIENDA: [["AA", 0.85, 1, 3], ["A", 0.65, 1, 3], ["B", 0.3, 1, 2], ["AAA", 0.25, 1, 2], ["JUMBO", 0.04, 1, 1]],
  SUPER: [["AA", 1, 6, 12], ["A", 0.9, 4, 10], ["AAA", 0.8, 3, 6], ["B", 0.6, 2, 5], ["JUMBO", 0.35, 1, 2]],
  RESTAURANTE: [["A", 0.8, 2, 5], ["B", 0.6, 1, 4], ["AA", 0.4, 1, 3]],
  ASADERO: [["GALLINA", 0.95, 4, 10], ["A", 0.4, 1, 3]],
  FINCA: [["GALLINAZA", 1, 3, 8]],
};
/** Probabilidad de que el cliente pida en un día de reparto. */
const FRECUENCIA: Record<Tamano, [number, number]> = {
  TIENDA: [0.35, 0.7],
  SUPER: [0.8, 0.95],
  RESTAURANTE: [0.4, 0.7],
  ASADERO: [0.3, 0.5],
  FINCA: [0.1, 0.2],
};

// Precios antes del alza a mitad del periodo (el resto no cambió).
const PRECIO_ANTERIOR: Record<string, number> = { AAA: 19000, AA: 17000, A: 14000 };
// Reparto de la producción por tipo de huevo en un grupo adulto.
const REPARTO_HUEVO: [string, number][] = [["JUMBO", 0.015], ["AAA", 0.1], ["AA", 0.34], ["A", 0.375], ["B", 0.17]];

/** Postura esperada según la edad: sube hasta el pico (semanas 26 a 32) y baja despacio. */
function curvaPostura(semanas: number): number {
  if (semanas < 18) return 0;
  if (semanas < 26) return 0.25 + ((semanas - 18) / 8) * 0.68;
  if (semanas <= 32) return 0.93;
  return Math.max(0.55, 0.93 - (semanas - 32) * 0.0055);
}

// ---------- Utilidades para insertar ----------

async function enLotes<T>(filas: T[], crear: (data: T[]) => Promise<unknown>) {
  for (let i = 0; i < filas.length; i += 2000) await crear(filas.slice(i, i + 2000));
}

const TABLAS_CON_ID = [
  "Usuario", "Cliente", "HistorialPrecio", "Galpon", "GrupoAves", "NovedadAves", "Proveedor", "Compra", "PagoProveedor", "Ruta", "Pedido",
  "DetallePedido", "Venta", "Pago", "MovimientoCaja", "RegistroClasificacion", "MovimientoInventario", "Auditoria",
];

async function main() {
  const dias = Number(process.env.DEMO_DIAS ?? 90);
  if (!Number.isInteger(dias) || dias < 7 || dias > 400) throw new Error("DEMO_DIAS debe ser un número de días entre 7 y 400.");
  const clave = process.env.DEMO_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
  if (!clave || clave.length < 8) throw new Error("Define DEMO_PASSWORD (mínimo 8 caracteres): es la clave de los usuarios de ejemplo.");

  const [clientes, galpones, proveedores, cajas, movimientos] = await Promise.all([
    db.cliente.count(),
    db.galpon.count(),
    db.proveedor.count(),
    db.caja.count(),
    db.movimientoInventario.count(),
  ]);
  if (clientes + galpones + proveedores + cajas + movimientos > 0)
    throw new Error(
      "La base ya tiene datos (clientes, galpones, proveedores, caja o inventario). Los datos de ejemplo solo se cargan en una base vacía, por ejemplo después de `npx prisma migrate reset`.",
    );
  const admin = await db.usuario.findUnique({ where: { usuario: "admin" } });
  const productos = new Map((await db.producto.findMany()).map((p) => [p.codigo, p]));
  const codigos = ["JUMBO", "AAA", "AA", "A", "B", "GALLINA", "GALLINAZA"];
  if (!admin || codigos.some((c) => !productos.has(c))) throw new Error("Faltan los productos o el usuario admin: corre primero `npm run db:seed`.");
  const prod = (codigo: string) => productos.get(codigo)!;

  const inicio = sumar(hoy, -dias);
  const diaAlza = sumar(inicio, Math.floor(dias / 2));
  // Último día de reparto antes de hoy: su caja queda sin cerrar y una ruta sin liquidar.
  const ayer = domingo(sumar(hoy, -1)) ? sumar(hoy, -2) : sumar(hoy, -1);
  const mismoDia = (a: Date, b: Date) => a.getTime() === b.getTime();
  /** El día de reparto más cercano a `inicio + n` (si cae domingo, el lunes). */
  const diaHabil = (n: number) => (domingo(sumar(inicio, n)) ? sumar(inicio, n + 1) : sumar(inicio, n));
  // Días con casos puntuales.
  const diaClasifAnulada = diaHabil(Math.floor(dias * 0.15));
  const diaRutaReabierta = diaHabil(Math.floor(dias * 0.2));
  const diaCompraAnulada = diaHabil(Math.floor(dias * 0.25));
  const diaPagoProvAnulado = diaHabil(Math.floor(dias * 0.4));
  const diaCambioPrecios = diaHabil(Math.floor(dias / 2) + 5);
  // Una semana de vacaciones de Andrés: Diana hace su ruta.
  const inicioVacaciones = sumar(inicio, Math.floor(dias * 0.3));
  const deVacaciones = (d: Date) => d >= inicioVacaciones && d < sumar(inicioVacaciones, 7);
  // Huevos La Pradera: la última compra a crédito no se le paga y queda vencida.
  const diaPraderaVencida = sumar(hoy, -20 - ((sumar(hoy, -20).getUTCDay() + 4) % 7)); // miércoles
  // Avícola El Llano vendió las primeras semanas y luego se dejó de usar.
  const finLlano = sumar(inicio, Math.min(21, Math.floor(dias / 2)));

  // ---------- Usuarios (se guardan junto con todo lo demás, al final) ----------
  const claveHash = await bcrypt.hash(clave, 10);
  const usuarios: Prisma.UsuarioCreateManyInput[] = [];
  // Cada tabla sigue desde su id más alto: la base puede traer usuarios o auditoría del seed o de haber usado la app.
  const ids: Record<string, number> = {};
  for (const tabla of TABLAS_CON_ID) {
    const [{ max }] = await db.$queryRawUnsafe<{ max: number | null }[]>(`SELECT MAX("id")::int AS max FROM "${tabla}"`);
    ids[tabla] = max ?? 0;
  }
  const nuevoId = (tabla: string) => (ids[tabla] = (ids[tabla] ?? 0) + 1);
  const nuevoUsuario = (nombre: string, usuario: string, accesos: ("VENTAS" | "REPARTIDOR")[], activo = true) => {
    const fila = { id: nuevoId("Usuario"), nombre, usuario, claveHash, accesos, activo, creadoEn: sumar(inicio, -10) };
    usuarios.push(fila);
    return fila;
  };
  const ventas = nuevoUsuario("Laura Gómez", "laura", ["VENTAS"]);
  const repartidores = [nuevoUsuario("Carlos Rivera", "carlos", ["REPARTIDOR"]), nuevoUsuario("Andrés Muñoz", "andres", ["REPARTIDOR"])];
  // La clasificación y las aves las registra el administrador.
  const galponero = admin;
  // Diana hace caja y reemplaza a un repartidor cuando falta.
  const diana = nuevoUsuario("Diana Ruiz", "diana", ["VENTAS", "REPARTIDOR"]);
  nuevoUsuario("Pedro Gil", "pedro", ["REPARTIDOR"], false);
  if (await db.usuario.count({ where: { usuario: { in: usuarios.map((u) => u.usuario) } } }))
    throw new Error("Ya existen usuarios con los nombres de los de ejemplo (laura, carlos, andres, diana, pedro).");

  // Gallinaza en venta y mínimos para las alertas de existencias bajas.
  const PRECIO_GALLINAZA = 9000;
  const MINIMOS: Record<string, number> = { JUMBO: 5, AAA: 15, AA: 40, A: 30, B: 15, GALLINA: 20, GALLINAZA: 10 };
  const precioGeneral = (codigo: string, dia: Date) =>
    codigo === "GALLINAZA" ? PRECIO_GALLINAZA : dia < diaAlza && PRECIO_ANTERIOR[codigo] ? PRECIO_ANTERIOR[codigo] : prod(codigo).precioGeneral;

  // ---------- Filas a insertar ----------
  const filas = {
    clientes: [] as Prisma.ClienteCreateManyInput[],
    preciosCliente: [] as Prisma.PrecioClienteCreateManyInput[],
    historial: [] as Prisma.HistorialPrecioCreateManyInput[],
    galpones: [] as Prisma.GalponCreateManyInput[],
    grupos: [] as Prisma.GrupoAvesCreateManyInput[],
    novedades: [] as Prisma.NovedadAvesCreateManyInput[],
    registros: [] as Prisma.RegistroClasificacionCreateManyInput[],
    detallesClasif: [] as Prisma.DetalleClasificacionCreateManyInput[],
    movimientos: [] as Prisma.MovimientoInventarioCreateManyInput[],
    proveedores: [] as Prisma.ProveedorCreateManyInput[],
    compras: [] as (Prisma.CompraCreateManyInput & { id: number; saldo: number; porClasificar: number })[],
    detallesCompra: [] as Prisma.DetalleCompraCreateManyInput[],
    pagosProveedor: [] as Prisma.PagoProveedorCreateManyInput[],
    aplicacionesProveedor: [] as Prisma.AplicacionPagoProveedorCreateManyInput[],
    cajas: [] as Prisma.CajaCreateManyInput[],
    movimientosCaja: [] as Prisma.MovimientoCajaCreateManyInput[],
    rutas: [] as Prisma.RutaCreateManyInput[],
    pedidos: [] as Prisma.PedidoCreateManyInput[],
    detallesPedido: [] as Prisma.DetallePedidoCreateManyInput[],
    ventas: [] as (Prisma.VentaCreateManyInput & { id: number; saldo: number; fecha: Date })[],
    pagos: [] as Prisma.PagoCreateManyInput[],
    aplicaciones: [] as Prisma.AplicacionPagoCreateManyInput[],
    auditoria: [] as Prisma.AuditoriaCreateManyInput[],
  };
  /** Rastro de las acciones que no dejan otra huella (precierre devuelto, liquidación reabierta). */
  const auditoria = (fecha: Date, usuarioId: number, entidad: string, entidadId: number, accion: string, detalle: Prisma.InputJsonValue) =>
    filas.auditoria.push({ id: nuevoId("Auditoria"), fecha, usuarioId, entidad, entidadId: String(entidadId), accion, detalle });
  let consecutivoVenta = 0;
  let consecutivoPago = 0;

  // Inventario simulado (huevos para cubetas, unidades para lo demás); nunca baja de cero.
  const stock = new Map<number, number>();
  const mover = (m: Omit<Prisma.MovimientoInventarioCreateManyInput, "id">) => {
    filas.movimientos.push({ id: nuevoId("MovimientoInventario"), ...m });
    stock.set(m.productoId, (stock.get(m.productoId) ?? 0) + m.cantidad);
  };

  // ---------- Clientes ----------
  interface ClienteDemo {
    id: number;
    nombre: string;
    zona: string;
    ruta: number;
    tamano: Tamano;
    perfil: Perfil;
    frecuencia: number;
    diasCredito: number;
    activo: boolean;
    precios: Map<string, number>;
    deudas: (typeof filas.ventas)[number][];
  }
  const lista: ClienteDemo[] = [];
  const usados = new Set<string>();
  const calles = ["Calle", "Carrera", "Diagonal", "Transversal"];
  const agregarCliente = (nombre: string, tamano: Tamano, zona: string, ruta: number) => {
    const id = nuevoId("Cliente");
    const perfil: Perfil =
      tamano === "SUPER" ? elegir(["TRANSFERENCIA", "FIADO"] as const) : elegir(["CONTADO", "CONTADO", "CONTADO", "CONTADO", "TRANSFERENCIA", "FIADO", "FIADO", "FIADO", "MOROSO"] as const);
    const diasCredito = tamano === "SUPER" ? 30 : elegir([8, 15, 15, 15, 30]);
    const activo = !prob(0.03);
    const [fmin, fmax] = FRECUENCIA[tamano];
    const cliente: ClienteDemo = { id, nombre, zona, ruta, tamano, perfil, frecuencia: fmin + azar() * (fmax - fmin), diasCredito, activo, precios: new Map(), deudas: [] };
    const conGps = prob(0.6);
    filas.clientes.push({
      id,
      nombre,
      telefono: prob(0.92) ? `3${entre(0, 2)}${entre(0, 9)}${entre(1000000, 9999999)}` : null,
      direccion: `${elegir(calles)} ${entre(1, 80)} # ${entre(1, 60)}-${entre(2, 99)}`,
      zona,
      latitud: conGps ? 4.8133 + (azar() - 0.5) * 0.06 : null,
      longitud: conGps ? -75.6961 + (azar() - 0.5) * 0.06 : null,
      notas: prob(0.15) ? elegir(["Entregar por la puerta de atrás", "Llamar antes de llegar", "Recibe solo en la mañana", "Paga los viernes"]) : null,
      // Los morosos también tienen cupo: varios lo pasan y la app lo advierte al tomar el pedido.
      cupoCredito: perfil === "FIADO" ? elegir([300000, 500000, 800000, 1000000, 1500000]) : perfil === "MOROSO" ? elegir([200000, 300000]) : null,
      diasCredito,
      activo,
      creadoEn: hora(sumar(inicio, -entre(1, 20)), entre(8, 16)),
    });
    // Precio especial: uno de cada cuatro clientes de huevo, y los asaderos en gallina.
    const especiales: [string, number][] = [];
    if (tamano !== "FINCA" && tamano !== "ASADERO" && prob(0.25)) especiales.push(["AA", prod("AA").precioClienteSugerido!], ["A", prod("A").precioClienteSugerido!]);
    if (tamano === "ASADERO" && prob(0.6)) especiales.push(["GALLINA", prod("GALLINA").precioClienteSugerido!]);
    for (const [codigo, precio] of especiales) {
      cliente.precios.set(codigo, precio);
      filas.preciosCliente.push({ clienteId: id, productoId: prod(codigo).id, precio });
      filas.historial.push({
        id: nuevoId("HistorialPrecio"),
        fecha: hora(sumar(inicio, -1), 10),
        productoId: prod(codigo).id,
        clienteId: id,
        precioAnterior: null,
        precioNuevo: precio,
        usuarioId: admin.id,
      });
    }
    lista.push(cliente);
  };
  for (const negocio of NEGOCIOS) {
    for (let i = 0; i < negocio.cuantos; i++) {
      let nombre = `${negocio.prefijo} ${elegir(NOMBRES)}`;
      while (usados.has(nombre)) nombre = `${negocio.prefijo} ${elegir(NOMBRES)}`;
      usados.add(nombre);
      const ruta = entre(0, 1);
      agregarCliente(nombre, negocio.tamano, elegir(ZONAS_RUTA[ruta].slice(0, 4)), ruta);
    }
  }
  FINCAS.forEach((nombre, i) => agregarCliente(nombre, "FINCA", ZONAS_RUTA[i % 2][4], i % 2));
  // Consumidor final: quien compra una vez en el punto y no está registrado. No está en ninguna ruta ni en la lista de clientes.
  const final: ClienteDemo = {
    id: nuevoId("Cliente"), nombre: "Consumidor final", zona: "", ruta: -1, tamano: "TIENDA", perfil: "CONTADO",
    frecuencia: 0, diasCredito: 0, activo: true, precios: new Map(), deudas: [],
  };
  filas.clientes.push({ id: final.id, nombre: final.nombre, diasCredito: 0, consumidorFinal: true, creadoEn: hora(sumar(inicio, -20), 8) });

  // Alza de precios generales a mitad del periodo.
  for (const [codigo, anterior] of Object.entries(PRECIO_ANTERIOR)) {
    filas.historial.push({
      id: nuevoId("HistorialPrecio"),
      fecha: hora(diaAlza, 7),
      productoId: prod(codigo).id,
      clienteId: null,
      precioAnterior: anterior,
      precioNuevo: prod(codigo).precioGeneral,
      usuarioId: admin.id,
    });
  }

  // ---------- Cartera: ventas, pagos y su aplicación ----------
  /** Las transferencias viejas ya se confirmaron en el banco; las de ayer, algunas; las de hoy, ninguna. */
  const verificacion = (dia: Date, fecha: Date) =>
    dia < sumar(hoy, -2) || (dia < hoy && prob(0.5)) ? new Date(Math.min(fecha.getTime() + entre(1, 20) * 3_600_000, Date.now())) : null;
  const crearVenta = (c: ClienteDemo, datos: { fecha: Date; total: number; usuarioId: number; pedidoId?: number; tipo?: "SALDO_INICIAL"; nota?: string }) => {
    const dia = new Date(Date.UTC(datos.fecha.getUTCFullYear(), datos.fecha.getUTCMonth(), datos.fecha.getUTCDate()));
    const venta = {
      id: nuevoId("Venta"),
      consecutivo: ++consecutivoVenta,
      tipo: datos.tipo ?? ("VENTA" as const),
      pedidoId: datos.pedidoId ?? null,
      clienteId: c.id,
      fecha: datos.fecha,
      total: datos.total,
      saldo: datos.total,
      vence: sumar(dia, c.diasCredito),
      usuarioId: datos.usuarioId,
      nota: datos.nota ?? null,
    };
    filas.ventas.push(venta);
    c.deudas.push(venta);
    return venta;
  };
  const deudaDe = (c: ClienteDemo) => c.deudas.reduce((s, v) => s + v.saldo, 0);
  /** Pago aplicado primero al recibo elegido (si hay) y lo demás a la deuda más antigua, como en la app. */
  const pagar = (
    c: ClienteDemo,
    d: { dia: Date; fecha: Date; valor: number; medio: "EFECTIVO" | "TRANSFERENCIA"; usuarioId: number; rutaId?: number; ventaId?: number },
  ) => {
    const valor = Math.min(d.valor, deudaDe(c));
    if (valor <= 0) return null;
    const pagoId = nuevoId("Pago");
    const orden = [...c.deudas.filter((v) => v.id === d.ventaId), ...c.deudas.filter((v) => v.id !== d.ventaId)];
    let restante = valor;
    for (const venta of orden) {
      if (restante === 0) break;
      const aplicado = Math.min(venta.saldo, restante);
      venta.saldo -= aplicado;
      restante -= aplicado;
      filas.aplicaciones.push({ pagoId, ventaId: venta.id, valor: aplicado });
    }
    c.deudas = c.deudas.filter((v) => v.saldo > 0);
    const transferencia = d.medio === "TRANSFERENCIA";
    filas.pagos.push({
      id: pagoId,
      consecutivo: ++consecutivoPago,
      clienteId: c.id,
      fecha: d.fecha,
      dia: d.dia,
      valor,
      medio: d.medio,
      referencia: transferencia ? referencia() : null,
      usuarioId: d.usuarioId,
      rutaId: d.rutaId ?? null,
      verificadoEn: transferencia ? verificacion(d.dia, d.fecha) : null,
    });
    return { valor, medio: d.medio, pagoId };
  };
  /** Anula un pago equivocado: sus abonos vuelven a la deuda. */
  const anularPago = (c: ClienteDemo, pagoId: number) => {
    const pago = filas.pagos.find((p) => p.id === pagoId)!;
    pago.anulado = true;
    pago.nota = "Valor mal digitado";
    for (const a of filas.aplicaciones.filter((x) => x.pagoId === pagoId)) {
      const venta = filas.ventas.find((v) => v.id === a.ventaId)!;
      if (venta.saldo === 0) c.deudas.push(venta);
      venta.saldo += a.valor;
    }
    c.deudas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.id - b.id);
  };

  // Deudas que algunos clientes traían antes de usar la app.
  for (const c of lista.filter((c) => c.perfil === "FIADO" || c.perfil === "MOROSO")) {
    if (prob(0.5)) {
      crearVenta(c, {
        fecha: hora(sumar(inicio, -1), 12),
        total: entre(5, 40) * 10000,
        usuarioId: admin.id,
        tipo: "SALDO_INICIAL",
        nota: "Deuda del cuaderno anterior",
      });
    }
  }

  // ---------- Galpones y grupos de aves ----------
  interface GrupoDemo {
    id: number;
    galpon: string;
    ingreso: Date;
    edadIngreso: number;
    vivas: number;
    postura: boolean;
    paraVenta: boolean; // aves viejas que se van vendiendo como gallina
  }
  const grupos: GrupoDemo[] = [];
  const agregarGalpon = (nombre: string, capacidad: number, activo = true) => {
    const id = nuevoId("Galpon");
    filas.galpones.push({ id, nombre, capacidad, activo, creadoEn: sumar(inicio, -600) });
    return id;
  };
  // Cada grupo son las aves que entraron a un galpón; en pantalla solo se ve el galpón.
  const agregarGrupo = (galponId: number, raza: string, ingreso: Date, edadIngreso: number, cantidad: number, etapa: "CRIA" | "LEVANTE" | "POSTURA", paraVenta = false) => {
    const id = nuevoId("GrupoAves");
    const galpon = filas.galpones.find((g) => g.id === galponId)!.nombre;
    filas.grupos.push({ id, galponId, raza, fechaIngreso: ingreso, edadIngresoSemanas: edadIngreso, cantidadInicial: cantidad, etapa, creadoEn: hora(ingreso, 9) });
    const grupo = { id, galpon, ingreso, edadIngreso, vivas: cantidad, postura: etapa === "POSTURA", paraVenta };
    grupos.push(grupo);
    return grupo;
  };
  agregarGrupo(agregarGalpon("Galpón 1", 4500), "Hy-Line Brown", sumar(inicio, -280), 16, 4000, "POSTURA");
  agregarGrupo(agregarGalpon("Galpón 2", 4000), "Lohmann Brown", sumar(inicio, -170), 16, 3500, "POSTURA");
  agregarGrupo(agregarGalpon("Galpón 3", 4000), "Hy-Line Brown", sumar(inicio, -45), 17, 3300, "POSTURA");
  const grupoViejo = agregarGrupo(agregarGalpon("Galpón 4", 3000), "Isa Brown", sumar(inicio, -520), 18, 2700, "POSTURA", true);
  // Pollitas que llegaron hace diez semanas: en levante, todavía sin postura.
  agregarGrupo(agregarGalpon("Galpón 5 (levante)", 3500), "Lohmann Brown", sumar(hoy, -70), 1, 3000, "LEVANTE");
  const galponCria = agregarGalpon("Galpón 6 (cría)", 3500);
  agregarGalpon("Galpón viejo (fuera de uso)", 2000, false);
  const diaPollitas = sumar(inicio, Math.floor(dias * 0.6));
  const edadSemanas = (l: GrupoDemo, d: Date) => l.edadIngreso + Math.floor((d.getTime() - l.ingreso.getTime()) / DIA / 7);

  // ---------- Proveedores ----------
  const proveedor = (nombre: string, telefono: string, diasCredito: number, notas: string | null, activo = true) => {
    const id = nuevoId("Proveedor");
    filas.proveedores.push({ id, nombre, telefono, diasCredito, notas, activo, creadoEn: sumar(inicio, -30) });
    return { id, nombre, diasCredito };
  };
  const sanLuis = proveedor("Avícola San Luis", "3104567890", 15, "Entrega clasificado, a crédito");
  const elEden = proveedor("Granja El Edén", "3127654321", 0, "Huevo sin clasificar, se paga de contado");
  const pradera = proveedor("Huevos La Pradera", "3159876543", 8, null);
  const llano = proveedor("Avícola El Llano", "3201112233", 0, "Ya no se le compra: el huevo llegaba muy sucio", false);

  // ---------- Inventario inicial ----------
  const INICIAL: Record<string, number> = { JUMBO: 15, AAA: 40, AA: 120, A: 100, B: 40 };
  for (const [codigo, cubetas] of Object.entries(INICIAL))
    mover({ fecha: hora(sumar(inicio, -1), 17), productoId: prod(codigo).id, cantidad: cubetas * HUEVOS, tipo: "AJUSTE", nota: "Inventario inicial", usuarioId: admin.id });
  mover({ fecha: hora(sumar(inicio, -1), 17), productoId: prod("GALLINAZA").id, cantidad: 40, tipo: "AJUSTE", nota: "Inventario inicial", usuarioId: admin.id });

  // ---------- Simulación día por día ----------
  let baseCaja = 300000;
  const efectivo = { dia: 0 }; // efectivo en caja durante el día
  const pendientesClasificar: (typeof filas.compras)[number][] = [];
  let pedidosEntregados = 0;
  let pedidosParciales = 0;
  let ventasPunto = 0;
  const pedidoDe = new Map<number, (typeof filas.pedidos)[number]>();
  const reprogramados = new Map<number, { pedidoId: number; lineas: (typeof filas.detallesPedido)[number][] }>();
  const repartidoresDel = (d: Date) => [repartidores[0], deVacaciones(d) ? diana : repartidores[1]];

  for (let d = inicio; d <= hoy; d = sumar(d, 1)) {
    const esHoy = d.getTime() === hoy.getTime();
    // Cambios de precios especiales: a uno se le quitan, a otro se le baja y a una tienda se le da.
    if (mismoDia(d, diaCambioPrecios)) {
      const conEspecial = lista.filter((c) => c.activo && c.precios.has("AA"));
      const nuevo = lista.find((c) => c.activo && c.tamano === "TIENDA" && c.precios.size === 0);
      const cambios: [ClienteDemo | undefined, string, number | null][] = [
        [conEspecial[0], "AA", null],
        [conEspecial[0], "A", null],
        [conEspecial[1], "AA", 16500],
        [nuevo, "AA", 17000],
      ];
      for (const [c, codigo, precio] of cambios) {
        if (!c) continue;
        const productoId = prod(codigo).id;
        filas.historial.push({ id: nuevoId("HistorialPrecio"), fecha: hora(d, 7, 15), productoId, clienteId: c.id, precioAnterior: c.precios.get(codigo) ?? null, precioNuevo: precio, usuarioId: admin.id });
        filas.preciosCliente = filas.preciosCliente.filter((x) => !(x.clienteId === c.id && x.productoId === productoId));
        if (precio === null) c.precios.delete(codigo);
        else {
          c.precios.set(codigo, precio);
          filas.preciosCliente.push({ clienteId: c.id, productoId, precio });
        }
      }
    }
    const reparto = !domingo(d);
    const caja = { ingresosEf: 0, egresosEf: 0, cobrosEf: 0 };
    const movCaja = (m: { tipo: "INGRESO" | "EGRESO"; concepto: string; valor: number; medio: "EFECTIVO" | "TRANSFERENCIA"; fecha: Date; usuarioId: number; rutaId?: number; compraId?: number; pagoProveedorId?: number }) => {
      const transferencia = m.medio === "TRANSFERENCIA";
      filas.movimientosCaja.push({
        id: nuevoId("MovimientoCaja"),
        dia: d,
        ...m,
        verificadoEn: transferencia ? verificacion(d, m.fecha) : null,
      });
      if (m.medio === "EFECTIVO") {
        if (m.tipo === "INGRESO") caja.ingresosEf += m.valor;
        else caja.egresosEf += m.valor;
      }
    };
    efectivo.dia = baseCaja;
    // Se anota un gasto dos veces y se anula el repetido.
    const gasto = (m: Parameters<typeof movCaja>[0]) => {
      movCaja(m);
      if (prob(0.03)) {
        filas.movimientosCaja.push({ id: nuevoId("MovimientoCaja"), dia: d, ...m, anulado: true });
      }
    };

    // Aves e inventario: pasa temprano, también hoy.
    {
      // Novedades de los grupos: mortalidad diaria y, en el grupo viejo, gallinas que pasan a la venta.
      // Cuando se acaba el grupo viejo, se empieza a vender el que le sigue en edad.
      if (grupoViejo.vivas <= 0) grupos[0].paraVenta = true;
      for (const l of grupos) {
        if (l.vivas <= 0 || d < l.ingreso) continue;
        const muertes = entre(0, l.vivas > 3000 ? 3 : 2);
        if (muertes > 0) {
          filas.novedades.push({ id: nuevoId("NovedadAves"), grupoId: l.id, fecha: d, tipo: "MUERTE", cantidad: muertes, usuarioId: galponero.id, creadoEn: hora(d, 7, 30) });
          l.vivas -= muertes;
        }
        if (l.paraVenta && (d.getUTCDay() === 1 || d.getUTCDay() === 4)) {
          const cantidad = l.vivas < 200 ? l.vivas : entre(95, 125);
          const novedadId = nuevoId("NovedadAves");
          filas.novedades.push({ id: novedadId, grupoId: l.id, fecha: d, tipo: "VENTA", cantidad, usuarioId: galponero.id, creadoEn: hora(d, 5, 15), nota: "Para venta como gallina" });
          mover({ fecha: hora(d, 5, 15), productoId: prod("GALLINA").id, cantidad, tipo: "PRODUCCION", novedadId, usuarioId: galponero.id, nota: `Del ${l.galpon}` });
          l.vivas -= cantidad;
          if (prob(0.3) && l.vivas > 20) {
            const descarte = entre(5, 15);
            filas.novedades.push({ id: nuevoId("NovedadAves"), grupoId: l.id, fecha: d, tipo: "DESCARTE", cantidad: descarte, usuarioId: galponero.id, creadoEn: hora(d, 7, 50), nota: "Aves enfermas" });
            l.vivas -= descarte;
          }
        }
      }
      if (d.getTime() === sumar(inicio, 20).getTime()) {
        const [origen, destino] = [grupos[1], grupos[2]];
        filas.novedades.push({ id: nuevoId("NovedadAves"), grupoId: origen.id, grupoDestinoId: destino.id, fecha: d, tipo: "TRASLADO", cantidad: 40, usuarioId: galponero.id, creadoEn: hora(d, 8), nota: "Reubicación por espacio" });
        origen.vivas -= 40;
        destino.vivas += 40;
      }
      if (d.getTime() === sumar(inicio, 10).getTime())
        filas.novedades.push({ id: nuevoId("NovedadAves"), grupoId: grupos[0].id, fecha: d, tipo: "MUERTE", cantidad: 25, usuarioId: galponero.id, creadoEn: hora(d, 8), nota: "Se escribió en el galpón equivocado", anulada: true });
      if (d.getTime() === diaPollitas.getTime()) {
        const pollitas = agregarGrupo(galponCria, "Hy-Line Brown", d, 1, 3200, "CRIA");
        pollitas.postura = false;
      }

      // Recolección y clasificación de cada grupo en postura.
      for (const l of grupos) {
        if (!l.postura || l.vivas <= 0) continue;
        const semanas = edadSemanas(l, d);
        const huevos = Math.round(l.vivas * curvaPostura(semanas) * (0.97 + azar() * 0.05));
        if (huevos <= 0) continue;
        const rotos = Math.round(huevos * (0.005 + azar() * 0.007));
        const registroId = nuevoId("RegistroClasificacion");
        filas.registros.push({ id: registroId, fecha: d, creadoEn: hora(d, 5, entre(30, 55)), usuarioId: galponero.id, rotos, grupoId: l.id });
        // Las gallinas jóvenes ponen huevo más pequeño; las viejas, más grande.
        const sesgo = Math.max(-0.1, Math.min(0.1, (semanas - 45) * 0.004));
        let restante = huevos - rotos;
        REPARTO_HUEVO.forEach(([codigo, peso], i) => {
          const ajustado = codigo === "JUMBO" || codigo === "AAA" ? peso * (1 + sesgo * 3) : codigo === "B" ? peso * (1 - sesgo * 3) : peso;
          const cantidad = i === REPARTO_HUEVO.length - 1 ? restante : Math.min(restante, Math.round((huevos - rotos) * ajustado));
          restante -= cantidad;
          if (cantidad <= 0) return;
          filas.detallesClasif.push({ registroId, productoId: prod(codigo).id, cantidad });
          mover({ fecha: hora(d, 6), productoId: prod(codigo).id, cantidad, tipo: "PRODUCCION", clasificacionId: registroId, usuarioId: galponero.id });
        });
      }
      // Una clasificación registrada dos veces: la repetida se anula y su producción sale del inventario.
      if (mismoDia(d, diaClasifAnulada)) {
        const registroId = nuevoId("RegistroClasificacion");
        filas.registros.push({ id: registroId, fecha: d, creadoEn: hora(d, 6, 40), usuarioId: galponero.id, grupoId: grupos[0].id, nota: "Repetida" });
        for (const [codigo, cubetas] of [["AA", 40], ["A", 45]] as const) {
          filas.detallesClasif.push({ registroId, productoId: prod(codigo).id, cantidad: cubetas * HUEVOS });
          mover({ fecha: hora(d, 6, 40), productoId: prod(codigo).id, cantidad: cubetas * HUEVOS, tipo: "PRODUCCION", clasificacionId: registroId, usuarioId: galponero.id });
          mover({ fecha: hora(d, 6, 55), productoId: prod(codigo).id, cantidad: -cubetas * HUEVOS, tipo: "ANULACION", clasificacionId: registroId, nota: `Anulación de clasificación #${registroId}`, usuarioId: admin.id });
        }
      }
      // Gallinaza recogida de los galpones, los sábados.
      if (d.getUTCDay() === 6) {
        const registroId = nuevoId("RegistroClasificacion");
        const bultos = entre(40, 60);
        filas.registros.push({ id: registroId, fecha: d, creadoEn: hora(d, 6, 5), usuarioId: galponero.id, nota: "Gallinaza de los galpones" });
        filas.detallesClasif.push({ registroId, productoId: prod("GALLINAZA").id, cantidad: bultos });
        mover({ fecha: hora(d, 6, 5), productoId: prod("GALLINAZA").id, cantidad: bultos, tipo: "PRODUCCION", clasificacionId: registroId, usuarioId: galponero.id });
      }
      // Huevos que se rompen en la bodega y ajustes por conteo físico.
      if (d.getUTCDay() === 6) {
        const p = prod(elegir(["AA", "A", "B"]));
        const rotos = Math.min(stock.get(p.id) ?? 0, entre(6, 45));
        if (rotos > 0) mover({ fecha: hora(d, 6, 20), productoId: p.id, cantidad: -rotos, tipo: "ROTURA", nota: elegir(["Se cayó una arruma en la bodega", "Rotos al cargar la moto", "Cubetas mojadas"]), usuarioId: ventas.id });
      }
      if (prob(0.06)) {
        const p = prod(elegir(["AAA", "AA", "A", "B"]));
        const cantidad = elegir([-1, 1]) * entre(1, 2) * HUEVOS;
        if ((stock.get(p.id) ?? 0) + cantidad >= 0) mover({ fecha: hora(d, 6, 25), productoId: p.id, cantidad, tipo: "AJUSTE", nota: "Conteo físico de la bodega", usuarioId: admin.id });
      }
      // Huevo comprado ayer sin clasificar: se clasifica hoy.
      for (const compra of pendientesClasificar.splice(0)) {
        const registroId = nuevoId("RegistroClasificacion");
        const rotos = Math.round(compra.huevos * 0.01);
        filas.registros.push({ id: registroId, fecha: d, creadoEn: hora(d, 6, 10), usuarioId: galponero.id, rotos, compraId: compra.id, nota: "Huevo comprado" });
        let restante = compra.huevos - rotos;
        for (const [codigo, parte] of [["AAA", 0.1], ["AA", 0.4], ["A", 0.35], ["B", 0.15]] as const) {
          const cantidad = codigo === "B" ? restante : Math.round((compra.huevos - rotos) * parte);
          restante -= cantidad;
          filas.detallesClasif.push({ registroId, productoId: prod(codigo).id, cantidad });
          mover({ fecha: hora(d, 6, 10), productoId: prod(codigo).id, cantidad, tipo: "COMPRA", clasificacionId: registroId, compraId: compra.id, usuarioId: galponero.id });
        }
        compra.porClasificar = 0;
      }
    }

    if (reparto) {
      filas.cajas.push({ dia: d, base: baseCaja });

      if (!esHoy) {
        // ---------- Compras de huevo (martes y viernes) ----------
        if (d.getUTCDay() === 2 || d.getUTCDay() === 5) {
          const compraId = nuevoId("Compra");
          const detalles = [["AA", entre(30, 50)], ["A", entre(35, 60)], ["B", entre(5, 12)]] as const;
          const huevos = detalles.reduce((s, [, cubetas]) => s + cubetas * HUEVOS, 0);
          const total = detalles.reduce((s, [codigo, cubetas]) => s + cubetas * (codigo === "AA" ? 14500 : codigo === "A" ? 12000 : 9500), 0);
          filas.compras.push({ id: compraId, proveedorId: sanLuis.id, fecha: hora(d, 7), dia: d, usuarioId: ventas.id, clasificada: true, huevos, porClasificar: 0, total, saldo: total, formaPago: "CREDITO", vence: sumar(d, sanLuis.diasCredito) });
          for (const [codigo, cubetas] of detalles) {
            filas.detallesCompra.push({ compraId, productoId: prod(codigo).id, cantidad: cubetas * HUEVOS });
            mover({ fecha: hora(d, 7), productoId: prod(codigo).id, cantidad: cubetas * HUEVOS, tipo: "COMPRA", compraId, usuarioId: ventas.id });
          }
          // De vez en cuando se registra una compra equivocada y se anula.
          if (prob(0.04)) {
            const anuladaId = nuevoId("Compra");
            filas.compras.push({ id: anuladaId, proveedorId: sanLuis.id, fecha: hora(d, 7, 10), dia: d, usuarioId: ventas.id, clasificada: true, huevos: 30 * HUEVOS, porClasificar: 0, total: 30 * 14500, saldo: 0, formaPago: "CREDITO", vence: sumar(d, sanLuis.diasCredito), anulada: true, nota: "Repetida" });
            filas.detallesCompra.push({ compraId: anuladaId, productoId: prod("AA").id, cantidad: 30 * HUEVOS });
            mover({ fecha: hora(d, 7, 10), productoId: prod("AA").id, cantidad: 30 * HUEVOS, tipo: "COMPRA", compraId: anuladaId, usuarioId: ventas.id });
            mover({ fecha: hora(d, 7, 20), productoId: prod("AA").id, cantidad: -30 * HUEVOS, tipo: "ANULACION", compraId: anuladaId, nota: `Anulación de compra #${anuladaId}`, usuarioId: admin.id });
          }
          // Huevo sin clasificar de Granja El Edén, de contado.
          const edenId = nuevoId("Compra");
          const cubetasEden = entre(30, 60);
          const totalEden = cubetasEden * 12500;
          const compraEden = { id: edenId, proveedorId: elEden.id, fecha: hora(d, 7, 30), dia: d, usuarioId: ventas.id, clasificada: false, huevos: cubetasEden * HUEVOS, porClasificar: cubetasEden * HUEVOS, total: totalEden, saldo: 0, formaPago: "CONTADO" as const, vence: null };
          filas.compras.push(compraEden);
          pendientesClasificar.push(compraEden);
          const medioEden = efectivo.dia - caja.egresosEf > totalEden + 100000 ? "EFECTIVO" : "TRANSFERENCIA";
          movCaja({ tipo: "EGRESO", concepto: `Compra de huevo a ${elEden.nombre}`, valor: totalEden, medio: medioEden, fecha: hora(d, 7, 30), usuarioId: ventas.id, compraId: edenId });
        }
        // Una compra de contado que se registró dos veces: se anula y su salida de la caja también.
        if (mismoDia(d, diaCompraAnulada)) {
          const compraId = nuevoId("Compra");
          const cubetas = 40;
          filas.compras.push({ id: compraId, proveedorId: elEden.id, fecha: hora(d, 7, 35), dia: d, usuarioId: ventas.id, clasificada: false, huevos: cubetas * HUEVOS, porClasificar: cubetas * HUEVOS, total: cubetas * 12500, saldo: 0, formaPago: "CONTADO", vence: null, anulada: true, nota: "Se registró dos veces" });
          filas.movimientosCaja.push({ id: nuevoId("MovimientoCaja"), dia: d, tipo: "EGRESO", concepto: `Compra de huevo a ${elEden.nombre}`, valor: cubetas * 12500, medio: "TRANSFERENCIA", fecha: hora(d, 7, 35), usuarioId: ventas.id, compraId, anulado: true });
        }
        // Avícola El Llano: compras de contado las primeras semanas; después se dejó de usar.
        if (d < finLlano && d.getUTCDay() === 4) {
          const compraId = nuevoId("Compra");
          const detalles = [["A", entre(20, 30)], ["B", entre(10, 20)]] as const;
          const total = detalles.reduce((s, [codigo, cubetas]) => s + cubetas * (codigo === "A" ? 11500 : 9000), 0);
          filas.compras.push({ id: compraId, proveedorId: llano.id, fecha: hora(d, 7, 15), dia: d, usuarioId: ventas.id, clasificada: true, huevos: detalles.reduce((s, [, c]) => s + c * HUEVOS, 0), porClasificar: 0, total, saldo: 0, formaPago: "CONTADO", vence: null });
          for (const [codigo, cubetas] of detalles) {
            filas.detallesCompra.push({ compraId, productoId: prod(codigo).id, cantidad: cubetas * HUEVOS });
            mover({ fecha: hora(d, 7, 15), productoId: prod(codigo).id, cantidad: cubetas * HUEVOS, tipo: "COMPRA", compraId, usuarioId: ventas.id });
          }
          movCaja({ tipo: "EGRESO", concepto: `Compra de huevo a ${llano.nombre}`, valor: total, medio: "TRANSFERENCIA", fecha: hora(d, 7, 15), usuarioId: ventas.id, compraId });
        }
        // Huevos La Pradera, cada quince días, a veces de contado (las últimas, a crédito).
        if ((d.getUTCDay() === 3 && d.getUTCDate() % 14 < 7) || mismoDia(d, diaPraderaVencida)) {
          const compraId = nuevoId("Compra");
          const cubetas = entre(20, 40);
          const total = cubetas * 14000;
          const credito = d >= sumar(diaPraderaVencida, -7) || prob(0.5);
          filas.compras.push({ id: compraId, proveedorId: pradera.id, fecha: hora(d, 6, 45), dia: d, usuarioId: ventas.id, clasificada: true, huevos: cubetas * HUEVOS, porClasificar: 0, total, saldo: credito ? total : 0, formaPago: credito ? "CREDITO" : "CONTADO", vence: credito ? sumar(d, pradera.diasCredito) : null });
          filas.detallesCompra.push({ compraId, productoId: prod("AA").id, cantidad: cubetas * HUEVOS });
          mover({ fecha: hora(d, 6, 45), productoId: prod("AA").id, cantidad: cubetas * HUEVOS, tipo: "COMPRA", compraId, usuarioId: ventas.id });
          if (!credito) movCaja({ tipo: "EGRESO", concepto: `Compra de huevo a ${pradera.nombre}`, valor: total, medio: "TRANSFERENCIA", fecha: hora(d, 6, 45), usuarioId: ventas.id, compraId });
        }
        // Abonos a proveedores los lunes: se paga lo que vence esta semana, por transferencia.
        if (d.getUTCDay() === 1) {
          // A La Pradera no se le paga desde su compra vencida: queda en las alertas.
          for (const p of d > diaPraderaVencida ? [sanLuis] : [sanLuis, pradera]) {
            const porPagar = filas.compras.filter((c) => c.proveedorId === p.id && c.saldo > 0 && c.vence && c.vence <= sumar(d, 4));
            const valor = porPagar.reduce((s, c) => s + c.saldo, 0);
            if (valor === 0) continue;
            const pagoId = nuevoId("PagoProveedor");
            filas.pagosProveedor.push({ id: pagoId, proveedorId: p.id, fecha: hora(d, 9), dia: d, valor, medio: "TRANSFERENCIA", referencia: referencia(), usuarioId: admin.id });
            for (const c of porPagar) {
              filas.aplicacionesProveedor.push({ pagoId, compraId: c.id, valor: c.saldo });
              c.saldo = 0;
            }
            movCaja({ tipo: "EGRESO", concepto: `Abono a proveedor ${p.nombre}`, valor, medio: "TRANSFERENCIA", fecha: hora(d, 9), usuarioId: admin.id, pagoProveedorId: pagoId });
          }
        }
        // Los jueves, a veces un abono parcial en efectivo a la compra más reciente de San Luis (no a la más antigua).
        if (d.getUTCDay() === 4 && prob(0.5)) {
          const compra = filas.compras.filter((c) => c.proveedorId === sanLuis.id && !c.anulada && c.saldo > 0).at(-1);
          const valor = compra ? miles(Math.min(compra.saldo * 0.4, efectivo.dia - caja.egresosEf + caja.ingresosEf - 250000)) : 0;
          if (compra && valor >= 100000) {
            const pagoId = nuevoId("PagoProveedor");
            filas.pagosProveedor.push({ id: pagoId, proveedorId: sanLuis.id, fecha: hora(d, 8, 30), dia: d, valor, medio: "EFECTIVO", usuarioId: ventas.id });
            filas.aplicacionesProveedor.push({ pagoId, compraId: compra.id, valor });
            compra.saldo -= valor;
            movCaja({ tipo: "EGRESO", concepto: `Abono a proveedor ${sanLuis.nombre}`, valor, medio: "EFECTIVO", fecha: hora(d, 8, 30), usuarioId: ventas.id, pagoProveedorId: pagoId });
          }
        }
        // Un abono a proveedor con el valor equivocado: se anula y la deuda y la caja vuelven a como estaban.
        if (mismoDia(d, diaPagoProvAnulado)) {
          const compra = filas.compras.find((c) => c.proveedorId === sanLuis.id && !c.anulada && c.saldo > 0);
          if (compra) {
            const pagoId = nuevoId("PagoProveedor");
            filas.pagosProveedor.push({ id: pagoId, proveedorId: sanLuis.id, fecha: hora(d, 9, 15), dia: d, valor: compra.saldo, medio: "TRANSFERENCIA", referencia: referencia(), usuarioId: ventas.id, anulado: true });
            filas.aplicacionesProveedor.push({ pagoId, compraId: compra.id, valor: compra.saldo });
            filas.movimientosCaja.push({ id: nuevoId("MovimientoCaja"), dia: d, tipo: "EGRESO", concepto: `Abono a proveedor ${sanLuis.nombre}`, valor: compra.saldo, medio: "TRANSFERENCIA", fecha: hora(d, 9, 15), usuarioId: ventas.id, pagoProveedorId: pagoId, anulado: true });
          }
        }
        // ---------- Gastos del día ----------
        for (const r of repartidoresDel(d)) gasto({ tipo: "EGRESO", concepto: "Gasolina", valor: entre(15, 30) * 1000, medio: "EFECTIVO", fecha: hora(d, 6, 45), usuarioId: ventas.id });
        if (d.getUTCDay() === 1 || d.getUTCDay() === 4)
          movCaja({ tipo: "EGRESO", concepto: "Cuido", valor: entre(95, 110) * 104000, medio: "TRANSFERENCIA", fecha: hora(d, 9, 30), usuarioId: admin.id });
        if (d.getUTCDate() === 15 || ultimoDelMes(d) || (domingo(sumar(d, 1)) && (sumar(d, 1).getUTCDate() === 15 || ultimoDelMes(sumar(d, 1)))))
          movCaja({ tipo: "EGRESO", concepto: "Nómina", valor: 4850000, medio: "TRANSFERENCIA", fecha: hora(d, 16), usuarioId: admin.id });
        if (d.getUTCDate() === 2) movCaja({ tipo: "EGRESO", concepto: "Arriendo de la bodega", valor: 1500000, medio: "TRANSFERENCIA", fecha: hora(d, 10), usuarioId: admin.id });
        if (d.getUTCDate() === 6) movCaja({ tipo: "EGRESO", concepto: "Servicios", valor: entre(650, 900) * 1000, medio: "TRANSFERENCIA", fecha: hora(d, 10), usuarioId: admin.id });
        if (prob(0.12)) gasto({ tipo: "EGRESO", concepto: elegir(["Cubetas", "Arreglos general moto", "Materiales galpones", "Limpido", "Papel higiénico", "Guantes"]), valor: entre(60, 220) * 1000, medio: "EFECTIVO", fecha: hora(d, 11), usuarioId: ventas.id });
        if (prob(0.05)) movCaja({ tipo: "INGRESO", concepto: "Venta de costales vacíos", valor: entre(15, 40) * 1000, medio: "EFECTIVO", fecha: hora(d, 12), usuarioId: ventas.id });
      } else {
        // Hoy, temprano: huevo comprado que sigue sin clasificar, la gasolina y otro ingreso por transferencia.
        const compraId = nuevoId("Compra");
        const cubetas = entre(30, 45);
        filas.compras.push({ id: compraId, proveedorId: elEden.id, fecha: hora(d, 7, 30), dia: d, usuarioId: ventas.id, clasificada: false, huevos: cubetas * HUEVOS, porClasificar: cubetas * HUEVOS, total: cubetas * 12500, saldo: 0, formaPago: "CONTADO", vence: null });
        movCaja({ tipo: "EGRESO", concepto: `Compra de huevo a ${elEden.nombre}`, valor: cubetas * 12500, medio: "TRANSFERENCIA", fecha: hora(d, 7, 30), usuarioId: ventas.id, compraId });
        for (const r of [repartidores[0], diana]) movCaja({ tipo: "EGRESO", concepto: "Gasolina", valor: entre(15, 30) * 1000, medio: "EFECTIVO", fecha: hora(d, 6, 45), usuarioId: ventas.id });
        movCaja({ tipo: "INGRESO", concepto: "Arriendo del potrero a un vecino", valor: 350000, medio: "TRANSFERENCIA", fecha: hora(d, 8, 10), usuarioId: admin.id });
      }

      // ---------- Pedidos y rutas ----------
      // Cada repartidor toma en Mi ruta los pedidos de su zona. Hoy Carlos tomó los suyos y va entregando;
      // Diana tomó unos pocos de la otra zona, ya terminó y mandó el precierre; los demás siguen sin tomar.
      const rutas = repartidoresDel(d).map((r, i) => ({ id: nuevoId("Ruta"), fecha: d, repartidorId: r.id, nombre: r.nombre, creadaEn: hora(d, 6, 30), indice: i }));
      if (esHoy) rutas[1] = { ...rutas[1], repartidorId: diana.id, nombre: diana.nombre };
      const paradas: { cliente: ClienteDemo; pedidoId: number; ruta: (typeof rutas)[number]; orden: number; lineas: (typeof filas.detallesPedido)[number][]; instante: Date }[] = [];
      for (const ruta of rutas) {
        const clientesRuta = lista
          .filter((c) => c.activo && c.ruta === ruta.indice && (reprogramados.has(c.id) || prob(c.frecuencia)))
          .sort((a, b) => ZONAS_RUTA[ruta.indice].indexOf(a.zona as never) - ZONAS_RUTA[ruta.indice].indexOf(b.zona as never));
        let tomados = 0;
        clientesRuta.forEach((c, i) => {
          const pedidoId = nuevoId("Pedido");
          const previo = reprogramados.get(c.id);
          reprogramados.delete(c.id);
          const lineas = previo
            ? previo.lineas.map((l) => ({ ...l, id: nuevoId("DetallePedido"), pedidoId, cantidadEntregada: null as number | null }))
            : CANASTA[c.tamano]
            .filter(([, p]) => prob(p))
            .map(([codigo, , min, max]) => ({
              id: nuevoId("DetallePedido"),
              pedidoId,
              productoId: prod(codigo).id,
              cantidad: entre(min, max),
              precioUnitario: c.precios.get(codigo) ?? precioGeneral(codigo, d),
              cantidadEntregada: null as number | null,
            }));
          if (lineas.length === 0) {
            ids.Pedido--;
            return;
          }
          filas.detallesPedido.push(...lineas);
          // Algunos se cancelan antes de salir: quedan sin ruta.
          const cancelado = !esHoy && prob(0.02);
          // Sin tomar: hoy, los de la zona de Andrés (Diana solo tomó cuatro); ayer, dos que nadie entregó (quedan atrasados).
          const sinTomar =
            (esHoy && ruta.indice === 1 && (tomados >= 4 || c.tamano === "FINCA")) || (mismoDia(d, ayer) && ruta.indice === 0 && i >= clientesRuta.length - 2);
          if (!cancelado && !sinTomar) tomados++;
          filas.pedidos.push({
            id: pedidoId,
            clienteId: c.id,
            fechaEntrega: d,
            estado: cancelado ? "CANCELADO" : "PENDIENTE",
            creadoEn: hora(sumar(d, -1), entre(13, 18), entre(0, 59)),
            creadoPorId: prob(0.8) ? ventas.id : prob(0.5) ? diana.id : admin.id,
            rutaId: cancelado || sinTomar ? null : ruta.id,
            nota: previo ? `Reprogramado del pedido #${previo.pedidoId}` : prob(0.05) ? elegir(["Traer cambio de 50 mil", "Dejar con la vecina si no está", "Entregar antes de las 10"]) : null,
          });
          pedidoDe.set(pedidoId, filas.pedidos[filas.pedidos.length - 1]);
          if (!cancelado && !sinTomar) paradas.push({ cliente: c, pedidoId, ruta, orden: 0, lineas, instante: d });
        });
      }
      for (const ruta of rutas) {
        const suyas = paradas.filter((p) => p.ruta === ruta);
        suyas.forEach((p, i) => {
          p.orden = i + 1;
          // Hoy Diana sale temprano con su ruta corta.
          p.instante = esHoy && ruta.indice === 1 ? hora(d, 6, 50 + i * 25) : hora(d, 7, 30 + Math.round((i * 540) / Math.max(1, suyas.length)) + entre(0, 4));
        });
      }
      for (const p of paradas) {
        const pedido = pedidoDe.get(p.pedidoId)!;
        pedido.ordenEnRuta = p.orden;
      }

      // Abonos en la oficina de clientes con deuda: a la deuda más antigua o, a veces, a un recibo elegido.
      const eventos: { instante: Date; hacer: () => void }[] = [];
      for (const c of lista) {
        if (c.deudas.length === 0 || !prob(c.perfil === "FIADO" ? 0.08 : c.perfil === "MOROSO" ? 0.02 : 0.01)) continue;
        const instante = hora(d, entre(8, 16), entre(0, 59));
        eventos.push({
          instante,
          hacer: () => {
            const deuda = deudaDe(c);
            const valor = c.perfil === "MOROSO" ? miles(deuda * (0.2 + azar() * 0.3)) : prob(0.6) ? deuda : miles(deuda * (0.4 + azar() * 0.4));
            const medio = prob(0.5) ? "TRANSFERENCIA" : "EFECTIVO";
            const ventaId = c.deudas.length > 1 && prob(0.3) ? elegir(c.deudas.slice(1)).id : undefined;
            if (prob(0.05)) {
              const errado = pagar(c, { dia: d, fecha: instante, valor: valor * 10, medio, usuarioId: ventas.id });
              if (errado) anularPago(c, errado.pagoId);
            }
            const pago = pagar(c, { dia: d, fecha: new Date(instante.getTime() + 120_000), valor, medio, usuarioId: ventas.id, ventaId });
            if (pago?.medio === "EFECTIVO") caja.cobrosEf += pago.valor;
          },
        });
      }
      // Ventas en el punto: el cliente viene por gallinaza o gallinas y se le vende en un solo paso, sin ruta.
      if (esHoy || prob(0.35)) {
        const c = elegir(lista.filter((x) => x.activo && (x.tamano === "FINCA" || x.tamano === "ASADERO")));
        const instante = esHoy ? hora(d, 8, 15) : hora(d, entre(9, 15), entre(0, 59));
        eventos.push({
          instante,
          hacer: () => {
            const codigo = c.tamano === "FINCA" ? "GALLINAZA" : "GALLINA";
            const p = prod(codigo);
            const cantidad = Math.min(codigo === "GALLINA" ? entre(4, 12) : entre(3, 10), stock.get(p.id) ?? 0);
            if (cantidad <= 0) return;
            const precio = c.precios.get(codigo) ?? precioGeneral(codigo, d);
            const pedidoId = nuevoId("Pedido");
            filas.pedidos.push({ id: pedidoId, clienteId: c.id, fechaEntrega: d, estado: "ENTREGADO", nota: "Venta en el punto", creadoEn: instante, creadoPorId: ventas.id });
            filas.detallesPedido.push({ id: nuevoId("DetallePedido"), pedidoId, productoId: p.id, cantidad, precioUnitario: precio, cantidadEntregada: cantidad });
            const venta = crearVenta(c, { fecha: instante, total: cantidad * precio, usuarioId: ventas.id, pedidoId });
            mover({ fecha: instante, productoId: p.id, cantidad: -cantidad, tipo: "VENTA", ventaId: venta.id, usuarioId: ventas.id });
            pedidosEntregados++;
            ventasPunto++;
            // Casi siempre paga todo; a veces aprovecha para pagar lo que debía, o deja una parte fiada.
            const valor = elegir([venta.total, venta.total, venta.total, venta.total, deudaDe(c), miles(venta.total / 2)]);
            const pago = pagar(c, { dia: d, fecha: new Date(instante.getTime() + 60_000), valor, medio: prob(0.8) ? "EFECTIVO" : "TRANSFERENCIA", usuarioId: ventas.id, ventaId: venta.id });
            if (pago?.medio === "EFECTIVO") caja.cobrosEf += pago.valor;
          },
        });
      }
      // Alguien de paso compra unas cubetas o una gallina como consumidor final: paga todo, a precio general.
      if (esHoy || prob(0.5)) {
        const instante = esHoy ? hora(d, 9, 40) : hora(d, entre(8, 16), entre(0, 59));
        eventos.push({
          instante,
          hacer: () => {
            const codigo = elegir(["AA", "AA", "A", "GALLINA"]);
            const p = prod(codigo);
            const cantidad = Math.min(entre(1, 3), stock.get(p.id) ?? 0);
            if (cantidad <= 0) return;
            const precio = precioGeneral(codigo, d);
            const pedidoId = nuevoId("Pedido");
            filas.pedidos.push({ id: pedidoId, clienteId: final.id, fechaEntrega: d, estado: "ENTREGADO", nota: "Venta en el punto", creadoEn: instante, creadoPorId: ventas.id });
            filas.detallesPedido.push({ id: nuevoId("DetallePedido"), pedidoId, productoId: p.id, cantidad, precioUnitario: precio, cantidadEntregada: cantidad });
            const venta = crearVenta(final, { fecha: instante, total: cantidad * precio, usuarioId: ventas.id, pedidoId });
            mover({ fecha: instante, productoId: p.id, cantidad: -cantidad, tipo: "VENTA", ventaId: venta.id, usuarioId: ventas.id });
            pedidosEntregados++;
            ventasPunto++;
            const pago = pagar(final, { dia: d, fecha: new Date(instante.getTime() + 60_000), valor: venta.total, medio: prob(0.85) ? "EFECTIVO" : "TRANSFERENCIA", usuarioId: ventas.id, ventaId: venta.id });
            if (pago?.medio === "EFECTIVO") caja.cobrosEf += pago.valor;
          },
        });
      }
      // Entregas en orden de hora, para que los recibos queden numerados en orden.
      for (const p of paradas) {
        eventos.push({
          instante: p.instante,
          hacer: () => {
            const pedido = pedidoDe.get(p.pedidoId)!;
            const c = p.cliente;
            const repartidorId = p.ruta.repartidorId;
            if (prob(0.03)) {
              pedido.estado = "NO_ENTREGADO";
              pedido.motivoNoEntrega = elegir(MOTIVOS_NO_ENTREGA);
              if (pedido.motivoNoEntrega === MOTIVOS_NO_ENTREGA[3]) reprogramados.set(c.id, { pedidoId: p.pedidoId, lineas: p.lineas });
              // Aunque no recibió, a veces abona lo que debía al repartidor (abono en la parada).
              if (pedido.motivoNoEntrega !== MOTIVOS_NO_ENTREGA[2] && deudaDe(c) > 0 && prob(0.5)) {
                const pago = pagar(c, { dia: d, fecha: new Date(p.instante.getTime() + 60_000), valor: Math.max(1000, miles(deudaDe(c) / 2)), medio: "EFECTIVO", usuarioId: repartidorId, rutaId: p.ruta.id });
                if (pago) caja.cobrosEf += pago.valor;
              }
              return;
            }
            let parcial = false;
            for (const l of p.lineas) {
              const producto = [...productos.values()].find((x) => x.id === l.productoId)!;
              const porUnidad = producto.tipo === "CUBETA" ? HUEVOS : 1;
              const disponible = Math.floor((stock.get(l.productoId) ?? 0) / porUnidad);
              // A veces el cliente recibe menos de lo pedido; otras veces no alcanza el inventario.
              const quiere = prob(0.03) && l.cantidad > 1 ? l.cantidad - 1 : l.cantidad;
              l.cantidadEntregada = Math.min(quiere, disponible);
              if (l.cantidadEntregada < l.cantidad) parcial = true;
            }
            const total = p.lineas.reduce((s, l) => s + l.cantidadEntregada! * l.precioUnitario, 0);
            if (total === 0) {
              for (const l of p.lineas) l.cantidadEntregada = null;
              pedido.estado = "NO_ENTREGADO";
              pedido.motivoNoEntrega = "No había inventario suficiente";
              return;
            }
            pedido.estado = "ENTREGADO";
            pedidosEntregados++;
            if (parcial) pedidosParciales++;
            const venta = crearVenta(c, { fecha: p.instante, total, usuarioId: repartidorId, pedidoId: p.pedidoId });
            for (const l of p.lineas) {
              if (!l.cantidadEntregada) continue;
              const producto = [...productos.values()].find((x) => x.id === l.productoId)!;
              mover({ fecha: p.instante, productoId: l.productoId, cantidad: -l.cantidadEntregada * (producto.tipo === "CUBETA" ? HUEVOS : 1), tipo: "VENTA", ventaId: venta.id, usuarioId: repartidorId });
            }
            // Pocas veces la venta se anula el mismo día (se cargó al cliente equivocado).
            if (!esHoy && prob(0.006)) {
              Object.assign(venta, { anulada: true, saldo: 0, nota: "Se registró al cliente equivocado" });
              c.deudas = c.deudas.filter((v) => v.id !== venta.id);
              pedido.estado = "CANCELADO";
              for (const m of filas.movimientos.filter((m) => m.ventaId === venta.id))
                mover({ fecha: new Date(p.instante.getTime() + 30_000), productoId: m.productoId, cantidad: -m.cantidad, tipo: "ANULACION", ventaId: venta.id, nota: "Anulación de venta", usuarioId: admin.id });
              return;
            }
            // Lo que paga al recibir, según cómo suele pagar el cliente.
            const deuda = deudaDe(c);
            let valor = 0;
            if (c.perfil === "CONTADO" || c.perfil === "TRANSFERENCIA") valor = prob(0.9) ? deuda : 0;
            else if (c.perfil === "FIADO") {
              // Paga a ratos, pero no deja que lo vencido se acumule.
              const vencido = c.deudas.filter((v) => v.vence < d).reduce((s, v) => s + v.saldo, 0);
              valor = Math.max(vencido, deuda > total * 4 ? miles(deuda * 0.6) : elegir([deuda, deuda, total, miles(total * 0.5), 0]));
            }
            // El moroso abona menos de lo que compra; cuando la deuda crece, le cobran un pedazo.
            else valor = deuda > 600000 && prob(0.4) ? miles(deuda * 0.4) : prob(0.5) ? miles(total * (0.5 + azar() * 0.5)) : 0;
            if (valor <= 0) return;
            const medio = c.perfil === "TRANSFERENCIA" ? "TRANSFERENCIA" : prob(0.12) ? "TRANSFERENCIA" : "EFECTIVO";
            const pago = pagar(c, { dia: d, fecha: new Date(p.instante.getTime() + 60_000), valor, medio, usuarioId: repartidorId, rutaId: p.ruta.id, ventaId: venta.id });
            if (pago?.medio === "EFECTIVO") caja.cobrosEf += pago.valor;
          },
        });
      }
      // Hoy solo ha pasado la mañana: lo de después del mediodía sigue pendiente.
      eventos
        .filter((e) => !esHoy || e.instante < hora(d, 12))
        .sort((a, b) => a.instante.getTime() - b.instante.getTime())
        .forEach((e) => e.hacer());

      const efectivoRuta = (rutaId: number) => filas.pagos.filter((p) => p.rutaId === rutaId && !p.anulado && p.medio === "EFECTIVO").reduce((s, p) => s + p.valor, 0);
      const fechaRuta = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
      if (!esHoy) {
        // ---------- Precierre del repartidor y aprobación del administrador ----------
        for (const ruta of rutas) {
          const esperado = efectivoRuta(ruta.id);
          let diferencia = prob(0.08) ? elegir([-1, 1]) * entre(1, 20) * 1000 : 0;
          let observacion = diferencia === 0 ? null : diferencia < 0 ? "Dio mal un cambio" : "Un cliente no recibió las vueltas";
          // Casi siempre el repartidor manda el precierre; a veces el administrador liquida sin él.
          const precerradaEn = prob(0.9) ? hora(d, 16, 30 + ruta.indice * 15 + entre(0, 10)) : null;
          if (mismoDia(d, ayer) && ruta.indice === 1) {
            // Precierre devuelto: declaró menos efectivo, el administrador se lo devolvió y la ruta sigue abierta.
            const entregado = Math.max(0, esperado - 30000);
            filas.rutas.push({ id: ruta.id, fecha: d, repartidorId: ruta.repartidorId, creadaEn: ruta.creadaEn, observacion: "Me faltan 30 mil, no sé en qué parada" });
            auditoria(hora(d, 16, 50), ruta.repartidorId, "Ruta", ruta.id, "precierre", { esperado, entregado, diferencia: entregado - esperado });
            auditoria(hora(d, 17, 40), admin.id, "Ruta", ruta.id, "devolver", { entregado, observacion: "Me faltan 30 mil, no sé en qué parada" });
            continue;
          }
          if (mismoDia(d, diaRutaReabierta) && ruta.indice === 0) {
            // Se liquidó con un faltante; el dinero apareció, el administrador reabrió la liquidación
            // (el faltante se anula) y la volvió a aprobar sin diferencia.
            filas.movimientosCaja.push({ id: nuevoId("MovimientoCaja"), dia: d, tipo: "EGRESO", concepto: `Faltante en la liquidación de la ruta de ${ruta.nombre} (${fechaRuta})`, valor: 20000, medio: "EFECTIVO", fecha: hora(d, 17, 45), usuarioId: admin.id, rutaId: ruta.id, anulado: true });
            auditoria(hora(d, 17, 45), admin.id, "Ruta", ruta.id, "liquidar", { esperado, entregado: esperado - 20000, diferencia: -20000 });
            auditoria(hora(d, 18, 5), admin.id, "Ruta", ruta.id, "reabrir", { diferencia: -20000 });
            diferencia = 0;
            observacion = "Se reabrió: los 20 mil del faltante aparecieron en la maleta";
          }
          if (diferencia !== 0) {
            movCaja({
              tipo: diferencia < 0 ? "EGRESO" : "INGRESO",
              concepto: `${diferencia < 0 ? "Faltante" : "Sobrante"} en la liquidación de la ruta de ${ruta.nombre} (${fechaRuta})`,
              valor: Math.abs(diferencia),
              medio: "EFECTIVO",
              fecha: hora(d, 17, 45),
              usuarioId: admin.id,
              rutaId: ruta.id,
            });
          }
          filas.rutas.push({
            id: ruta.id,
            fecha: d,
            repartidorId: ruta.repartidorId,
            creadaEn: ruta.creadaEn,
            estado: "LIQUIDADA",
            efectivoEsperado: esperado,
            efectivoEntregado: esperado + diferencia,
            diferencia,
            observacion,
            precerradaEn,
            liquidadaEn: hora(d, 17, 45),
            liquidadaPorId: admin.id,
          });
        }

        // ---------- Cierre de caja: lo que sobra de efectivo se consigna ----------
        // La de ayer quedó sin cerrar: la cierra quien entre (y entonces sale el libro del mes).
        if (!mismoDia(d, ayer)) {
          let esperado = baseCaja + caja.cobrosEf + caja.ingresosEf - caja.egresosEf;
          if (esperado > 900000) {
            const consignacion = Math.floor((esperado - 400000) / 100000) * 100000;
            movCaja({ tipo: "EGRESO", concepto: "Consignación al banco", valor: consignacion, medio: "EFECTIVO", fecha: hora(d, 18), usuarioId: ventas.id });
            movCaja({ tipo: "INGRESO", concepto: "Consignación al banco", valor: consignacion, medio: "TRANSFERENCIA", fecha: hora(d, 18), usuarioId: ventas.id });
            esperado -= consignacion;
          }
          const diferencia = prob(0.07) ? elegir([-1, 1]) * entre(1, 10) * 500 : 0;
          const contado = Math.max(0, esperado + diferencia);
          const cajaDia = filas.cajas[filas.cajas.length - 1];
          Object.assign(cajaDia, {
            estado: "CERRADA",
            esperado,
            contado,
            diferencia: contado - esperado,
            observacion: contado === esperado ? null : contado < esperado ? "Faltó al contar, se revisará mañana" : "Sobró efectivo, posible cambio mal dado",
            cerradaEn: hora(d, 18, 30),
            cerradaPorId: elegir([ventas.id, ventas.id, ventas.id, diana.id, admin.id]),
          });
          baseCaja = contado;
        }
      } else {
        // Hoy: la ruta de Carlos sigue abierta; la de Diana espera la aprobación de su precierre.
        const [abierta, precerrada] = rutas;
        filas.rutas.push({ id: abierta.id, fecha: d, repartidorId: abierta.repartidorId, creadaEn: abierta.creadaEn });
        const esperado = efectivoRuta(precerrada.id);
        const entregado = Math.max(0, esperado - 5000);
        filas.rutas.push({
          id: precerrada.id,
          fecha: d,
          repartidorId: precerrada.repartidorId,
          creadaEn: precerrada.creadaEn,
          estado: "PRECERRADA",
          efectivoEsperado: esperado,
          efectivoEntregado: entregado,
          diferencia: entregado - esperado,
          observacion: entregado === esperado ? null : "Di mal unas vueltas de 5 mil",
          precerradaEn: hora(d, 9, 50),
        });
      }
    }
  }

  // Pedidos ya tomados para el próximo día de reparto (uno ya se canceló).
  const manana = domingo(sumar(hoy, 1)) ? sumar(hoy, 2) : sumar(hoy, 1);
  let cancelados = 0;
  for (const c of lista.filter((c) => c.activo && c.tamano !== "FINCA").slice(0, 200)) {
    if (!prob(0.12)) continue;
    const pedidoId = nuevoId("Pedido");
    const cancelado = cancelados++ === 0;
    filas.pedidos.push({
      id: pedidoId,
      clienteId: c.id,
      fechaEntrega: manana,
      estado: cancelado ? "CANCELADO" : "PENDIENTE",
      creadoEn: hora(hoy, 8, entre(0, 59)),
      creadoPorId: ventas.id,
      nota: cancelado ? "Llamó a cancelar: ya le llegó huevo de otro lado" : null,
    });
      for (const [codigo, , min, max] of CANASTA[c.tamano].slice(0, 2))
      filas.detallesPedido.push({ id: nuevoId("DetallePedido"), pedidoId, productoId: prod(codigo).id, cantidad: entre(min, max), precioUnitario: c.precios.get(codigo) ?? precioGeneral(codigo, manana) });
  }

  // Pedidos recurrentes: uno empieza hoy (sale por aprobar al abrir la app) y otro desde el próximo día de reparto.
  // Se eligen clientes sin pedido hoy para no duplicarles la entrega.
  const conPedidoHoy = new Set(filas.pedidos.filter((p) => +new Date(p.fechaEntrega) === +hoy).map((p) => p.clienteId));
  const recurrentes = lista
    .filter((c) => c.activo && c.tamano !== "FINCA" && !conPedidoHoy.has(c.id))
    .slice(0, 2)
    .map((c, i) => ({
      clienteId: c.id,
      diasSemana: i === 0 ? [1, 2, 3, 4, 5, 6] : [1, 4],
      desde: i === 0 ? hoy : manana,
      nota: i === 0 ? "Pedido fijo de la semana" : null,
      creadoEn: hora(sumar(hoy, -10), 9),
      creadoPorId: ventas.id,
      detalles: { create: CANASTA[c.tamano].slice(0, 2).map(([codigo, , min]) => ({ productoId: prod(codigo).id, cantidad: min })) },
    }));

  // ---------- Guardar todo ----------
  await db.$transaction(
    async (tx) => {
      await tx.usuario.createMany({ data: usuarios });
      await tx.producto.update({ where: { id: prod("GALLINAZA").id }, data: { activo: true, unidad: "bulto", precioGeneral: PRECIO_GALLINAZA } });
      // El administrador subió el mínimo de Jumbo por encima de lo que hay: sale la alerta de existencias bajas.
      MINIMOS.JUMBO = Math.max(MINIMOS.JUMBO, Math.floor((stock.get(prod("JUMBO").id) ?? 0) / HUEVOS) + 5);
      for (const [codigo, minimo] of Object.entries(MINIMOS)) await tx.producto.update({ where: { id: prod(codigo).id }, data: { minimo } });
      await enLotes(filas.clientes, (data) => tx.cliente.createMany({ data }));
      await enLotes(filas.preciosCliente, (data) => tx.precioCliente.createMany({ data }));
      await enLotes(filas.historial, (data) => tx.historialPrecio.createMany({ data }));
      await enLotes(filas.galpones, (data) => tx.galpon.createMany({ data }));
      await enLotes(filas.grupos, (data) => tx.grupoAves.createMany({ data }));
      await enLotes(filas.proveedores, (data) => tx.proveedor.createMany({ data }));
      await enLotes(filas.cajas, (data) => tx.caja.createMany({ data }));
      await enLotes(filas.rutas, (data) => tx.ruta.createMany({ data }));
      await enLotes(filas.pedidos, (data) => tx.pedido.createMany({ data }));
      await enLotes(filas.detallesPedido, (data) => tx.detallePedido.createMany({ data }));
      await enLotes(filas.ventas, (data) => tx.venta.createMany({ data }));
      await enLotes(filas.pagos, (data) => tx.pago.createMany({ data }));
      await enLotes(filas.aplicaciones, (data) => tx.aplicacionPago.createMany({ data }));
      await enLotes(filas.compras, (data) => tx.compra.createMany({ data }));
      await enLotes(filas.detallesCompra, (data) => tx.detalleCompra.createMany({ data }));
      await enLotes(filas.pagosProveedor, (data) => tx.pagoProveedor.createMany({ data }));
      await enLotes(filas.aplicacionesProveedor, (data) => tx.aplicacionPagoProveedor.createMany({ data }));
      await enLotes(filas.movimientosCaja, (data) => tx.movimientoCaja.createMany({ data }));
      await enLotes(filas.novedades, (data) => tx.novedadAves.createMany({ data }));
      await enLotes(filas.registros, (data) => tx.registroClasificacion.createMany({ data }));
      await enLotes(filas.detallesClasif, (data) => tx.detalleClasificacion.createMany({ data }));
      await enLotes(filas.movimientos, (data) => tx.movimientoInventario.createMany({ data }));
      await enLotes(filas.auditoria, (data) => tx.auditoria.createMany({ data }));
      for (const data of recurrentes) await tx.pedidoRecurrente.create({ data });
      for (const [id, existencias] of stock) await tx.producto.update({ where: { id }, data: { existencias } });
      // El grupo viejo ya se vendió completo: queda cerrado.
      if (grupoViejo.vivas <= 0) await tx.grupoAves.update({ where: { id: grupoViejo.id }, data: { activo: false, etapa: "DESCARTE" } });
      for (const [nombre, valor] of [["VENTA", consecutivoVenta], ["PAGO", consecutivoPago]] as const)
        await tx.consecutivo.upsert({ where: { nombre }, create: { nombre, valor }, update: { valor } });
      // Los ids se dieron aquí; las secuencias siguen desde el último.
      for (const tabla of TABLAS_CON_ID)
        await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${tabla}"', 'id'), GREATEST((SELECT MAX("id") FROM "${tabla}"), 1))`);
    },
    { timeout: 300_000, maxWait: 10_000 },
  );

  const cartera = filas.ventas.reduce((s, v) => s + v.saldo, 0);
  console.log(`Datos de ejemplo cargados: ${dias} días desde ${inicio.toISOString().slice(0, 10)}.`);
  console.log(
    `  ${filas.clientes.length} clientes, ${filas.pedidos.length} pedidos (${pedidosEntregados} entregados, ${pedidosParciales} parciales, ${ventasPunto} ventas en el punto), ${filas.pagos.length} pagos.`,
  );
  console.log(`  Cartera pendiente: $${cartera.toLocaleString("es-CO")}.`);
  console.log(`  Por revisar: la caja de ayer sin cerrar, una ruta de ayer devuelta sin liquidar, el precierre de Diana de hoy por aprobar,`);
  console.log(`  pedidos de hoy sin tomar y atrasados, un pedido recurrente de hoy por aprobar, una compra vencida a La Pradera y huevo comprado por clasificar.`);
  console.log(`  Usuarios: laura (ventas), carlos y andres (repartidores), diana (ventas y repartidor), con la clave de DEMO_PASSWORD.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
