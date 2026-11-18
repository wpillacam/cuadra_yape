import 'dotenv/config';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const clave = input.trim();
  if (clave.length < 8 || clave.length > 128) throw new Error('Usa una clave de 8 a 128 caracteres.');
  const salt = randomBytes(16).toString('hex');
  const digest = (await promisify(scrypt)(clave, salt, 64)).toString('hex');
  const credentials = { claveHash: salt + ':' + digest, sesionKey: randomBytes(32).toString('hex') };
  await prisma.administrador.upsert({
    where: { id: 'admin' },
    create: { id: 'admin', ...credentials },
    update: credentials,
  });
  console.log('Clave administrativa guardada como hash scrypt.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
