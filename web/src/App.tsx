import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GamesListPage from './pages/GamesListPage';
import NewGamePage from './pages/NewGamePage';
import GamePage from './pages/GamePage';
import GameStatsPage from './pages/GameStatsPage';
import PlayersPage from './pages/PlayersPage';
import PlayerStatsPage from './pages/PlayerStatsPage';
import ContractsReferencePage from './pages/ContractsReferencePage';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/games" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/games" replace /> : <RegisterPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/games" replace />} />
                <Route path="/games" element={<GamesListPage />} />
                <Route path="/games/new" element={<NewGamePage />} />
                <Route path="/games/:id" element={<GamePage />} />
                <Route path="/games/:id/stats" element={<GameStatsPage />} />
                <Route path="/players" element={<PlayersPage />} />
                <Route path="/players/:id/stats" element={<PlayerStatsPage />} />
                <Route path="/contracts" element={<ContractsReferencePage />} />
                <Route path="*" element={<Navigate to="/games" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
