import { describe, expect, it } from "vitest";
import { actualizarCliente, crearCliente, guardarPreciosCliente } from "@/app/(app)/clientes/acciones";
import { guardarPreciosGenerales } from "@/app/(app)/precios/acciones";
import { actualizarProveedor, crearProveedor } from "@/app/(app)/proveedores/acciones";
import { actualizarUsuario, crearUsuario } from "@/app/(app)/usuarios/acciones";
import { iniciarSesion, salir } from "@/app/login/acciones";
import { seleccionarOperacion } from "@/app/operacion/acciones";
import { db } from "@/lib/db";
import { obtenerSesion, requerir } from "@/lib/sesion";
import { cookiesPrueba, Redireccion } from "@/pruebas/next";
import { comoOperacion, fallo, form, ok, producto, usuario } from "@/pruebas/datos";

const redireccion = (p: Promise<unknown>) => p.then(() => null, (e: Redireccion) => e.url);

describe("inicio de sesión", () => {
  it("con un solo acceso entra directo; con varios elige la operación", async () => {
    const u = await usuario(["VENTAS"], { usuario: "ana", clave: "clave-segura" });
    expect(await redireccion(iniciarSesion(undefined, form({ usuario: "ANA", clave: "clave-segura" })))).toBe("/");
    expect((await obtenerSesion())?.operacion).toBe("VENTAS");
    expect(await db.auditoria.count({ where: { usuarioId: u.id, accion: "login" } })).toBe(1);

    await usuario(["ADMIN", "VENTAS"], { usuario: "luis", clave: "clave-segura" });
    expect(await redireccion(iniciarSesion(undefined, form({ usuario: "luis", clave: "clave-segura" })))).toBe("/operacion");
    expect((await obtenerSesion())?.operacion).toBeNull();
    // Sin operación elegida no entra a las pantallas.
    expect(await redireccion(requerir())).toBe("/operacion");

    fallo(await seleccionarOperacion(undefined, form({ operacion: "OTRA" })), /no válida/);
    fallo(await seleccionarOperacion(undefined, form({ operacion: "REPARTIDOR" })), /Acceso denegado/);
    expect(await redireccion(seleccionarOperacion(undefined, form({ operacion: "ADMIN" })))).toBe("/");
    expect((await obtenerSesion())?.operacion).toBe("ADMIN");

    expect(await redireccion(salir())).toBe("/login");
    expect(cookiesPrueba.has("rp_sesion")).toBe(false);
    expect(await obtenerSesion()).toBeNull();
  });

  it("bloquea 15 minutos tras 5 intentos fallidos, sin revelar si el usuario existe", async () => {
    const u = await usuario(["VENTAS"], { usuario: "ana", clave: "clave-segura" });
    fallo(await iniciarSesion(undefined, form({ usuario: "ana" })), /Escribe tu usuario/);
    const noExiste = fallo(await iniciarSesion(undefined, form({ usuario: "nadie", clave: "x" })));
    for (let i = 0; i < 4; i++) expect(fallo(await iniciarSesion(undefined, form({ usuario: "ana", clave: "mala" })))).toBe(noExiste);
    expect((await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).intentosFallidos).toBe(4);
    fallo(await iniciarSesion(undefined, form({ usuario: "ana", clave: "mala" })));
    const bloqueado = await db.usuario.findUniqueOrThrow({ where: { id: u.id } });
    expect(bloqueado.bloqueadoHasta!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    // Ni con la clave correcta mientras dure el bloqueo.
    expect(fallo(await iniciarSesion(undefined, form({ usuario: "ana", clave: "clave-segura" })))).toBe(noExiste);

    // Pasado el bloqueo entra y se limpian los intentos.
    await db.usuario.update({ where: { id: u.id }, data: { bloqueadoHasta: new Date(Date.now() - 1), intentosFallidos: 2 } });
    expect(await redireccion(iniciarSesion(undefined, form({ usuario: "ana", clave: "clave-segura" })))).toBe("/");
    expect(await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).toMatchObject({ intentosFallidos: 0, bloqueadoHasta: null });
  });

  it("un usuario inactivo no entra y su sesión deja de valer", async () => {
    await usuario(["VENTAS"], { usuario: "ana", clave: "clave-segura", activo: false });
    fallo(await iniciarSesion(undefined, form({ usuario: "ana", clave: "clave-segura" })));
    const u = await comoOperacion("VENTAS");
    expect(await obtenerSesion()).not.toBeNull();
    await db.usuario.update({ where: { id: u.id }, data: { activo: false } });
    expect(await obtenerSesion()).toBeNull();
  });

  it("si el administrador le quita el acceso, la operación activa deja de valer", async () => {
    const u = await comoOperacion("VENTAS", ["VENTAS", "REPARTIDOR"]);
    await db.usuario.update({ where: { id: u.id }, data: { accesos: ["REPARTIDOR"] } });
    expect((await obtenerSesion())?.operacion).toBeNull();
  });

  it("una sesión vencida no vale", async () => {
    await comoOperacion("VENTAS");
    await db.sesion.updateMany({ data: { expira: new Date(Date.now() - 1) } });
    expect(await obtenerSesion()).toBeNull();
  });
});

describe("usuarios", () => {
  it("el administrador crea y edita empleados", async () => {
    const admin = await comoOperacion("ADMIN");
    ok(await crearUsuario(undefined, form({ nombre: "Johan", usuario: "Johan", clave: "12345678", accesos: ["REPARTIDOR"] })));
    const johan = await db.usuario.findUniqueOrThrow({ where: { usuario: "johan" } });
    expect(johan.accesos).toEqual(["REPARTIDOR"]);
    fallo(await crearUsuario(undefined, form({ nombre: "Otro", usuario: "johan", clave: "12345678", accesos: ["VENTAS"] })), /ya existe/);
    fallo(await crearUsuario(undefined, form({ usuario: "x" })), /nombre/);
    fallo(await crearUsuario(undefined, form({ nombre: "X", usuario: "con espacio" })), /3 a 30/);
    fallo(await crearUsuario(undefined, form({ nombre: "X", usuario: "xyz", clave: "corta" })), /al menos 8/);
    fallo(await crearUsuario(undefined, form({ nombre: "X", usuario: "xyz", clave: "12345678" })), /al menos un acceso/);

    // Cambiar la clave cierra sus sesiones y levanta el bloqueo.
    await db.sesion.create({ data: { id: "s", usuarioId: johan.id, expira: new Date(Date.now() + 60_000) } });
    await db.usuario.update({ where: { id: johan.id }, data: { intentosFallidos: 3 } });
    ok(await actualizarUsuario(johan.id, undefined, form({ nombre: "Johan R", accesos: ["REPARTIDOR", "VENTAS"], activo: true, clave: "nueva-clave" })));
    expect(await db.usuario.findUniqueOrThrow({ where: { id: johan.id } })).toMatchObject({ nombre: "Johan R", accesos: ["VENTAS", "REPARTIDOR"], intentosFallidos: 0 });
    expect(await db.sesion.count({ where: { usuarioId: johan.id } })).toBe(0);
    fallo(await actualizarUsuario(johan.id, undefined, form({ nombre: "J", accesos: ["VENTAS"], clave: "corta" })), /al menos 8/);
    fallo(await actualizarUsuario(johan.id, undefined, form({ accesos: ["VENTAS"] })), /nombre/);

    // Nadie se quita a sí mismo el acceso de administrador.
    fallo(await actualizarUsuario(admin.id, undefined, form({ nombre: "Yo", accesos: ["VENTAS"], activo: true })), /a ti mismo/);
    fallo(await actualizarUsuario(admin.id, undefined, form({ nombre: "Yo", accesos: ["ADMIN"] })), /a ti mismo/);
  });

  it("ventas no administra usuarios", async () => {
    await comoOperacion("VENTAS");
    expect(await redireccion(crearUsuario(undefined, form()))).toBe("/sin-acceso");
  });
});

describe("clientes, precios y proveedores", () => {
  it("crea y actualiza clientes con su ubicación", async () => {
    await comoOperacion("VENTAS");
    const url = await redireccion(crearCliente(undefined, form({ nombre: "Doña Rosa", diasCredito: 8, latitud: "4,6097", longitud: "-74.08", cupoCredito: "200.000", zona: "Centro" })));
    const c = await db.cliente.findFirstOrThrow();
    expect(url).toBe(`/clientes/${c.id}?creado=1`);
    expect(c).toMatchObject({ nombre: "Doña Rosa", diasCredito: 8, latitud: 4.6097, longitud: -74.08, cupoCredito: 200_000, zona: "Centro" });
    fallo(await crearCliente(undefined, form({ diasCredito: 1 })), /nombre del cliente/);
    fallo(await crearCliente(undefined, form({ nombre: "X" })), /días de crédito/);
    fallo(await crearCliente(undefined, form({ nombre: "X", diasCredito: 1, latitud: 91 })), /entre -90 y 90/);
    fallo(await crearCliente(undefined, form({ nombre: "X", diasCredito: 1, longitud: "abc" })), /escribe un número/);
    ok(await actualizarCliente(c.id, undefined, form({ nombre: "Rosa", diasCredito: 15 })));
    expect(await db.cliente.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ nombre: "Rosa", activo: false, latitud: null });
    fallo(await actualizarCliente(999, undefined, form({ nombre: "X", diasCredito: 1 })), /ya no existe/);
  });

  it("precios especiales por cliente con historial", async () => {
    await comoOperacion("ADMIN");
    const c = await db.cliente.create({ data: { nombre: "Tienda" } });
    const aa = await producto("AA");
    ok(await guardarPreciosCliente(c.id, undefined, form({ [`precio_${aa.id}`]: 17_000 })));
    ok(await guardarPreciosCliente(c.id, undefined, form({ [`precio_${aa.id}`]: 16_000 })));
    expect((await db.precioCliente.findFirstOrThrow()).precio).toBe(16_000);
    ok(await guardarPreciosCliente(c.id, undefined, form({})));
    expect(await db.precioCliente.count()).toBe(0);
    const historial = await db.historialPrecio.findMany({ orderBy: { id: "asc" } });
    expect(historial.map((h) => [h.precioAnterior, h.precioNuevo])).toEqual([[null, 17_000], [17_000, 16_000], [16_000, null]]);
    // Ventas no cambia precios.
    await comoOperacion("VENTAS");
    expect(await redireccion(guardarPreciosCliente(c.id, undefined, form()))).toBe("/sin-acceso");
  });

  it("precios generales: activar, unidad de la gallinaza y mínimo", async () => {
    await comoOperacion("ADMIN");
    const productos = await db.producto.findMany();
    const actuales = Object.fromEntries(
      productos.flatMap((p) => [
        [`general_${p.id}`, p.precioGeneral],
        [`activo_${p.id}`, p.activo],
        [`sugerido_${p.id}`, p.precioClienteSugerido ?? ""],
        [`unidad_${p.id}`, p.unidad ?? ""],
      ]),
    );
    const aa = await producto("AA");
    const gallinaza = await producto("GALLINAZA");
    fallo(await guardarPreciosGenerales(undefined, form({ ...actuales, [`activo_${gallinaza.id}`]: true })), /precio general de Gallinaza/);
    fallo(await guardarPreciosGenerales(undefined, form({ ...actuales, [`unidad_${gallinaza.id}`]: "litro" })), /unidad de la gallinaza/);
    ok(await guardarPreciosGenerales(undefined, form({ ...actuales, [`general_${aa.id}`]: 19_000, [`minimo_${aa.id}`]: 10, [`general_${gallinaza.id}`]: 8_000, [`activo_${gallinaza.id}`]: true, [`unidad_${gallinaza.id}`]: "viaje" })));
    expect(await producto("AA")).toMatchObject({ precioGeneral: 19_000, minimo: 10 });
    expect(await producto("GALLINAZA")).toMatchObject({ precioGeneral: 8_000, activo: true, unidad: "viaje" });
    expect(await db.historialPrecio.count()).toBe(2);
  });

  it("rango de peso en gramos de cada tipo de huevo", async () => {
    await comoOperacion("ADMIN");
    const productos = await db.producto.findMany();
    const actuales = Object.fromEntries(
      productos.flatMap((p) => [
        [`general_${p.id}`, p.precioGeneral],
        [`activo_${p.id}`, p.activo],
        [`sugerido_${p.id}`, p.precioClienteSugerido ?? ""],
        [`unidad_${p.id}`, p.unidad ?? ""],
      ]),
    );
    const jumbo = await producto("JUMBO");
    const aa = await producto("AA");
    const gallinaza = await producto("GALLINAZA");
    fallo(await guardarPreciosGenerales(undefined, form({ ...actuales, [`gramosMin_${aa.id}`]: 66, [`gramosMax_${aa.id}`]: 60 })), /«desde» no puede ser mayor/);
    fallo(await guardarPreciosGenerales(undefined, form({ ...actuales, [`gramosMin_${aa.id}`]: 0 })), /mayor que 0 gramos/);
    fallo(await guardarPreciosGenerales(undefined, form({ ...actuales, [`gramosMax_${aa.id}`]: "60,5" })), /solo números enteros/);
    expect(await producto("AA")).toMatchObject({ gramosMin: null, gramosMax: null });

    // Los rangos pueden cruzarse; la gallinaza no tiene peso aunque llegue en el formulario.
    ok(
      await guardarPreciosGenerales(
        undefined,
        form({ ...actuales, [`gramosMin_${jumbo.id}`]: 64, [`gramosMin_${aa.id}`]: 60, [`gramosMax_${aa.id}`]: 66, [`gramosMin_${gallinaza.id}`]: 5 }),
      ),
    );
    expect(await producto("JUMBO")).toMatchObject({ gramosMin: 64, gramosMax: null });
    expect(await producto("AA")).toMatchObject({ gramosMin: 60, gramosMax: 66 });
    expect(await producto("GALLINAZA")).toMatchObject({ gramosMin: null, gramosMax: null });
    expect(await db.historialPrecio.count()).toBe(0);
    expect(await db.auditoria.count({ where: { entidad: "Producto", accion: "precios" } })).toBe(2);

    // Vaciar los campos quita el rango.
    ok(await guardarPreciosGenerales(undefined, form(actuales)));
    expect(await producto("AA")).toMatchObject({ gramosMin: null, gramosMax: null });
  });

  it("precios generales con la página abierta en dos equipos: no se pisan los cambios de otra persona", async () => {
    await comoOperacion("ADMIN");
    const productos = await db.producto.findMany();
    // Lo que muestra la página al abrirla, con los valores de antes al lado.
    const pagina = Object.fromEntries(
      productos.flatMap((p) =>
        (
          [
            ["general", p.precioGeneral],
            ["sugerido", p.precioClienteSugerido ?? ""],
            ["minimo", p.minimo ?? ""],
            ["activo", p.activo ? "on" : null],
            ["unidad", p.tipo === "GALLINAZA" ? (p.unidad ?? "bulto") : null],
          ] as const
        ).flatMap(([c, v]) => [
          [`${c}_${p.id}`, v],
          [`antes_${c}_${p.id}`, v],
        ]),
      ),
    );
    const aa = await producto("AA");
    const a = await producto("A");
    // Un equipo cambia AA; el otro, con la página vieja, cambia solo A.
    ok(await guardarPreciosGenerales(undefined, form({ ...pagina, [`general_${aa.id}`]: 19_000 })));
    ok(await guardarPreciosGenerales(undefined, form({ ...pagina, [`general_${a.id}`]: 16_000 })));
    expect((await producto("AA")).precioGeneral).toBe(19_000);
    expect((await producto("A")).precioGeneral).toBe(16_000);
    // Si la página vieja cambia el mismo precio a otro valor, se avisa y no se guarda nada.
    fallo(
      await guardarPreciosGenerales(undefined, form({ ...pagina, [`general_${aa.id}`]: 21_000, [`minimo_${a.id}`]: 5 })),
      /Otra persona cambió el precio general de AA/,
    );
    expect(await producto("AA")).toMatchObject({ precioGeneral: 19_000 });
    expect((await producto("A")).minimo).toBeNull();
    expect(await db.historialPrecio.count()).toBe(2);
    // Borrar el precio general de un producto en venta no se deja; el sugerido sí se guarda.
    const jumbo = await producto("JUMBO");
    fallo(await guardarPreciosGenerales(undefined, form({ ...pagina, [`general_${jumbo.id}`]: "" })), /Escribe el precio general de Jumbo/);
    ok(await guardarPreciosGenerales(undefined, form({ ...pagina, [`sugerido_${a.id}`]: 14_000 })));
    expect(await producto("A")).toMatchObject({ precioGeneral: 16_000, precioClienteSugerido: 14_000 });
  });

  it("precios especiales con la página abierta en dos equipos", async () => {
    await comoOperacion("ADMIN");
    const c = await db.cliente.create({ data: { nombre: "Tienda" } });
    const aa = await producto("AA");
    const a = await producto("A");
    const pagina = { [`antes_precio_${aa.id}`]: "", [`antes_precio_${a.id}`]: "" };
    ok(await guardarPreciosCliente(c.id, undefined, form({ ...pagina, [`precio_${aa.id}`]: 17_000 })));
    // La página vieja solo cambia A: el precio de AA que guardó otra persona se queda.
    ok(await guardarPreciosCliente(c.id, undefined, form({ ...pagina, [`precio_${a.id}`]: 12_000 })));
    const precios = await db.precioCliente.findMany({ orderBy: { productoId: "asc" } });
    expect(new Map(precios.map((p) => [p.productoId, p.precio]))).toEqual(new Map([[aa.id, 17_000], [a.id, 12_000]]));
    fallo(await guardarPreciosCliente(c.id, undefined, form({ ...pagina, [`precio_${aa.id}`]: 16_000 })), /Otra persona cambió el precio de AA/);
    expect((await db.precioCliente.findFirstOrThrow({ where: { productoId: aa.id } })).precio).toBe(17_000);
  });

  it("proveedores", async () => {
    await comoOperacion("VENTAS");
    const url = await redireccion(crearProveedor(undefined, form({ nombre: "Granja", diasCredito: 30, telefono: "300" })));
    const p = await db.proveedor.findFirstOrThrow();
    expect(url).toBe(`/proveedores/${p.id}`);
    fallo(await crearProveedor(undefined, form({ diasCredito: 1 })), /nombre del proveedor/);
    fallo(await crearProveedor(undefined, form({ nombre: "X" })), /días de crédito/);
    ok(await actualizarProveedor(p.id, undefined, form({ nombre: "Granja Sol", diasCredito: 20, activo: true })));
    expect(await db.proveedor.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ nombre: "Granja Sol", diasCredito: 20, activo: true });
    fallo(await actualizarProveedor(p.id, undefined, form({ nombre: "" })), /nombre/);
  });
});
