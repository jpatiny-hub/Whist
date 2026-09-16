#!/usr/bin/env bash
# Usage quotidien (un seul processus) : construit l'app puis lance UN seul
# serveur qui sert à la fois l'API et l'application web déjà compilée.
# Pas de rechargement automatique ici : relance ce script après un
# "git pull" pour prendre en compte les changements.
set -e
cd "$(dirname "$0")"
npm run build
npm start
