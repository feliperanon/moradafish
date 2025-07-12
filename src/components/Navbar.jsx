import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="fixed bottom-0 md:top-0 md:bottom-auto w-full bg-white border-t md:border-b border-gray-200 z-50">
      <ul className="flex md:justify-start justify-around items-center p-2 md:p-4 text-sm md:text-base">
        <li>
          <NavLink to="/" className={({ isActive }) =>
            isActive ? 'text-blue-600 font-bold' : 'text-gray-600'
          }>
            Início
          </NavLink>
        </li>
        <li>
          <NavLink to="/production" className={({ isActive }) =>
            isActive ? 'text-blue-600 font-bold' : 'text-gray-600'
          }>
            Produção
          </NavLink>
        </li>
        <li className="hidden md:block">
          <NavLink to="/dashboard" className={({ isActive }) =>
            isActive ? 'text-blue-600 font-bold' : 'text-gray-600'
          }>
            Mensal
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
