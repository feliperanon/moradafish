import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

function MainLayout({ user }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        // O "ouvinte" no App.jsx cuidará de redirecionar para o login.
        console.log('Logout bem-sucedido');
      })
      .catch((error) => console.error("Erro no logout:", error));
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Barra Lateral de Navegação */}
      <aside className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Morada Fish</h2>
        </div>
        <nav className="flex-1 p-2 space-y-2">
          <Link to="/" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">Início</Link>
          <Link to="/producao" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">Produção</Link>
          <Link to="/cadastros" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">Cadastros</Link>
          {/* Adicione outros links aqui conforme as páginas forem criadas */}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <p className="text-sm">{user.email}</p>
          <button 
            onClick={handleLogout}
            className="w-full mt-2 bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet /> {/* O conteúdo da rota atual será renderizado aqui */}
      </main>
    </div>
  );
}

export default MainLayout;