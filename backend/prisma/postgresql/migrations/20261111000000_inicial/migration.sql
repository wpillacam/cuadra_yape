CREATE TABLE "ventas" (
    "caja" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "metodo" TEXT NOT NULL,
    "montoCentimos" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "nota" TEXT NOT NULL,
    "foto" BYTEA,
    CONSTRAINT "ventas_pkey" PRIMARY KEY ("caja", "id")
);

CREATE INDEX "ventas_caja_dia_fecha_idx" ON "ventas"("caja", "dia", "fecha");

CREATE TABLE "cierre_dia" (
    "caja" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "cerradoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cierre_dia_pkey" PRIMARY KEY ("caja", "dia")
);

ALTER TABLE "ventas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cierre_dia" ENABLE ROW LEVEL SECURITY;
