import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { PlayerStats } from '../types';

export default function PlayerStatsPage() {
  const { id } = useParams<{ id: string }>();
  const [stats, setStats] = useState<PlayerStats | null>(null);

  useEffect(() => {
    if (!id) return;
    api<{ stats: PlayerStats }>(`/stats/players/${id}`).then((res) => setStats(res.stats));
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
        <h2>{stats.playerName}</h2>
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
            <div className="value">{stats.averagePointsPerHand.toFixed(1)}</div>
            <div className="label">Points / donne en moyenne</div>
          </div>
          <div className="stat-tile">
            <div className="value">{Math.round(stats.defenseSuccessRate * 100)}%</div>
            <div className="label">
              Taux de réussite en défense ({stats.totalDefenseWon}/{stats.totalDefended})
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Tendances</h2>
        <div className="ladder-row">
          <span>Contrat favori</span>
          <span>{stats.favoriteContract ? `${stats.favoriteContract.label} (${stats.favoriteContract.timesDeclared}×)` : '—'}</span>
        </div>
        <div className="ladder-row">
          <span>Contrat le plus réussi</span>
          <span>
            {stats.mostSuccessfulContract
              ? `${stats.mostSuccessfulContract.label} (${Math.round(stats.mostSuccessfulContract.successRate * 100)}%)`
              : '—'}
          </span>
        </div>
        <div className="ladder-row">
          <span>Contrat le plus raté</span>
          <span>
            {stats.mostFailedContract
              ? `${stats.mostFailedContract.label} (${Math.round((1 - stats.mostFailedContract.successRate) * 100)}% d'échec)`
              : '—'}
          </span>
        </div>
        <div className="ladder-row">
          <span>Partenaire favori</span>
          <span>{stats.favoritePartner ? `${stats.favoritePartner.playerName} (${stats.favoritePartner.timesPartnered}×)` : '—'}</span>
        </div>
        <div className="ladder-row">
          <span>Némésis</span>
          <span>{stats.nemesis ? `${stats.nemesis.playerName} (${stats.nemesis.netPointDiff} pts)` : '—'}</span>
        </div>
        <div className="ladder-row">
          <span>Souffre-douleur</span>
          <span>{stats.bestRival ? `${stats.bestRival.playerName} (+${stats.bestRival.netPointDiff} pts)` : '—'}</span>
        </div>
        <div className="ladder-row">
          <span>Bête noire</span>
          <span>
            {stats.beteNoire
              ? `${stats.beteNoire.playerName} (a fait échouer ${stats.beteNoire.failedAttacksAgainst} de ses attaques)`
              : '—'}
          </span>
        </div>
      </div>

      <div className="card">
        <h2>Défense</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Quand ce joueur n'est pas le déclarant : a-t-il fait échouer le contrat adverse ?
        </p>
        <div className="ladder-row">
          <span>Contrat le plus souvent affronté</span>
          <span>{stats.mostFacedContract ? `${stats.mostFacedContract.label} (${stats.mostFacedContract.timesDefended}×)` : '—'}</span>
        </div>
        <div className="ladder-row">
          <span>Contrat le mieux défendu</span>
          <span>
            {stats.bestDefendedContract
              ? `${stats.bestDefendedContract.label} (${Math.round(stats.bestDefendedContract.successRate * 100)}% de réussite)`
              : '—'}
          </span>
        </div>
        <div className="ladder-row">
          <span>Contrat le plus souvent subi</span>
          <span>
            {stats.worstDefendedContract
              ? `${stats.worstDefendedContract.label} (${Math.round((1 - stats.worstDefendedContract.successRate) * 100)}% d'échecs en défense)`
              : '—'}
          </span>
        </div>
      </div>

      <div className="card">
        <h2>Détail par contrat</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Tous les contrats du jeu, même ceux jamais joués par ce joueur.
        </p>
        <table>
          <thead>
            <tr>
              <th>Contrat</th>
              <th>Attaque</th>
              <th>Défense</th>
            </tr>
          </thead>
          <tbody>
            {stats.contractBreakdown.map((c) => (
              <tr key={c.contractCode}>
                <td>{c.label}</td>
                <td className="muted">
                  {c.timesDeclared > 0 ? `${c.timesDeclared}× (${Math.round(c.declaredSuccessRate * 100)}%)` : '—'}
                </td>
                <td className="muted">
                  {c.timesDefended > 0 ? `${c.timesDefended}× (${Math.round(c.defendedSuccessRate * 100)}%)` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Face à chaque joueur</h2>
        {stats.pairStats.map((p) => (
          <div key={p.playerId} className="ladder-row">
            <span>{p.playerName}</span>
            <span className={p.netPointDiff >= 0 ? 'positive' : 'negative'}>
              {p.netPointDiff >= 0 ? '+' : ''}
              {p.netPointDiff} pts sur {p.handsTogether} donnes
              {p.timesPartnered > 0 ? ` · partenaires ${p.timesPartnered}×` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
