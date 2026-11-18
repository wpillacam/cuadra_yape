import Brand from './Brand';

export default function LoginShell({ children, admin = false, onSubmit }) {
  return (
    <main className="cy-auth">
      <div className="cy-login">
        <header className="cy-login-heading">
          <Brand />
          <h1>{admin ? 'Administración' : 'Iniciar sesión'}</h1>
          <p>Cuadra tu caja en segundos.<br />¡Simple, ágil, y sin líos!</p>
        </header>
        <form className="cy-auth-card" onSubmit={onSubmit}>{children}</form>
      </div>
    </main>
  );
}
