import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { GameStats } from '../types';

export default function GameStatsPage() {
  const { id } = useParams<{ id: string }>();
  const [stats, setStats] = useState<GameStats | null>(null);

  useEffect(() => {
    if (!id) return;
    api<{ stats: GameStats }>(`/stats/games/${id}`).then((res) => setStats(res.stats));
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
            <p className="muted" style={{ marginTop: 0, marginBottom: 4 }}>
              Attaque
            </p>
            {p.contractStats.length === 0 && <p className="muted">Aucun contrat déclaré.</p>}
            {p.contractStats.map((c) => (
              <div key={c.contractCode} className="ladder-row">
                <span>{c.label}</span>
                <span className="muted">
                  {c.timesDeclared}× — {c.successCount} réussi(s), {c.failCount} échoué(s)
                </span>
              </div>
            ))}
            <p className="muted" style={{ marginTop: 14, marginBottom: 4 }}>
              Défense
            </p>
            {p.defenseStats.length === 0 && <p className="muted">Aucune défense enregistrée.</p>}
            {p.defenseStats.map((d) => (
              <div key={d.contractCode} className="ladder-row">
                <span>{d.label}</span>
                <span className="muted">
                  {d.timesDefended}× — {d.successCount} battu(s), {d.failCount} subi(s)
                </span>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
