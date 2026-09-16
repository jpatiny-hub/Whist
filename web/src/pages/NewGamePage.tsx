import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Game, Player } from '../types';

export default function NewGamePage() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [lastGame, setLastGame] = useState<Game | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [label, setLabel] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ players: Player[] }>('/players').then((res) => setPlayers(res.players));
    api<{ games: Game[] }>('/games').then((res) => setLastGame(res.games[0] ?? null));
  }, []);

  function toggle(id: string) {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 4) return cur;
      return [...cur, id];
    });
  }

  function reuseLastGame() {
    if (lastGame) setSelected(lastGame.players.map((p) => p.playerId));
  }

  async function addPlayer() {
    if (!newPlayerName.trim()) return;
    try {
      const res = await api<{ player: Player }>('/players', {
        method: 'POST',
        body: JSON.stringify({ name: newPlayerName.trim() }),
      });
      setPlayers((cur) => [...cur, res.player].sort((a, b) => a.name.localeCompare(b.name)));
      if (selected.length < 4) setSelected((cur) => [...cur, res.player.id]);
      setNewPlayerName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  }

  async function createGame() {
    if (selected.length !== 4) return;
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ game: Game }>('/games', {
        method: 'POST',
        body: JSON.stringify({ label: label || undefined, playerIds: selected }),
      });
      navigate(`/games/${res.game.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  const selectedNames = useMemo(
    () => selected.map((id) => players.find((p) => p.id === id)?.name).filter(Boolean),
    [selected, players],
  );

  return (
    <div>
      <div className="card">
        <h2>Nouvelle partie</h2>
        <p className="muted">Choisis exactement 4 joueurs — sélectionne parmi les joueurs récurrents ou ajoute-en de nouveaux.</p>
        {error && <div className="error-box">{error}</div>}

        {lastGame && (
          <button className="btn secondary" onClick={reuseLastGame} style={{ marginBottom: 14 }}>
            Reprendre les joueurs de « {lastGame.label || 'la dernière partie'} »
          </button>
        )}

        <div className="field">
          <label>Joueurs ({selected.length}/4)</label>
          <div className="chip-row">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${selected.includes(p.id) ? 'selected' : ''}`}
                onClick={() => toggle(p.id)}
                disabled={!selected.includes(p.id) && selected.length >= 4}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="newPlayer">Ajouter un nouveau joueur</label>
          <div className="btn-row">
            <input
              id="newPlayer"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Nom"
              style={{ flex: 1, padding: '11px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,.06)' }}
            />
            <button type="button" className="btn secondary" onClick={addPlayer}>
              Ajouter
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="label">Nom de la soirée (optionnel)</label>
          <input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Soirée du 20/09" />
        </div>

        {selectedNames.length > 0 && <p className="muted">Table : {selectedNames.join(', ')}</p>}

        <button className="btn" disabled={selected.length !== 4 || busy} onClick={createGame} style={{ width: '100%' }}>
          {busy ? 'Création…' : 'Démarrer la partie'}
        </button>
      </div>
    </div>
  );
}
