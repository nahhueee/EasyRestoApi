 import db from '../db/db.config';

class MiscRepository{
    async TiposPedidoSelector(){
        const connection = await db.getConnection();
    
        try {
            const [rows] = await connection.query('SELECT id, nombre, icono FROM pedidos_tipo');
            return [rows][0];

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async TiposPagoSelector(){
        const connection = await db.getConnection();
    
        try {
            const [rows] = await connection.query('SELECT id, nombre FROM tipos_pago');
            return [rows][0];

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }
}

export const MiscRepo = new MiscRepository();

