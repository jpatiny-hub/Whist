import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { OverviewStats, Player } from '../types';

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await api<{ players: Player[] }>('/players');
    setPlayers(res.players);
    setLoading(false);
  }

  useEffect(() => {
    load();
    api<{ stats: OverviewStats }>('/stats/overview').then((res) => setOverview(res.stats));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await api('/players', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Ajouter un joueur récurrent</h2>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={onSubmit} className="btn-row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="pname">Nom</label>
            <input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Sophie" />
          </div>
          <button className="btn" type="submit" disabled={busy}>
            Ajouter
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Joueurs ({players.length})</h2>
        {loading && <p className="muted">Chargement…</p>}
        {!loading && players.length === 0 && <p className="muted">Aucun joueur pour l'instant.</p>}
        {players.map((p) => (
          <div key={p.id} className="ladder-row">
            <span>{p.name}</span>
            <Link className="link-btn" to={`/players/${p.id}/stats`}>
              Statistiques →
            </Link>
          </div>
        ))}
      </div>

      {overview && (
        <>
          <div className="card">
            <h2>Statistiques générales</h2>
            <div className="ladder-row">
              <span>Meilleur joueur</span>
              <span>
                {overview.bestPlayer
                  ? `${overview.bestPlayer.playerName} (${overview.bestPlayer.totalPoints >= 0 ? '+' : ''}${overview.bestPlayer.totalPoints} pts)`
                  : '—'}
              </span>
            </div>
            <div className="ladder-row">
              <span>Le plus de parties jouées</span>
              <span>
                {overview.mostGamesPlayed ? `${overview.mostGamesPlayed.playerName} (${overview.mostGamesPlayed.gamesPlayed}×)` : '—'}
              </span>
            </div>
            <div className="ladder-row">
              <span>Contrat le plus joué (tous joueurs)</span>
              <span>{overview.mostPlayedContract ? `${overview.mostPlayedContract.label} (${overview.mostPlayedContract.timesDeclared}×)` : '—'}</span>
            </div>
            <div className="ladder-row">
              <span>Contrat le plus gagné en annonce</span>
              <span>{overview.mostWonContract ? `${overview.mostWonContract.label} (${overview.mostWonContract.successCount}×)` : '—'}</span>
            </div>
            <div className="ladder-row">
              <span>Contrat le plus perdu en annonce</span>
              <span>{overview.mostLostContract ? `${overview.mostLostContract.label} (${overview.mostLostContract.failCount}×)` : '—'}</span>
            </div>
            <div className="ladder-row">
              <span>Meilleur ratio annonce : victoire</span>
              <span>
                {overview.bestRatioContract
                  ? `${overview.bestRatioContract.label} (${Math.round(overview.bestRatioContract.successRate * 100)}% sur ${overview.bestRatioContract.timesDeclared} annonces)`
                  : '—'}
              </span>
            </div>
          </div>

          <div className="card">
            <h2>Classement</h2>
            <table>
              <thead>
                <tr>
                  <th>Joueur</th>
                  <th>Parties</th>
                  <th>Gagnées</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {overview.players.map((p) => (
                  <tr key={p.playerId}>
                    <td>
                      <Link className="link-btn" to={`/players/${p.playerId}/stats`}>
                        {p.playerName}
                      </Link>
                    </td>
                    <td>{p.gamesPlayed}</td>
                    <td>{p.gamesWon}</td>
                    <td className={p.totalPoints >= 0 ? 'positive' : 'negative'}>
                      {p.totalPoints >= 0 ? '+' : ''}
                      {p.totalPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Tous les contrats annoncés (tous joueurs confondus)</h2>
            <table>
              <thead>
                <tr>
                  <th>Contrat</th>
                  <th>Annoncé</th>
                  <th>Réussi</th>
                  <th>Raté</th>
                  <th>Taux</th>
                </tr>
              </thead>
              <tbody>
                {overview.globalContractStats.map((c) => (
                  <tr key={c.contractCode}>
                    <td>{c.label}</td>
                    <td>{c.timesDeclared}</td>
                    <td>{c.successCount}</td>
                    <td>{c.failCount}</td>
                    <td className="muted">{c.timesDeclared > 0 ? `${Math.round(c.successRate * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
