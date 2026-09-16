import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Game } from '../types';

export default function GamesListPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ games: Game[] }>('/games').then((res) => {
      setGames(res.games);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="btn-row" style={{ marginBottom: 14 }}>
        <Link className="btn" to="/games/new" style={{ width: '100%', textDecoration: 'none' }}>
          + Nouvelle partie
        </Link>
      </div>

      {loading && <p className="muted">Chargement…</p>}
      {!loading && games.length === 0 && <p className="muted">Aucune partie enregistrée pour l'instant.</p>}

      {games.map((g) => (
        <Link key={g.id} to={`/games/${g.id}`} className="card" style={{ display: 'block', textDecoration: 'none' }}>
          <h2>
            {g.label || 'Partie sans nom'}{' '}
            <span className="badge" style={{ background: g.status === 'OPEN' ? 'rgba(111,191,139,.2)' : 'rgba(255,255,255,.1)', color: g.status === 'OPEN' ? 'var(--success)' : 'var(--text-dim)' }}>
              {g.status === 'OPEN' ? 'en cours' : 'clôturée'}
            </span>
          </h2>
          <p className="muted">{new Date(g.startedAt).toLocaleString('fr-BE')}</p>
          <p className="muted">{g.players.map((p) => p.player.name).join(', ')}</p>
        </Link>
      ))}
    </div>
  );
}
