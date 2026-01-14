import { Restaurant, UserType, MenuItem } from './types';

export const THEME_COLORS = {
  primary: '#8b5cf6', // Violet 500
  secondary: '#a78bfa', // Violet 400
  background: '#0f0718', // Deep purple/black
  surface: '#2e1065', // Dark violet
  accent: '#fbbf24', // Amber 400 for stars/gold
};

export const MOCK_RESTAURANT_USER: Restaurant = {
  id: 'rest_123',
  name: 'Azure Coast Bistro',
  email: 'contact@azurecoast.com',
  avatar: 'https://picsum.photos/200/200?random=1',
  type: UserType.RESTAURANT,
  location: { lat: 25.2048, lng: 55.2708 }, // Dubai coords
  leads: 12,
  balance: 96,
  menu: [
    { name: 'Lobster Thermidor', description: 'Fresh atlantic lobster with creamy sauce', price: '180 AED' },
    { name: 'Truffle Risotto', description: 'Arborio rice with black truffle shavings', price: '95 AED' }
  ]
};

export const MOCK_REGULAR_USER = {
  id: 'user_456',
  name: 'Sara Al-Maha',
  email: 'sara@example.com',
  avatar: 'https://picsum.photos/200/200?random=2',
  type: UserType.USER,
};

export const LEAD_PRICE_AED = 3;