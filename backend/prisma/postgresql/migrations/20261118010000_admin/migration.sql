CREATE TABLE "administradores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claveHash" TEXT NOT NULL,
    "sesionKey" TEXT NOT NULL
);
ALTER TABLE "administradores" ENABLE ROW LEVEL SECURITY;
