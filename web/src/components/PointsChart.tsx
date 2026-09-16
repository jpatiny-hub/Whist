import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GamePlayer, Hand } from '../types';

const PALETTE = ['#e7b23c', '#6fbf8b', '#5aa9e6', '#e0654f'];

interface Props {
  seatedPlayers: GamePlayer[];
  hands: Hand[];
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
          <XAxis dataKey="handNumber" stroke="#b9cdc3" fontSize={12} label={{ value: 'Donne', position: 'insideBottom', offset: -2, fill: '#b9cdc3', fontSize: 11 }} />
          <YAxis stroke="#b9cdc3" fontSize={12} />
          <Tooltip contentStyle={{ background: '#144d3a', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8 }} />
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
