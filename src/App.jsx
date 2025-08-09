// C:\code\moradafish\src\App.jsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';

// Layout e Páginas
import MainLayout from './components/MainLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProductionPage from './pages/ProductionPage';
import RegistrationPage from './pages/RegistrationPage';
import ProcessYieldEntryPage from './pages/ProcessYieldEntryPage';
import TesteEscamacaoPage from './pages/TesteEscamacaoPage';

// NOVA PÁGINA
import RendFiletadorExcelPage from './pages/RendFiletadorExcelPage';

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  if (isLoading) return <div className="p-6">Carregando...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute user={user}>
              <MainLayout user={user} />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="producao" element={<ProductionPage />} />
          <Route path="cadastros" element={<RegistrationPage />} />
          <Route path="entrada-rendimento" element={<ProcessYieldEntryPage />} />
          <Route path="teste-escamacao" element={<TesteEscamacaoPage />} />

          {/* NOVA ROTA: Rend. filetador (excel) */}
          <Route path="rend-filetador-excel" element={<RendFiletadorExcelPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
