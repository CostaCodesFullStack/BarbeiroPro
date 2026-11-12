import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer__inner">
        <span>BarbeiroPro</span>
        <nav className="public-footer__links" aria-label="Links do rodapé">
          <Link href="/login">Entrar</Link>
          <Link href="/cadastro">Criar conta</Link>
        </nav>
      </div>
    </footer>
  );
}
