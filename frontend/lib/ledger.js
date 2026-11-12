import { openDB } from 'idb';

let database;
let syncing;
const lima = { timeZone: 'America/Lima' };
const dayFormat = new Intl.DateTimeFormat('sv-SE', lima);
const timeFormat = new Intl.DateTimeFormat('es-PE', { ...lima, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const dayOf = (date = new Date()) => dayFormat.format(date);
export const timeOf = date => timeFormat.format(new Date(date));
export const money = cents => 'S/ ' + (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));

export function centsFrom(text) {
  if (!/^\d{1,6}(?:[.,]\d{0,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split(/[.,]/);
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function totals(sales) {
  let yape = 0;
  let efectivo = 0;
  for (const sale of sales) {
    if (sale.metodo === 'YAPE') yape += sale.montoCentimos;
    else efectivo += sale.montoCentimos;
  }
  return { yape, efectivo, total: yape + efectivo, cantidad: sales.length };
}

function db() {
  database ??= openDB('cuadra-yape', 1, {
    upgrade(store) {
      store.createObjectStore('ventas', { keyPath: 'id' }).createIndex('pending', 'pending');
      store.createObjectStore('cierres', { keyPath: 'dia' }).createIndex('pending', 'pending');
      store.createObjectStore('ajustes');
    },
  });
  return database;
}

export async function readLedger() {
  const local = await db();
  const transaction = local.transaction(['ventas', 'cierres']);
  const [sales, closes] = await Promise.all([
    transaction.objectStore('ventas').getAll(), transaction.objectStore('cierres').getAll(),
  ]);
  return { sales: sales.sort((a, b) => b.fecha.localeCompare(a.fecha)), closes };
}

export async function saveSale(sale) {
  await (await db()).add('ventas', { ...sale, pending: 1 });
}

export async function saveClose(close) {
  const local = await db();
  const tx = local.transaction('cierres', 'readwrite');
  if (!(await tx.store.get(close.dia))) await tx.store.add({ ...close, pending: 1 });
  await tx.done;
}

const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

async function pinHash(pin, salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', iterations: 210_000, salt: encoder.encode(salt),
  }, key, 256)));
}

export async function readProfile() {
  return (await db()).get('ajustes', 'perfil');
}

export async function createProfile(pin) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const profile = { salt, hash: await pinHash(pin, salt), token: hex(crypto.getRandomValues(new Uint8Array(32))) };
  await (await db()).add('ajustes', profile, 'perfil');
  return profile;
}

export async function verifyPin(pin, profile) {
  return (await pinHash(pin, profile.salt)) === profile.hash;
}

export function syncLedger(token) {
  syncing ??= sendPending(token).finally(() => { syncing = null; });
  return syncing;
}

async function sendPending(token) {
  const local = await db();
  const [sales, closes] = await Promise.all([
    local.getAllFromIndex('ventas', 'pending', 1), local.getAllFromIndex('cierres', 'pending', 1),
  ]);
  let changed = false;
  const requests = [
    ...sales.map(({ pending, ...sale }) => ({
      path: '/api/ventas', method: 'POST', store: 'ventas', value: sale,
    })),
    ...closes.map(({ pending, ...close }) => ({
      path: '/api/cierre/' + close.dia, method: 'PUT', store: 'cierres', value: close,
    })),
  ];

  for (const { path, method, store, value } of requests) {
    try {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(value),
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      });
      if (response.status >= 500) break;
      if (!response.ok) continue;
      await local.put(store, { ...value, pending: 0 });
      changed = true;
    } catch {
      break;
    }
  }
  return changed;
}

export async function voucher(file) {
  if (!file || file.size > 15_000_000) throw new Error('Elige una foto de hasta 15 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/jpeg', 0.72);
    if (image.length > 700_000) throw new Error('La foto es muy grande.');
    return image;
  } finally {
    bitmap.close();
  }
}
