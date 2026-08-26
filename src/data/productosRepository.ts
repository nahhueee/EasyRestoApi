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

// Columnas habilitadas para ORDER BY dinámico (whitelist). filtros.orden llega
// del cliente: no se puede concatenar directo a la query (ver ObtenerQuery).
const COLUMNAS_ORDEN_VALIDAS = ['id', 'nombre', 'idCategoria', 'cantidad'];

// Quién y desde dónde originó la escritura, para auditar en `eventos`. Hasta
// que exista el token de Fase 4 viaja como headers (x-usuario-id / x-puesto),
// leídos en identidadMiddleware.ts y propagados explícitamente hasta acá -
// nunca se lee "el usuario actual" desde estado global (architecture.md §9.2).
export interface ContextoAuditoria {
    idUsuario: number | null;
    puesto: string | null;
    loteId?: string | null;
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
            const consulta = `INSERT INTO productos(idCategoria,nombre,tipo,imagen,cantidad,descripcion)
                              VALUES(?,?,?,?,?,?)`;

            const parametros =
                            [
                                data.categoria?.id,
                                data.nombre!.toUpperCase(),
                                data.tipo,
                                data.imagen,
                                data.cantidad,
                                data.descripcion
                            ];

            // El id lo asigna MySQL (AUTO_INCREMENT); se lee de insertId. Antes se
            // predecía con MAX(id)+1 (ObtenerUltimoProducto) y se usaba ese valor
            // predicho -no el real- para asociar los precios: si un producto se había
            // borrado antes, el cálculo podía no coincidir con el id real asignado
            // y los precios quedaban insertados contra un idProducto equivocado.
            const [resultado]:any = await connection.query(consulta, parametros);
            data.id = resultado.insertId;
            //#endregion

            //Insertamos los precios por el punto único de escritura (audita PRECIO_CREAR)
            for (const precio of data.precios!) {
                precio.idProducto = data.id;
                await guardarPrecio(connection, precio, null, 'PRECIO_CREAR', contexto);
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
            const consulta = `UPDATE productos SET
                                idCategoria = ?,
                                nombre = ?,
                                tipo = ?,
                                imagen = ?,
                                cantidad = ?,
                                descripcion = ?
                               WHERE id = ?`;

           const parametros =
                            [
                                data.categoria?.id,
                                data.nombre!.toUpperCase(),
                                data.tipo,
                                data.imagen,
                                data.cantidad,
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
                await guardarPrecio(connection, precio, precio, 'PRECIO_ELIMINAR', contexto);
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
                    escribio = await guardarPrecio(connection, precioNuevo, null, 'PRECIO_CREAR', contextoLote);
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
                    escribio = await guardarPrecio(connection, precioNuevo, anterior, 'PRECIO_AJUSTE_MASIVO', contextoLote);
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
    //#endregion
}

function ArmarObjeto(row, mapaPrecios:Map<number, ProductoPrecio[]>, mapaAdicionales:Map<number, ProductoAdicional[]>):Producto{
    let elemento:Producto = new Producto({
        id: row['id'],
        nombre: row['nombre'],
        tipo: row['tipo'],
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

        await guardarPrecio(connection, precioNuevo, anterior, anterior ? 'PRECIO_MODIFICAR' : 'PRECIO_CREAR', contexto);
    }

    const preciosABorrar = preciosActuales.filter(p => !idsEntrantes.has(p.id!));
    for (const precioABorrar of preciosABorrar) {
        await guardarPrecio(connection, precioABorrar, precioABorrar, 'PRECIO_ELIMINAR', contexto);
    }
}

// Punto único de escritura de productos_precio (handoff PR2): decide la acción
// según el estado anterior -que trae el caller, ya lo tiene por el diff, evita
// una query extra por fila- y solo escribe + audita en `eventos` si hay un
// cambio real. La reutiliza tal cual el ajuste masivo (PR3), precio por precio,
// pasando loteId en el contexto. Devuelve si escribió o no (PR3 lo usa para que
// `cantidadAfectada` refleje escrituras reales, no filas calculadas).
async function guardarPrecio(
    connection,
    precio:ProductoPrecio,
    anterior:ProductoPrecio | null,
    accion:'PRECIO_CREAR' | 'PRECIO_MODIFICAR' | 'PRECIO_ELIMINAR' | 'PRECIO_AJUSTE_MASIVO',
    contexto:ContextoAuditoria
):Promise<boolean>{

    if (accion === 'PRECIO_ELIMINAR') {
        if (!anterior) return false; // ya no existe: nada que borrar ni auditar

        await connection.query("DELETE FROM productos_precio WHERE id = ?", [anterior.id]);
        await eventosRepository.registrarEvento(connection, {
            loteId: contexto.loteId ?? null,
            puesto: contexto.puesto,
            idUsuario: contexto.idUsuario,
            accion: 'PRECIO_ELIMINAR',
            entidad: 'productos_precio',
            entidadId: anterior.id,
            datosBefore: anterior,
            datosAfter: null,
            observacion: contexto.observacion ?? null,
        });
        return true;
    }

    if (accion === 'PRECIO_CREAR') {
        const idNuevo = await InsertPrecioProducto(connection, precio);
        await eventosRepository.registrarEvento(connection, {
            loteId: contexto.loteId ?? null,
            puesto: contexto.puesto,
            idUsuario: contexto.idUsuario,
            accion: 'PRECIO_CREAR',
            entidad: 'productos_precio',
            entidadId: idNuevo,
            datosBefore: null,
            datosAfter: { ...precio, id: idNuevo },
            observacion: contexto.observacion ?? null,
        });
        return true;
    }

    // PRECIO_MODIFICAR / PRECIO_AJUSTE_MASIVO: comparamos antes de escribir para
    // no generar ruido en el historial cuando no cambió nada. `accion` se pasa
    // tal cual llegó -antes quedaba hardcodeado a PRECIO_MODIFICAR acá, lo que
    // iba a mentir sobre el origen del cambio en cuanto el ajuste masivo
    // empezara a reutilizar esta rama-.
    if (!anterior || !PrecioCambio(anterior, precio)) return false;

    await ActualizarPrecioProducto(connection, precio);
    await eventosRepository.registrarEvento(connection, {
        loteId: contexto.loteId ?? null,
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
