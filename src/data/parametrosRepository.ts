import db from '../db/db.config';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';

const DESTINOS_VALIDOS = ['principal', 'barra', 'ninguna'];

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
        // Destinos de comanda. Compatibilidad con la pantalla vieja de Preferencias (hasta PR5):
        // solo manda `comandaDoble`, que se traduce a destinoBarra; destinoSinPrep no se toca.
        const [filasActual]:any = await connection.query("SELECT destinoBarra, destinoSinPrep FROM parametros_impresion");
        const actual = filasActual[0];

        const destinoBarra = data.destinoBarra ?? ((data.comandaDoble === 1 || data.comandaDoble === true) ? 'barra' : 'ninguna');
        const destinoSinPrep = data.destinoSinPrep ?? actual?.destinoSinPrep ?? 'ninguna';

        if(!DESTINOS_VALIDOS.includes(destinoBarra) || !DESTINOS_VALIDOS.includes(destinoSinPrep))
            throw new AppError(CodigoError.VALIDACION, "Destino de comanda inválido.", 400);

        // `comandaDoble` se sigue escribiendo, derivado, para que un rollback de código siga andando
        const comandaDoble = (destinoBarra === 'barra' || destinoSinPrep === 'barra') ? 1 : 0;

        const consulta = `UPDATE parametros_impresion
                          SET
                          impresora = ?,
                          papel = ?,
                          margenIzq = ?,
                          margenDer = ?,
                          nomLocal = ?,
                          desLocal = ?,
                          dirLocal = ?,
                          destinoBarra = ?,
                          destinoSinPrep = ?,
                          comandaDoble = ?`;

        const parametros = [data.impresora, data.papel, data.margenIzq, data.margenDer, data.nomLocal, data.desLocal, data.dirLocal, destinoBarra, destinoSinPrep, comandaDoble];
        
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