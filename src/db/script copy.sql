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
    nombre VARCHAR(50),
    email VARCHAR(100),
    pass VARCHAR(30),
    idCargo INT,
    idRol INT
);

DROP TABLE IF EXISTS cargos;
CREATE TABLE cargos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(20)
);

DROP TABLE IF EXISTS roles;
CREATE TABLE roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(20)
);

DROP TABLE IF EXISTS categorias;
CREATE TABLE categorias (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(20),
    icono VARCHAR(2),
    favorita BOOLEAN
);

DROP TABLE IF EXISTS mesas;
CREATE TABLE mesas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(8),
    disponible BOOLEAN,
    icono VARCHAR(150),
    combinada VARCHAR(10),
    principal BOOLEAN
);

DROP TABLE IF EXISTS adicionales;
CREATE TABLE adicionales (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    descripcion VARCHAR(30)
);

DROP TABLE IF EXISTS listas_precio;
CREATE TABLE listas_precio (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(30)
);

DROP TABLE IF EXISTS productos;
CREATE TABLE productos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(15),
    nombre VARCHAR(80),
    idCategoria INT,
    cantidad INT,
    imagen VARCHAR(250),
    descripcion VARCHAR(130)
)ENGINE=InnoDB;

DROP TABLE IF EXISTS productos_adicional;
CREATE TABLE productos_adicional (
    idProducto INT,
    idAdicional INT,
    recargo DECIMAL(5,2),
    PRIMARY KEY(idProducto,idAdicional)
)ENGINE=InnoDB;

DROP TABLE IF EXISTS productos_precio;
CREATE TABLE productos_precio (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    idProducto INT,
    idListaPrecio INT,
    descripcion VARCHAR(15),
    costo DECIMAL(10,2),
    precio DECIMAL(10,2),
    mostrarDesc BOOLEAN
)ENGINE=InnoDB;

DROP TABLE IF EXISTS pedidos;
CREATE TABLE pedidos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    idTipo INT,
    idResponsable INT,
    idMesa INT,
    cliente VARCHAR(30),
    fecha DATE,
    fechaBaja DATE,
    hora VARCHAR(5),
    obs VARCHAR(200),
    finalizado BOOLEAN
)
ENGINE=InnoDB;

DROP TABLE IF EXISTS pedidos_tipo;
CREATE TABLE pedidos_tipo (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(15),
    icono VARCHAR(20)
);

DROP TABLE IF EXISTS pedidos_detalle;
CREATE TABLE pedidos_detalle (
    id INT UNSIGNED AUTO_INCREMENT,
    idPedido INT,
    idProducto INT,
    descripcion VARCHAR(100),
    cantidad INT,
    costo DECIMAL(10,2),
    unitario DECIMAL(10,2),
    total DECIMAL(10,2),
    obs VARCHAR(150),
    
    PRIMARY KEY(id,idPedido)
)ENGINE=InnoDB;

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
    ptoVenta INT,
    condReceptor INT DEFAULT 0
)ENGINE=InnoDB;

DROP TABLE IF EXISTS pedidos_pago;
CREATE TABLE pedidos_pago (
    idPedido INT PRIMARY KEY,
    idTPago INT,
    efectivo DECIMAL(10,2),
    digital DECIMAL(10,2),
    descuento DECIMAL(4,2),
    recargo DECIMAL(4,2),
    realizado BOOLEAN
)ENGINE=InnoDB;

DROP TABLE IF EXISTS tipos_pago;
CREATE TABLE tipos_pago (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(15)
);

INSERT INTO parametros(clave, valor) 
VALUES 
('version','1.3.0'),
('dni',''), 
('expresion',''), 
('backups', 'false'), 
('dias', 'Lunes, Martes, Viernes'), 
('hora', '20:30'), 
('avisoNvaVersion', 'true'),
('actualizado', 'false');

INSERT INTO parametros_facturacion(condicion, puntoVta, cuil, razon, direccion) 
VALUES ('monotributista', 0, 0, '', '');

INSERT INTO listas_precio(id, nombre) VALUES (NULL,'RESTAURANT'), (NULL,'PARA LLEVAR');
INSERT INTO tipos_pago(id, nombre) VALUES (NULL,'EFECTIVO'), (NULL,'TARJETA'), (NULL,'TRANSFERENCIA'), (NULL,'COMBINADO');
INSERT INTO cargos(id, nombre) VALUES (NULL,'ADMINISTRADOR'), (NULL,'EMPLEADO');
INSERT INTO roles(id, nombre) VALUES (NULL,'ENCARGADO'), (NULL,'CAJERO'), (NULL,'MOZO'), (NULL,'DELIVERY');
INSERT INTO categorias(id, nombre, icono, favorita) VALUES (NULL,'SIN ASIGNAR', '🔺', 0);
INSERT INTO mesas(id, codigo) VALUES (NULL,'NINGUNA');
INSERT INTO usuarios(id, nombre, email, pass, idCargo, idRol) VALUES (NULL, 'ADMIN', NULL, '1235', 1, 1);
INSERT INTO pedidos_tipo (id, nombre, icono) VALUES (NULL, 'RESTAURANTE', 'restaurant'), (NULL, 'RETIRA', 'hail'), (NULL, 'DELIVERY', 'local_shipping');