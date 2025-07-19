import db from '../db/db.config';

class SalonesRepository{

    //#region OBTENER
    async Obtener(){
        const connection = await db.getConnection();
        
        try {
            const [rows] = await connection.query('SELECT id, descripcion, orden FROM salones ORDER BY orden ASC');
            return [rows][0];

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    //#endregion

    //#region ABM


    async GrabarSalones(salones:any): Promise<string>{
        const connection = await db.getConnection();

        try {
            let orden:number = 0;
            for (const element of salones) {
                if(element.id == 0){ //Insertamos el nuevo salon
                    await connection.query(`INSERT INTO salones(descripcion, orden) VALUES(?,?) `, [element.descripcion, orden]);
                    orden += 1;
                }else if(element.borrar == 1){ //Borramos el salon
                    await connection.query(`DELETE FROM salones WHERE id = ? `, [element.id]);
                }else{ //Actualizamos las posiciones
                    await connection.query(`UPDATE salones SET orden = ? WHERE id = ? `, [orden, element.id]);
                    orden += 1;
                }
            };
            return "OK";

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }
    //#endregion
}

export const SalonesRepo = new SalonesRepository();