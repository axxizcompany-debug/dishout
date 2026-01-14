import React, { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Layout } from './components/Layout';
import { HomeView } from './components/HomeView';
import { MapView } from './components/MapView';
import { ChatView } from './components/ChatView';
import { ProfileView } from './components/ProfileView';
import { AuthView } from './components/AuthView';
import { RestaurantDashboard } from './components/RestaurantDashboard';
import { UserType, ViewState } from './types';
import { AppProvider, useAppStore } from './services/store';

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
      <Analytics />
    </AppProvider>
  );
};

export default App;