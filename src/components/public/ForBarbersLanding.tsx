import Link from "next/link";
import PublicShell from "@/components/public/PublicShell";
import styles from "./ForBarbersLanding.module.css";

const capabilities = [
  {
    number: "01",
    title: "Agenda em um só lugar",
    description:
      "Acompanhe os agendamentos da barbearia no painel e consulte os horários da operação.",
    detail: "Agenda do painel",
  },
  {
    number: "02",
    title: "Serviços e equipe",
    description:
      "Cadastre serviços, profissionais, horários de trabalho e bloqueios da agenda.",
    detail: "Catálogo · profissionais · horários",
  },
  {
    number: "03",
    title: "Agendamento online",
    description:
      "Compartilhe a página da sua barbearia para que clientes consultem serviços, profissionais e horários disponíveis.",
    detail: "Página pública de agendamento",
  },
];

export default function ForBarbersLanding() {
  return (
    <PublicShell>
      <main className={styles.main} id="conteudo">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowMark} aria-hidden="true" />
              Gestão para barbearias
            </p>
            <h1 className={styles.heroTitle} id="hero-title">
              Sua barbearia organizada. Seu agendamento online.
            </h1>
            <p className={styles.heroDescription}>
              Cuide da agenda, dos serviços e da equipe em um só lugar. Deixe
              seus clientes consultarem os horários pela página pública da sua
              barbearia.
            </p>
            <div className={styles.heroActions}>
              <Link className="ui-button ui-button--primary" href="/cadastro">
                Começar teste grátis
                <span aria-hidden="true">→</span>
              </Link>
              <Link className="ui-button ui-button--secondary" href="/">
                Conhecer a vitrine
              </Link>
            </div>
            <p className={styles.heroNote}>
              7 dias grátis · R$ 79,90 por mês após o período de teste
            </p>
          </div>

          <aside className={styles.featurePanel} aria-labelledby="panel-heading">
            <div className={styles.panelTopline}>
              <span className={styles.panelLogo} aria-hidden="true">BP</span>
              <span>BarbeiroPro</span>
              <span className={styles.panelStatus}>Para sua barbearia</span>
            </div>
            <p className={styles.panelHeading} id="panel-heading">O essencial da operação, conectado.</p>
            <div className={styles.panelModules}>
              <div className={styles.panelModule}>
                <span className={styles.moduleIcon} aria-hidden="true">01</span>
                <span>
                  <strong>Organize</strong>
                  <small>Agenda e horários</small>
                </span>
                <span className={styles.moduleArrow} aria-hidden="true">↗</span>
              </div>
              <div className={styles.panelModule}>
                <span className={styles.moduleIcon} aria-hidden="true">02</span>
                <span>
                  <strong>Configure</strong>
                  <small>Serviços e profissionais</small>
                </span>
                <span className={styles.moduleArrow} aria-hidden="true">↗</span>
              </div>
              <div className={styles.panelModule}>
                <span className={styles.moduleIcon} aria-hidden="true">03</span>
                <span>
                  <strong>Compartilhe</strong>
                  <small>Agendamento online</small>
                </span>
                <span className={styles.moduleArrow} aria-hidden="true">↗</span>
              </div>
            </div>
            <p className={styles.panelCaption}>
              Ferramentas para o dia a dia da sua barbearia.
            </p>
            <span className={styles.panelOrbit} aria-hidden="true" />
          </aside>
        </section>

        <section className={styles.capabilities} aria-labelledby="capabilities-title">
          <div className={styles.sectionHeading}>
            <p className={styles.sectionKicker}>Feito para a rotina</p>
            <h2 id="capabilities-title">Mais clareza para cuidar da operação.</h2>
            <p>
              Cadastre o que sua barbearia oferece, organize quem atende e
              acompanhe os horários marcados.
            </p>
          </div>
          <div className={styles.capabilityGrid}>
            {capabilities.map((item) => (
              <article className={styles.capabilityCard} key={item.number}>
                <span className={styles.cardNumber}>{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span className={styles.cardDetail}>{item.detail}</span>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.startSection} aria-labelledby="start-title">
          <div className={styles.startIntro}>
            <p className={styles.sectionKicker}>Um começo simples</p>
            <h2 id="start-title">Configure sua barbearia em etapas.</h2>
            <p>
              O cadastro abre seu acesso. Depois, você ativa o período de teste
              e configura os recursos da operação.
            </p>
          </div>
          <ol className={styles.steps}>
            <li>
              <span>1</span>
              <div>
                <h3>Crie sua conta</h3>
                <p>Informe seus dados e o nome da barbearia.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>Ative os 7 dias grátis</h3>
                <p>A contagem do teste começa quando os dados do cartão são enviados ao Asaas; o acesso é liberado após a confirmação. A primeira cobrança ocorre depois de pelo menos sete dias completos.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>Configure sua operação</h3>
                <p>Cadastre serviços e profissionais e defina os horários.</p>
              </div>
            </li>
          </ol>
        </section>

        <section className={styles.priceSection} aria-labelledby="price-title">
          <div className={styles.priceCopy}>
            <p className={styles.sectionKicker}>Preço claro</p>
            <h2 id="price-title">Comece com 7 dias grátis.</h2>
            <p>
              O plano mensal custa R$ 79,90. A primeira cobrança ocorre depois
              de pelo menos sete dias completos do cadastro do cartão.
            </p>
          </div>
          <div className={styles.priceCard}>
            <p className={styles.priceLabel}>Plano mensal</p>
            <p className={styles.priceValue}>
              <span>R$</span> 79,90 <small>/ mês</small>
            </p>
            <p className={styles.priceTrial}>7 dias grátis</p>
            <p className={styles.priceFinePrint}>
              O cartão é validado no início do teste. Como o Asaas agenda por
              data, a primeira cobrança pode ocorrer até oito dias depois.
            </p>
            <Link className="ui-button ui-button--primary" href="/cadastro">
              Criar minha conta
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section className={styles.finalCallout} aria-labelledby="final-title">
          <div>
            <p className={styles.sectionKicker}>Sua próxima etapa</p>
            <h2 id="final-title">Prepare sua barbearia para receber agendamentos online.</h2>
          </div>
          <Link className="ui-button ui-button--primary" href="/cadastro">
            Começar cadastro
            <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>
    </PublicShell>
  );
}
