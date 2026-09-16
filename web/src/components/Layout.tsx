import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>♦ Whist Scoreboard</h1>
        {user && (
          <button className="link-btn" onClick={logout}>
            Déconnexion ({user.name})
          </button>
        )}
      </header>
      <main className="app-main">{children}</main>
      <nav className="bottom-nav">
        <NavLink to="/games" className={({ isActive }) => (isActive ? 'active' : '')} end>
          <span className="icon">🃏</span>
          Parties
        </NavLink>
        <NavLink to="/players" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="icon">👥</span>
          Joueurs
        </NavLink>
        <NavLink to="/contracts" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="icon">📜</span>
          Contrats
        </NavLink>
      </nav>
    </div>
  );
}
