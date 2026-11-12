'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { centsFrom, createProfile, dayOf, money, readLedger, readProfile, saveClose,
  saveSale, syncLedger, timeOf, totals, verifyPin, voucher } from '../lib/ledger';

const labels = { YAPE: 'Yape', EFECTIVO: 'Efectivo' };
const shortDate = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLabel = day => shortDate.format(new Date(day + 'T00:00:00Z')).replace('.', '');

function Pin({ profile, onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  async function enter(event) {
    event.preventDefault();
    if (pin.length !== 4 || busy || blocked) return;
    setBusy(true);
    setError('');
    try {
      if (!profile) {
        onUnlock(await createProfile(pin));
        navigator.storage?.persist?.().catch(() => {});
      } else if (await verifyPin(pin, profile)) {
        onUnlock(profile);
      } else {
        setError('PIN incorrecto. Intenta de nuevo.');
        setPin('');
        setBlocked(true);
        setTimeout(() => setBlocked(false), 1000);
      }
    } catch {
      setError('No se pudo abrir la caja. Recarga la página e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen justify-center">
      <div className="mb-2 flex items-center gap-3 font-extrabold text-yape">
        <img src="/icon-192.png" alt="" width="52" height="52" />
        Cuadra Yape
      </div>
      <h1 className="heading">{profile ? 'Ingresa tu PIN' : 'Crea tu PIN'}</h1>
      <form className="grid gap-4" onSubmit={enter}>
        <label className="grid gap-2 font-semibold">
          PIN de 4 dígitos
          <input className="field text-center text-3xl tracking-[0.35em]" type="password" inputMode="numeric"
            autoComplete="off" maxLength={4} value={pin}
            onChange={event => setPin(event.target.value.replace(/\D/g, ''))} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="primary" disabled={pin.length !== 4 || busy || blocked}>
          {profile ? 'ABRIR CAJA' : 'CREAR PIN'}
        </button>
      </form>
    </main>
  );
}

function Sales({ sales, showDate = false }) {
  if (!sales.length) return <p className="panel">No hay ventas para mostrar.</p>;
  return (
    <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 px-4">
      {sales.map(sale => (
        <li key={sale.id} className="py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span>{showDate && <>{dayLabel(sale.dia)} · </>}{timeOf(sale.fecha)} · {labels[sale.metodo]}</span>
            <strong className="money text-xl">{money(sale.montoCentimos)}</strong>
          </div>
          {(sale.descripcion || sale.nota) && <p className="break-words">{[sale.descripcion, sale.nota].filter(Boolean).join(' · ')}</p>}
          {sale.foto && (
            <details>
              <summary className="min-h-[60px] cursor-pointer py-4 font-semibold text-yape">Ver voucher</summary>
              <img src={sale.foto} loading="lazy" alt="Foto del voucher de Yape" className="max-h-72 rounded-lg object-contain" />
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

function Today({ sales, onRegister }) {
  const { yape, efectivo, total } = totals(sales);
  return (
    <>
      <h1 className="money rounded-2xl bg-[#f5ecf7] p-4 text-[clamp(1.85rem,8vw,2.75rem)] font-black text-yape">
        HOY: {money(total)}
      </h1>
      <div className="grid grid-cols-2 gap-3">
        <div className="panel"><p>Yape</p><strong className="money text-2xl">{money(yape)}</strong></div>
        <div className="panel"><p>Efectivo</p><strong className="money text-2xl">{money(efectivo)}</strong></div>
      </div>
      <div className="grid justify-items-center gap-3 py-2">
        <button className="primary min-h-[76px] w-4/5 text-xl" onClick={() => onRegister('YAPE')}>+ REGISTRAR YAPE</button>
        <button className="secondary w-4/5" onClick={() => onRegister('EFECTIVO')}>+ Efectivo</button>
      </div>
      <h2 className="text-xl font-extrabold">Ventas de hoy</h2>
      <Sales sales={sales} />
    </>
  );
}

function Register({ method, onSave, onBack }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cents = centsFrom(amount);
  const busy = saving || loadingPhoto;

  function press(key) {
    setAmount(current => {
      if (key === '⌫') return current.slice(0, -1);
      const candidate = key === '.' && !current ? '0.' : (current === '0' && key !== '.' ? key : current + key);
      return centsFrom(candidate) === null ? current : candidate;
    });
  }

  async function attach(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLoadingPhoto(true);
    setError('');
    try {
      setPhoto(await voucher(file));
    } catch {
      setError('No se pudo adjuntar la foto. Puedes volver a intentar o guardar la venta.');
    } finally {
      setLoadingPhoto(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!cents || busy) return;
    setSaving(true);
    setError('');
    try {
      const now = new Date();
      await onSave({
        id: crypto.randomUUID(), fecha: now.toISOString(), dia: dayOf(now), metodo: method,
        montoCentimos: cents, descripcion: description, nota: note.trim(), foto: photo,
      });
    } catch {
      setError('No se pudo guardar en el celular. Revisa el espacio disponible e inténtalo otra vez.');
      setSaving(false);
    }
  }

  return (
    <>
      <button className="secondary self-start" onClick={onBack} disabled={busy}>← Volver</button>
      <h1 className="heading">Registrar {labels[method]}</h1>
      <form className="grid gap-3" onSubmit={submit}>
        <output className="money rounded-xl bg-[#f5ecf7] p-3 text-right text-4xl font-black text-yape"
          aria-label="Monto de la venta">S/ {amount || '0'}</output>
        <div className="grid grid-cols-3 gap-2" aria-label="Teclado de monto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(key => (
            <button className="secondary text-2xl" key={key} type="button" onClick={() => press(key)}
              aria-label={key === '⌫' ? 'Borrar último dígito' : key === '.' ? 'Punto decimal' : key}>{key}</button>
          ))}
        </div>

        {error && <p role="alert">{error}</p>}
        <div className="grid grid-cols-3 gap-2">
          {['Desayuno', 'Jugo', 'Menú'].map(option => (
            <button type="button" key={option} aria-pressed={description === option}
              className={description === option ? 'primary px-1' : 'secondary px-1'}
              onClick={() => setDescription(description === option ? '' : option)}>{option}</button>
          ))}
        </div>
        <label className="grid gap-1 font-semibold">Nota <input className="field font-normal" placeholder="Ej. mesa 3"
          maxLength={120} value={note} onChange={event => setNote(event.target.value)} /></label>
        {method === 'YAPE' && (
          <>
            <label className="secondary relative cursor-pointer focus-within:ring-2 focus-within:ring-yape">
              {loadingPhoto ? 'Preparando foto…' : photo ? 'Cambiar foto del voucher' : 'Tomar foto del voucher de Yape'}
              <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={attach} disabled={busy} />
            </label>
            {photo && <button className="secondary" type="button" onClick={() => setPhoto(null)} disabled={busy}>Quitar foto</button>}
          </>
        )}
        <button className="primary sticky bottom-2 min-h-[68px] shadow-lg" disabled={!cents || busy}>
          {saving ? 'Guardando…' : 'GUARDAR'}
        </button>
      </form>
    </>
  );
}

function Close({ day, close, sales, onClose, onHistory }) {
  const { yape, efectivo, total, cantidad } = totals(sales);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const message = 'Cierre ' + dayLabel(day) + ': Yape ' + money(yape) + ', Efectivo ' + money(efectivo) + ', Total ' + money(total);

  async function finish() {
    setBusy(true);
    setError(false);
    try {
      await onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="heading">Cierre de día</h1>
      <dl className="panel grid grid-cols-[1fr_auto] gap-3">
        <dt>Total Yape</dt><dd className="money font-bold">{money(yape)}</dd>
        <dt>Total Efectivo</dt><dd className="money font-bold">{money(efectivo)}</dd>
        <dt className="font-extrabold">Total General</dt><dd className="money font-extrabold">{money(total)}</dd>
        <dt>Cantidad de ventas</dt><dd className="font-bold">{cantidad}</dd>
      </dl>
      {close ? (
        <>
          <p role="status" className="font-bold text-yape">Día cerrado a las {timeOf(close.cerradoEn)}</p>
          <a className="action bg-whatsapp" href={'https://wa.me/?text=' + encodeURIComponent(message)}
            target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
        </>
      ) : <button className="primary" onClick={finish} disabled={busy}>{busy ? 'Guardando…' : 'CERRAR DÍA'}</button>}
      {error && <p role="alert">No se pudo guardar el cierre en el celular.</p>}
      <button className="secondary" onClick={onHistory}>Ver días anteriores</button>
    </>
  );
}

function History({ sales, today, selected, onSelect }) {
  const [amount, setAmount] = useState('');
  const query = amount.trim();
  const cents = centsFrom(query);
  const filtered = query
    ? sales.filter(sale => sale.metodo === 'YAPE' && sale.montoCentimos === cents)
    : sales.filter(sale => sale.dia === selected);
  return (
    <>
      <h1 className="heading">Historial</h1>
      <label className="grid gap-1 font-semibold">Calendario
        <input className="field font-normal" type="date" value={selected} max={today}
          onChange={event => {
            if (event.target.value) {
              onSelect(event.target.value);
              setAmount('');
            }
          }} />
      </label>
      <label className="grid gap-1 font-semibold">Buscar Yapes por monto
        <input className="field font-normal" type="text" inputMode="decimal" maxLength={9} placeholder="Ej. 12"
          value={amount} onChange={event => setAmount(event.target.value)} />
      </label>
      <h2 className="text-xl font-bold">{query ? 'Resultados en todos los días' : 'Ventas del ' + dayLabel(selected)}</h2>
      <Sales sales={filtered} showDate={Boolean(query)} />
    </>
  );
}

export default function Caja() {
  const [profile, setProfile] = useState(undefined);
  const [unlocked, setUnlocked] = useState(false);
  const [startupError, setStartupError] = useState(false);
  const [ledger, setLedger] = useState({ sales: [], closes: [] });
  const [screen, setScreen] = useState('Hoy');
  const [method, setMethod] = useState('YAPE');
  const [today, setToday] = useState('');
  const [selected, setSelected] = useState('');
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState('');
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++revision.current;
    const data = await readLedger();
    if (current === revision.current) setLedger(data);
  }, []);

  const sync = useCallback(async () => {
    if (!profile || !navigator.onLine) return;
    if (await syncLedger(profile.token)) await refresh();
  }, [profile, refresh]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
    setToday(dayOf());
    setSelected(dayOf());
    readProfile().then(data => setProfile(data ?? null)).catch(() => setStartupError(true));
  }, []);

  useEffect(() => {
    const update = () => {
      setToday(dayOf());
      setOnline(navigator.onLine);
      if (unlocked) void sync().catch(console.error);
    };
    const visibility = () => { if (!document.hidden) update(); };
    update();
    const timer = setInterval(visibility, 15_000);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [unlocked, sync]);

  function navigate(next) {
    setNotice('');
    setScreen(next);
    window.scrollTo(0, 0);
  }

  async function unlock(data) {
    try {
      await refresh();
      setProfile(data);
      setUnlocked(true);
    } catch {
      setStartupError(true);
    }
  }

  async function save(sale) {
    await saveSale(sale);
    revision.current++;
    setLedger(current => ({ ...current, sales: [{ ...sale, pending: 1 }, ...current.sales] }));
    setToday(sale.dia);
    navigate('Hoy');
    setNotice('Venta guardada');
    void sync().catch(console.error);
  }

  async function closeDay() {
    const now = new Date();
    const close = { dia: dayOf(now), cerradoEn: now.toISOString() };
    await saveClose(close);
    setToday(close.dia);
    await refresh();
    void sync().catch(console.error);
  }

  if (startupError) return <main className="screen"><p role="alert">No se pudo acceder a la caja del celular. Recarga la página.</p></main>;
  if (profile === undefined) return <main className="screen"><p role="status">Abriendo Cuadra Yape…</p></main>;
  if (!unlocked) return <Pin profile={profile} onUnlock={unlock} />;

  const sales = ledger.sales.filter(sale => sale.dia === today);
  const close = ledger.closes.find(item => item.dia === today);
  const pending = [...ledger.sales, ...ledger.closes].filter(item => item.pending).length;
  return (
    <main className="screen">
      {screen !== 'Registrar' && (
        <>
          <header className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-yape">Cuadra Yape</span>
            <button className="secondary" onClick={() => { navigate('Hoy'); setUnlocked(false); }}>Bloquear</button>
          </header>
          <nav aria-label="Pantallas de la caja" className="grid grid-cols-3 gap-2">
            {['Hoy', 'Cierre', 'Historial'].map(tab => (
              <button key={tab} aria-current={screen === tab ? 'page' : undefined}
                className={screen === tab ? 'primary px-1' : 'secondary px-1'} onClick={() => navigate(tab)}>{tab}</button>
            ))}
          </nav>
          {(!online || pending > 0 || notice) && (
            <p role="status">{[notice, !online && 'Sin internet', pending > 0 && (pending + ' por sincronizar')].filter(Boolean).join(' · ')}</p>
          )}
        </>
      )}
      {screen === 'Hoy' && <Today sales={sales} onRegister={value => { setMethod(value); navigate('Registrar'); }} />}
      {screen === 'Registrar' && <Register method={method} onSave={save} onBack={() => navigate('Hoy')} />}
      {screen === 'Cierre' && <Close day={today} close={close} sales={sales} onClose={closeDay} onHistory={() => navigate('Historial')} />}
      {screen === 'Historial' && <History sales={ledger.sales} today={today} selected={selected} onSelect={setSelected} />}
    </main>
  );
}
