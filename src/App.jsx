import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Importando nossas páginas e o layout
import LoginPage from './pages/LoginPage';
import MainLayout from './components/MainLayout';
import HomePage from './pages/HomePage';
import ProductionPage from './pages/ProductionPage';
import RegistrationPage from './pages/RegistrationPage';

// Componente para proteger rotas que exigem login
function ProtectedRoute({ user, children }) {
  if (!user) {
    // Se não há usuário, redireciona para a página de login
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Rota de Login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rotas Protegidas dentro do Layout Principal */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute user={user}>
              <MainLayout user={user} />
            </ProtectedRoute>
          }
        >
          {/* A rota "index" é a padrão quando se acessa "/" */}
          <Route index element={<HomePage />} />
          <Route path="producao" element={<ProductionPage />} />
          <Route path="cadastros" element={<RegistrationPage />} />
          {/* Adicione outras rotas aqui */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;