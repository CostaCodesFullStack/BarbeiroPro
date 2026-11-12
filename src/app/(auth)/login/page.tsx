"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import PublicShell from "@/components/public/PublicShell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fromSignup, setFromSignup] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Vindo do cadastro com e-mail já existente: preenche o e-mail e leva o foco para a senha.
  useEffect(() => {
    const prefilled = new URLSearchParams(window.location.search).get("email");
    if (prefilled) {
      setEmail(prefilled);
      setFromSignup(true);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/v1/auth/login", { method: "POST", body: { email, password } });
      router.push("/painel");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <PublicShell>
      <main className="auth">
        <form className="card" onSubmit={onSubmit}>
          <h1>Entrar</h1>
          {fromSignup && (
            <div className="banner">Este e-mail já tem cadastro. Digite sua senha para entrar.</div>
          )}
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus={fromSignup}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className="error" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
          <p className="muted">
            Ainda não tem conta? <Link href="/cadastro">Comece o teste grátis</Link>
          </p>
        </form>
      </main>
    </PublicShell>
  );
}
