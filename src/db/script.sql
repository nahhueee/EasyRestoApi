DROP DATABASE IF EXISTS dbeasyresto;
CREATE DATABASE dbeasyresto;

USE dbeasyresto;

DROP TABLE IF EXISTS parametros;
CREATE TABLE parametros (
    clave VARCHAR(30) PRIMARY KEY,
    valor VARCHAR(50) NOT NULL DEFAULT ''
);

DROP TABLE IF EXISTS parametros_facturacion;
CREATE TABLE parametros_facturacion (
    condicion VARCHAR(50),
    puntoVta INT,
    cuil BIGINT,
    razon VARCHAR(100),
    direccion VARCHAR(250)
);

DROP TABLE IF EXISTS backups;
CREATE TABLE backups (
    nombre VARCHAR(30) PRIMARY KEY,
    fecha DATE
);

DROP TABLE IF EXISTS usuarios;
CREATE TABLE usuarios (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    email VARCHAR(100),
    pass VARCHAR(30),
    idCargo INT
);

DROP TABLE IF EXISTS mesas;
CREATE TABLE mesas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50)
);

DROP TABLE IF EXISTS cargos;
CREATE TABLE cargos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50)
);

DROP TABLE IF EXISTS rubros;
CREATE TABLE rubros (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100)
);

DROP TABLE IF EXISTS producto_variedad;
CREATE TABLE producto_variedad (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    idRubro INT,
    nombre VARCHAR(100),
    tipo VARCHAR(10),
    imagen VARCHAR(250),
    costo DECIMAL(10,2),
    pLocal DECIMAL(10,2),
    pDelivery DECIMAL(10,2),
    cantidad DECIMAL(5,2)
)
ENGINE=InnoDB;

DROP TABLE IF EXISTS variedad_variante;
CREATE TABLE variedad_variante (
    idProdVar INT,
    nombre VARCHAR(100),
    costo DECIMAL(10,2),
    pLocal DECIMAL(10,2),
    pDelivery DECIMAL(10,2),

    PRIMARY KEY(idProdVar,nombre)
);
ENGINE=InnoDB;

DROP TABLE IF EXISTS variedad_guarnicion;
CREATE TABLE variedad_guarnicion (
    idProdVar INT,
    idGuarnicion INT

    PRIMARY KEY(idProdVar, idGuarnicion)
);
ENGINE=InnoDB;

DROP TABLE IF EXISTS pedidos;
CREATE TABLE pedidos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    idTipo INT,
    idResponsable INT,
    idMesa INT,
    cliente VARCHAR(35),
    fecha DATE,
    fechaBaja DATE,
    hora VARCHAR(5),
    total DECIMAL(10,2),
    obs VARCHAR(200),
    finalizado BOOLEAN
)
ENGINE=InnoDB;

DROP TABLE IF EXISTS pedidos_tipo;
CREATE TABLE pedidos_tipo (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(10)
);

DROP TABLE IF EXISTS pedidos_detalle;
CREATE TABLE pedidos_detalle (
    id INT UNSIGNED AUTO_INCREMENT,
    idPedido INT,
    idProdVar INT,
    prodVar VARCHAR(100),
    tipoProdVar VARCHAR(10),
    cantidad INT,
    unitario DECIMAL(10,2),
    total DECIMAL(10,2),
    obs VARCHAR(150),
    
    PRIMARY KEY(id,idPedido)
)
ENGINE=InnoDB;

DROP TABLE IF EXISTS pedidos_factura;
CREATE TABLE pedidos_factura (
    idPedido INT PRIMARY KEY,
    cae BIGINT,
    caeVto DATE,
    ticket INT,
    tipoFactura INT,
    neto DECIMAL(10,2),
    iva DECIMAL(10,2),
    dni BIGINT,
    tipoDni INT,
    ptoVenta INT
)
ENGINE=InnoDB;

DROP TABLE IF EXISTS pedidos_pago;
CREATE TABLE pedidos_pago (
    idPedido INT PRIMARY KEY,
    idPago INT,
    efectivo DECIMAL(10,2),
    digital DECIMAL(10,2),
    descuento DECIMAL(4,2),
    recargo DECIMAL(4,2),
    realizado BOOLEAN
)
ENGINE=InnoDB;

DROP TABLE IF EXISTS tipos_pago;
CREATE TABLE tipos_pago (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(15)
);

INSERT INTO parametros(clave, valor) 
VALUES 
('version','1.0.0'),
('dni',''), 
('expresion',''), 
('backups', 'false'), 
('dias', 'Lunes, Martes, Viernes'), 
('hora', '20:30'), 
('avisoNvaVersion', 'true'),
('actualizado', 'false');

INSERT INTO parametros_facturacion(condicion, puntoVta, cuil, razon, direccion) 
VALUES ('monotributista', 0, 0, '', '');

INSERT INTO tipos_pago(id, nombre) VALUES (NULL,'EFECTIVO'), (NULL,'TARJETA'), (NULL,'TRANSFERENCIA'), (NULL,'COMBINADO');
INSERT INTO cargos(id, nombre) VALUES (NULL,'ADMINISTRADOR'), (NULL,'EMPLEADO');
INSERT INTO rubros(id, nombre) VALUES (NULL,'SIN ASIGNAR');
INSERT INTO mesas(id, codigo) VALUES (NULL,'NINGUNA');
INSERT INTO usuarios(id, nombre, email, pass, idCargo) VALUES (NULL, 'ADMIN', NULL, '1235', 1);
INSERT INTO pedidos_tipo (id, nombre) VALUES (NULL, 'RESTAURANT'), (NULL, 'DELIVERY');
