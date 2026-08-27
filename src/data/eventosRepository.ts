// Punto único de lectura/escritura de la tabla `eventos` — auditoría genérica
// de EasyResto (architecture.md §12.3). Primera implementación real del
// modelo; EasySales todavía no la tiene.

export interface Evento {
    id?: number;
    fecha?: string | Date;
    loteId?: string | null;
    loteIdOrigen?: string | null;
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
            const consulta = " INSERT INTO eventos(loteId, loteIdOrigen, puesto, idUsuario, accion, entidad, entidadId, datosBefore, datosAfter, observacion) " +
                             " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ";

            // datosBefore/datosAfter son columnas JSON: mysql2 no serializa objetos
            // JS automáticamente en el parámetro, hay que stringificar a mano.
            const parametros = [
                evento.loteId ?? null,
                evento.loteIdOrigen ?? null,
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

    // Todos los eventos de un lote, en el orden en que se escribieron. Por
    // `id` (autoincremental) y no por `fecha`: `fecha` es DATETIME sin
    // fracción de segundo, y un lote de N escrituras corriendo dentro de la
    // misma transacción puede caer entero en el mismo segundo -no sirve para
    // ordenar ni para detectar "qué pasó después" con precisión-.
    async obtenerEventosPorLote(connection, loteId:string):Promise<Evento[]>{
        const consulta = "SELECT * FROM eventos WHERE loteId = ? ORDER BY id ASC";
        const [rows] = await connection.query(consulta, [loteId]);
        return Array.isArray(rows) ? rows : [];
    }

    // Último evento (mayor id) por cada entidadId dado, para una entidad. Se
    // usa para detectar si algo tocó un registro después de un evento
    // puntual -PR5 la usa para saber si un precio fue editado/borrado después
    // del lote que se quiere deshacer-. Una sola query agrupada en vez de una
    // por precio (mismo criterio anti-N+1 que el resto del repositorio).
    async obtenerUltimosEventosPorEntidad(connection, entidad:string, entidadIds:number[]):Promise<Map<number, number>>{
        const mapa = new Map<number, number>();
        if (entidadIds.length === 0) return mapa;

        const consulta = "SELECT entidadId, MAX(id) AS ultimoEventoId FROM eventos " +
                         "WHERE entidad = ? AND entidadId IN (?) GROUP BY entidadId";
        const [rows] = await connection.query(consulta, [entidad, entidadIds]);

        if (Array.isArray(rows)) {
            for (const row of rows) mapa.set(row.entidadId, row.ultimoEventoId);
        }
        return mapa;
    }

    // Si el loteId ya fue revertido antes. Hasta PR6 esto se resolvía buscando
    // texto en `observacion` (`LIKE '%loteId%'`); PR6 agrega `loteIdOrigen`
    // (columna estructurada, completada solo en eventos PRECIO_REVERTIR) para
    // poder además CONTAR reversiones agrupadas por lote en ObtenerLotes -algo
    // que no se puede hacer eficientemente sobre un LIKE por fila-. Esta
    // consulta puntual se actualiza al mismo tiempo para no dejar dos formas
    // de responder la misma pregunta.
    async existeReversionDeLote(connection, loteId:string):Promise<boolean>{
        const consulta = "SELECT 1 FROM eventos WHERE accion = 'PRECIO_REVERTIR' AND loteIdOrigen = ? LIMIT 1";
        const [rows] = await connection.query(consulta, [loteId]);
        return Array.isArray(rows) && rows.length > 0;
    }

    // Historial completo de una entidad puntual (ej. un productos_precio.id),
    // más reciente primero: mezcla ediciones individuales (loteId NULL) y las
    // que vinieron de un lote de ajuste masivo o de su reversión -es lo que
    // necesita el ícono de historial en addmod-productos (PR6)-. Resuelve el
    // nombre de usuario acá (no en el consumidor) porque cualquier lector de
    // auditoría genérica lo va a necesitar igual.
    async obtenerEventosPorEntidad(connection, entidad:string, entidadId:number):Promise<Evento[]>{
        const consulta = " SELECT e.*, COALESCE(u.nombre, 'ELIMINADO') AS nombreUsuario " +
                         " FROM eventos e " +
                         " LEFT JOIN usuarios u ON u.id = e.idUsuario " +
                         " WHERE e.entidad = ? AND e.entidadId = ? " +
                         " ORDER BY e.id DESC";
        const [rows] = await connection.query(consulta, [entidad, entidadId]);
        return Array.isArray(rows) ? rows : [];
    }
}

export const eventosRepository = new EventosRepository();
