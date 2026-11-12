import { createHash } from 'node:crypto';
import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const lima = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicSale = {
  id: true, dia: true, fecha: true, metodo: true, montoCentimos: true, descripcion: true, nota: true,
};

function validDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(day + 'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === day;
}

app.disable('x-powered-by');
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const token = /^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization') || '');
  if (!token) return res.status(401).json({ error: 'Caja no identificada' });
  res.locals.caja = createHash('sha256').update(token[1]).digest('hex');
  next();
});
app.use(express.json({ limit: '1mb' }));

app.post('/api/ventas', async (req, res) => {
  const { id, fecha, metodo, montoCentimos, descripcion, nota, foto } = req.body || {};
  const date = typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(fecha) ? new Date(fecha) : null;
  if (
    typeof id !== 'string' || !uuid.test(id) || !date || !Number.isFinite(+date) || date.toISOString() !== fecha ||
    !['YAPE', 'EFECTIVO'].includes(metodo) ||
    !Number.isInteger(montoCentimos) || montoCentimos < 1 || montoCentimos > 99_999_999 ||
    !['', 'Desayuno', 'Jugo', 'Menú'].includes(descripcion) ||
    typeof nota !== 'string' || nota.length > 120 ||
    (foto != null && (metodo !== 'YAPE' || typeof foto !== 'string' || foto.length > 700_000 ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(foto)))
  ) {
    return res.status(400).json({ error: 'Datos de venta inválidos' });
  }
  const caja = res.locals.caja;
  const venta = await prisma.venta.upsert({
    where: { caja_id: { caja, id } },
    update: {},
    create: {
      caja, id, fecha: date, dia: lima.format(date), metodo, montoCentimos, descripcion, nota,
      foto: foto ? Buffer.from(foto.split(',')[1], 'base64') : null,
    },
    select: publicSale,
  });
  res.json(venta);
});

app.get('/api/ventas/:dia', async (req, res) => {
  const { dia } = req.params;
  if (!validDay(dia)) return res.status(400).json({ error: 'Fecha inválida' });
  res.json(await prisma.venta.findMany({
    where: { caja: res.locals.caja, dia }, select: publicSale, orderBy: { fecha: 'desc' },
  }));
});

async function readClose(caja, dia) {
  const [cierre, grupos] = await prisma.$transaction([
    prisma.cierreDia.findUnique({ where: { caja_dia: { caja, dia } } }),
    prisma.venta.groupBy({
      by: ['metodo'], where: { caja, dia }, _sum: { montoCentimos: true }, _count: { _all: true },
    }),
  ]);
  const yape = grupos.find(grupo => grupo.metodo === 'YAPE')?._sum.montoCentimos ?? 0;
  const efectivo = grupos.find(grupo => grupo.metodo === 'EFECTIVO')?._sum.montoCentimos ?? 0;
  return {
    dia, cerradoEn: cierre?.cerradoEn ?? null, yape, efectivo, total: yape + efectivo,
    cantidad: grupos.reduce((total, grupo) => total + grupo._count._all, 0),
  };
}

app.put('/api/cierre/:dia', async (req, res) => {
  const { dia } = req.params;
  const { cerradoEn } = req.body || {};
  const fecha = typeof cerradoEn === 'string' ? new Date(cerradoEn) : null;
  if (!validDay(dia) || !fecha || !Number.isFinite(+fecha) || fecha.toISOString() !== cerradoEn ||
    lima.format(fecha) !== dia) {
    return res.status(400).json({ error: 'Fecha de cierre inválida' });
  }
  const caja = res.locals.caja;
  await prisma.cierreDia.upsert({
    where: { caja_dia: { caja, dia } }, create: { caja, dia, cerradoEn: fecha }, update: {},
  });
  res.json(await readClose(caja, dia));
});

app.get('/api/cierre/:dia', async (req, res) => {
  if (!validDay(req.params.dia)) return res.status(400).json({ error: 'Fecha inválida' });
  res.json(await readClose(res.locals.caja, req.params.dia));
});

app.use((error, req, res, next) => {
  if (error.status === 400 || error.status === 413) {
    return res.status(error.status).json({ error: 'Datos inválidos o demasiado grandes' });
  }
  console.error(error);
  res.status(500).json({ error: 'No se pudo guardar o consultar la caja' });
});

export default app;
