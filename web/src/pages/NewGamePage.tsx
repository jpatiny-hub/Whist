import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Game, GameType, Player } from '../types';

const RIKIKI_MIN_PLAYERS = 3;
const RIKIKI_MAX_PLAYERS = 8;

function maxCardsForPlayers(n: number) {
  return Math.floor(52 / n);
}

export default function NewGamePage() {
  const navigate = useNavigate();
  const [gameType, setGameType] = useState<GameType>('WHIST');
  const [players, setPlayers] = useState<Player[]>([]);
  const [lastGame, setLastGame] = useState<Game | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [label, setLabel] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [rikikiPeak, setRikikiPeak] = useState<number | null>(null);
  const [rikikiDoublePeak, setRikikiDoublePeak] = useState(false);
  const [rikikiZeroBidPenalty, setRikikiZeroBidPenalty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ players: Player[] }>('/players').then((res) => setPlayers(res.players));
    api<{ games: Game[] }>('/games').then((res) => setLastGame(res.games[0] ?? null));
  }, []);

  const maxPlayers = gameType === 'WHIST' ? 4 : RIKIKI_MAX_PLAYERS;
  const minPlayers = gameType === 'WHIST' ? 4 : RIKIKI_MIN_PLAYERS;
  const theoreticalPeak = selected.length >= 2 ? maxCardsForPlayers(selected.length) : null;
  const effectivePeak = rikikiPeak ?? theoreticalPeak;

  function setGameTypeAndReset(type: GameType) {
    setGameType(type);
    setSelected([]);
    setRikikiPeak(null);
  }

  function toggle(id: string) {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= maxPlayers) return cur;
      return [...cur, id];
    });
  }

  function reuseLastGame() {
    if (lastGame) setSelected(lastGame.players.map((p) => p.playerId).slice(0, maxPlayers));
  }

  async function addPlayer() {
    if (!newPlayerName.trim()) return;
    try {
      const res = await api<{ player: Player }>('/players', {
        method: 'POST',
        body: JSON.stringify({ name: newPlayerName.trim() }),
      });
      setPlayers((cur) => [...cur, res.player].sort((a, b) => a.name.localeCompare(b.name)));
      if (selected.length < maxPlayers) setSelected((cur) => [...cur, res.player.id]);
      setNewPlayerName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  }

  const canCreate = gameType === 'WHIST' ? selected.length === 4 : selected.length >= minPlayers && selected.length <= maxPlayers;

  async function createGame() {
    if (!canCreate) return;
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ game: Game }>('/games', {
        method: 'POST',
        body: JSON.stringify({
          type: gameType,
          label: label || undefined,
          playerIds: selected,
          ...(gameType === 'RIKIKI'
            ? { rikikiPeak: effectivePeak ?? undefined, rikikiDoublePeak, rikikiZeroBidPenalty }
            : {}),
        }),
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
        {error && <div className="error-box">{error}</div>}

        <div className="field">
          <label>Jeu</label>
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${gameType === 'WHIST' ? 'selected' : ''}`}
              onClick={() => setGameTypeAndReset('WHIST')}
            >
              Whist
            </button>
            <button
              type="button"
              className={`chip ${gameType === 'RIKIKI' ? 'selected' : ''}`}
              onClick={() => setGameTypeAndReset('RIKIKI')}
            >
              Rikiki (l'ascenseur)
            </button>
          </div>
        </div>

        <p className="muted">
          {gameType === 'WHIST'
            ? 'Choisis exactement 4 joueurs.'
            : `Choisis entre ${RIKIKI_MIN_PLAYERS} et ${RIKIKI_MAX_PLAYERS} joueurs.`}
        </p>

        {lastGame && lastGame.type === gameType && (
          <button className="btn secondary" onClick={reuseLastGame} style={{ marginBottom: 14 }}>
            Reprendre les joueurs de « {lastGame.label || 'la dernière partie'} »
          </button>
        )}

        <div className="field">
          <label>
            Joueurs ({selected.length}/{maxPlayers})
          </label>
          <div className="chip-row">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${selected.includes(p.id) ? 'selected' : ''}`}
                onClick={() => toggle(p.id)}
                disabled={!selected.includes(p.id) && selected.length >= maxPlayers}
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

        {gameType === 'RIKIKI' && (
          <>
            <div className="field">
              <label htmlFor="peak">
                Pic de cartes (maximum {theoreticalPeak ?? '—'} pour {selected.length || '…'} joueurs)
              </label>
              <input
                id="peak"
                type="number"
                min={1}
                max={theoreticalPeak ?? undefined}
                value={effectivePeak ?? ''}
                onChange={(e) => setRikikiPeak(e.target.value ? Number(e.target.value) : null)}
                placeholder={theoreticalPeak ? String(theoreticalPeak) : 'Sélectionne les joueurs d\'abord'}
              />
            </div>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={rikikiDoublePeak} onChange={(e) => setRikikiDoublePeak(e.target.checked)} />
              Rejouer le tour du sommet deux fois
            </label>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rikikiZeroBidPenalty}
                onChange={(e) => setRikikiZeroBidPenalty(e.target.checked)}
              />
              Malus de 2 points pour 3 annonces à 0 consécutives
            </label>
          </>
        )}

        <div className="field">
          <label htmlFor="label">Nom de la soirée (optionnel)</label>
          <input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Soirée du 20/09" />
        </div>

        {selectedNames.length > 0 && <p className="muted">Table : {selectedNames.join(', ')}</p>}

        <button className="btn" disabled={!canCreate || busy} onClick={createGame} style={{ width: '100%' }}>
          {busy ? 'Création…' : 'Démarrer la partie'}
        </button>
      </div>
    </div>
  );
}
