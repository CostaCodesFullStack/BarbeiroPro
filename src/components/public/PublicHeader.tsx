import Link from "next/link";

export default function PublicHeader() {
  return (
    <header className="public-header">
      <div className="public-header__inner">
        <Link className="public-brand" href="/" aria-label="BarbeiroPro, página inicial">
          BarbeiroPro
        </Link>
        <nav className="public-header__nav" aria-label="Navegação principal">
          <Link href="/login">Entrar</Link>
          <Link className="ui-button ui-button--primary" href="/cadastro">Teste grátis</Link>
        </nav>
      </div>
    </header>
  );
}
