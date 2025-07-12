import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

// Ícone do menu "Hambúrguer"
const MenuIcon = (props) => (
  <svg {...props} stroke="currentColor" fill="none" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

// Ícone de "X" para fechar
const CloseIcon = (props) => (
  <svg {...props} stroke="currentColor" fill="none" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

function MainLayout({ user }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    signOut(auth).catch((error) => console.error("Erro no logout:", error));
  };

  const activeLinkStyle = {
    backgroundColor: '#4a5568', // bg-gray-700
    color: 'white',
  };

  return (
    <div className="relative min-h-screen md:flex">
      {/* Overlay para fechar o menu em mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black opacity-50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Menu Lateral */}
      <aside
        className={`
          fixed inset-y-0 left-0 bg-gray-800 text-gray-200 w-64 p-4 z-30 
          transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:relative md:translate-x-0 transition-transform duration-200 ease-in-out
          flex flex-col justify-between
        `}
        aria-expanded={isSidebarOpen}
      >
        {/* Cabeçalho do menu lateral */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold text-white">Morada Fish</h2>
          <button
            className="md:hidden text-gray-400 hover:text-white focus:outline-none"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu lateral"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Links de navegação */}
        <nav className="space-y-2 flex-1">
          <NavLink
            to="/"
            end
            style={({ isActive }) => isActive ? activeLinkStyle : undefined}
            className="block py-3 px-4 rounded-lg text-base font-medium transition hover:bg-gray-700 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            Início
          </NavLink>
          <NavLink
            to="/producao"
            style={({ isActive }) => isActive ? activeLinkStyle : undefined}
            className="block py-3 px-4 rounded-lg text-base font-medium transition hover:bg-gray-700 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            Produção
          </NavLink>
          <NavLink
            to="/cadastros"
            style={({ isActive }) => isActive ? activeLinkStyle : undefined}
            className="block py-3 px-4 rounded-lg text-base font-medium transition hover:bg-gray-700 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            Cadastros
          </NavLink>
        </nav>

        {/* Rodapé do menu lateral */}
        <div className="border-t border-gray-700 pt-4">
          <p className="text-sm truncate" title={user?.email}>{user?.email}</p>
          <button
            onClick={handleLogout}
            className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col">
        {/* Cabeçalho superior para dispositivos móveis */}
        <header className="md:hidden bg-white shadow-md p-4 flex justify-between items-center">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-700 hover:text-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            aria-label="Abrir menu lateral"
          >
            <MenuIcon className="h-8 w-8" />
          </button>
          <h1 className="text-xl font-semibold text-gray-800">Morada Fish</h1>
          <div className="w-8" /> {/* Espaçador visual */}
        </header>

        {/* Área de conteúdo */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
