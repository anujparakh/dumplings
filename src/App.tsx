import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SpotPage } from './pages/SpotPage';
import { SpotFormPage } from './pages/SpotFormPage';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/spot/:id" element={<SpotPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<Navigate to="/login" replace />} />
      <Route path="/admin/new" element={<SpotFormPage />} />
      <Route path="/admin/spot/:id/edit" element={<SpotFormPage />} />
    </Routes>
  );
}
