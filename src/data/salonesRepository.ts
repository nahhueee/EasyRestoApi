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
        if(!Array.isArray(salones)) return "No se recibieron salones para guardar.";

        const connection = await db.getConnection();

        try {
            //Todo o nada: antes, si fallaba a mitad de camino, las altas y el orden quedaban aplicados a medias
            await connection.beginTransaction();

            //Un salón con mesas no se borra (quedaban mesas huérfanas). Se valida todo antes de tocar nada
            const aBorrar = salones.filter((s:any) => s.id != 0 && s.borrar == 1).map((s:any) => Number(s.id));
            if(aBorrar.length > 0){
                const [conMesas]:any = await connection.query(
                    " SELECT s.descripcion FROM salones s INNER JOIN mesas m ON m.idSalon = s.id " +
                    " WHERE s.id IN (?) GROUP BY s.id, s.descripcion ", [aBorrar]);
                if(conMesas.length > 0){
                    await connection.rollback();
                    return `El salón «${conMesas[0].descripcion}» tiene mesas: eliminalas o movelas primero.`;
                }
            }

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

            await connection.commit();
            return "OK";

        } catch (error:any) {
            await connection.rollback();
            throw error;
        } finally{
            connection.release();
        }
    }
    //#endregion
}

export const SalonesRepo = new SalonesRepository();