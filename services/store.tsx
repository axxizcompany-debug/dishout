import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { User, UserType, ViewState, ChatSession, FoodScan, MenuItem, RestaurantMatch } from '../types';
import { MOCK_REGULAR_USER, MOCK_RESTAURANT_USER, LEAD_PRICE_AED } from '../constants';

interface AppState {
  user: User | null;
  view: ViewState;
  chats: ChatSession[];
  scans: FoodScan[];
  currentRestaurantData: any | null;
  // New state for navigation
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
  | { type: 'START_CHAT'; payload: RestaurantMatch } // Initiate chat from Map
  | { type: 'SET_ACTIVE_CHAT'; payload: string | null }
  | { type: 'FOCUS_MAP'; payload: { lat: number; lng: number; restaurantId: string } }
  | { type: 'UPDATE_USER_AVATAR'; payload: string };

// Helper to load initial state from localStorage
const loadInitialState = (): AppState => {
    const storedUserStr = localStorage.getItem('dishout_current_session');
    const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
    
    let currentRestaurantData = MOCK_RESTAURANT_USER;
    
    // If we have a stored restaurant user, initialize their dashboard data
    if (storedUser && storedUser.type === UserType.RESTAURANT) {
        currentRestaurantData = {
            ...storedUser,
            leads: 0, 
            balance: 0,
            menu: storedUser.menu || [] 
        };
    }

    return {
        user: storedUser,
        view: ViewState.HOME,
        chats: [
            {
            id: 'chat_1',
            restaurantId: 'rest_123',
            restaurantName: 'Azure Coast Bistro',
            restaurantAvatar: 'https://picsum.photos/200/200?random=1',
            userId: 'user_456',
            userName: 'Sara Al-Maha',
            status: 'active',
            messages: [
                { id: 'm1', senderId: 'rest_123', text: 'Welcome to Azure Coast! Did you see our Lobster special?', timestamp: Date.now() - 100000 },
                { id: 'm2', senderId: 'user_456', text: 'Yes, does it come with sides?', timestamp: Date.now() - 50000 }
            ]
            }
        ],
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
      // Save session
      localStorage.setItem('dishout_current_session', JSON.stringify(action.payload));

      // If the logged-in user is a restaurant, we must initialize the dashboard data
      let nextRestaurantData = state.currentRestaurantData;
      
      if (action.payload.type === UserType.RESTAURANT) {
          nextRestaurantData = {
              ...action.payload, // Spread the user data (includes id, name, location, website)
              leads: 0,         // Reset stats for new session
              balance: 0,
              menu: []          // Start with empty menu unless synced
          };
      }

      return { 
          ...state, 
          user: action.payload,
          currentRestaurantData: nextRestaurantData
      };
    }
    case 'LOGOUT':
      localStorage.removeItem('dishout_current_session');
      return { ...state, user: null };
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
                ? { 
                    ...chat, 
                    status: 'closed',
                    messages: [...chat.messages, {
                        id: `sys_${Date.now()}`,
                        senderId: 'system',
                        text: 'Restaurant is currently unavailable. Rerouting to nearest alternative...',
                        timestamp: Date.now(),
                        isSystem: true
                    }]
                  } 
                : chat
            ),
            activeChatId: null, // Close the chat view for the decliner
            view: state.user?.type === UserType.RESTAURANT ? ViewState.HOME : state.view
        };
    case 'UPDATE_MENU':
      return {
          ...state,
          currentRestaurantData: {
              ...state.currentRestaurantData,
              menu: action.payload
          }
      };
    case 'UPDATE_RESTAURANT_LOCATION':
      // Update both the user profile in state and the specific restaurant data
      const updatedRestData = {
          ...state.currentRestaurantData,
          location: action.payload
      };
      
      return {
          ...state,
          currentRestaurantData: updatedRestData,
          user: state.user?.type === UserType.RESTAURANT 
            ? { ...state.user, ...updatedRestData } 
            : state.user
      };
    case 'START_CHAT': {
        const restaurant = action.payload;
        // Check if chat exists
        const existingChat = state.chats.find(c => c.restaurantId === restaurant.id);
        
        if (existingChat) {
            return {
                ...state,
                activeChatId: existingChat.id,
                view: ViewState.CHAT
            };
        }

        // Create new chat
        const newChat: ChatSession = {
            id: `chat_${Date.now()}`,
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            restaurantAvatar: `https://ui-avatars.com/api/?name=${restaurant.name}&background=random`,
            userId: state.user?.id || 'unknown',
            userName: state.user?.name || 'User',
            messages: [
                {
                    id: 'init_1',
                    senderId: 'system',
                    text: `📍 Connected to location: ${restaurant.distance || 'Nearby'}. Waiting for restaurant acceptance...`,
                    timestamp: Date.now()
                }
            ],
            status: 'pending' // New chats start as pending until restaurant accepts
        };

        return {
            ...state,
            chats: [newChat, ...state.chats],
            activeChatId: newChat.id,
            view: ViewState.CHAT
        };
    }
    case 'SET_ACTIVE_CHAT':
        return { ...state, activeChatId: action.payload };
    case 'FOCUS_MAP':
        return { 
            ...state, 
            mapFocus: action.payload,
            view: ViewState.MAP 
        };
    case 'UPDATE_USER_AVATAR':
        return {
            ...state,
            user: state.user ? { ...state.user, avatar: action.payload } : null
        };
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