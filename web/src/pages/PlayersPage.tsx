import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Player } from '../types';

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
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
    </div>
  );
}
