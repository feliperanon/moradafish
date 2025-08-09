// C:\code\moradafish\src\components\MainLayout.jsx
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Erro no logout:', error));
  };

  const activeLinkStyle = {
    backgroundColor: '#4a5568', // bg-gray-700
    color: 'white',
  };

  const navLinkBase =
    'px-3 py-2 rounded-lg text-sm font-medium transition hover:bg-gray-700 hover:text-white';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* NAV SUPERIOR */}
      <header className="w-full bg-gray-800 text-gray-200 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* Branding + Botão mobile */}
            <div className="flex items-center gap-3">
              <button
                className="md:hidden text-gray-300 hover:text-white focus:outline-none"
                onClick={() => setIsMenuOpen((v) => !v)}
                aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              >
                {isMenuOpen ? <CloseIcon className="h-7 w-7" /> : <MenuIcon className="h-7 w-7" />}
              </button>
              <span className="text-xl sm:text-2xl font-extrabold text-white select-none">
                Morada Fish
              </span>
            </div>

            {/* Links (desktop) */}
            <nav className="hidden md:flex items-center gap-2">
              <NavLink
                to="/"
                end
                style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
                className={navLinkBase}
              >
                Início
              </NavLink>

              <NavLink
                to="/producao"
                style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
                className={navLinkBase}
              >
                Produção
              </NavLink>

              <NavLink
                to="/cadastros"
                style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
                className={navLinkBase}
              >
                Cadastros
              </NavLink>

              <NavLink
                to="/entrada-rendimento"
                style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
                className={navLinkBase}
              >
                Entrada de Rendimento
              </NavLink>

              <NavLink
                to="/teste-escamacao"
                style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
                className={navLinkBase}
              >
                Teste de Escamação
              </NavLink>

              {/* Nova aba */}
              <NavLink
                to="/rend-filetador-excel"
                style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
                className={navLinkBase}
              >
                Rend. filetador (excel)
              </NavLink>
            </nav>

            {/* Usuário + Sair (desktop) */}
            <div className="hidden md:flex items-center gap-3">
              <p className="text-xs text-gray-300 truncate max-w-[220px]" title={user?.email}>
                {user?.email}
              </p>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400"
              >
                Sair
              </button>
            </div>
          </div>
        </div>

        {/* Menu dropdown (mobile) */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-700 bg-gray-800">
            <nav className="px-4 py-3 space-y-2">
              <NavLink
                to="/"
                end
                onClick={() => setIsMenuOpen(false)}
                style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
                className="block px-3 py-2 rounded-lg text-base font-medium transition hover:bg-gray-700 hover:text-white"
              >
                Início
              </NavLink>

              <NavLink
                to="/producao"
                onClick={() => setIsMenuOpen(false)}
                style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
                className="block px-3 py-2 rounded-lg text-base font-medium transition hover:bg-gray-700 hover:text-white"
              >
                Produção
              </NavLink>

              <NavLink
                to="/cadastros"
                onClick={() => setIsMenuOpen(false)}
                style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
                className="block px-3 py-2 rounded-lg text-base font-medium transition hover:bg-gray-700 hover:text-white"
              >
                Cadastros
              </NavLink>

              <NavLink
                to="/entrada-rendimento"
                onClick={() => setIsMenuOpen(false)}
                style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
                className="block px-3 py-2 rounded-lg text-base font-medium transition hover:bg-gray-700 hover:text-white"
              >
                Entrada de Rendimento
              </NavLink>

              <NavLink
                to="/teste-escamacao"
                onClick={() => setIsMenuOpen(false)}
                style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
                className="block px-3 py-2 rounded-lg text-base font-medium transition hover:bg-gray-700 hover:text-white"
              >
                Teste de Escamação
              </NavLink>

              <NavLink
                to="/rend-filetador-excel"
                onClick={() => setIsMenuOpen(false)}
                style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
                className="block px-3 py-2 rounded-lg text-base font-medium transition hover:bg-gray-700 hover:text-white"
              >
                Rend. filetador (excel)
              </NavLink>

              <div className="mt-3 border-t border-gray-700 pt-3">
                <p className="text-sm text-gray-300 truncate" title={user?.email}>
                  {user?.email}
                </p>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400"
                >
                  Sair
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* CONTEÚDO */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}

export default MainLayout;
