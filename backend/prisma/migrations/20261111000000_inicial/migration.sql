CREATE TABLE "ventas" (
    "caja" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "metodo" TEXT NOT NULL,
    "montoCentimos" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "nota" TEXT NOT NULL,
    "foto" BLOB,
    PRIMARY KEY ("caja", "id")
);

CREATE INDEX "ventas_caja_dia_fecha_idx" ON "ventas"("caja", "dia", "fecha");

CREATE TABLE "cierre_dia" (
    "caja" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "cerradoEn" DATETIME NOT NULL,
    PRIMARY KEY ("caja", "dia")
);
