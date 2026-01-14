
import React from 'react';
import { Layout } from './components/Layout.tsx';
import { HomeView } from './components/HomeView.tsx';
import { MapView } from './components/MapView.tsx';
import { ChatView } from './components/ChatView.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { AuthView } from './components/AuthView.tsx';
import { RestaurantDashboard } from './components/RestaurantDashboard.tsx';
import { UserType, ViewState } from './types.ts';
import { AppProvider, useAppStore } from './services/store.tsx';

const AppContent: React.FC = () => {
  const { state } = useAppStore();

  if (!state.user) {
    return <AuthView />;
  }

  // Router logic
  const renderView = () => {
    if (state.user?.type === UserType.RESTAURANT) {
      // Allow restaurants to view specific chats
      if (state.view === ViewState.CHAT) {
        return <ChatView />;
      }
      return <RestaurantDashboard />;
    }

    switch (state.view) {
      case ViewState.HOME:
        return <HomeView />;
      case ViewState.MAP:
        return <MapView />;
      case ViewState.CHAT:
        return <ChatView />;
      case ViewState.PROFILE:
        return <ProfileView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <Layout>
      {renderView()}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
