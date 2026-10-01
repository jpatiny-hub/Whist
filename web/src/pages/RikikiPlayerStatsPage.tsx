import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { RikikiPlayerStats } from '../types';

export default function RikikiPlayerStatsPage() {
  const { id } = useParams<{ id: string }>();
  const [stats, setStats] = useState<RikikiPlayerStats | null>(null);

  useEffect(() => {
    if (!id) return;
    api<{ stats: RikikiPlayerStats }>(`/stats/rikiki-players/${id}`).then((res) => setStats(res.stats));
  }, [id]);

  if (!stats) return <p className="muted">Chargement…</p>;

  return (
    <div>
      <p>
        <Link className="link-btn" to="/players">
          ← Retour aux joueurs
        </Link>
      </p>

      <div className="card">
        <h2>{stats.playerName} — Rikiki</h2>
        <div className="stat-grid">
          <div className="stat-tile">
            <div className="value">{stats.gamesPlayed}</div>
            <div className="label">Parties jouées</div>
          </div>
          <div className="stat-tile">
            <div className="value">{stats.gamesWon}</div>
            <div className="label">Parties gagnées</div>
          </div>
          <div className="stat-tile">
            <div className={`value ${stats.totalPoints >= 0 ? 'positive' : 'negative'}`}>
              {stats.totalPoints >= 0 ? '+' : ''}
              {stats.totalPoints}
            </div>
            <div className="label">Points cumulés</div>
          </div>
          <div className="stat-tile">
            <div className="value">{stats.averagePointsPerRound.toFixed(1)}</div>
            <div className="label">Points / manche en moyenne</div>
          </div>
          <div className="stat-tile">
            <div className="value">{Math.round(stats.successRate * 100)}%</div>
            <div className="label">
              Taux de réussite ({stats.roundsWon}/{stats.roundsPlayed})
            </div>
          </div>
          <div className="stat-tile">
            <div className="value">{stats.longestWinStreak}</div>
            <div className="label">Plus grande série de contrats réussis</div>
          </div>
          <div className="stat-tile">
            <div className="value">{stats.biggestSuccessfulBid ?? '—'}</div>
            <div className="label">Plus grosse annonce réussie</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Tendances</h2>
        <div className="ladder-row">
          <span>Némésis</span>
          <span>{stats.nemesis ? `${stats.nemesis.playerName} (${stats.nemesis.netPointDiff} pts)` : '—'}</span>
        </div>
        <div className="ladder-row">
          <span>Souffre-douleur</span>
          <span>{stats.souffreDouleur ? `${stats.souffreDouleur.playerName} (+${stats.souffreDouleur.netPointDiff} pts)` : '—'}</span>
        </div>
      </div>

      <div className="card">
        <h2>Face à chaque joueur</h2>
        {stats.pairStats.length === 0 && <p className="muted">Pas encore assez de manches jouées ensemble.</p>}
        {stats.pairStats.map((p) => (
          <div key={p.playerId} className="ladder-row">
            <span>{p.playerName}</span>
            <span className={p.netPointDiff >= 0 ? 'positive' : 'negative'}>
              {p.netPointDiff >= 0 ? '+' : ''}
              {p.netPointDiff} pts sur {p.roundsTogether} manches
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
