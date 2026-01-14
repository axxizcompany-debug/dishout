
import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { User, UserType, ViewState, ChatSession, FoodScan, MenuItem, RestaurantMatch } from '../types.ts';
import { MOCK_REGULAR_USER, MOCK_RESTAURANT_USER, LEAD_PRICE_AED } from '../constants.ts';

interface AppState {
  user: User | null;
  view: ViewState;
  chats: ChatSession[];
  scans: FoodScan[];
  currentRestaurantData: any | null;
  activeChatId: string | null;
  mapFocus: { lat: number; lng: number; restaurantId: string } | null;
}

type Action =
  | { type: 'LOGIN_USER'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_VIEW'; payload: ViewState }
  | { type: 'ADD_SCAN'; payload: FoodScan }
  | { type: 'ADD_MESSAGE'; payload: { chatId: string; message: any } }
  | { type: 'CONVERT_LEAD'; payload: { chatId: string; restaurantId: string } }
  | { type: 'ACCEPT_LEAD'; payload: { chatId: string; restaurantId: string } }
  | { type: 'DECLINE_LEAD'; payload: { chatId: string } }
  | { type: 'UPDATE_MENU'; payload: MenuItem[] }
  | { type: 'UPDATE_RESTAURANT_LOCATION'; payload: { lat: number; lng: number } }
  | { type: 'START_CHAT'; payload: RestaurantMatch } 
  | { type: 'SET_ACTIVE_CHAT'; payload: string | null }
  | { type: 'FOCUS_MAP'; payload: { lat: number; lng: number; restaurantId: string } }
  | { type: 'UPDATE_USER_AVATAR'; payload: string };

const loadInitialState = (): AppState => {
    const storedUserStr = localStorage.getItem('dishout_current_session');
    let storedUser = null;
    try {
        storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
    } catch (e) {
        console.warn("Could not parse session", e);
    }
    
    let currentRestaurantData = MOCK_RESTAURANT_USER;
    if (storedUser && storedUser.type === UserType.RESTAURANT) {
        currentRestaurantData = {
            ...storedUser,
            leads: storedUser.leads || 0, 
            balance: storedUser.balance || 0,
            menu: storedUser.menu || [] 
        };
    }

    return {
        user: storedUser,
        view: ViewState.HOME,
        chats: [],
        scans: [],
        currentRestaurantData: currentRestaurantData,
        activeChatId: null,
        mapFocus: null,
    };
};

const initialState: AppState = loadInitialState();

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'LOGIN_USER': {
      localStorage.setItem('dishout_current_session', JSON.stringify(action.payload));
      let nextRestaurantData = state.currentRestaurantData;
      if (action.payload.type === UserType.RESTAURANT) {
          nextRestaurantData = {
              ...action.payload,
              leads: (action.payload as any).leads || 0,
              balance: (action.payload as any).balance || 0,
              menu: (action.payload as any).menu || []
          };
      }
      return { ...state, user: action.payload, currentRestaurantData: nextRestaurantData };
    }
    case 'LOGOUT':
      localStorage.removeItem('dishout_current_session');
      return { ...state, user: null, chats: [], scans: [] };
    case 'SET_VIEW':
      return { ...state, view: action.payload };
    case 'ADD_SCAN':
      return { ...state, scans: [action.payload, ...state.scans] };
    case 'ADD_MESSAGE':
      return {
        ...state,
        chats: state.chats.map(chat =>
          chat.id === action.payload.chatId
            ? { ...chat, messages: [...chat.messages, action.payload.message] }
            : chat
        )
      };
    case 'CONVERT_LEAD':
      return {
        ...state,
        chats: state.chats.map(chat =>
          chat.id === action.payload.chatId ? { ...chat, status: 'converted' } : chat
        ),
      };
    case 'ACCEPT_LEAD':
        return {
            ...state,
            chats: state.chats.map(chat =>
              chat.id === action.payload.chatId ? { ...chat, status: 'active' } : chat
            ),
            currentRestaurantData: state.user?.id === action.payload.restaurantId
              ? {
                  ...state.currentRestaurantData,
                  leads: state.currentRestaurantData.leads + 1,
                  balance: state.currentRestaurantData.balance + LEAD_PRICE_AED
                }
              : state.currentRestaurantData
        };
    case 'DECLINE_LEAD':
        return {
            ...state,
            chats: state.chats.map(chat => 
                chat.id === action.payload.chatId 
                ? { ...chat, status: 'closed' } : chat
            ),
            activeChatId: null
        };
    case 'UPDATE_MENU':
      return { ...state, currentRestaurantData: { ...state.currentRestaurantData, menu: action.payload } };
    case 'UPDATE_RESTAURANT_LOCATION':
      const updatedRestData = { ...state.currentRestaurantData, location: action.payload };
      return { ...state, currentRestaurantData: updatedRestData };
    case 'START_CHAT': {
        const restaurant = action.payload;
        const existingChat = state.chats.find(c => c.restaurantId === restaurant.id);
        if (existingChat) {
            return { ...state, activeChatId: existingChat.id, view: ViewState.CHAT };
        }
        const newChat: ChatSession = {
            id: `chat_${Date.now()}`,
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            restaurantAvatar: `https://ui-avatars.com/api/?name=${restaurant.name}&background=random`,
            userId: state.user?.id || 'unknown',
            userName: state.user?.name || 'User',
            messages: [{ id: 'init_1', senderId: 'system', text: `📍 Connected to: ${restaurant.name}. Waiting for acceptance...`, timestamp: Date.now() }],
            status: 'pending'
        };
        return { ...state, chats: [newChat, ...state.chats], activeChatId: newChat.id, view: ViewState.CHAT };
    }
    case 'SET_ACTIVE_CHAT':
        return { ...state, activeChatId: action.payload };
    case 'FOCUS_MAP':
        return { ...state, mapFocus: action.payload, view: ViewState.MAP };
    case 'UPDATE_USER_AVATAR':
        return { ...state, user: state.user ? { ...state.user, avatar: action.payload } : null };
    default:
      return state;
  }
};

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore must be used within AppProvider');
  return context;
};
