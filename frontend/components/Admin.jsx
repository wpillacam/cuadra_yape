'use client';

import { useEffect, useState } from 'react';
import { accountRequest } from '../lib/accounts';
import { dayOf } from '../lib/ledger';
import './admin.css';
import Brand from './Brand';
import LoginShell from './LoginShell';
import PasswordField from './PasswordField';
import ButtonIcon from './ButtonIcon';

const labels = { active: 'Activo', upcoming: 'Programado', expired: 'Vencido' };
const columns = [
  ['negocio', 'Nombre del negocio'], ['rubro', 'Rubro'], ['dni', 'DNI'], ['nombre', 'Nombre'],
  ['apellido', 'Apellido'], ['correo', 'Correo opcional', 'email'],
  ['telefono', 'Teléfono opcional', 'tel'], ['inicio', 'Inicio del servicio', 'date'],
  ['fin', 'Fin del servicio', 'date'], ['usuario', 'Usuario de acceso'],
];
const dateLabel = value => value.split('-').reverse().join('/');
const customerStatus = (cliente, today) => cliente.inicio > today ? 'upcoming' : cliente.fin < today ? 'expired' : 'active';

function CustomerForm({ edit, busy, error, onSave, onCancel }) {
  return <section className="cy-card cy-form-card" aria-labelledby="form-title">
    <h2 id="form-title">{edit ? 'Editar cliente' : 'Nuevo cliente'}</h2>
    <form onSubmit={onSave}>
      <div className="cy-form-grid">
        {columns.map(([name, title, type]) => (
          <div key={name} className={['negocio', 'dni', 'inicio'].includes(name) ? 'cy-section-start' : undefined}>
            {['negocio', 'dni', 'inicio'].includes(name) && <h3 className="cy-group-title">
              {{ negocio: 'Datos del negocio', dni: 'Datos del propietario', inicio: 'Suscripción y acceso' }[name]}
            </h3>}
          <label>{title}
            <input placeholder={title} name={name} type={type || 'text'} autoComplete="off"
              required={!['correo', 'telefono'].includes(name)}
              inputMode={name === 'dni' ? 'numeric' : undefined}
              maxLength={name === 'dni' ? 8 : name === 'usuario' ? 40 : 160}
              pattern={name === 'dni' ? '[0-9]{8}' : name === 'usuario' ? '[a-zA-Z0-9._\\-]{3,40}' : undefined}
              readOnly={Boolean(edit && name === 'usuario')}
              defaultValue={edit?.[name] || (name === 'inicio' ? dayOf() : '')} />
          </label>
          </div>
        ))}
      </div>
      {error && <p className="cy-error" role="alert">{error}</p>}
      <div className="cy-actions">
        <button type="button" className="cy-secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="cy-primary inline-flex items-center gap-2" disabled={busy}>
          <ButtonIcon name="Guardar" />{busy ? 'Guardando…' : 'Guardar cliente'}
        </button>
      </div>
    </form>
  </section>;
}

function Credentials({ credentials, onClose }) {
  const [message, setMessage] = useState('');
  const { cliente, clave } = credentials;
  const url = location.origin + '/negocio';
  async function copy() {
    try {
      await navigator.clipboard.writeText(['Cuadra Dinero · ' + cliente.negocio, url,
        'Usuario: ' + cliente.usuario, 'Clave: ' + clave].join('\n'));
      setMessage('Credenciales copiadas.');
    } catch {
      setMessage('Selecciona y copia los datos de acceso manualmente.');
    }
  }
  return <section className="cy-card cy-credentials" aria-labelledby="credentials-title">
    <h2 id="credentials-title">Credenciales del negocio</h2>
    <p>Comparte estos datos con el titular. La clave se muestra una sola vez.</p>
    <dl><dt>Usuario</dt><dd>{cliente.usuario}</dd><dt>Clave</dt><dd><code>{clave}</code></dd></dl>
    <a href={url}>Abrir acceso de negocios</a>
    <div className="cy-actions">
      <button className="cy-secondary" onClick={onClose}>Listo</button>
      <button className="cy-primary" onClick={copy}>Copiar acceso</button>
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}

export default function Admin() {
  const [token, setToken] = useState('');
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [reset, setReset] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const today = dayOf();

  function logout() {
    setToken('');
    setClients([]);
    setForm(null);
    setReset(null);
    setCredentials(null);
    setError('');
  }

  useEffect(() => {
    if (!token) return;
    let current = true;
    setLoading(true);
    accountRequest('/admin/clientes', { token })
      .then(data => { if (current) setClients(data); })
      .catch(err => {
        if (!current) return;
        if (err.status === 401) logout();
        setError(err.message);
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [token]);

  async function login(event) {
    event.preventDefault();
    const clave = new FormData(event.currentTarget).get('clave');
    setError('');
    setBusy(true);
    try {
      const session = await accountRequest('/admin/sesion', { method: 'POST', body: { clave } });
      setToken(session.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const editing = Boolean(form.id);
    setError('');
    setBusy(true);
    try {
      const result = await accountRequest('/admin/clientes' + (editing ? '/' + form.id : ''),
        { method: editing ? 'PATCH' : 'POST', body, token });
      if (editing) setClients(list => list.map(cliente => cliente.id === result.id ? result : cliente));
      else {
        setClients(list => [result.cliente, ...list]);
        setCredentials(result);
      }
      setForm(null);
    } catch (err) {
      if (err.status === 401) logout();
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    setError('');
    setBusy(true);
    try {
      const result = await accountRequest('/admin/clientes/' + reset.id + '/clave', { method: 'POST', token });
      setCredentials(result);
      setReset(null);
    } catch (err) {
      if (err.status === 401) logout();
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) return <LoginShell admin onSubmit={login}>
      <PasswordField label="Clave de administración" />
      {error && <p className="cy-error" role="alert">{error}</p>}
      <button className="cy-primary" disabled={busy}>{busy ? 'Ingresando…' : 'Entrar al panel'}</button>
      <a href="/">Volver a Cuadra Dinero</a>
  </LoginShell>;

  const normalizedQuery = query.trim().toLocaleLowerCase('es-PE');
  const visible = clients.filter(cliente =>
    (!filter || customerStatus(cliente, today) === filter) &&
    [cliente.negocio, cliente.rubro, cliente.nombre + ' ' + cliente.apellido, cliente.dni, cliente.usuario]
      .some(value => value.toLocaleLowerCase('es-PE').includes(normalizedQuery)));
  const blocked = busy || Boolean(form || reset || credentials);
  return <div className="cy-dashboard">
    <aside className="cy-sidebar">
      <Brand />
      <a className="cy-current" href="#clientes" aria-current="page">Clientes</a>
      <a href="/negocio">Acceso de negocios ↗</a>
      <button className="cy-logout" disabled={busy} onClick={logout}>Cerrar sesión</button>
    </aside>
    <main className="cy-main" id="clientes">
      <header className="cy-banner">
        <div><h1>Clientes</h1><p>Gestiona los negocios y su acceso a Cuadra Dinero.</p></div>
        <button className="cy-new" disabled={blocked} onClick={() => { setError(''); setForm({}); }}>＋ Nuevo cliente</button>
      </header>
      <div className="cy-metrics">
        {[['Total de clientes', clients.length], ['Activos', clients.filter(c => customerStatus(c, today) === 'active').length],
          ['Vencidos', clients.filter(c => customerStatus(c, today) === 'expired').length]].map(([label, number]) =>
          <div className="cy-card cy-stat" key={label}><span>{label}</span><strong>{loading ? '—' : number}</strong></div>)}
      </div>
      {form && <CustomerForm key={form.id || 'new'} edit={form.id ? form : null} error={error} busy={busy}
        onSave={save} onCancel={() => { setError(''); setForm(null); }} />}
      {credentials && <Credentials credentials={credentials} onClose={() => setCredentials(null)} />}
      {reset && <section className="cy-card cy-form-card">
        <h2>Restablecer clave</h2>
        <p>Se invalidará la clave anterior de {reset.negocio}. Sus dispositivos deberán ingresar con la nueva clave al reconectar.</p>
        <div className="cy-actions">
          <button className="cy-secondary" disabled={busy} onClick={() => { setError(''); setReset(null); }}>Cancelar</button>
          <button className="cy-primary" disabled={busy} onClick={rotate}>{busy ? 'Generando…' : 'Generar nueva clave'}</button>
        </div>
      </section>}
      {!form && error && <p className="cy-error" role="alert">{error}</p>}
      <section className="cy-card cy-directory" aria-labelledby="directory-title">
        <div className="cy-toolbar">
          <h2 id="directory-title">Directorio de negocios</h2>
          <div className="cy-filters">
            <input type="search" aria-label="Buscar clientes" placeholder="Buscar negocio, usuario o DNI" value={query} onChange={e => setQuery(e.target.value)} />
            <select aria-label="Filtrar por estado" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              {Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
        </div>
        {loading ? <p role="status">Cargando clientes…</p> : visible.length ? (
          <div className="cy-table-scroll"><table>
            <thead><tr>{['Negocio', 'Titular', 'Usuario', 'Servicio', 'Estado', 'Acciones'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{visible.map((cliente) => {
              const status = customerStatus(cliente, today);
              return <tr key={cliente.id}>
                <td><strong>{cliente.negocio}</strong><span>{cliente.rubro}</span></td>
                <td>{cliente.nombre} {cliente.apellido}<span>DNI {cliente.dni}</span></td>
                <td>{cliente.usuario}</td>
                <td>{dateLabel(cliente.inicio)}<span>Hasta {dateLabel(cliente.fin)}</span></td>
                <td><span className={'cy-status ' + status}>{labels[status]}</span></td>
                <td><div className="cy-row-actions">
                  <button className="cy-secondary" disabled={blocked} onClick={() => { setError(''); setForm(cliente); window.scrollTo(0, 0); }}>Editar</button>
                  <button className="cy-secondary" disabled={blocked} onClick={() => { setError(''); setReset(cliente); window.scrollTo(0, 0); }}>Nueva clave</button>
                </div></td>
              </tr>;
            })}</tbody>
          </table></div>
        ) : <div className="cy-empty"><strong>{clients.length ? 'Sin resultados' : 'Todavía no hay clientes'}</strong>
          <p>{clients.length ? 'Prueba con otro término o estado.' : 'Crea el primer negocio para entregarle su usuario y clave.'}</p></div>}
      </section>
    </main>
  </div>;
}
