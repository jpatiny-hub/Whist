import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { ContractsResponse } from '../types';

export default function ContractsReferencePage() {
  const [data, setData] = useState<ContractsResponse | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api<ContractsResponse>('/contracts').then(setData);
  }, []);

  if (!data) return <p className="muted">Chargement…</p>;

  return (
    <div>
      <div className="card">
        <h2>Échelle des contrats</h2>
        <p className="muted">
          Du plus faible au plus fort — chaque enchère doit être plus forte que la précédente. Le Trou est indiqué
          uniquement à titre de repère (il est déclenché automatiquement, jamais enchéri).
        </p>
        {data.ladder.map((code) => {
          const c = data.byCode[code];
          return (
            <div key={code} className="ladder-row">
              <span>{c.label}</span>
              <span className="muted">
                {c.exact ? `exactement ${c.requiredTricks} pli(s)` : `≥ ${c.requiredTricks} plis`}
              </span>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Points gagnés / perdus par contrat</h2>
        <p className="muted">
          Pour les contrats joués seul (Solo, Abondance, Piccolo, misères, Grand Chelem), la valeur affichée pour le
          déclarant est déjà ×3 (il gagne ou perd 3 fois la valeur de chacun de ses 3 adversaires). Pour l'Emballage et
          le Trou (2 déclarants contre 2 adversaires), la valeur s'applique directement à chaque joueur.
        </p>
        {data.contracts.map((c) => (
          <div key={c.code} className="declaration-row">
            <div
              className="ladder-row"
              style={{ cursor: 'pointer', border: 'none' }}
              onClick={() => setExpanded(expanded === c.code ? null : c.code)}
            >
              <strong>{c.label}</strong>
              <span className="muted">{expanded === c.code ? '▲' : '▼'}</span>
            </div>
            {c.ruleNote && <p className="muted" style={{ marginTop: 0 }}>{c.ruleNote}</p>}
            {expanded === c.code && (
              <table>
                <thead>
                  <tr>
                    <th>Plis</th>
                    <th>Résultat</th>
                    <th>Déclarant(s)</th>
                    <th>Chaque adversaire</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pointsTables?.[c.code]?.map((row) => (
                    <tr key={row.tricks}>
                      <td>{row.tricks}</td>
                      <td>
                        <span className={`badge ${row.success ? 'success' : 'fail'}`}>
                          {row.success ? 'réussi' : 'échec'}
                        </span>
                      </td>
                      <td className={row.declarerDelta >= 0 ? 'positive' : 'negative'}>
                        {row.declarerDelta >= 0 ? '+' : ''}
                        {row.declarerDelta}
                      </td>
                      <td className={row.opponentDelta >= 0 ? 'positive' : 'negative'}>
                        {row.opponentDelta >= 0 ? '+' : ''}
                        {row.opponentDelta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
