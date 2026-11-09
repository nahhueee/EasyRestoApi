import db from '../db/db.config';
import { randomUUID } from 'crypto';
import { Adicional } from '../models/Adicional';
import { Categoria } from '../models/Categoria';
import { ProductoAdicional } from '../models/ProductoAdicional';
import { ProductoPrecio } from '../models/ProductoPrecio';
import { Producto } from '../models/Producto';
import { ListaPrecio } from '../models/ListaPrecio';
import { eventosRepository } from './eventosRepository';
import { query } from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
import { registrarMovimiento } from './productosMovimientosRepository';

// Columnas habilitadas para ORDER BY dinámico (whitelist). filtros.orden llega
// del cliente: no se puede concatenar directo a la query (ver ObtenerQuery).
const COLUMNAS_ORDEN_VALIDAS = ['id', 'nombre', 'idCategoria', 'cantidad'];

const SECTORES_VALIDOS = ['cocina', 'barra', 'ninguno'];

// El backend es quien decide `sector`, `controlaStock` y `tipo` de un producto
// (handoff_rework_productos_comandas.md, PR2). `tipo` se deriva de `sector` y se
// ignora el del payload: sigue existiendo solo por expand-contract.
// Si el payload no trae `sector` (front viejo, o rollback de código) se deriva de
// `tipo`: elaborado -> cocina/sin stock, terciarizado -> barra/con stock.
function resolverClasificacion(data:any){
    const legacy = data.sector === undefined || data.sector === null;

    let sector:string;
    let controlaStock:boolean;

    if(legacy){
        const esTerciarizado = data.tipo === 'terciarizado';
        sector = esTerciarizado ? 'barra' : 'cocina';
        controlaStock = esTerciarizado;
    } else {
        if(!SECTORES_VALIDOS.includes(data.sector))
            throw new AppError(CodigoError.VALIDACION, "Sector inválido: " + data.sector + ".", 400);
        sector = data.sector;
        controlaStock = data.controlaStock === true || data.controlaStock === 1;
    }

    const tipo:'elaborado' | 'terciarizado' = sector === 'cocina' ? 'elaborado' : 'terciarizado';
    return { sector, controlaStock, tipo, legacy };
}

// Stock con el que nace un producto. Un front viejo manda el stock en `cantidad`
// (no conoce `stockInicial`): se respeta para no perder el dato al crear.
function resolverStockInicial(data:any, clasificacion:{ controlaStock:boolean, legacy:boolean }):number{
    if(!clasificacion.controlaStock) return 0;

    const crudo = data.stockInicial ?? (clasificacion.legacy ? data.cantidad : 0) ?? 0;
    const stock = Number(crudo);
    if(!Number.isInteger(stock) || stock < 0)
        throw new AppError(CodigoError.VALIDACION, "El stock inicial debe ser un número entero mayor o igual a 0.", 400);

    return stock;
}

// Quién y desde dónde originó la escritura, para auditar en `eventos`. Hasta
// que exista el token de Fase 4 viaja como headers (x-usuario-id / x-puesto),
// leídos en identidadMiddleware.ts y propagados explícitamente hasta acá -
// nunca se lee "el usuario actual" desde estado global (architecture.md §9.2).
export interface ContextoAuditoria {
    idUsuario: number | null;
    puesto: string | null;
    loteId?: string | null;
    // Solo se usa al auditar una reversión (PR5/PR6): apunta al loteId que se
    // está revirtiendo. Ver eventosRepository.existeReversionDeLote/ObtenerLotes.
    loteIdOrigen?: string | null;
    observacion?: string | null;
}

class ProductoRepository{

    //#region OBTENER
    async Obtener(filtros:any){
        const connection = await db.getConnection();

        try {
            //Obtengo la query segun los filtros
            let queryRegistros = await ObtenerQuery(filtros,false);
            let queryTotal = await ObtenerQuery(filtros,true);

            //Obtengo la lista de registros y el total
            const [rows] = await connection.query(queryRegistros.sql, queryRegistros.parametros);
            const resultado = await connection.query(queryTotal.sql, queryTotal.parametros);

            const productos:Producto[] = [];

            if (Array.isArray(rows) && rows.length > 0) {
                // Precios y adicionales de toda la página en 2 queries (antes: 2 por
                // producto, N+1). Se arman en memoria con un Map<idProducto, [...]>.
                const idsProducto = rows.map((row:any) => row['id']);
                const mapaPrecios = await ObtenerPreciosProducto(connection, idsProducto);
                const mapaAdicionales = await ObtenerAdicionalesProducto(connection, idsProducto);

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    productos.push(ArmarObjeto(row, mapaPrecios, mapaAdicionales));
                }
            }

            return {total:resultado[0][0].total, registros:productos};

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async ObtenerProducto(filtros){
        const connection = await db.getConnection();

        try {
            let consulta = await ObtenerQuery(filtros,false);
            const rows = await connection.query(consulta.sql, consulta.parametros);

            const row = rows[0][0];
            const mapaPrecios = await ObtenerPreciosProducto(connection, [row['id']]);
            const mapaAdicionales = await ObtenerAdicionalesProducto(connection, [row['id']]);

            return ArmarObjeto(row, mapaPrecios, mapaAdicionales);

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }
    //#endregion

    // Sector de cada producto, para decidir a qué comanda va cada ítem sin confiar
    // en lo que mande el cliente. Un producto borrado físicamente no aparece en el mapa.
    async ObtenerSectores(ids:number[]): Promise<Map<number, string>>{
        const mapa = new Map<number, string>();
        if(ids.length === 0) return mapa;

        const connection = await db.getConnection();

        try {
            const [rows]:any = await connection.query("SELECT id, sector FROM productos WHERE id IN (?)", [ids]);
            for (const row of rows) {
                mapa.set(row['id'], row['sector']);
            }
            return mapa;

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    //#region ABM
    async Agregar(data:Producto, contexto:ContextoAuditoria): Promise<string>{
        const connection = await db.getConnection();

        try {
            let existe = await ValidarExistencia(connection, data, false);
            if(existe)//Verificamos si ya existe un producto con el mismo nombre
                return "Ya existe un producto con el mismo nombre.";

            //Iniciamos una transaccion
            await connection.beginTransaction();

            //#region INSERTAR PRODUCTO
            const clasificacion = resolverClasificacion(data);
            const stockInicial = resolverStockInicial(data, clasificacion);

            const consulta = `INSERT INTO productos(idCategoria,nombre,tipo,sector,controlaStock,imagen,cantidad,descripcion)
                              VALUES(?,?,?,?,?,?,?,?)`;

            const parametros =
                            [
                                data.categoria?.id,
                                data.nombre!.toUpperCase(),
                                clasificacion.tipo,
                                clasificacion.sector,
                                clasificacion.controlaStock ? 1 : 0,
                                data.imagen,
                                stockInicial,
                                data.descripcion
                            ];

            // El id lo asigna MySQL (AUTO_INCREMENT); se lee de insertId. Antes se
            // predecía con MAX(id)+1 (ObtenerUltimoProducto) y se usaba ese valor
            // predicho -no el real- para asociar los precios: si un producto se había
            // borrado antes, el cálculo podía no coincidir con el id real asignado
            // y los precios quedaban insertados contra un idProducto equivocado.
            const [resultado]:any = await connection.query(consulta, parametros);
            data.id = resultado.insertId;

            //Stock inicial: queda en el libro de stock, en la misma transaccion
            if(clasificacion.controlaStock){
                await registrarMovimiento(connection, {
                    idProducto: data.id,
                    motivo: 'INICIAL',
                    cantidadDelta: stockInicial,
                    cantidadResultante: stockInicial,
                    observacion: 'Stock inicial',
                    contexto
                });
            }
            //#endregion

            //Insertamos los precios por el punto único de escritura (audita PRECIO_CREAR)
            for (const precio of data.precios!) {
                precio.idProducto = data.id;
                await guardarPrecio(connection, precio, null, 'INSERT', 'PRECIO_CREAR', contexto);
            };

            //Insertamos adicionales
            await connection.query("DELETE FROM productos_adicional WHERE idProducto = ?", [data.id]);
            for (const adicional of data.adicionales!) {
                adicional.idProducto = data.id;
                await InsertAdicionalProducto(connection, adicional);
            };

            //Mandamos la transaccion
            await connection.commit();
            return "OK";

        } catch (error:any) {
            //Si ocurre un error volvemos todo para atras (antes faltaba: un fallo a
            //mitad de la carga de precios/adicionales dejaba un producto a medias)
            await connection.rollback();

            throw error;
        } finally{
            connection.release();
        }
    }

    async Modificar(data:Producto, contexto:ContextoAuditoria): Promise<string>{
        const connection = await db.getConnection();
        try {
            let existe = await ValidarExistencia(connection, data, true);
            if(existe)//Verificamos si ya existe un producto con el mismo nombre
                return "Ya existe un producto con el mismo nombre.";

            // Guarda de seguridad: un front que mande precios vacío/undefined no
            // debe poder vaciar los precios del producto. Se corta antes de tocar la BD.
            if(!data.precios || data.precios.length === 0)
                return "El producto debe tener al menos un precio.";

            //Iniciamos una transaccion
            await connection.beginTransaction();

            //#region MODIFICAR PRODUCTO.
            // `cantidad` NO se escribe desde el formulario: el stock cambia solo por
            // ventas y por ajustes auditados (productos_movimientos). Antes, guardar un
            // producto pisaba el stock con el valor que tenia el formulario al abrirlo y
            // las ventas hechas mientras tanto desaparecian.
            const clasificacion = resolverClasificacion(data);

            const consulta = `UPDATE productos SET
                                idCategoria = ?,
                                nombre = ?,
                                tipo = ?,
                                sector = ?,
                                controlaStock = ?,
                                imagen = ?,
                                descripcion = ?
                               WHERE id = ?`;

           const parametros =
                            [
                                data.categoria?.id,
                                data.nombre!.toUpperCase(),
                                clasificacion.tipo,
                                clasificacion.sector,
                                clasificacion.controlaStock ? 1 : 0,
                                data.imagen,
                                data.descripcion,
                                data.id
                            ];

            await connection.query(consulta, parametros);
            //#endregion

            //Sincronizamos los precios por diff (UPDATE/INSERT/DELETE) en vez de
            //DELETE-ALL + reinsert: el DELETE-ALL quema el id de productos_precio en
            //cada guardado, y sin id estable no hay a qué colgar historial ni undo
            //(ver handoff_precios_ajuste_masivo_easyresto.md). Cada escritura pasa
            //por guardarPrecio, que audita en `eventos`.
            await SincronizarPreciosProducto(connection, data.id, data.precios!, contexto);

            //Insertamos adicionales (sin cambios: fuera del alcance de este PR)
            await connection.query("DELETE FROM productos_adicional WHERE idProducto = ?", [data.id]);
            for (const adicional of data.adicionales!) {
                adicional.idProducto = data.id;
                await InsertAdicionalProducto(connection, adicional);
            };

            //Mandamos la transaccion
            await connection.commit();
            return "OK";

        } catch (error:any) {
            //Si ocurre un error volvemos todo para atras
            await connection.rollback();

            throw error;
        } finally{
            connection.release();
        }
    }

    async Eliminar(id:string, contexto:ContextoAuditoria): Promise<string>{
        const connection = await db.getConnection();

        try {
             //Iniciamos una transaccion
            await connection.beginTransaction();

            //Eliminamos los precios del producto por el punto único de escritura
            //(audita PRECIO_ELIMINAR de cada uno; los eventos sobreviven al borrado
            //del producto porque `eventos` no tiene FK)
            const idNumerico = Number(id);
            const mapaPrecios = await ObtenerPreciosProducto(connection, [idNumerico]);
            for (const precio of mapaPrecios.get(idNumerico) ?? []) {
                await guardarPrecio(connection, precio, precio, 'DELETE', 'PRECIO_ELIMINAR', contexto);
            }

            //Eliminamos los adicionales del producto
            await connection.query("DELETE FROM productos_adicional WHERE idProducto = ?", [id]);

            //Eliminamos el producto
            await connection.query("DELETE FROM productos WHERE id = ?", [id]);

            //Mandamos la transaccion
            await connection.commit();
            return "OK";

        } catch (error:any) {
            //Si ocurre un error volvemos todo para atras
            await connection.rollback();

            throw error;
        } finally{
            connection.release();
        }
    }

    //#endregion

    //#region AJUSTE MASIVO
    // simular-ajuste y ajustar comparten CalcularCambiosAjuste para garantizar
    // que el valor que se muestra en el preview sea exactamente el que se
    // termina persistiendo (handoff PR3, criterio de aceptación).
    async SimularAjusteMasivo(datos:any): Promise<any>{
        const connection = await db.getConnection();

        try {
            const errorValidacion = ValidarDatosAjuste(datos);
            if (errorValidacion) return { error: errorValidacion };

            const { cambios, saltados } = await CalcularCambiosAjuste(connection, datos);

            // cantidadAfectada solo cuenta lo que realmente se va a escribir si se
            // confirma -los omitidos (ej. quedarían en costo/precio <= 0) se
            // muestran en el preview pero no se persisten (ver AjustarMasivo).
            const cantidadAfectada = cambios.filter((c:any) => !c.omitido).length;

            return { cambios, saltados, cantidadAfectada };

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async AjustarMasivo(datos:any, contexto:ContextoAuditoria): Promise<any>{
        const connection = await db.getConnection();

        try {
            const errorValidacion = ValidarDatosAjuste(datos);
            if (errorValidacion) return { error: errorValidacion };

            const { cambios } = await CalcularCambiosAjuste(connection, datos);

            // loteId nuevo por lote: agrupa todos los eventos de esta operación
            // para poder mostrarla como una unidad y (PR5) deshacerla completa.
            const loteId = randomUUID();
            const contextoLote:ContextoAuditoria = {
                ...contexto,
                loteId,
                observacion: datos.motivo ?? contexto.observacion ?? null,
            };

            await connection.beginTransaction();

            let cantidadAfectada = 0;
            for (const cambio of cambios) {
                // Omitido (costo/precio quedaría en cero o negativo): se saltea sin
                // frenar el resto del lote. Antes esto rechazaba TODO el ajuste -un
                // solo producto con costo en 0 bloqueaba a los otros 49-, algo que
                // además el usuario recién se enteraba en un toast que se cerraba
                // solo. Ahora se ve marcado en el preview (simular-ajuste) y acá
                // simplemente no se escribe.
                if (cambio.omitido) continue;

                const precioNuevo = new ProductoPrecio({
                    id: cambio.idPrecio,
                    idProducto: cambio.idProducto,
                    listaPrecio: new ListaPrecio({ id: cambio.idListaPrecio }),
                    descripcion: cambio.descripcion,
                    posicionDes: cambio.posicionDes,
                    costo: cambio.costoNuevo,
                    precio: cambio.precioNuevo,
                });

                let escribio:boolean;
                if (cambio.esNuevo) {
                    escribio = await guardarPrecio(connection, precioNuevo, null, 'INSERT', 'PRECIO_CREAR', contextoLote);
                } else {
                    const anterior = new ProductoPrecio({
                        id: cambio.idPrecio,
                        idProducto: cambio.idProducto,
                        listaPrecio: new ListaPrecio({ id: cambio.idListaPrecio }),
                        descripcion: cambio.descripcion,
                        posicionDes: cambio.posicionDes,
                        costo: cambio.costoActual,
                        precio: cambio.precioActual,
                    });
                    escribio = await guardarPrecio(connection, precioNuevo, anterior, 'UPDATE', 'PRECIO_AJUSTE_MASIVO', contextoLote);
                }

                // cantidadAfectada cuenta escrituras reales (= filas en `eventos`),
                // no filas calculadas: si el redondeo deja un valor idéntico al
                // actual, guardarPrecio no escribe y acá tampoco debe contarlo.
                if (escribio) cantidadAfectada++;
            }

            await connection.commit();
            return { loteId, cantidadAfectada };

        } catch (error:any) {
            await connection.rollback();
            throw error;
        } finally{
            connection.release();
        }
    }

    // Deshacer un lote de ajuste masivo (PR5). Un lote de AjustarMasivo solo
    // contiene eventos PRECIO_CREAR (filas nuevas por modo copia) y
    // PRECIO_AJUSTE_MASIVO (filas existentes ajustadas) -nunca PRECIO_ELIMINAR,
    // AjustarMasivo no borra nada-. Revertir cada uno es, respectivamente, un
    // DELETE de la fila creada o un UPDATE de vuelta al valor de antes.
    //
    // No se aborta todo el deshacer por un conflicto puntual: se revierte lo
    // que se puede y se reporta el resto en `conflictos` -mismo criterio que
    // los omitidos de AjustarMasivo, no bloquear 49 reversiones válidas por 1
    // que no se puede hacer en silencio.
    async DeshacerLoteAjuste(loteId:string, contexto:ContextoAuditoria): Promise<any>{
        const connection = await db.getConnection();

        try {
            const eventosLote = await eventosRepository.obtenerEventosPorLote(connection, loteId);
            if (eventosLote.length === 0)
                return { error: "No se encontró el lote indicado." };

            if (await eventosRepository.existeReversionDeLote(connection, loteId))
                return { error: "Este lote ya fue revertido." };

            // Último evento por cada precio tocado en el lote: si no coincide con
            // el evento de este lote, algo lo tocó después (edición manual, otro
            // ajuste, un borrado) y no se revierte en silencio (handoff PR5).
            const entidadIds = eventosLote
                .map((e:any) => e.entidadId)
                .filter((id:any): id is number => id != null);
            const ultimosEventos = await eventosRepository.obtenerUltimosEventosPorEntidad(connection, 'productos_precio', entidadIds);

            const loteIdReversion = randomUUID();
            const contextoReversion:ContextoAuditoria = {
                idUsuario: contexto.idUsuario,
                puesto: contexto.puesto,
                loteId: loteIdReversion,
                loteIdOrigen: loteId,
                observacion: `Reversión del lote ${loteId}`,
            };

            await connection.beginTransaction();

            let cantidadRevertida = 0;
            const conflictos:any[] = [];

            for (const evento of eventosLote) {
                const ultimoEventoId = evento.entidadId != null ? ultimosEventos.get(evento.entidadId) : undefined;

                if (ultimoEventoId !== evento.id) {
                    conflictos.push({
                        idPrecio: evento.entidadId,
                        motivo: 'Este precio fue modificado o eliminado después del ajuste; no se revirtió.',
                    });
                    continue;
                }

                let escribio:boolean;
                if (evento.accion === 'PRECIO_CREAR') {
                    // La fila no existía antes del lote: revertirla es borrarla.
                    // Auditado como PRECIO_REVERTIR, no PRECIO_ELIMINAR -en el
                    // historial tiene que distinguirse de un borrado manual-.
                    const actual = new ProductoPrecio({ ...evento.datosAfter, id: evento.entidadId });
                    escribio = await guardarPrecio(connection, actual, actual, 'DELETE', 'PRECIO_REVERTIR', contextoReversion);
                } else {
                    // PRECIO_AJUSTE_MASIVO: se restaura el valor de antes del ajuste.
                    const restaurado = new ProductoPrecio({ ...evento.datosBefore, id: evento.entidadId });
                    const actual = new ProductoPrecio({ ...evento.datosAfter, id: evento.entidadId });
                    escribio = await guardarPrecio(connection, restaurado, actual, 'UPDATE', 'PRECIO_REVERTIR', contextoReversion);
                }

                if (escribio) cantidadRevertida++;
            }

            await connection.commit();
            return { loteIdReversion, cantidadRevertida, conflictos };

        } catch (error:any) {
            await connection.rollback();
            throw error;
        } finally{
            connection.release();
        }
    }
    //#endregion

    //#region AUDITORÍA (PR6)
    // Lotes de ajuste de precios, paginado server-side (pantalla "Auditoría").
    // Un lote es un grupo de eventos con el mismo loteId -solo los que generó
    // AjustarMasivo (loteId IS NOT NULL, entidad='productos_precio'). Las
    // ediciones individuales (loteId NULL) no aparecen acá -se ven desde
    // ObtenerHistorialPrecio, por producto-. Las filas de reversión
    // (accion='PRECIO_REVERTIR') tampoco se listan como lotes propios: su
    // efecto se pliega en el `estado` del lote que revirtieron, no en una fila
    // aparte -evita mostrar el "deshacer de un deshacer" como si fuera otra
    // operación de negocio.
    async ObtenerLotes(filtros:any):Promise<any>{
        const connection = await db.getConnection();

        try {
            const queryRegistros = ObtenerLotesQuery(filtros, false);
            const queryTotal = ObtenerLotesQuery(filtros, true);

            const [rows]:any = await connection.query(queryRegistros.sql, queryRegistros.parametros);
            const resultadoTotal:any = await connection.query(queryTotal.sql, queryTotal.parametros);

            const registros = (Array.isArray(rows) ? rows : []).map((row:any) => ({
                loteId: row.loteId,
                fecha: row.fecha,
                idUsuario: row.idUsuario,
                nombreUsuario: row.nombreUsuario,
                puesto: row.puesto,
                totalPrecios: row.totalEventos,
                revertidos: row.revertidos,
                // Derivado, no una columna: 0 revertidos = vigente, todos = revertido,
                // lo que quede en el medio = parcial (deshacer-lote con conflictos).
                estado: row.revertidos === 0 ? 'VIGENTE' : (row.revertidos === row.totalEventos ? 'REVERTIDO' : 'PARCIAL'),
                observacion: row.observacion,
            }));

            return { total: resultadoTotal[0][0].total, registros };

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    // Historial completo de un precio puntual (ícono de historial en
    // addmod-productos): mezcla ediciones individuales y las que vinieron de
    // un lote (ajuste masivo o su reversión), más reciente primero.
    async ObtenerHistorialPrecio(idPrecio:number):Promise<any[]>{
        const connection = await db.getConnection();

        try {
            return await eventosRepository.obtenerEventosPorEntidad(connection, 'productos_precio', idPrecio);

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }
    //#endregion
}

function ArmarObjeto(row, mapaPrecios:Map<number, ProductoPrecio[]>, mapaAdicionales:Map<number, ProductoAdicional[]>):Producto{
    let elemento:Producto = new Producto({
        id: row['id'],
        nombre: row['nombre'],
        tipo: row['tipo'],
        sector: row['sector'],
        controlaStock: row['controlaStock'] == 1,
        imagen: row['imagen'],
        descripcion: row['descripcion'],
        cantidad: row['cantidad'],
        categoria: new Categoria({
            id: row['idCategoria'],
            nombre: row['categoria']
        })
    });

    elemento.precios = mapaPrecios.get(row['id']) ?? [];
    elemento.adicionales = mapaAdicionales.get(row['id']) ?? [];

    return elemento;
}

async function ObtenerQuery(filtros:any,esTotal:boolean):Promise<{sql:string, parametros:any[]}>{
    try {
        //#region VARIABLES
        let filtro:string = "";
        let orden:string = "";
        let paginado:string = "";

        let count:string = "";
        let endCount:string = "";
        const parametros:any[] = [];
        //#endregion

        // #region FILTROS
        // Toda condición viaja parametrizada: busqueda/tipo/categoria/idProducto
        // llegan del cliente y antes se concatenaban crudos a la query (SQL injection).
        if (filtros.idProducto != null && filtros.idProducto != 0) {
            filtro += " AND p.id = ? ";
            parametros.push(filtros.idProducto);
        }
        else{
            if (filtros.busqueda != null && filtros.busqueda != ""){
                filtro += " AND (p.nombre LIKE ?) ";
                parametros.push('%' + filtros.busqueda + '%');
            }

            if (filtros.tipo != null && filtros.tipo != ""){
                filtro += " AND p.tipo = ? ";
                parametros.push(filtros.tipo);
            }

            if (filtros.categoria != null && filtros.categoria != ""){
                filtro += " AND p.idCategoria = ? ";
                parametros.push(filtros.categoria);
            }
        }
        // #endregion

        // #region ORDENAMIENTO
        // orden/direccion también llegan del cliente: whitelist de columna y
        // normalización de dirección en vez de concatenar lo que mande el front.
        const columnaOrden = COLUMNAS_ORDEN_VALIDAS.includes(filtros.orden) ? filtros.orden : null;
        const direccionOrden = String(filtros.direccion).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        if (columnaOrden != null){
            orden += " ORDER BY p." + columnaOrden + " " + direccionOrden;
        } else{
            orden += " ORDER BY p.id DESC";
        }
        // #endregion

        if (esTotal)
        {//Si esTotal agregamos para obtener un total de la consulta
            count = "SELECT COUNT(*) AS total FROM ( ";
            endCount = " ) as subquery";
        }
        else
        {//De lo contrario paginamos
            if (filtros.tamanioPagina != null){
                paginado = " LIMIT ? OFFSET ? ";
                parametros.push(filtros.tamanioPagina, (filtros.pagina - 1) * filtros.tamanioPagina);
            }
        }

        //Arma la Query con el paginado y los filtros correspondientes
        const sql = count +
                " SELECT p.*, COALESCE(c.nombre, 'ELIMINADO') categoria " +
                " FROM productos p " +
                " INNER JOIN categorias c ON c.id = p.idCategoria " +
                " WHERE 1 = 1 " +
                filtro +
                orden +
                paginado +
                endCount;

        return {sql, parametros};

    } catch (error) {
        throw error;
    }
}

//#region AUDITORÍA (PR6)
// Mismo patrón count/endCount + paginado que ObtenerQuery (arriba). El
// conteo de revertidos por lote sale de un LEFT JOIN contra los propios
// eventos filtrados a PRECIO_REVERTIR y agrupados por loteIdOrigen -sin esa
// columna (migración PR6) contar reversiones por lote en una página entera
// exigiría una query por lote-. `estado` es derivado (revertidos vs.
// totalEventos) y no una columna: se filtra acá con HAVING sobre esos mismos
// alias, referenciándolos como permite MySQL.
//
// Columnas no incluidas en el GROUP BY (idUsuario, puesto, observacion,
// revertidos) van envueltas en MAX(): son funcionalmente dependientes de
// loteId por construcción (un lote lo escribe una sola llamada a
// AjustarMasivo, con un único usuario/puesto), pero MySQL con
// ONLY_FULL_GROUP_BY no lo sabe y las rechaza sin el wrapper.
function ObtenerLotesQuery(filtros:any, esTotal:boolean):{sql:string, parametros:any[]}{
    let filtro:string = "";
    let having:string = "";
    let paginado:string = "";

    let count:string = "";
    let endCount:string = "";
    const parametros:any[] = ['productos_precio'];

    // #region FILTROS
    if (filtros.idUsuario != null && filtros.idUsuario != "") {
        filtro += " AND e.idUsuario = ? ";
        parametros.push(filtros.idUsuario);
    }
    if (filtros.fechaDesde != null && filtros.fechaDesde != "") {
        filtro += " AND e.fecha >= ? ";
        parametros.push(filtros.fechaDesde);
    }
    if (filtros.fechaHasta != null && filtros.fechaHasta != "") {
        filtro += " AND e.fecha <= ? ";
        parametros.push(filtros.fechaHasta);
    }

    if (filtros.estado === 'VIGENTE') having = " HAVING revertidos = 0 ";
    else if (filtros.estado === 'REVERTIDO') having = " HAVING revertidos = totalEventos ";
    else if (filtros.estado === 'PARCIAL') having = " HAVING revertidos > 0 AND revertidos < totalEventos ";
    // #endregion

    if (esTotal)
    {//Si esTotal agregamos para obtener un total de la consulta
        count = "SELECT COUNT(*) AS total FROM ( ";
        endCount = " ) as subquery";
    }
    else
    {//De lo contrario paginamos
        if (filtros.tamanioPagina != null){
            paginado = " LIMIT ? OFFSET ? ";
            parametros.push(filtros.tamanioPagina, (filtros.pagina - 1) * filtros.tamanioPagina);
        }
    }

    const sql = count +
            " SELECT e.loteId AS loteId, " +
            "        MIN(e.fecha) AS fecha, " +
            "        MAX(e.idUsuario) AS idUsuario, " +
            "        MAX(COALESCE(u.nombre, 'ELIMINADO')) AS nombreUsuario, " +
            "        MAX(e.puesto) AS puesto, " +
            "        COUNT(*) AS totalEventos, " +
            "        MAX(e.observacion) AS observacion, " +
            "        MAX(COALESCE(r.revertidos, 0)) AS revertidos " +
            " FROM eventos e " +
            " LEFT JOIN usuarios u ON u.id = e.idUsuario " +
            " LEFT JOIN ( " +
            "     SELECT loteIdOrigen, COUNT(*) AS revertidos FROM eventos " +
            "     WHERE accion = 'PRECIO_REVERTIR' AND loteIdOrigen IS NOT NULL " +
            "     GROUP BY loteIdOrigen " +
            " ) r ON r.loteIdOrigen = e.loteId " +
            " WHERE e.entidad = ? AND e.loteId IS NOT NULL AND e.accion <> 'PRECIO_REVERTIR' " +
            filtro +
            " GROUP BY e.loteId " +
            having +
            " ORDER BY MIN(e.id) DESC " +
            paginado +
            endCount;

    return {sql, parametros};
}
//#endregion

//#region DETALLES DE PRODUCTO
async function ObtenerPreciosProducto(connection, idsProducto:number[]):Promise<Map<number, ProductoPrecio[]>>{
    try {
        const mapa = new Map<number, ProductoPrecio[]>();
        if (idsProducto.length === 0) return mapa;

        // ORDER BY determinístico: antes el orden lo decidía MySQL de forma
        // implícita y dos consumidores del front toman precios[0] a ciegas.
        const consulta = " SELECT pp.*, COALESCE(lp.nombre, 'ELIMINADA') nombreLista FROM productos_precio pp " +
                         " INNER JOIN listas_precio lp ON lp.id = pp.idListaPrecio " +
                         " WHERE pp.idProducto IN (?) " +
                         " ORDER BY pp.idProducto, pp.idListaPrecio, pp.id";

        const [rows] = await connection.query(consulta, [idsProducto]);

        if (Array.isArray(rows)) {
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];

                let precio:ProductoPrecio = new ProductoPrecio({
                    id: row['id'],
                    idProducto: row['idProducto'],
                    listaPrecio : new ListaPrecio({
                        id: row['idListaPrecio'],
                        nombre: row['nombreLista']
                    }),
                    descripcion : row['descripcion'] == '' ? 'TRADICIONAL' : row['descripcion'],
                    posicionDes : row['posicionDes'] == null ? 'izquierda' : row['posicionDes'],
                    costo : row['costo'],
                    precio : row['precio'],
                });

                if (!mapa.has(row['idProducto'])) mapa.set(row['idProducto'], []);
                mapa.get(row['idProducto'])!.push(precio);
            }
        }

        return mapa;

    } catch (error) {
        throw error;
    }
}

async function ObtenerAdicionalesProducto(connection, idsProducto:number[]):Promise<Map<number, ProductoAdicional[]>>{
    try {
        const mapa = new Map<number, ProductoAdicional[]>();
        if (idsProducto.length === 0) return mapa;

        const consulta = " SELECT pa.idProducto, pa.idAdicional, pa.recargo, COALESCE(a.descripcion, 'ELIMINADO') adicional FROM productos_adicional pa " +
                         " LEFT JOIN adicionales a on a.id = pa.idAdicional" +
                         " WHERE pa.idProducto IN (?) ";

        const [rows] = await connection.query(consulta, [idsProducto]);
        if (Array.isArray(rows)) {
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];

                let adicionalProducto:ProductoAdicional = new ProductoAdicional({
                    idProducto: row['idProducto'],
                    adicional : new Adicional({
                        id: row['idAdicional'],
                        descripcion: row['adicional'],
                    }),
                    recargo : row['recargo']
                });

                if (!mapa.has(row['idProducto'])) mapa.set(row['idProducto'], []);
                mapa.get(row['idProducto'])!.push(adicionalProducto);
            }
        }

        return mapa;

    } catch (error) {
        throw error;
    }
}

// Punto único de comparación para decidir si un precio cambió. Solo se actualiza
// si algo relevante cambió: evita UPDATEs sin efecto (importa para no ensuciar
// el historial de auditoría que se suma en el próximo PR).
function PrecioCambio(actual:ProductoPrecio, nuevo:ProductoPrecio):boolean{
    return actual.costo !== nuevo.costo
        || actual.precio !== nuevo.precio
        || actual.descripcion !== nuevo.descripcion
        || actual.posicionDes !== nuevo.posicionDes
        || actual.listaPrecio?.id !== nuevo.listaPrecio?.id;
}

// Reemplaza el DELETE-ALL + reinsert de productos_precio por un diff real:
// - precio entrante con id existente en BD → UPDATE (solo si cambió algo)
// - precio entrante sin id, o con id que no existe en BD → INSERT
// - id que está en BD y no vino en el payload → DELETE
// Preserva el id de las filas no tocadas: es el prerequisito para poder
// engancharles historial/undo más adelante. Cada escritura pasa por
// guardarPrecio (punto único), que decide si audita.
async function SincronizarPreciosProducto(connection, idProducto:number, preciosNuevos:ProductoPrecio[], contexto:ContextoAuditoria):Promise<void>{
    const mapaActuales = await ObtenerPreciosProducto(connection, [idProducto]);
    const preciosActuales = mapaActuales.get(idProducto) ?? [];
    const actualesPorId = new Map(preciosActuales.map(p => [p.id, p]));
    const idsEntrantes = new Set<number>();

    for (const precioNuevo of preciosNuevos) {
        precioNuevo.idProducto = idProducto;

        const anterior = precioNuevo.id != null ? actualesPorId.get(precioNuevo.id) ?? null : null;
        if (anterior) idsEntrantes.add(anterior.id!);

        await guardarPrecio(connection, precioNuevo, anterior, anterior ? 'UPDATE' : 'INSERT', anterior ? 'PRECIO_MODIFICAR' : 'PRECIO_CREAR', contexto);
    }

    const preciosABorrar = preciosActuales.filter(p => !idsEntrantes.has(p.id!));
    for (const precioABorrar of preciosABorrar) {
        await guardarPrecio(connection, precioABorrar, precioABorrar, 'DELETE', 'PRECIO_ELIMINAR', contexto);
    }
}

// Punto único de escritura de productos_precio (handoff PR2): solo escribe +
// audita en `eventos` si hay un cambio real. La reutiliza tal cual el ajuste
// masivo (PR3), precio por precio, pasando loteId en el contexto. Devuelve si
// escribió o no (PR3 lo usa para que `cantidadAfectada` refleje escrituras
// reales, no filas calculadas).
//
// `operacion` (qué hacer físicamente) y `accion` (qué label queda en
// `eventos.accion`) son parámetros separados a propósito -antes eran el mismo
// string, lo que alcanzaba mientras cada operación física tenía un único
// label posible. Deshacer un lote (PR5) rompe esa correspondencia: revertir
// una creación es un DELETE físico, pero tiene que auditarse como
// PRECIO_REVERTIR, no como PRECIO_ELIMINAR -son hechos distintos en el
// historial, uno es "se deshizo un ajuste" y el otro "alguien borró la
// variante a mano"-.
async function guardarPrecio(
    connection,
    precio:ProductoPrecio,
    anterior:ProductoPrecio | null,
    operacion:'INSERT' | 'UPDATE' | 'DELETE',
    accion:'PRECIO_CREAR' | 'PRECIO_MODIFICAR' | 'PRECIO_ELIMINAR' | 'PRECIO_AJUSTE_MASIVO' | 'PRECIO_REVERTIR',
    contexto:ContextoAuditoria
):Promise<boolean>{

    if (operacion === 'DELETE') {
        if (!anterior) return false; // ya no existe: nada que borrar ni auditar

        await connection.query("DELETE FROM productos_precio WHERE id = ?", [anterior.id]);
        await eventosRepository.registrarEvento(connection, {
            loteId: contexto.loteId ?? null,
            loteIdOrigen: contexto.loteIdOrigen ?? null,
            puesto: contexto.puesto,
            idUsuario: contexto.idUsuario,
            accion,
            entidad: 'productos_precio',
            entidadId: anterior.id,
            datosBefore: anterior,
            datosAfter: null,
            observacion: contexto.observacion ?? null,
        });
        return true;
    }

    if (operacion === 'INSERT') {
        const idNuevo = await InsertPrecioProducto(connection, precio);
        await eventosRepository.registrarEvento(connection, {
            loteId: contexto.loteId ?? null,
            loteIdOrigen: contexto.loteIdOrigen ?? null,
            puesto: contexto.puesto,
            idUsuario: contexto.idUsuario,
            accion,
            entidad: 'productos_precio',
            entidadId: idNuevo,
            datosBefore: null,
            datosAfter: { ...precio, id: idNuevo },
            observacion: contexto.observacion ?? null,
        });
        return true;
    }

    // UPDATE (PRECIO_MODIFICAR / PRECIO_AJUSTE_MASIVO / PRECIO_REVERTIR):
    // comparamos antes de escribir para no generar ruido en el historial
    // cuando no cambió nada.
    if (!anterior || !PrecioCambio(anterior, precio)) return false;

    await ActualizarPrecioProducto(connection, precio);
    await eventosRepository.registrarEvento(connection, {
        loteId: contexto.loteId ?? null,
        loteIdOrigen: contexto.loteIdOrigen ?? null,
        puesto: contexto.puesto,
        idUsuario: contexto.idUsuario,
        accion,
        entidad: 'productos_precio',
        entidadId: precio.id,
        datosBefore: anterior,
        datosAfter: precio,
        observacion: contexto.observacion ?? null,
    });
    return true;
}

async function ActualizarPrecioProducto(connection, precioProducto:ProductoPrecio):Promise<void>{
    try {
        const consulta = " UPDATE productos_precio SET " +
                         " idListaPrecio = ?, descripcion = ?, posicionDes = ?, costo = ?, precio = ? " +
                         " WHERE id = ? ";

        const parametros = [
            precioProducto.listaPrecio?.id,
            precioProducto.descripcion,
            precioProducto.posicionDes,
            precioProducto.costo,
            precioProducto.precio,
            precioProducto.id,
        ];
        await connection.query(consulta, parametros);

    } catch (error) {
        throw error;
    }
}

async function InsertPrecioProducto(connection, precioProducto:ProductoPrecio):Promise<number>{
    try {
        const consulta = " INSERT INTO productos_precio(idProducto, idListaPrecio, descripcion, posicionDes, costo, precio) " +
                         " VALUES(?, ?, ?, ?, ?, ?) ";

        const parametros = [
            precioProducto.idProducto,
            precioProducto.listaPrecio?.id,
            precioProducto.descripcion,
            precioProducto.posicionDes,
            precioProducto.costo,
            precioProducto.precio,
        ];
        const [resultado]:any = await connection.query(consulta, parametros);
        return resultado.insertId;

    } catch (error) {
        throw error;
    }
}

async function InsertAdicionalProducto(connection, adicionalProducto:ProductoAdicional):Promise<void>{
    try {
        const consulta = " INSERT INTO productos_adicional(idProducto, idAdicional, recargo) " +
                         " VALUES(?, ?, ?) ";

            const parametros = [
            adicionalProducto.idProducto,
            adicionalProducto.adicional?.id,
            adicionalProducto.recargo];
        await connection.query(consulta, parametros);

    } catch (error) {
        throw error;
    }
}
//#endregion

//#region AJUSTE MASIVO
function ValidarDatosAjuste(datos:any):string | null{
    if (!Array.isArray(datos.idsProducto) || datos.idsProducto.length === 0)
        return "Debe seleccionar al menos un producto.";

    if (datos.idsProducto.length > 1000)
        return "No se pueden ajustar más de 1000 productos en un mismo lote.";

    if (datos.idListaPrecioOrigen == null)
        return "Debe indicar la lista de precios de origen.";

    if (!['PORCENTAJE', 'MONTO_FIJO', 'PRECIO_FIJO'].includes(datos.operacion))
        return "Operación de ajuste inválida.";

    if (!['PRECIO', 'COSTO', 'AMBOS'].includes(datos.aplicarA))
        return "Debe indicar a qué campo aplicar el ajuste.";

    // PRECIO_FIJO + AMBOS dejaría costo = precio en cada fila -margen cero-.
    // No tiene un caso de uso real, se bloquea acá en vez de dejarlo a criterio
    // de la UI de PR4.
    if (datos.operacion === 'PRECIO_FIJO' && datos.aplicarA === 'AMBOS')
        return "PRECIO_FIJO no puede aplicarse a costo y precio a la vez.";

    if (typeof datos.valor !== 'number' || Number.isNaN(datos.valor))
        return "El valor del ajuste es inválido.";

    if (datos.redondeo === 'MULTIPLO' && (!datos.multiploRedondeo || datos.multiploRedondeo <= 0))
        return "Debe indicar un múltiplo de redondeo válido.";

    // La UI ya saca esta opción del selector, pero se valida también acá: sin
    // esto, CalcularCambiosAjuste simplemente no arma el modo copia si son
    // iguales (no falla, no hace nada), lo cual sería un no-op silencioso
    // -el usuario pidió copiar y no pasa nada, sin ningún aviso-.
    if (datos.idListaPrecioDestino != null && datos.idListaPrecioDestino === datos.idListaPrecioOrigen)
        return "La lista destino no puede ser la misma que la de origen.";

    return null;
}

function CalcularValorAjustado(valorActual:number, operacion:string, valor:number):number{
    switch (operacion) {
        case 'PORCENTAJE': return valorActual * (1 + valor / 100);
        case 'MONTO_FIJO': return valorActual + valor;
        case 'PRECIO_FIJO': return valor;
        default: return valorActual;
    }
}

function AplicarRedondeo(valor:number, redondeo?:string, multiploRedondeo?:number):number{
    switch (redondeo) {
        case 'ENTERO':
            return Math.round(valor);
        case 'MULTIPLO': {
            const multiplo = multiploRedondeo && multiploRedondeo > 0 ? multiploRedondeo : 1;
            return Math.round(valor / multiplo) * multiplo;
        }
        case 'NINGUNO':
        default:
            // Sin redondeo pedido igual se limpia a 2 decimales: PORCENTAJE sobre
            // un float arrastra basura de punto flotante (100 * 1.12 = 112.00000000000001)
            // y ese valor es el que se compara contra `costoActual`/`precioActual`
            // en PrecioCambio y el que se persiste.
            return Math.round(valor * 100) / 100;
    }
}

async function ObtenerPreciosParaAjuste(connection, idsProducto:number[], idListaPrecio:number):Promise<any[]>{
    if (idsProducto.length === 0) return [];

    const consulta = " SELECT pp.*, p.nombre nombreProducto FROM productos_precio pp " +
                     " INNER JOIN productos p ON p.id = pp.idProducto " +
                     " WHERE pp.idProducto IN (?) AND pp.idListaPrecio = ? " +
                     " ORDER BY p.nombre, pp.id";

    const [rows] = await connection.query(consulta, [idsProducto, idListaPrecio]);
    return Array.isArray(rows) ? rows : [];
}

// Núcleo compartido por simular-ajuste y ajustar: misma consulta, mismo cálculo.
// Es lo que garantiza que el preview coincida con lo que termina persistido
// (criterio de aceptación de PR3) -si cada endpoint recalculara por su cuenta,
// un cambio futuro en uno solo los desincroniza en silencio.
//
// Un precio cuyo resultado quedaría en cero o negativo NO aborta el lote entero
// -antes sí, y un solo producto con costo en 0 bloqueaba el ajuste de los otros
// 49-. Se marca `omitido` con el motivo: el preview lo muestra resaltado y
// AjustarMasivo simplemente no lo escribe. Mismo criterio que `saltados`
// (producto sin precio en origen): informar, no frenar todo por un caso puntual.
async function CalcularCambiosAjuste(connection, datos:any):Promise<{cambios:any[], saltados:any[]}>{
    const filasOrigen = await ObtenerPreciosParaAjuste(connection, datos.idsProducto, datos.idListaPrecioOrigen);

    const idsConPrecio = new Set(filasOrigen.map((f:any) => f.idProducto));
    const saltados = datos.idsProducto
        .filter((id:number) => !idsConPrecio.has(id))
        .map((id:number) => ({ idProducto: id, motivo: 'Sin precio en la lista de origen seleccionada.' }));

    const cambios:any[] = [];

    for (const fila of filasOrigen) {
        const costoActual = Number(fila.costo);
        const precioActual = Number(fila.precio);

        let costoNuevo = costoActual;
        let precioNuevo = precioActual;

        if (datos.aplicarA === 'COSTO' || datos.aplicarA === 'AMBOS')
            costoNuevo = AplicarRedondeo(CalcularValorAjustado(costoActual, datos.operacion, datos.valor), datos.redondeo, datos.multiploRedondeo);

        if (datos.aplicarA === 'PRECIO' || datos.aplicarA === 'AMBOS')
            precioNuevo = AplicarRedondeo(CalcularValorAjustado(precioActual, datos.operacion, datos.valor), datos.redondeo, datos.multiploRedondeo);

        let omitido = false;
        let motivoOmitido: string | undefined;

        if ((datos.aplicarA === 'COSTO' || datos.aplicarA === 'AMBOS') && costoNuevo <= 0) {
            omitido = true;
            motivoOmitido = `El costo quedaría en ${costoNuevo}.`;
        }
        if ((datos.aplicarA === 'PRECIO' || datos.aplicarA === 'AMBOS') && precioNuevo <= 0) {
            omitido = true;
            motivoOmitido = motivoOmitido
                ? 'El costo y el precio quedarían en cero o negativo.'
                : `El precio quedaría en ${precioNuevo}.`;
        }

        cambios.push({
            idPrecio: fila.id,
            idProducto: fila.idProducto,
            idListaPrecio: datos.idListaPrecioOrigen,
            nombreProducto: fila.nombreProducto,
            descripcion: fila.descripcion,
            posicionDes: fila.posicionDes,
            costoActual, costoNuevo, precioActual, precioNuevo,
            esNuevo: false,
            omitido, motivoOmitido,
        });
    }

    // Modo copia: no se recalcula nada para destino, se copia el mismo valor
    // nuevo ya calculado para origen -es una sincronización, no un ajuste
    // independiente sobre el valor actual de destino-. Los que ya existen en
    // destino (mismo producto + misma descripción de variante) se actualizan;
    // los que faltan se crean. Si el origen quedó omitido, destino hereda el
    // mismo motivo -copiar un valor inválido no tiene sentido.
    if (datos.idListaPrecioDestino != null && datos.idListaPrecioDestino !== datos.idListaPrecioOrigen) {
        const filasDestino = await ObtenerPreciosParaAjuste(connection, datos.idsProducto, datos.idListaPrecioDestino);
        const destinoPorClave = new Map(filasDestino.map((f:any) => [`${f.idProducto}|${f.descripcion}`, f]));

        const cambiosOrigen = [...cambios]; // snapshot: no iterar sobre lo que se va agregando
        for (const cambio of cambiosOrigen) {
            const filaDestino = destinoPorClave.get(`${cambio.idProducto}|${cambio.descripcion}`);

            if (filaDestino) {
                cambios.push({
                    idPrecio: filaDestino.id,
                    idProducto: cambio.idProducto,
                    idListaPrecio: datos.idListaPrecioDestino,
                    nombreProducto: cambio.nombreProducto,
                    descripcion: cambio.descripcion,
                    posicionDes: filaDestino.posicionDes,
                    costoActual: Number(filaDestino.costo),
                    costoNuevo: cambio.costoNuevo,
                    precioActual: Number(filaDestino.precio),
                    precioNuevo: cambio.precioNuevo,
                    esNuevo: false,
                    omitido: cambio.omitido, motivoOmitido: cambio.motivoOmitido,
                });
            } else {
                cambios.push({
                    idPrecio: null,
                    idProducto: cambio.idProducto,
                    idListaPrecio: datos.idListaPrecioDestino,
                    nombreProducto: cambio.nombreProducto,
                    descripcion: cambio.descripcion,
                    posicionDes: cambio.posicionDes,
                    costoActual: null,
                    costoNuevo: cambio.costoNuevo,
                    precioActual: null,
                    precioNuevo: cambio.precioNuevo,
                    esNuevo: true,
                    omitido: cambio.omitido, motivoOmitido: cambio.motivoOmitido,
                });
            }
        }
    }

    return { cambios, saltados };
}
//#endregion

async function ValidarExistencia(connection, data:any, modificando:boolean):Promise<any>{
    try {
        let consulta = " SELECT id FROM productos WHERE nombre = ? ";
        if(modificando) consulta += " AND id <> ? ";
        const parametros = [data.nombre.toUpperCase(), data.id];
        const rows = await connection.query(consulta,parametros);

        if(rows[0].length > 0) return true;
        return false;

    } catch (error) {
        throw error;
    }
}

export const prodRepository = new ProductoRepository();
