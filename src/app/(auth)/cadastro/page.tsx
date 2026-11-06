"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api, errorMessage, slugify } from "@/lib/client-api";

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [barbershopName, setBarbershopName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [loading, setLoading] = useState(false);

  function onShopName(value: string) {
    setBarbershopName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function clearError() {
    setError("");
    setErrorCode("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      await api("/api/v1/auth/register", {
        method: "POST",
        body: { name, email, password, barbershopName, slug },
      });
      router.push("/painel");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setErrorCode(err instanceof ApiError ? err.code : "");
      setLoading(false);
    }
  }

  const suggestedSlug = `${slug.slice(0, 38)}-2`;

  return (
    <main className="auth">
      <form className="card" onSubmit={onSubmit}>
        <h1>Teste grátis por 7 dias</h1>
        <p className="muted">
          Crie sua conta. No próximo passo você cadastra o cartão: nada é cobrado nos 7 primeiros dias.
        </p>

        <label htmlFor="name">Seu nome</label>
        <input id="name" required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />

        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label htmlFor="password">Senha (mínimo 8 caracteres)</label>
        <input id="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <label htmlFor="shop">Nome da barbearia</label>
        <input id="shop" required minLength={2} value={barbershopName} onChange={(e) => onShopName(e.target.value)} />

        <label htmlFor="slug">Endereço da página de agendamento</label>
        <input
          id="slug"
          required
          pattern="[a-z0-9\-]{3,40}"
          title="3 a 40 caracteres: letras minúsculas, números e hífen"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
        />
        <div className="muted">/barbearia/{slug || "sua-barbearia"}</div>

        {error && (
          <div className="error" role="alert">
            {error}
            {errorCode === "EMAIL_TAKEN" && (
              <div style={{ marginTop: 8 }}>
                Já tem conta? <Link href={`/login?email=${encodeURIComponent(email)}`}>Entrar com este e-mail →</Link>
              </div>
            )}
            {errorCode === "SLUG_TAKEN" && slug.length >= 1 && (
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setSlugTouched(true);
                    setSlug(suggestedSlug);
                    clearError();
                  }}
                >
                  Usar “{suggestedSlug}”
                </button>
              </div>
            )}
          </div>
        )}

        <button className="primary" type="submit" disabled={loading}>
          {loading ? "Criando..." : "Criar conta"}
        </button>
        <p className="muted">
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
