@echo off
REM Lance l'API et l'app web en mode développement, chacune dans sa propre
REM fenêtre, avec rechargement automatique à chaque changement de code.
cd /d "%~dp0"
start "Whist - API" cmd /k "cd /d %~dp0server && npm run dev"
start "Whist - Web" cmd /k "cd /d %~dp0web && npm run dev"
echo Deux fenetres viennent de s'ouvrir (API + Web).
echo Une fois "Local: http://localhost:5173/" affiche, ouvre cette adresse dans ton navigateur.
pause
