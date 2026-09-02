import db from '../db/db.config';

class ParametrosRepository{

  async ObtenerParametros(clave:string){
    const connection = await db.getConnection();

    try {
        
        let consulta = `SELECT valor FROM parametros WHERE clave = ?`;
        const rows = await connection.query(consulta,[clave]);
      
        if(rows[0][0]){
          if(rows[0][0].valor!="")
            return rows[0][0].valor
        }
        return null;

    } catch (error:any) {
        throw error;
    } finally{
        connection.release();
    }
  }

  async ActualizarParametro(data:any): Promise<string>{
    const connection = await db.getConnection();
    try {
        const consulta = `UPDATE parametros SET valor = ? WHERE clave = ?`;
        const parametros = [data.valor, data.clave];
        
        await connection.query(consulta, parametros);
        return "OK";

    } catch (error:any) {
        throw error;
    } finally{
        connection.release();
    }
  }

  async ActualizarFacturacion(data:any): Promise<string>{
    const connection = await db.getConnection();
    try {
        const consulta = `UPDATE parametros_facturacion 
                          SET 
                          condicion = ?, 
                          cuil = ?, 
                          puntoVta = ?,
                          razon = ?,
                          direccion = ?`;

        const parametros = [data.condicion, data.cuil, data.puntoVta, data.razon, data.direccion];
        
        await connection.query(consulta, parametros);
        return "OK";

    } catch (error:any) {
        throw error;
    } finally{
        connection.release();
    }
  }

  async ObtenerParametrosFacturacion(){
    const connection = await db.getConnection();

    try {
        
        const rows = await connection.query(`SELECT * FROM parametros_facturacion`);
      
        if(rows[0][0]){
          return rows[0][0];
        }
        return null;

    } catch (error:any) {
        throw error;
    } finally{
        connection.release();
    }
  }

  async ActualizarImpresion(data:any): Promise<string>{
    const connection = await db.getConnection();
    try {
        const consulta = `UPDATE parametros_impresion
                          SET
                          impresora = ?,
                          papel = ?,
                          margenIzq = ?,
                          margenDer = ?,
                          nomLocal = ?,
                          desLocal = ?,
                          dirLocal = ?,
                          comandaDoble = ?`;

        const parametros = [data.impresora, data.papel, data.margenIzq, data.margenDer, data.nomLocal, data.desLocal, data.dirLocal, data.comandaDoble];
        
        await connection.query(consulta, parametros);
        return "OK";

    } catch (error:any) {
        throw error;
    } finally{
        connection.release();
    }
  }

  async ActualizarMobile(data:any): Promise<string>{
    const connection = await db.getConnection();
    try {
        // tema/modoOscuro se suman en la Fase 1 del theming de Mobile (agosto 2026):
        // parametros_mobile sigue siendo una sola fila -el UPDATE reescribe
        // todo el registro, por eso el caller siempre tiene que mandar el
        // objeto completo (leerlo con ObtenerParametrosMobile, pisar solo el
        // campo que cambió, reenviar) en vez de un patch parcial.
        const consulta = `UPDATE parametros_mobile
                          SET 
                          imagenes = ?, 
                          todasMesas = ?, 
                          impComprobante = ?,
                          tema = ?,
                          modoOscuro = ?`;

        const parametros = [data.imagenes, data.todasMesas, data.impComprobante, data.tema, data.modoOscuro];
        console.log(parametros)
        await connection.query(consulta, parametros);
        return "OK";

    } catch (error:any) {
        throw error;
    } finally{
        connection.release();
    }
  }

  async ObtenerParametrosImpresion(){
    const connection = await db.getConnection();

    try {
        
        const rows = await connection.query(`SELECT * FROM parametros_impresion`);
      
        if(rows[0][0]){
          return rows[0][0];
        }
        return null;

    } catch (error:any) {
        throw error;
    } finally{
        connection.release();
    }
  }

  async ObtenerParametrosMobile(){
    const connection = await db.getConnection();

    try {
        
        const rows = await connection.query(`SELECT * FROM parametros_mobile`);
      
        if(rows[0][0]){
          return rows[0][0];
        }
        return null;

    } catch (error:any) {
        throw error;
    } finally{
        connection.release();
    }
  }

}


export const ParametrosRepo = new ParametrosRepository();