import Link from "next/link";

export default function Home() {
  return (
    <main className="auth">
      <div className="card">
        <h1>BarbeiroPro</h1>
        <p className="muted">Agenda, clientes e financeiro da sua barbearia em um só lugar.</p>
        <p>
          <Link href="/cadastro">Teste grátis por 7 dias</Link> · <Link href="/login">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
