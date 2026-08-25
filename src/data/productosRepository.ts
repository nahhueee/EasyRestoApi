import db from '../db/db.config';
import { Adicional } from '../models/Adicional';
import { Categoria } from '../models/Categoria';
import { ProductoAdicional } from '../models/ProductoAdicional';
import { ProductoPrecio } from '../models/ProductoPrecio';
import { Producto } from '../models/Producto';
import { ListaPrecio } from '../models/ListaPrecio';
import { query } from 'express';

// Columnas habilitadas para ORDER BY dinámico (whitelist). filtros.orden llega
// del cliente: no se puede concatenar directo a la query (ver ObtenerQuery).
const COLUMNAS_ORDEN_VALIDAS = ['id', 'nombre', 'idCategoria', 'cantidad'];

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
    async Agregar(data:Producto): Promise<string>{
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

            //Insertamos los precios
            for (const precio of data.precios!) {
                precio.idProducto = data.id;
                await InsertPrecioProducto(connection, precio);
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

    async Modificar(data:Producto): Promise<string>{
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
            //(ver handoff_precios_ajuste_masivo_easyresto.md).
            await SincronizarPreciosProducto(connection, data.id, data.precios!);

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

    async Eliminar(id:string): Promise<string>{
        const connection = await db.getConnection();

        try {
             //Iniciamos una transaccion
            await connection.beginTransaction();

            //Eliminamos los precios del producto
            await connection.query("DELETE FROM productos_precio WHERE idProducto = ?", [id]);

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
// engancharles historial/undo más adelante.
async function SincronizarPreciosProducto(connection, idProducto:number, preciosNuevos:ProductoPrecio[]):Promise<void>{
    const mapaActuales = await ObtenerPreciosProducto(connection, [idProducto]);
    const preciosActuales = mapaActuales.get(idProducto) ?? [];
    const actualesPorId = new Map(preciosActuales.map(p => [p.id, p]));
    const idsEntrantes = new Set<number>();

    for (const precioNuevo of preciosNuevos) {
        precioNuevo.idProducto = idProducto;

        const actual = precioNuevo.id != null ? actualesPorId.get(precioNuevo.id) : undefined;

        if (actual) {
            idsEntrantes.add(actual.id!);
            if (PrecioCambio(actual, precioNuevo))
                await ActualizarPrecioProducto(connection, precioNuevo);
        } else {
            await InsertPrecioProducto(connection, precioNuevo);
        }
    }

    const idsABorrar = preciosActuales
        .filter(p => !idsEntrantes.has(p.id!))
        .map(p => p.id);

    if (idsABorrar.length > 0)
        await connection.query("DELETE FROM productos_precio WHERE id IN (?)", [idsABorrar]);
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

async function InsertPrecioProducto(connection, precioProducto:ProductoPrecio):Promise<void>{
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
        await connection.query(consulta, parametros);

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
