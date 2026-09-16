@echo off
REM Usage quotidien (une seule fenetre) : construit l'app puis lance UN seul
REM serveur qui sert a la fois l'API et l'application web deja compilee.
REM Pas de rechargement automatique ici : relance ce script apres un
REM "git pull" pour prendre en compte les changements.
cd /d "%~dp0"
call npm run build
if errorlevel 1 (
  echo La construction a echoue, voir les erreurs ci-dessus.
  pause
  exit /b 1
)
call npm start
pause
