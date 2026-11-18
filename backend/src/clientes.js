import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import express from 'express';

const derive = promisify(scrypt);
const lima = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' });
const publicFields = ['id', 'negocio', 'rubro', 'nombre', 'apellido', 'dni', 'correo', 'telefono',
  'inicio', 'fin', 'usuario', 'creadoEn'];
const select = Object.fromEntries(publicFields.map(field => [field, true]));

function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function throttle(_req, res, next) {
  const now = Date.now();
  if (now >= attemptWindow) {
    attemptWindow = now + 60_000;
    attempts = 0;
  }
  if (++attempts > 30) return res.status(429).json({ error: 'Espera un minuto antes de intentar de nuevo.' });
  next();
}
let attemptWindow = 0;
let attempts = 0;

async function hashPassword(password, salt) {
  return (await derive(password, salt, 64)).toString('hex');
}

async function generateCredentials() {
  const clave = randomBytes(18).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  return { clave, claveHash: salt + ':' + await hashPassword(clave, salt) };
}

function sessionSignature(value, key) {
  return createHmac('sha256', key).update('admin:' + value).digest('hex');
}

function businessSignature(cliente) {
  return createHmac('sha256', cliente.claveHash).update('caja:' + cliente.id).digest('hex');
}

function vigente(cliente) {
  const hoy = lima.format(new Date());
  return cliente.inicio <= hoy && hoy <= cliente.fin;
}

function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(date + 'T00:00:00Z');
  return Number.isFinite(+value) && value.toISOString().slice(0, 10) === date;
}

function customerFields(body) {
  const fields = {};
  for (const name of ['negocio', 'rubro', 'nombre', 'apellido', 'dni', 'correo', 'telefono', 'inicio', 'fin']) {
    const value = body?.[name];
    if (typeof value !== 'string' || value.length > 160) return null;
    fields[name] = value.trim();
  }
  if (!fields.negocio || !fields.rubro || !fields.nombre || !fields.apellido ||
    !/^\d{8}$/.test(fields.dni) || (fields.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.correo)) ||
    !validDate(fields.inicio) || !validDate(fields.fin) || fields.fin < fields.inicio) return null;
  return fields;
}

export function customerRoutes(prisma) {
  const router = express.Router();

  router.post('/admin/sesion', throttle, async (req, res) => {
    const admin = await prisma.administrador.findUnique({ where: { id: 'admin' } });
    if (!admin) return res.status(503).json({ error: 'Configura la clave de administración en la base de datos.' });
    const clave = req.body?.clave;
    if (typeof clave !== 'string' || clave.length > 128) {
      return res.status(401).json({ error: 'Clave de administración incorrecta.' });
    }
    const [salt, digest] = admin.claveHash.split(':');
    if (!equal(await hashPassword(clave, salt), digest)) return res.status(401).json({ error: 'Clave de administración incorrecta.' });
    const expiration = String(Date.now() + 60 * 60 * 1000);
    res.json({ token: expiration + '.' + sessionSignature(expiration, admin.sesionKey) });
  });

  router.use('/admin', async (req, res, next) => {
    const match = /^Bearer (\d{13})\.([a-f0-9]{64})$/.exec(req.get('Authorization') || '');
    if (!match || Number(match[1]) <= Date.now()) {
      return res.status(401).json({ error: 'Vuelve a iniciar sesión.' });
    }
    const admin = await prisma.administrador.findUnique({ where: { id: 'admin' } });
    if (!admin || !equal(match[2], sessionSignature(match[1], admin.sesionKey))) {
      return res.status(401).json({ error: 'Vuelve a iniciar sesión.' });
    }
    next();
  });

  router.get('/admin/clientes', async (_req, res) => {
    res.json(await prisma.cliente.findMany({ select, orderBy: { creadoEn: 'desc' } }));
  });

  router.post('/admin/clientes', async (req, res) => {
    const fields = customerFields(req.body);
    const usuario = typeof req.body?.usuario === 'string' ? req.body.usuario.trim().toLowerCase() : '';
    if (!fields || !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(usuario)) {
      return res.status(400).json({ error: 'Revisa los datos, el usuario y las fechas de servicio.' });
    }
    const { clave, claveHash } = await generateCredentials();
    try {
      const cliente = await prisma.cliente.create({
        data: { ...fields, id: randomUUID(), usuario, claveHash }, select,
      });
      return res.status(201).json({ cliente, clave });
    } catch (error) {
      if (error.code !== 'P2002') throw error;
      return res.status(409).json({ error: 'Ese usuario ya está en uso.' });
    }
  });

  router.patch('/admin/clientes/:id', async (req, res) => {
    const fields = customerFields(req.body);
    if (!fields) return res.status(400).json({ error: 'Revisa los datos y las fechas de servicio.' });
    try {
      res.json(await prisma.cliente.update({ where: { id: req.params.id }, data: fields, select }));
    } catch (error) {
      if (error.code !== 'P2025') throw error;
      res.status(404).json({ error: 'El cliente ya no existe.' });
    }
  });

  router.post('/admin/clientes/:id/clave', async (req, res) => {
    const { clave, claveHash } = await generateCredentials();
    try {
      const cliente = await prisma.cliente.update({ where: { id: req.params.id }, data: { claveHash }, select });
      res.json({ cliente, clave });
    } catch (error) {
      if (error.code !== 'P2025') throw error;
      res.status(404).json({ error: 'El cliente ya no existe.' });
    }
  });

  router.post('/negocio/sesion', throttle, async (req, res) => {
    const { usuario, clave } = req.body || {};
    if (typeof usuario !== 'string' || usuario.length > 80 || typeof clave !== 'string' || clave.length > 128) {
      return res.status(400).json({ error: 'Ingresa el usuario y la clave del negocio.' });
    }
    const cliente = await prisma.cliente.findUnique({ where: { usuario: usuario.trim().toLowerCase() } });
    const [salt, digest] = cliente?.claveHash.split(':') || ['0'.repeat(32), '0'.repeat(128)];
    if (!equal(await hashPassword(clave, salt), digest) || !cliente) {
      return res.status(401).json({ error: 'Usuario o clave incorrectos.' });
    }
    if (!vigente(cliente)) return res.status(403).json({ error: 'El servicio del negocio está fuera de vigencia.' });
    res.json({ id: cliente.id, negocio: cliente.negocio, inicio: cliente.inicio, fin: cliente.fin,
      token: cliente.id + '.' + businessSignature(cliente) });
  });

  return router;
}

export function requireCaja(prisma, hashLegacyToken) {
  return async (req, res, next) => {
    const authorization = req.get('Authorization') || '';
    const managed = /^Bearer ([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(authorization);
    if (managed) {
      const cliente = await prisma.cliente.findUnique({ where: { id: managed[1] } });
      if (!cliente || !equal(managed[2], businessSignature(cliente))) {
        return res.status(401).json({ error: 'Vuelve a ingresar con las credenciales del negocio.' });
      }
      if (!vigente(cliente)) return res.status(403).json({ error: 'El servicio del negocio está fuera de vigencia.' });
      res.locals.caja = cliente.id;
    } else {
      const legacy = /^Bearer ([a-f0-9]{64})$/.exec(authorization);
      if (!legacy) return res.status(401).json({ error: 'Caja no identificada' });
      res.locals.caja = hashLegacyToken(legacy[1]);
    }
    next();
  };
}
