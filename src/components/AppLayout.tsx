"use client";
import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Group, Panel, Separator } from "react-resizable-panels";

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => setIsMobile(window.innerWidth <= 768);
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <Group autoSave="app-layout" key={isMobile ? "mobile" : "desktop"} orientation="horizontal" className="h-full w-full">
        
        {sidebarOpen && (
          <>
            <Panel 
              id="sidebar"
              defaultSize={isMobile ? 70 : 20} 
              minSize={10} 
              className="bg-gray-800 flex flex-col"
            >
              <Sidebar />
            </Panel>
            <Separator className="w-1 bg-gray-700 hover:bg-blue-500 transition-colors cursor-col-resize" />
          </>
        )} 
        
        <Panel id="main" className="flex flex-col relative h-full">
          <button 
            onClick={() => setSidebarOpen((open) => !open)} 
            className="absolute top-4 left-4 z-50 p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-xs shadow-lg transition-colors"
          >
            {sidebarOpen ? "Close Sidebar" : "Open Sidebar"}
          </button>

          <main className="flex-1 flex flex-col relative h-full">{children}</main>
        </Panel>
        
      </Group>
    </div>
  );
};