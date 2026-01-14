
import React from 'react';
import { useAppStore } from '../services/store.tsx';
import { ViewState, UserType } from '../types.ts';
import { Home, Map, MessageSquare, User } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { state, dispatch } = useAppStore();
  const isRestaurant = state.user?.type === UserType.RESTAURANT;

  if (isRestaurant) {
    return (
      <div className="fixed inset-0 bg-[#0f0718] text-white flex flex-col">
         <header className="p-4 bg-[#1a0b2e] border-b border-purple-800 flex justify-between items-center shrink-0 z-50">
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              DishOut Business
            </h1>
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300">Balance:</span>
                <span className="font-bold text-amber-400">{state.currentRestaurantData.balance} AED</span>
                <button onClick={() => dispatch({type: 'LOGOUT'})} className="text-xs text-purple-400 ml-2">Logout</button>
            </div>
         </header>
         <main className="flex-1 overflow-y-auto">
            {children}
         </main>
      </div>
    );
  }

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: any; label: string }) => (
    <button
      onClick={() => dispatch({ type: 'SET_VIEW', payload: view })}
      className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform ${
        state.view === view ? 'text-purple-400' : 'text-gray-500'
      }`}
    >
      <Icon size={24} />
      <span className="text-[10px]">{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-[#0f0718] text-white flex flex-col overflow-hidden">
        <main className="flex-1 relative flex flex-col overflow-hidden">
            {children}
        </main>
        <nav className="shrink-0 h-16 bg-[#1a0b2e] border-t border-purple-900/50 flex justify-around items-center z-50 shadow-2xl pb-safe">
            <NavItem view={ViewState.HOME} icon={Home} label="Discover" />
            <NavItem view={ViewState.MAP} icon={Map} label="Map" />
            <NavItem view={ViewState.CHAT} icon={MessageSquare} label="Chat" />
            <NavItem view={ViewState.PROFILE} icon={User} label="Profile" />
        </nav>
    </div>
  );
};
