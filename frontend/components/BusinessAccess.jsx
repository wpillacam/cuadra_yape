'use client';

import { useEffect, useState } from 'react';
import { accountRequest } from '../lib/accounts';
import { saveBusinessProfile } from '../lib/ledger';
import Caja from './Caja';
import './admin.css';
import LoginShell from './LoginShell';
import PasswordField from './PasswordField';

export default function BusinessAccess() {
  const [businessId, setBusinessId] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('caja');
    setBusinessId(/^[a-f0-9-]{36}$/.test(id || '') ? id : null);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  async function signIn(event) {
    event.preventDefault();
    const { usuario, clave, pin } = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      const business = await accountRequest('/negocio/sesion', { method: 'POST', body: { usuario, clave } });
      await saveBusinessProfile(pin, business);
      try { localStorage.setItem('cuadra-negocio', business.id); } catch {}
      location.replace('/negocio?caja=' + business.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (businessId === undefined) return <main className="screen">Abriendo acceso…</main>;
  if (businessId) return <Caja business />;

  return <LoginShell onSubmit={signIn}>
      <label>Usuario<input name="usuario" placeholder="Usuario" autoComplete="username" maxLength={40} required /></label>
      <PasswordField />
      <label>PIN para este dispositivo<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required /></label>
      <p className="cy-pin-help">Elige cuatro dígitos para abrir tu caja en este celular.</p>
      {error && <p role="alert" className="cy-error">{error}</p>}
      <button className="cy-primary" disabled={busy}>{busy ? 'Verificando…' : 'Iniciar sesión'}</button>
      <a href="/">Volver a Cuadra Dinero</a>
  </LoginShell>;
}
