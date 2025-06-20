import db from '../db/db.config';
import { ProductoVariedad } from '../models/ProductoVariedad';
import { Rubro } from '../models/Rubro';
import { VarianteVariedad } from '../models/VarianteVariedad';

class ProductoVariedadRepository{

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

            const productosVariedad:ProductoVariedad[] = [];
           
            if (Array.isArray(rows)) {
                for (let i = 0; i < rows.length; i++) { 
                    const row = rows[i];

                    let elemento:ProductoVariedad = new ProductoVariedad({
                        id: row['id'],
                        nombre: row['nombre'],
                        tipo: row['tipo'],
                        imagen: row['imagen'],
                        costo: row['costo'],
                        precioLocal: row['pLocal'],
                        precioDelivery: row['pDelivery'],
                        cantidad: row['cantidad'],
                        rubro: new Rubro({
                            id: row['idRubro'], 
                            nombre: row['rubro']
                        })
                    });
                   
                    if(elemento.tipo == "Variedad") {
                        elemento.variantes = await ObtenerVariantesVariedad(connection, row['id']); 
                        if(elemento.variantes && elemento.variantes.length > 0){
                            elemento.costo = elemento.variantes[0].costo;
                            elemento.precioLocal = elemento.variantes[0].precioLocal;
                            elemento.precioDelivery = elemento.variantes[0].precioDelivery;
                        }
                    }

                    productosVariedad.push(elemento);
                  }
            }

            return {total:resultado[0][0].total, registros:productosVariedad};

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }
    //#endregion

    //#region ABM
    async Agregar(data:ProductoVariedad): Promise<string>{
        const connection = await db.getConnection();

        try {
            let existe = await ValidarExistencia(connection, data, false);
            if(existe)//Verificamos si ya existe un producto o variedad con el mismo nombre
                return "Ya existe un producto | variedad con el mismo nombre.";
            

            //Obtenemos el proximo nro de venta a insertar
            data.id = await ObtenerUltimoProductoVariedad(connection);
                
            //Iniciamos una transaccion
            await connection.beginTransaction();

            //#region INSERTAR PRODUCTO | VARIEDAD
            const consulta = `INSERT INTO producto_variedad(idRubro,nombre,tipo,imagen,costo,pLocal,pDelivery,cantidad)
                              VALUES(?,?,?,?,?,?,?,?)`;

            const parametros = [data.rubro?.id,
                                data.nombre!.toUpperCase(),
                                data.tipo,
                                data.imagen,
                                data.costo,
                                data.precioLocal,
                                data.precioDelivery,
                                data.cantidad];
            
            await connection.query(consulta, parametros);
            //#endregion
            
            //Insertar variantes si las tiene
            if(data.tipo == "Variedad" && data.variantes){
                await connection.query("DELETE FROM variantes WHERE idProdVar = ?", [data.id]);

                //Insertamos las variantes
                for (const variante of data.variantes) {
                    InsertVariante(connection, variante, data.id);                
                };
            }

            //Mandamos la transaccion
            await connection.commit();
            return "OK";

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async Modificar(data:ProductoVariedad): Promise<string>{
        const connection = await db.getConnection();

        try {
            
            let existe = await ValidarExistencia(connection, data, true);
            if(existe)//Verificamos si ya existe un producto o variedad con el mismo nombre
                return "Ya existe un producto | variedad con el mismo nombre.";
            
            
            //Iniciamos una transaccion
            await connection.beginTransaction();

            //#region MODIFICAR PRODUCTO | VARIEDAD
            const consulta = `UPDATE producto_variedad SET
                                idRubro = ?,
                                nombre = ?,
                                tipo = ?,
                                imagen = ?,
                                costo = ?,
                                pLocal = ?,
                                pDelivery = ?,
                                cantidad = ?
                              WHERE id = ?`;

           const parametros = [data.rubro?.id,
                                data.nombre!.toUpperCase(),
                                data.tipo,
                                data.imagen,
                                data.costo,
                                data.precioLocal,
                                data.precioDelivery,
                                data.cantidad,
                                data.id];

            await connection.query(consulta, parametros);
            //#endregion

            //Insertar variantes si las tiene
            if(data.tipo == "Variedad" && data.variantes){
                await connection.query("DELETE FROM variantes WHERE idProdVar = ?", [data.id]);

                //Insertamos las variantes
                for (const variante of data.variantes) {
                    InsertVariante(connection, variante, data.id);                
                };
            }

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

            //Eliminamos las variantes de la variedad
            await connection.query("DELETE FROM variantes WHERE idProdVar = ?", [id]);

            //Eliminamos el producto | variedad
            await connection.query("DELETE FROM producto_variedad WHERE id = ?", [id]);
            
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
        if (filtros.busqueda != null && filtros.busqueda != "") 
            filtro += " AND (pv.nombre LIKE '%"+ filtros.busqueda + "%') ";

        if (filtros.tipo != null && filtros.tipo != "")
            filtro += " AND pv.tipo = '"+ filtros.tipo + "' ";

        if (filtros.rubro != null && filtros.rubro != "")
            filtro += " AND pv.idrubro = "+ filtros.rubro;
        // #endregion

        // #region ORDENAMIENTO
        if (filtros.orden != null && filtros.orden != ""){
            orden += " ORDER BY pv."+ filtros.orden + " " + filtros.direccion;
        } else{
            orden += " ORDER BY pv.id DESC";
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
                " SELECT pv.*, COALESCE(r.nombre, 'ELIMINADO') rubro " +
                " FROM producto_variedad pv " +
                " INNER JOIN rubros r ON r.id = pv.idRubro " +
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

//#region VARIANTES VARIEDAD
async function ObtenerVariantesVariedad(connection, idVariedad:number){
    try {
        const consulta = " SELECT * FROM variantes " +
                         " WHERE idProdVar = ?";

        const [rows] = await connection.query(consulta, [idVariedad]);

        const variantes:VarianteVariedad[] = [];

        if (Array.isArray(rows)) {
            for (let i = 0; i < rows.length; i++) { 
                const row = rows[i];
                
                let variante:VarianteVariedad = new VarianteVariedad({
                    descripcion : row['nombre'],
                    costo : row['costo'],
                    precioLocal : row['pLocal'],
                    precioDelivery : row['pDelivery'],
                });
               
                variantes.push(variante)
              }
        }

        return variantes;

    } catch (error) {
        throw error; 
    }
}

async function InsertVariante(connection, variante, idProdVar):Promise<void>{
    try {
        const consulta = " INSERT INTO variantes(idProdVar, nombre, costo, pLocal, pDelivery) " +
                         " VALUES(?, ?, ?, ?, ?) ";

        const parametros = [idProdVar, variante.descripcion, variante.costo, variante.precioLocal, variante.precioDelivery];
        await connection.query(consulta, parametros);
        
    } catch (error) {
        throw error; 
    }
}
//#endregion

async function ObtenerUltimoProductoVariedad(connection):Promise<number>{
    try {
        const rows = await connection.query(" SELECT id FROM producto_variedad ORDER BY id DESC LIMIT 1 ");
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
        let consulta = " SELECT id FROM producto_variedad WHERE nombre = ? ";
        if(modificando) consulta += " AND id <> ? ";
        const parametros = [data.nombre.toUpperCase(), data.id];
        const rows = await connection.query(consulta,parametros);

        if(rows[0].length > 0) return true;
        return false;
        
    } catch (error) {
        throw error; 
    }
}

export const ProdVarRepository = new ProductoVariedadRepository();