#!/usr/bin/env bash
# Lance l'API et l'app web en mode développement dans deux processus, avec
# rechargement automatique à chaque changement de code.
set -e
cd "$(dirname "$0")"

trap 'kill 0' EXIT
(cd server && npm run dev) &
(cd web && npm run dev) &
wait
