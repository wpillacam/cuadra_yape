'use client';

import { useState } from 'react';

export default function PasswordField({ label = 'Contraseña' }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="cy-password-label">
      {label}
      <span className="cy-password">
        <input name="clave" type={visible ? 'text' : 'password'} placeholder="Contraseña"
          autoComplete="current-password" maxLength={128} required />
        <button type="button" className="cy-reveal" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible} onClick={() => setVisible(value => !value)}>
          {visible ? 'Ocultar' : 'Ver'}
        </button>
      </span>
    </label>
  );
}
