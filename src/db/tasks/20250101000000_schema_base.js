// MIGRATION BASE — CONGELADA. NO EDITAR. NO REGENERAR.
//
// Foto del schema objetivo de EasyResto (script.sql corregido + las migrations existentes),
// generada UNA vez el 2026-11-03 desde la base "diag_referencia" con
// scripts/diagnostico/generar-base.js. Ese script queda solo como trazabilidad.
//
// Reglas (architecture.md §13.1):
//  - Esta migration no se edita ni se regenera nunca. Cambiar el schema = escribir otra migration.
//  - Una migration que ya corrió en algún ambiente no cambia su efecto; solo se le pueden agregar
//    guardas de idempotencia.
//  - Nunca fijar CHARSET ni COLLATE en un DDL: todo hereda el default de la base.
//
// Cómo funciona (todo o nada):
//  - Si existe la tabla `pedidos`  -> instalación existente: no-op. (Su timestamp es anterior a
//    todas las demás: knex la corre primero, pero en una base existente no hace nada.)
//  - Si la base no tiene NINGUNA tabla (ignorando knex_migrations*) -> crea todo + semillas.
//  - Cualquier otro caso (base a medias) -> error. Una base a medias es un error de instalación
//    y tiene que verse, no tolerarse con CREATE TABLE IF NOT EXISTS.
//
// Orden al crear: tablas sin FKs -> semillas (ids explícitos) -> FKs. Después corren las demás
// migrations, que sobre este schema son no-op (tienen guardas de existencia).

const TABLAS = [
  "CREATE TABLE `adicionales` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `descripcion` varchar(30) DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB",
  "CREATE TABLE `backups` (\n  `nombre` varchar(30) NOT NULL,\n  `fecha` date DEFAULT NULL,\n  PRIMARY KEY (`nombre`)\n) ENGINE=InnoDB",
  "CREATE TABLE `cajas` (\n  `id` int NOT NULL,\n  `idResponsable` int DEFAULT NULL,\n  `fecha` date DEFAULT NULL,\n  `hora` varchar(5) DEFAULT NULL,\n  `fechaBaja` date DEFAULT NULL,\n  `inicial` decimal(10,2) DEFAULT NULL,\n  `ventas` decimal(10,2) DEFAULT NULL,\n  `entradas` decimal(10,2) DEFAULT NULL,\n  `salidas` decimal(10,2) DEFAULT NULL,\n  `finalizada` tinyint(1) DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB",
  "CREATE TABLE `cajas_movimientos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `idCaja` int DEFAULT NULL,\n  `tipoMovimiento` varchar(10) DEFAULT NULL,\n  `monto` decimal(10,2) DEFAULT NULL,\n  `descripcion` varchar(150) DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB",
  "CREATE TABLE `cargos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `nombre` varchar(20) DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB",
  "CREATE TABLE `categorias` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `nombre` varchar(30) DEFAULT NULL,\n  `icono` varchar(5) DEFAULT NULL,\n  `orden` int DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB",
  "CREATE TABLE `eventos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  `loteId` char(36) DEFAULT NULL,\n  `loteIdOrigen` char(36) DEFAULT NULL,\n  `puesto` varchar(60) DEFAULT NULL,\n  `idUsuario` int DEFAULT NULL,\n  `accion` varchar(40) NOT NULL,\n  `entidad` varchar(40) NOT NULL,\n  `entidadId` int DEFAULT NULL,\n  `datosBefore` json DEFAULT NULL,\n  `datosAfter` json DEFAULT NULL,\n  `observacion` varchar(255) DEFAULT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_eventos_lote` (`loteId`),\n  KEY `idx_eventos_entidad` (`entidad`,`entidadId`,`fecha`),\n  KEY `idx_eventos_lote_origen` (`loteIdOrigen`)\n) ENGINE=InnoDB",
  "CREATE TABLE `listas_precio` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `nombre` varchar(30) DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB",
  "CREATE TABLE `mesas` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `idSalon` int DEFAULT NULL,\n  `codigo` varchar(8) DEFAULT NULL,\n  `numero` int DEFAULT '0',\n  `codGrupo` char(36) DEFAULT '',\n  `idPedido` int DEFAULT '0',\n  `combinada` varchar(30) DEFAULT '',\n  `principal` tinyint(1) DEFAULT '1',\n  `asignacion` int DEFAULT '0',\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB",
  "CREATE TABLE `parametros` (\n  `clave` varchar(30) NOT NULL,\n  `valor` varchar(50) NOT NULL DEFAULT '',\n  PRIMARY KEY (`clave`)\n) ENGINE=InnoDB",
  "CREATE TABLE `parametros_facturacion` (\n  `condicion` varchar(50) DEFAULT NULL,\n  `puntoVta` int DEFAULT NULL,\n  `cuil` bigint DEFAULT NULL,\n  `razon` varchar(100) DEFAULT NULL,\n  `direccion` varchar(250) DEFAULT NULL\n) ENGINE=InnoDB",
  "CREATE TABLE `parametros_impresion` (\n  `impresora` varchar(100) DEFAULT NULL,\n  `papel` varchar(10) DEFAULT NULL,\n  `margenIzq` int DEFAULT '0',\n  `margenDer` int DEFAULT '0',\n  `nomLocal` varchar(100) DEFAULT NULL,\n  `desLocal` varchar(100) DEFAULT NULL,\n  `dirLocal` varchar(150) DEFAULT NULL,\n  `comandaDoble` int DEFAULT '0'\n) ENGINE=InnoDB",
  "CREATE TABLE `parametros_mobile` (\n  `imagenes` int DEFAULT '0',\n  `todasMesas` int DEFAULT '0',\n  `impComprobante` int DEFAULT '0',\n  `tema` varchar(20) NOT NULL DEFAULT 'green',\n  `modoOscuro` int NOT NULL DEFAULT '0'\n) ENGINE=InnoDB",
  "CREATE TABLE `pedidos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `idCaja` int DEFAULT '0',\n  `idTipo` int DEFAULT NULL,\n  `idResponsable` int DEFAULT NULL,\n  `idMesa` int DEFAULT NULL,\n  `cliente` varchar(30) DEFAULT NULL,\n  `fecha` date DEFAULT NULL,\n  `fechaBaja` date DEFAULT NULL,\n  `obsBaja` varchar(200) DEFAULT NULL,\n  `hora` varchar(5) DEFAULT NULL,\n  `obs` varchar(200) DEFAULT NULL,\n  `total` decimal(10,2) DEFAULT NULL,\n  `finalizado` tinyint(1) DEFAULT NULL,\n  `ticketImp` varchar(15) DEFAULT '',\n  `comandaImp` varchar(15) DEFAULT '',\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB",
  "CREATE TABLE `pedidos_detalle` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `idPedido` int NOT NULL,\n  `idProducto` int DEFAULT NULL,\n  `descripcion` varchar(100) DEFAULT NULL,\n  `cantidad` int DEFAULT NULL,\n  `costo` decimal(10,2) DEFAULT NULL,\n  `unitario` decimal(10,2) DEFAULT NULL,\n  `total` decimal(10,2) DEFAULT NULL,\n  `obs` varchar(150) DEFAULT NULL,\n  `quitado` int DEFAULT '0',\n  PRIMARY KEY (`id`,`idPedido`)\n) ENGINE=InnoDB",
  "CREATE TABLE `pedidos_factura` (\n  `idPedido` int NOT NULL,\n  `cae` bigint DEFAULT NULL,\n  `caeVto` date DEFAULT NULL,\n  `ticket` int DEFAULT NULL,\n  `tipoFactura` int DEFAULT NULL,\n  `neto` decimal(10,2) DEFAULT NULL,\n  `iva` decimal(10,2) DEFAULT NULL,\n  `dni` bigint DEFAULT NULL,\n  `tipoDni` int DEFAULT NULL,\n  `ptoVenta` int DEFAULT NULL,\n  `condReceptor` int DEFAULT '0',\n  PRIMARY KEY (`idPedido`)\n) ENGINE=InnoDB",
  "CREATE TABLE `pedidos_pago` (\n  `idPedido` int NOT NULL,\n  `monto` decimal(10,2) DEFAULT '0.00',\n  `descuento` decimal(10,2) DEFAULT NULL,\n  `recargo` decimal(10,2) DEFAULT NULL,\n  `tipoRecDes` varchar(10) DEFAULT 'Porcentaje',\n  `obs` varchar(150) DEFAULT NULL,\n  `realizado` tinyint(1) DEFAULT NULL,\n  PRIMARY KEY (`idPedido`)\n) ENGINE=InnoDB",
  "CREATE TABLE `pedidos_pagos_detalle` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `idPedido` int unsigned NOT NULL,\n  `idTPago` int NOT NULL,\n  `monto` decimal(10,2) NOT NULL,\n  `fecha` datetime DEFAULT CURRENT_TIMESTAMP,\n  PRIMARY KEY (`id`),\n  KEY `idPedido` (`idPedido`)\n) ENGINE=InnoDB",
  "CREATE TABLE `pedidos_tipo` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `nombre` varchar(15) DEFAULT NULL,\n  `icono` varchar(20) DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB",
  "CREATE TABLE `productos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `tipo` varchar(15) DEFAULT NULL,\n  `nombre` varchar(80) DEFAULT NULL,\n  `idCategoria` int DEFAULT NULL,\n  `cantidad` int DEFAULT NULL,\n  `imagen` varchar(250) DEFAULT NULL,\n  `descripcion` varchar(130) DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB",
  "CREATE TABLE `productos_adicional` (\n  `idProducto` int NOT NULL,\n  `idAdicional` int NOT NULL,\n  `recargo` decimal(10,2) DEFAULT '0.00',\n  PRIMARY KEY (`idProducto`,`idAdicional`)\n) ENGINE=InnoDB",
  "CREATE TABLE `productos_precio` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `idProducto` int DEFAULT NULL,\n  `idListaPrecio` int DEFAULT NULL,\n  `descripcion` varchar(25) DEFAULT NULL,\n  `posicionDes` varchar(10) DEFAULT 'izquierda',\n  `costo` decimal(10,2) DEFAULT NULL,\n  `precio` decimal(10,2) DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB",
  "CREATE TABLE `roles` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `nombre` varchar(20) DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB",
  "CREATE TABLE `salones` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `descripcion` varchar(20) DEFAULT NULL,\n  `orden` int DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB",
  "CREATE TABLE `tipos_pago` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `nombre` varchar(15) DEFAULT NULL,\n  `icono` varchar(15) DEFAULT NULL,\n  `color` varchar(15) DEFAULT NULL,\n  `orden` int DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB",
  "CREATE TABLE `usuarios` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `nombre` varchar(50) DEFAULT NULL,\n  `email` varchar(100) DEFAULT NULL,\n  `pass` varchar(72) DEFAULT NULL,\n  `idCargo` int DEFAULT NULL,\n  `idRol` int DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB"
];

const FKS = [
  "ALTER TABLE `pedidos_pagos_detalle` ADD CONSTRAINT `pedidos_pagos_detalle_ibfk_1` FOREIGN KEY (`idPedido`) REFERENCES `pedidos` (`id`)"
];

const SEMILLAS = {
  "cargos": {
    "columnas": [
      "id",
      "nombre"
    ],
    "filas": [
      {
        "id": 1,
        "nombre": "ADMINISTRADOR"
      },
      {
        "id": 2,
        "nombre": "EMPLEADO"
      }
    ]
  },
  "categorias": {
    "columnas": [
      "id",
      "nombre",
      "icono",
      "orden"
    ],
    "filas": [
      {
        "id": 1,
        "nombre": "SIN ASIGNAR",
        "icono": "🔺",
        "orden": 999
      }
    ]
  },
  "listas_precio": {
    "columnas": [
      "id",
      "nombre"
    ],
    "filas": [
      {
        "id": 1,
        "nombre": "RESTAURANT"
      },
      {
        "id": 2,
        "nombre": "PARA LLEVAR"
      }
    ]
  },
  "mesas": {
    "columnas": [
      "id",
      "idSalon",
      "codigo",
      "numero",
      "codGrupo",
      "idPedido",
      "combinada",
      "principal",
      "asignacion"
    ],
    "filas": [
      {
        "id": 1,
        "idSalon": 0,
        "codigo": "NINGUNA",
        "numero": 0,
        "codGrupo": "",
        "idPedido": 0,
        "combinada": "",
        "principal": 1,
        "asignacion": 0
      }
    ]
  },
  "parametros": {
    "columnas": [
      "clave",
      "valor"
    ],
    "filas": [
      {
        "clave": "actualizado",
        "valor": "false"
      },
      {
        "clave": "avisoNvaVersion",
        "valor": "true"
      },
      {
        "clave": "backups",
        "valor": "false"
      },
      {
        "clave": "dias",
        "valor": "Lunes, Martes, Viernes"
      },
      {
        "clave": "dni",
        "valor": ""
      },
      {
        "clave": "expresion",
        "valor": ""
      },
      {
        "clave": "hora",
        "valor": "20:30"
      },
      {
        "clave": "modoTrabajo",
        "valor": "pedidos"
      },
      {
        "clave": "version",
        "valor": "1.8.3"
      }
    ]
  },
  "parametros_facturacion": {
    "columnas": [
      "condicion",
      "puntoVta",
      "cuil",
      "razon",
      "direccion"
    ],
    "filas": [
      {
        "condicion": "monotributista",
        "puntoVta": 0,
        "cuil": 0,
        "razon": "",
        "direccion": ""
      }
    ]
  },
  "parametros_impresion": {
    "columnas": [
      "impresora",
      "papel",
      "margenIzq",
      "margenDer",
      "nomLocal",
      "desLocal",
      "dirLocal",
      "comandaDoble"
    ],
    "filas": [
      {
        "impresora": "",
        "papel": "58mm",
        "margenIzq": 0,
        "margenDer": 0,
        "nomLocal": "EASY RESTO",
        "desLocal": "",
        "dirLocal": "",
        "comandaDoble": 0
      }
    ]
  },
  "parametros_mobile": {
    "columnas": [
      "imagenes",
      "todasMesas",
      "impComprobante",
      "tema",
      "modoOscuro"
    ],
    "filas": [
      {
        "imagenes": 0,
        "todasMesas": 0,
        "impComprobante": 0,
        "tema": "green",
        "modoOscuro": 0
      }
    ]
  },
  "pedidos_tipo": {
    "columnas": [
      "id",
      "nombre",
      "icono"
    ],
    "filas": [
      {
        "id": 1,
        "nombre": "RESTAURANTE",
        "icono": "restaurant"
      },
      {
        "id": 2,
        "nombre": "RETIRA",
        "icono": "hail"
      },
      {
        "id": 3,
        "nombre": "DELIVERY",
        "icono": "local_shipping"
      }
    ]
  },
  "roles": {
    "columnas": [
      "id",
      "nombre"
    ],
    "filas": [
      {
        "id": 1,
        "nombre": "ENCARGADO"
      },
      {
        "id": 2,
        "nombre": "CAJERO"
      },
      {
        "id": 3,
        "nombre": "MOZO"
      },
      {
        "id": 4,
        "nombre": "DELIVERY"
      }
    ]
  },
  "salones": {
    "columnas": [
      "id",
      "descripcion",
      "orden"
    ],
    "filas": [
      {
        "id": 1,
        "descripcion": "PRINCIPAL",
        "orden": 1
      }
    ]
  },
  "tipos_pago": {
    "columnas": [
      "id",
      "nombre",
      "icono",
      "color",
      "orden"
    ],
    "filas": [
      {
        "id": 1,
        "nombre": "EFECTIVO",
        "icono": "monetization_on",
        "color": "#2dc051",
        "orden": 1
      },
      {
        "id": 2,
        "nombre": "TARJETA",
        "icono": "credit_card",
        "color": "#ee8b29",
        "orden": 4
      },
      {
        "id": 3,
        "nombre": "TRANSFERENCIA",
        "icono": "account_balance",
        "color": "#2db6c8",
        "orden": 2
      },
      {
        "id": 4,
        "nombre": "COMBINADO",
        "icono": "autorenew",
        "color": "#7d7d7d",
        "orden": 5
      },
      {
        "id": 5,
        "nombre": "QR",
        "icono": "qr_code",
        "color": "#fc7b9b",
        "orden": 3
      }
    ]
  },
  "usuarios": {
    "columnas": [
      "id",
      "nombre",
      "email",
      "pass",
      "idCargo",
      "idRol"
    ],
    "filas": [
      {
        "id": 1,
        "nombre": "ADMIN",
        "email": null,
        "pass": "$2a$10$PKu8seJLppLdmshAoUZ7Eu0eTBBZp0SrG7cqC.XYqOk4kilO9uwBC",
        "idCargo": 1,
        "idRol": 1
      }
    ]
  }
};

const EXCLUIDAS = ['knex_migrations', 'knex_migrations_lock'];

exports.up = async function (knex) {
  const [filas] = await knex.raw(
    "SELECT TABLE_NAME AS nombre FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'"
  );
  const existentes = filas.map((f) => f.nombre).filter((n) => !EXCLUIDAS.includes(n));

  if (existentes.includes('pedidos')) return; // instalación existente: no-op

  if (existentes.length > 0) {
    throw new Error(
      'schema_base: la base tiene ' + existentes.length + ' tabla(s) pero no tiene "pedidos" (' +
      existentes.slice(0, 5).join(', ') + (existentes.length > 5 ? ', …' : '') + '). ' +
      'Es una base a medias (instalación interrumpida o manipulada): no se continúa. ' +
      'Borrar la base y reinstalar.'
    );
  }

  for (const ddl of TABLAS) {
    await knex.raw(ddl);
  }

  for (const [tabla, semilla] of Object.entries(SEMILLAS)) {
    await knex(tabla).insert(semilla.filas);
  }

  for (const ddl of FKS) {
    await knex.raw(ddl);
  }
};

exports.down = async function () {
  // No-op a propósito: una migration nunca borra el schema completo.
};
