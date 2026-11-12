import LogoutButton from "@/components/LogoutButton";

export default function DashboardHeader({ tenantName }: { tenantName: string }) {
  return (
    <header className="dashboard-header">
      <div>
        <p className="dashboard-header__eyebrow">Painel administrativo</p>
        <h1>{tenantName}</h1>
      </div>
      <LogoutButton />
    </header>
  );
}
