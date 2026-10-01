import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { RikikiGameStats } from '../types';

export default function RikikiGameStatsPage() {
  const { id } = useParams<{ id: string }>();
  const [stats, setStats] = useState<RikikiGameStats | null>(null);

  useEffect(() => {
    if (!id) return;
    api<{ stats: RikikiGameStats }>(`/stats/rikiki-games/${id}`).then((res) => setStats(res.stats));
  }, [id]);

  if (!stats) return <p className="muted">Chargement…</p>;

  return (
    <div>
      <p>
        <Link className="link-btn" to={`/games/${id}`}>
          ← Retour à la partie
        </Link>
      </p>
      {stats.players
        .slice()
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .map((p) => (
          <div key={p.playerId} className="card">
            <h2>
              {p.playerName} —{' '}
              <span className={p.totalPoints >= 0 ? 'positive' : 'negative'}>
                {p.totalPoints >= 0 ? '+' : ''}
                {p.totalPoints} pts
              </span>
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {p.roundsWon} contrat(s) réussi(s) sur {p.roundsPlayed} manche(s)
              {p.roundsPlayed > 0 ? ` (${Math.round((p.roundsWon / p.roundsPlayed) * 100)}%)` : ''}
            </p>
          </div>
        ))}
    </div>
  );
}
