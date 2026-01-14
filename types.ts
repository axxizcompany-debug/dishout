export enum UserType {
  USER = 'USER',
  RESTAURANT = 'RESTAURANT'
}

export enum ViewState {
  HOME = 'HOME',
  MAP = 'MAP',
  CHAT = 'CHAT',
  PROFILE = 'PROFILE'
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  type: UserType;
}

export interface Restaurant extends User {
  location: { lat: number; lng: number };
  website?: string;
  menu: MenuItem[];
  leads: number;
  balance: number; // in AED
}

export interface MenuItem {
  name: string;
  description: string;
  price: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface ChatSession {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAvatar: string;
  userId: string;
  userName: string;
  messages: ChatMessage[];
  status: 'pending' | 'active' | 'closed' | 'converted';
}

export interface FoodScan {
  id: string;
  imageUrl: string;
  dishName: string;
  timestamp: number;
  matchedRestaurants: RestaurantMatch[];
}

export interface RestaurantMatch {
  id: string;
  name: string;
  distance: string;
  price: string;
  rating: number;
  location: { lat: number; lng: number }; // Added location
}