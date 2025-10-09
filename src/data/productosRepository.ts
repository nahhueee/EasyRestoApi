import db from '../db/db.config';
import { Adicional } from '../models/Adicional';
import { Categoria } from '../models/Categoria';
import { ProductoAdicional } from '../models/ProductoAdicional';
import { ProductoPrecio } from '../models/ProductoPrecio';
import { Producto } from '../models/Producto';
import { ListaPrecio } from '../models/ListaPrecio';
import { query } from 'express';

class ProductoRepository{

    //#region OBTENER
    async Obtener(filtros:any){
        const connection = await db.getConnection();
        
        try {
            //Obtengo la query segun los filtros
            let queryRegistros = await ObtenerQuery(filtros,false);
            let queryTotal = await ObtenerQuery(filtros,true);

            //Obtengo la lista de registros y el total
            const [rows] = await connection.query(queryRegistros);
            const resultado = await connection.query(queryTotal);

            const productos:Producto[] = [];
           
            if (Array.isArray(rows)) {
                for (let i = 0; i < rows.length; i++) { 
                    const row = rows[i];
                    productos.push(await this.ArmarObjeto(connection, row));
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
            const rows = await connection.query(consulta);
           
            const row = rows[0][0];
            return await this.ArmarObjeto(connection, row);

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async ArmarObjeto(connection, row){
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
        
        elemento.precios = await ObtenerPreciosProducto(connection, row['id']); 
        elemento.adicionales = await ObtenerAdicionalesProducto(connection, row['id']); 

        return elemento;
    }
    //#endregion

    //#region ABM
    async Agregar(data:Producto): Promise<string>{
        const connection = await db.getConnection();

        try {
            let existe = await ValidarExistencia(connection, data, false);
            if(existe)//Verificamos si ya existe un producto con el mismo nombre
                return "Ya existe un producto con el mismo nombre.";
            

            //Obtenemos el proximo nro de producto a insertar
            data.id = await ObtenerUltimoProducto(connection);
                
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
            
            await connection.query(consulta, parametros);
            //#endregion
            
            //Insertamos los precios
            await connection.query("DELETE FROM productos_precio WHERE idProducto = ?", [data.id]);
            for (const precio of data.precios!) {
                precio.idProducto = data.id;
                InsertPrecioProducto(connection, precio);                
            };

            //Insertamos adicionales
            await connection.query("DELETE FROM productos_adicional WHERE idProducto = ?", [data.id]);
            for (const adicional of data.adicionales!) {
                adicional.idProducto = data.id;
                InsertAdicionalProducto(connection, adicional);                
            };

            //Mandamos la transaccion
            await connection.commit();
            return "OK";

        } catch (error:any) {
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

            //Insertamos los precios
            await connection.query("DELETE FROM productos_precio WHERE idProducto = ?", [data.id]);
            for (const precio of data.precios!) {
                precio.idProducto = data.id;
                InsertPrecioProducto(connection, precio);                
            };

            //Insertamos adicionales
            await connection.query("DELETE FROM productos_adicional WHERE idProducto = ?", [data.id]);
            console.log(data.adicionales)
            for (const adicional of data.adicionales!) {
                adicional.idProducto = data.id;
                InsertAdicionalProducto(connection, adicional);                
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


async function ObtenerQuery(filtros:any,esTotal:boolean):Promise<string>{
    try {
        //#region VARIABLES
        let query:string;
        let filtro:string = "";
        let orden:string = "";
        let paginado:string = "";
    
        let count:string = "";
        let endCount:string = "";
        //#endregion

        // #region FILTROS
        if (filtros.idProducto != null && filtros.idProducto != 0) 
                filtro += " AND p.id = "+ filtros.idProducto + " ";
        else{
            if (filtros.busqueda != null && filtros.busqueda != "") 
                filtro += " AND (p.nombre LIKE '%"+ filtros.busqueda + "%') ";

            if (filtros.tipo != null && filtros.tipo != "")
                filtro += " AND p.tipo = '"+ filtros.tipo + "' ";
        
            if (filtros.categoria != null && filtros.categoria != "")
                filtro += " AND p.idCategoria = "+ filtros.categoria;
        }
        
        // #endregion

        // #region ORDENAMIENTO
        if (filtros.orden != null && filtros.orden != ""){
            orden += " ORDER BY p."+ filtros.orden + " " + filtros.direccion;
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
            if (filtros.tamanioPagina != null)
                paginado = " LIMIT " + filtros.tamanioPagina + " OFFSET " + ((filtros.pagina - 1) * filtros.tamanioPagina);
        }
            
        //Arma la Query con el paginado y los filtros correspondientes
        query = count +
                " SELECT p.*, COALESCE(c.nombre, 'ELIMINADO') categoria " +
                " FROM productos p " +
                " INNER JOIN categorias c ON c.id = p.idCategoria " +
                " WHERE 1 = 1 " +
                filtro +
                orden +
                paginado +
                endCount;
        return query;
            
    } catch (error) {
        throw error; 
    }
}

//#region DETALLES DE PRODUCTO
async function ObtenerPreciosProducto(connection, idProducto:number){
    try {
        const consulta = " SELECT pp.*, COALESCE(lp.nombre, 'ELIMINADA') nombreLista FROM productos_precio pp " +
                         " INNER JOIN listas_precio lp ON lp.id = pp.idListaPrecio " +
                         " WHERE pp.idProducto = ?";

        const [rows] = await connection.query(consulta, [idProducto]);

        const precios:Array<ProductoPrecio> = [];

        if (Array.isArray(rows)) {
            for (let i = 0; i < rows.length; i++) { 
                const row = rows[i];
                
                let precio:ProductoPrecio = new ProductoPrecio({
                    idProducto,
                    listaPrecio : new ListaPrecio({
                        id: row['idListaPrecio'],
                        nombre: row['nombreLista']
                    }),
                    descripcion : row['descripcion'],
                    mostrarDesc : row['mostrarDesc'],
                    costo : row['costo'],
                    precio : row['precio'],
                });
               
                precios.push(precio)
              }
        }

        return precios;

    } catch (error) {
        throw error; 
    }
}

async function ObtenerAdicionalesProducto(connection, idProducto:number){
    try {
        const consulta = " SELECT pa.idAdicional, pa.recargo, COALESCE(a.descripcion, 'ELIMINADO') adicional FROM productos_adicional pa " +
                         " LEFT JOIN adicionales a on a.id = pa.idAdicional" +
                         " WHERE pa.idProducto = ? ";

        const [rows] = await connection.query(consulta, [idProducto]);
        const adicionales:ProductoAdicional[] = [];
        if (Array.isArray(rows)) {
            for (let i = 0; i < rows.length; i++) { 
                const row = rows[i];
                
                let adicionalProducto:ProductoAdicional = new ProductoAdicional({
                    idProducto,
                    adicional : new Adicional({
                        id: row['idAdicional'],
                        descripcion: row['adicional'],
                    }),
                    recargo : row['recargo']
                });
               
                adicionales.push(adicionalProducto)
              }
        }

        return adicionales;

    } catch (error) {
        throw error; 
    }
}

async function InsertPrecioProducto(connection, precioProducto:ProductoPrecio):Promise<void>{
    try {
        const consulta = " INSERT INTO productos_precio(idProducto, idListaPrecio, descripcion, costo, precio, mostrarDesc) " +
                         " VALUES(?, ?, ?, ?, ?, ?) ";

        const parametros = [
            precioProducto.idProducto, 
            precioProducto.listaPrecio?.id, 
            precioProducto.descripcion,
            precioProducto.costo, 
            precioProducto.precio,
            precioProducto.mostrarDesc
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

async function ObtenerUltimoProducto(connection):Promise<number>{
    try {
        const rows = await connection.query(" SELECT id FROM productos ORDER BY id DESC LIMIT 1 ");
        let resultado:number = 0;

        if([rows][0][0].length==0){
            resultado = 1;
        }else{
            resultado = rows[0][0].id + 1;
        }

        return resultado;

    } catch (error) {
        throw error; 
    }
}

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