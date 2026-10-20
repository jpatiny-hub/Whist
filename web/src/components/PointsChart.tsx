import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GamePlayer, ScoreableRound } from '../types';

const PALETTE = ['#f4811d', '#7ddd3c', '#b388eb', '#d7263d', '#2ec4b6', '#ffd23f', '#5aa9e6', '#d9b382'];

interface Props {
  seatedPlayers: GamePlayer[];
  hands: ScoreableRound[];
}

export default function PointsChart({ seatedPlayers, hands }: Props) {
  const running: Record<string, number> = Object.fromEntries(seatedPlayers.map((p) => [p.playerId, 0]));
  const data = [{ handNumber: 0, ...Object.fromEntries(seatedPlayers.map((p) => [p.player.name, 0])) }];

  for (const hand of hands) {
    for (const score of hand.playerScores) {
      running[score.playerId] = (running[score.playerId] ?? 0) + score.delta;
    }
    data.push({
      handNumber: hand.handNumber,
      ...Object.fromEntries(seatedPlayers.map((p) => [p.player.name, running[p.playerId] ?? 0])),
    });
  }

  if (hands.length === 0) {
    return <p className="muted">Le graphique apparaîtra dès la première donne enregistrée.</p>;
  }

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="handNumber" stroke="#b9a3c9" fontSize={12} label={{ value: 'Donne', position: 'insideBottom', offset: -2, fill: '#b9a3c9', fontSize: 11 }} />
          <YAxis stroke="#b9a3c9" fontSize={12} />
          <Tooltip contentStyle={{ background: '#1e1329', border: '1px solid rgba(244,129,29,.25)', borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {seatedPlayers.map((p, i) => (
            <Line
              key={p.playerId}
              type="monotone"
              dataKey={p.player.name}
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
