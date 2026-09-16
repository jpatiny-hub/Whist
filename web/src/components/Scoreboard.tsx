import type { GamePlayer, Hand } from '../types';

interface Props {
  seatedPlayers: GamePlayer[];
  hands: Hand[];
}

export default function Scoreboard({ seatedPlayers, hands }: Props) {
  const totals: Record<string, number> = Object.fromEntries(seatedPlayers.map((p) => [p.playerId, 0]));
  for (const hand of hands) {
    for (const score of hand.playerScores) {
      totals[score.playerId] = (totals[score.playerId] ?? 0) + score.delta;
    }
  }
  const ranked = [...seatedPlayers].sort((a, b) => (totals[b.playerId] ?? 0) - (totals[a.playerId] ?? 0));

  return (
    <div className="stat-grid">
      {ranked.map((p) => (
        <div className="stat-tile" key={p.playerId}>
          <div className={`value ${totals[p.playerId] > 0 ? 'positive' : totals[p.playerId] < 0 ? 'negative' : ''}`}>
            {totals[p.playerId] >= 0 ? '+' : ''}
            {totals[p.playerId]}
          </div>
          <div className="label">{p.player.name}</div>
        </div>
      ))}
    </div>
  );
}
