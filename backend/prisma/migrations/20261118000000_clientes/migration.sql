CREATE TABLE "clientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "negocio" TEXT NOT NULL,
    "rubro" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "inicio" TEXT NOT NULL,
    "fin" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "claveHash" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "clientes_usuario_key" ON "clientes"("usuario");
