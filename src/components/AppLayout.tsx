import React from 'react';
import { Sidebar } from './Sidebar';

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <aside className="w-64 bg-gray-800 border-r border-gray-700">
        <Sidebar />
      </aside>

      <main className="flex-1 flex flex-col relative">{children}</main>
    </div>
  );
};