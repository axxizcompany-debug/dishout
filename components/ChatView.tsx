import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../services/store';
import { Send, ArrowLeft, Check, X, DollarSign, Clock, ShieldCheck, MapPin } from 'lucide-react';
import { checkPurchaseIntent } from '../services/geminiService';
import { UserType, ViewState } from '../types';
import { LEAD_PRICE_AED } from '../constants';

export const ChatView: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isRestaurant = state.user?.type === UserType.RESTAURANT;

  // Use global active chat ID
  const activeChatId = state.activeChatId;
  const activeChat = state.chats.find(c => c.id === activeChatId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChatId) return;

    const newMessage = {
        id: Date.now().toString(),
        senderId: state.user?.id || 'unknown',
        text: inputText,
        timestamp: Date.now()
    };

    dispatch({
        type: 'ADD_MESSAGE',
        payload: { chatId: activeChatId, message: newMessage }
    });
    setInputText('');

    // If User sends message, check intent (simple simulation)
    if (!isRestaurant) {
        const hasIntent = await checkPurchaseIntent(newMessage.text);
        if (hasIntent) {
            setTimeout(() => {
                 dispatch({
                    type: 'ADD_MESSAGE',
                    payload: { 
                        chatId: activeChatId, 
                        message: {
                            id: Date.now().toString(),
                            senderId: 'system',
                            text: 'We can prepare that for you right now!',
                            timestamp: Date.now(),
                            isSystem: true
                        }
                    }
                });
            }, 1000);
        }
    }
  };

  const handleAccept = () => {
      if (!activeChatId || !state.user) return;
      dispatch({ 
          type: 'ACCEPT_LEAD', 
          payload: { chatId: activeChatId, restaurantId: state.user.id } 
      });
  };

  const handleDecline = () => {
      if (!activeChatId) return;
      dispatch({ type: 'DECLINE_LEAD', payload: { chatId: activeChatId } });
  };

  const handleBack = () => {
      dispatch({ type: 'SET_ACTIVE_CHAT', payload: null });
      if (isRestaurant) {
          dispatch({ type: 'SET_VIEW', payload: ViewState.HOME });
      } else {
          dispatch({ type: 'SET_VIEW', payload: ViewState.CHAT });
      }
  };

  // Determine Display Name & Avatar
  const displayAvatar = isRestaurant 
    ? `https://ui-avatars.com/api/?name=${activeChat?.userName || 'User'}&background=random`
    : activeChat?.restaurantAvatar;
  
  const displayName = isRestaurant
    ? activeChat?.userName
    : activeChat?.restaurantName;

  // 1. Empty State / List View (Only for Users mainly)
  if (!activeChatId || !activeChat) {
    // If restaurant somehow gets here without active chat, go back to dashboard
    if (isRestaurant) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <p className="text-gray-400">Select a chat from your dashboard.</p>
                <button 
                    onClick={() => dispatch({ type: 'SET_VIEW', payload: ViewState.HOME })}
                    className="mt-4 px-6 py-2 bg-purple-600 rounded-lg text-white font-bold"
                >
                    Go to Dashboard
                </button>
            </div>
        );
    }

    // User Chat List
    const userChats = state.chats.filter(c => c.userId === state.user?.id);
    return (
      <div className="h-full flex flex-col bg-[#0f0718]">
        <header className="p-4 border-b border-purple-900/50 bg-[#1a0b2e]">
             <h2 className="text-xl font-bold">Your Messages</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {userChats.length === 0 && <p className="text-gray-500 text-center mt-10">No messages yet.</p>}
             {userChats.map(chat => (
                 <div 
                    key={chat.id} 
                    onClick={() => {
                        dispatch({ type: 'SET_ACTIVE_CHAT', payload: chat.id });
                    }}
                    className="flex items-center gap-4 p-4 bg-white/5 rounded-xl active:scale-95 transition-transform cursor-pointer border border-transparent hover:border-purple-500/30"
                 >
                     <img src={chat.restaurantAvatar} className="w-12 h-12 rounded-full" />
                     <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-center mb-1">
                            <h3 className="font-bold text-white truncate">{chat.restaurantName}</h3>
                            <span className="text-[10px] text-gray-500">
                                {new Date(chat.messages[chat.messages.length -1]?.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                         </div>
                         <p className="text-sm text-gray-400 truncate">
                            {chat.messages[chat.messages.length -1]?.text}
                         </p>
                     </div>
                 </div>
             ))}
        </div>
      </div>
    );
  }

  // 2. Active Chat Interface
  const isPending = activeChat.status === 'pending';

  return (
    <div className="h-full flex flex-col bg-[#0f0718]">
      {/* Header */}
      <header className="p-4 bg-[#1a0b2e] border-b border-purple-900/50 flex items-center gap-3 shrink-0 shadow-lg z-10">
        <button onClick={handleBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <img src={displayAvatar} className="w-10 h-10 rounded-full border border-purple-500/30" alt="Avatar" />
        <div className="flex-1">
          <h3 className="font-bold text-white leading-tight">{displayName}</h3>
          {isPending ? (
             <span className="text-xs text-amber-400 flex items-center gap-1">
                 <Clock size={10} /> Waiting to connect...
             </span>
          ) : (
             <span className="text-xs text-green-400 flex items-center gap-1">
                 <ShieldCheck size={10} /> Verified Location
             </span>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeChat.messages.map((msg) => {
          const isMe = msg.senderId === state.user?.id;
          const isSystem = msg.isSystem || msg.senderId === 'system';

          if (isSystem) {
              return (
                  <div key={msg.id} className="flex justify-center my-4">
                      <div className="bg-purple-900/30 border border-purple-500/20 px-4 py-2 rounded-full text-xs text-purple-200 flex items-center gap-2">
                          {msg.text.includes('Rerouting') ? <MapPin size={12} /> : <Check size={12} />}
                          {msg.text}
                      </div>
                  </div>
              );
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  isMe
                    ? 'bg-purple-600 text-white rounded-br-none'
                    : 'bg-[#2e1065] text-gray-100 rounded-bl-none border border-purple-500/20'
                }`}
              >
                {msg.text}
                <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-purple-200' : 'text-gray-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area / Action Panel */}
      <div className="p-4 bg-[#1a0b2e] border-t border-purple-900/50 shrink-0">
        
        {/* Scenario A: Pending Request for Restaurant */}
        {isRestaurant && isPending ? (
            <div className="animate-slide-up bg-[#2e1065] rounded-xl p-4 border border-amber-500/30 shadow-2xl shadow-amber-900/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500/20 rounded-full text-amber-400">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-white">New Customer Lead</h4>
                            <p className="text-xs text-amber-300">Accept to start chatting</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="block text-2xl font-black text-white">{LEAD_PRICE_AED} AED</span>
                        <span className="text-[10px] text-gray-400 uppercase">Lead Cost</span>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={handleDecline}
                        className="py-3 rounded-lg border border-red-500/30 text-red-400 font-bold hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                    >
                        <X size={18} /> Decline
                    </button>
                    <button 
                        onClick={handleAccept}
                        className="py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-900/50"
                    >
                        <Check size={18} /> Accept
                    </button>
                </div>
            </div>
        ) : 
        
        /* Scenario B: Pending for User */
        !isRestaurant && isPending ? (
            <div className="flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-dashed border-gray-600">
                 <div className="w-full text-center py-2 text-gray-400 text-sm italic flex items-center justify-center gap-2">
                     <Clock size={16} className="animate-spin-slow" />
                     Waiting for restaurant to connect...
                 </div>
            </div>
        ) :

        /* Scenario C: Active Chat (Normal) */
        (
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-[#0f0718] border border-purple-900 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors"
                />
                <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim()}
                    className="p-3 bg-purple-600 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/50"
                >
                    <Send size={20} />
                </button>
            </div>
        )}
      </div>
    </div>
  );
};