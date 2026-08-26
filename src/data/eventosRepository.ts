// Punto único de lectura/escritura de la tabla `eventos` — auditoría genérica
// de EasyResto (architecture.md §12.3). Primera implementación real del
// modelo; EasySales todavía no la tiene.

export interface Evento {
    loteId?: string | null;
    puesto?: string | null;
    idUsuario?: number | null;
    accion: string;
    entidad: string;
    entidadId?: number | null;
    datosBefore?: any;
    datosAfter?: any;
    observacion?: string | null;
}

class EventosRepository {

    // Recibe la connection por parámetro. Obligatorio: architecture.md §11.5
    // exige que la auditoría se inserte dentro de la misma transacción de la
    // operación auditada -si la operación falla, la auditoría también-. Está
    // prohibido que este método abra su propia conexión.
    async registrarEvento(connection, evento:Evento):Promise<void>{
        try {
            const consulta = " INSERT INTO eventos(loteId, puesto, idUsuario, accion, entidad, entidadId, datosBefore, datosAfter, observacion) " +
                             " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ";

            // datosBefore/datosAfter son columnas JSON: mysql2 no serializa objetos
            // JS automáticamente en el parámetro, hay que stringificar a mano.
            const parametros = [
                evento.loteId ?? null,
                evento.puesto ?? null,
                evento.idUsuario ?? null,
                evento.accion,
                evento.entidad,
                evento.entidadId ?? null,
                evento.datosBefore != null ? JSON.stringify(evento.datosBefore) : null,
                evento.datosAfter != null ? JSON.stringify(evento.datosAfter) : null,
                evento.observacion ?? null,
            ];

            await connection.query(consulta, parametros);

        } catch (error) {
            throw error;
        }
    }
}

export const eventosRepository = new EventosRepository();
