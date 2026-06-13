-- ============================================
-- BASE DE DATOS: GobiernoMunicipal_VillaNueva
-- ============================================

CREATE DATABASE GobiernoMunicipal_VillaNueva;
USE GobiernoMunicipal_VillaNueva;

-- 1. TABLA: departamentos
CREATE TABLE departamentos (
    id_departamento INT PRIMARY KEY AUTO_INCREMENT,
    nombre_departamento VARCHAR(100) NOT NULL,
    presupuesto_asignado DECIMAL(12,2),
    telefono VARCHAR(20)
);

-- 2. TABLA: empleados
CREATE TABLE empleados (
    id_empleado INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    dni VARCHAR(20) UNIQUE NOT NULL,
    cargo VARCHAR(100),
    id_departamento INT,
    fecha_ingreso DATE,
    salario DECIMAL(10,2),
    FOREIGN KEY (id_departamento) REFERENCES departamentos(id_departamento)
);

-- 3. TABLA: ciudadanos
CREATE TABLE ciudadanos (
    id_ciudadano INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    dni VARCHAR(20) UNIQUE NOT NULL,
    fecha_nacimiento DATE,
    direccion VARCHAR(200),
    telefono VARCHAR(20),
    email VARCHAR(100)
);

-- 4. TABLA: tramites
CREATE TABLE tramites (
    id_tramite INT PRIMARY KEY AUTO_INCREMENT,
    id_ciudadano INT,
    tipo_tramite VARCHAR(100),
    fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(50),
    id_empleado_asignado INT,
    FOREIGN KEY (id_ciudadano) REFERENCES ciudadanos(id_ciudadano),
    FOREIGN KEY (id_empleado_asignado) REFERENCES empleados(id_empleado)
);

-- 5. TABLA: licencias_conducir
CREATE TABLE licencias_conducir (
    id_licencia INT PRIMARY KEY AUTO_INCREMENT,
    id_ciudadano INT,
    numero_licencia VARCHAR(50) UNIQUE,
    categoria VARCHAR(10),
    fecha_emision DATE,
    fecha_vencimiento DATE,
    FOREIGN KEY (id_ciudadano) REFERENCES ciudadanos(id_ciudadano)
);

-- 6. TABLA: propiedades
CREATE TABLE propiedades (
    id_propiedad INT PRIMARY KEY AUTO_INCREMENT,
    id_ciudadano INT,
    direccion VARCHAR(200),
    tipo VARCHAR(50),
    valor_catastral DECIMAL(12,2),
    numero_catastral VARCHAR(50) UNIQUE,
    FOREIGN KEY (id_ciudadano) REFERENCES ciudadanos(id_ciudadano)
);

-- 7. TABLA: impuestos_prediales
CREATE TABLE impuestos_prediales (
    id_impuesto INT PRIMARY KEY AUTO_INCREMENT,
    id_propiedad INT,
    anio INT,
    monto DECIMAL(10,2),
    pagado BOOLEAN DEFAULT FALSE,
    fecha_vencimiento DATE,
    FOREIGN KEY (id_propiedad) REFERENCES propiedades(id_propiedad)
);

-- 8. TABLA: contribuyentes
CREATE TABLE contribuyentes (
    id_contribuyente INT PRIMARY KEY AUTO_INCREMENT,
    id_ciudadano INT,
    regimen VARCHAR(50),
    fecha_registro DATE,
    FOREIGN KEY (id_ciudadano) REFERENCES ciudadanos(id_ciudadano)
);

-- 9. TABLA: facturas_servicios
CREATE TABLE facturas_servicios (
    id_factura INT PRIMARY KEY AUTO_INCREMENT,
    id_contribuyente INT,
    servicio VARCHAR(100),
    periodo VARCHAR(20),
    monto DECIMAL(10,2),
    estado_pago VARCHAR(30),
    FOREIGN KEY (id_contribuyente) REFERENCES contribuyentes(id_contribuyente)
);

-- 10. TABLA: personal_eventual
CREATE TABLE personal_eventual (
    id_eventual INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(80),
    dni VARCHAR(20),
    contrato_tipo VARCHAR(50),
    fecha_inicio DATE,
    fecha_fin DATE,
    id_departamento INT,
    FOREIGN KEY (id_departamento) REFERENCES departamentos(id_departamento)
);

-- 11. TABLA: proyectos_obra_publica
CREATE TABLE proyectos_obra_publica (
    id_proyecto INT PRIMARY KEY AUTO_INCREMENT,
    nombre_proyecto VARCHAR(150),
    descripcion TEXT,
    presupuesto_total DECIMAL(14,2),
    fecha_inicio DATE,
    fecha_fin_estimada DATE,
    estado VARCHAR(50),
    id_departamento_responsable INT,
    FOREIGN KEY (id_departamento_responsable) REFERENCES departamentos(id_departamento)
);

-- 12. TABLA: proveedores
CREATE TABLE proveedores (
    id_proveedor INT PRIMARY KEY AUTO_INCREMENT,
    razon_social VARCHAR(150),
    ruc VARCHAR(30) UNIQUE,
    direccion VARCHAR(200),
    telefono VARCHAR(20),
    email VARCHAR(100)
);

-- 13. TABLA: contrataciones
CREATE TABLE contrataciones (
    id_contratacion INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT,
    id_proveedor INT,
    monto_contrato DECIMAL(12,2),
    fecha_contrato DATE,
    plazo_entrega INT,
    FOREIGN KEY (id_proyecto) REFERENCES proyectos_obra_publica(id_proyecto),
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor)
);

-- 14. TABLA: vehículos_municipales
CREATE TABLE vehiculos_municipales (
    id_vehiculo INT PRIMARY KEY AUTO_INCREMENT,
    placa VARCHAR(20) UNIQUE,
    marca VARCHAR(50),
    modelo VARCHAR(50),
    anio INT,
    estado VARCHAR(50),
    id_departamento_asignado INT,
    FOREIGN KEY (id_departamento_asignado) REFERENCES departamentos(id_departamento)
);

-- 15. TABLA: multas_transito
CREATE TABLE multas_transito (
    id_multa INT PRIMARY KEY AUTO_INCREMENT,
    id_ciudadano INT,
    id_vehiculo INT,
    fecha_multa DATE,
    monto DECIMAL(8,2),
    motivo TEXT,
    pagada BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_ciudadano) REFERENCES ciudadanos(id_ciudadano),
    FOREIGN KEY (id_vehiculo) REFERENCES vehiculos_municipales(id_vehiculo)
);

-- 16. TABLA: eventos_comunitarios
CREATE TABLE eventos_comunitarios (
    id_evento INT PRIMARY KEY AUTO_INCREMENT,
    nombre_evento VARCHAR(150),
    fecha_evento DATETIME,
    lugar VARCHAR(200),
    presupuesto DECIMAL(10,2),
    id_organizador INT,
    FOREIGN KEY (id_organizador) REFERENCES empleados(id_empleado)
);

-- 17. TABLA: asistentes_eventos
CREATE TABLE asistentes_eventos (
    id_asistente INT PRIMARY KEY AUTO_INCREMENT,
    id_evento INT,
    id_ciudadano INT,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_evento) REFERENCES eventos_comunitarios(id_evento),
    FOREIGN KEY (id_ciudadano) REFERENCES ciudadanos(id_ciudadano)
);

-- 18. TABLA: quejas_sugerencias
CREATE TABLE quejas_sugerencias (
    id_queja INT PRIMARY KEY AUTO_INCREMENT,
    id_ciudadano INT,
    tipo VARCHAR(50),
    descripcion TEXT,
    fecha_reporte DATETIME DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(50),
    FOREIGN KEY (id_ciudadano) REFERENCES ciudadanos(id_ciudadano)
);

-- 19. TABLA: nominas_pagos
CREATE TABLE nominas_pagos (
    id_nomina INT PRIMARY KEY AUTO_INCREMENT,
    id_empleado INT,
    anio INT,
    mes INT,
    monto_total DECIMAL(10,2),
    fecha_pago DATE,
    FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado)
);

-- 20. TABLA: permisos_construccion
CREATE TABLE permisos_construccion (
    id_permiso INT PRIMARY KEY AUTO_INCREMENT,
    id_propiedad INT,
    id_ciudadano INT,
    fecha_solicitud DATE,
    fecha_aprobacion DATE,
    estado VARCHAR(50),
    area_construida DECIMAL(8,2),
    FOREIGN KEY (id_propiedad) REFERENCES propiedades(id_propiedad),
    FOREIGN KEY (id_ciudadano) REFERENCES ciudadanos(id_ciudadano)
);

-- ============================================
-- INSERCIÓN DE DATOS DE EJEMPLO (OPCIONAL)
-- ============================================

INSERT INTO departamentos (nombre_departamento, presupuesto_asignado, telefono) VALUES
('Recursos Humanos', 1500000.00, '555-1001'),
('Finanzas', 2000000.00, '555-1002'),
('Obras Públicas', 5000000.00, '555-1003'),
('Tránsito', 800000.00, '555-1004');

INSERT INTO empleados (nombre, apellido, dni, cargo, id_departamento, fecha_ingreso, salario) VALUES
('Carlos', 'Pérez', '12345678', 'Director RRHH', 1, '2010-05-10', 85000.00),
('María', 'Gómez', '87654321', 'Analista Financiero', 2, '2015-03-22', 62000.00);

INSERT INTO ciudadanos (nombre, apellido, dni, fecha_nacimiento, direccion, telefono, email) VALUES
('Juan', 'López', '33445566', '1985-07-15', 'Av. Central 123', '555-2020', 'juan@mail.com'),
('Ana', 'Martínez', '99887744', '1990-11-02', 'Calle 8 Nro 456', '555-3030', 'ana@mail.com');

-- Fin del script