
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../services/store';
import { RefreshCw, DollarSign, Users, Globe, MapPin, Power, Wifi, Radio, MessageSquare, Clock, ChevronRight, Crosshair, Radar, Scan } from 'lucide-react';
import { syncProfileFromUrl } from '../services/geminiService';
import { ViewState } from '../types';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// --- Custom Icons for Dashboard Map ---
const RestaurantIcon = L.divIcon({
  className: 'custom-rest-icon',
  html: `<div class="w-8 h-8 bg-amber-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
         </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

const CustomerIcon = L.divIcon({
  className: 'custom-user-icon',
  html: `<div class="relative flex items-center justify-center w-6 h-6">
            <div class="absolute w-full h-full bg-blue-500 rounded-full animate-ping opacity-50"></div>
            <div class="relative w-3 h-3 bg-blue-400 border border-white rounded-full shadow-md"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

export const RestaurantDashboard: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const [url, setUrl] = useState(state.currentRestaurantData.website || '');
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showRadar, setShowRadar] = useState(false);
  const [nearbyCustomers, setNearbyCustomers] = useState<Array<{id: string, lat: number, lng: number, status: string}>>([]);

  const menu = state.currentRestaurantData.menu || [];
  const coords = state.currentRestaurantData.location;
  const myChats = state.chats.filter(c => c.restaurantId === state.user?.id);

  useEffect(() => {
    if (showRadar && coords) {
        const customers = Array.from({ length: 5 }).map((_, i) => ({
            id: `cust_${i}`,
            lat: coords.lat + (Math.random() - 0.5) * 0.015,
            lng: coords.lng + (Math.random() - 0.5) * 0.015,
            status: ['Browsing...', 'Just Scanned Food', 'Hungry', 'Nearby'][Math.floor(Math.random() * 4)]
        }));
        setNearbyCustomers(customers);
    }
  }, [showRadar, coords]);

  const handleSync = async () => {
      if (!url) return;
      setSyncing(true);
      const data = await syncProfileFromUrl(url);
      if (data.menu && data.menu.length > 0) dispatch({ type: 'UPDATE_MENU', payload: data.menu });
      if (data.location && data.location.lat && data.location.lng) dispatch({ type: 'UPDATE_RESTAURANT_LOCATION', payload: data.location });
      setSyncing(false);
  };

  const handleConnectionToggle = () => {
      if (isOnline) {
          setIsOnline(false);
      } else {
          // Optimized: Reconnect instantly
          setIsOnline(true);
      }
  };

  const handleUseDeviceLocation = () => {
      if (!navigator.geolocation) return;
      setIsConnecting(true);
      navigator.geolocation.getCurrentPosition((pos) => {
           dispatch({
               type: 'UPDATE_RESTAURANT_LOCATION',
               payload: { lat: pos.coords.latitude, lng: pos.coords.longitude }
           });
           setIsConnecting(false);
      }, () => setIsConnecting(false));
  };

  const handleOpenChat = (chatId: string) => {
      dispatch({ type: 'SET_ACTIVE_CHAT', payload: chatId });
      dispatch({ type: 'SET_VIEW', payload: ViewState.CHAT });
  };

  return (
    <div className="p-4 space-y-6">
       <div className={`rounded-3xl border transition-all duration-500 overflow-hidden relative ${
           isOnline ? 'bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border-green-500/30 shadow-lg shadow-green-900/20' : 'bg-[#1a0b2e] border-gray-800'
       }`}>
           {isOnline && <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse"></div>}
           <div className="p-6 relative z-10">
               <div className="flex justify-between items-start mb-6">
                   <div className="flex items-center gap-4">
                       <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${isOnline ? 'bg-green-500 text-white shadow-green-900' : 'bg-gray-800 text-gray-500'}`}>
                           {isConnecting ? <RefreshCw className="animate-spin" /> : <MapPin size={28} fill={isOnline ? "currentColor" : "none"} />}
                       </div>
                       <div>
                           <h2 className="text-xl font-bold text-white leading-tight">Location Hub</h2>
                           <div className="flex items-center gap-2 mt-1">
                               <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-ping' : 'bg-gray-600'}`}></div>
                               <p className={`text-xs font-bold uppercase tracking-wider ${isOnline ? 'text-green-400' : 'text-gray-500'}`}>{isConnecting ? 'Connecting...' : isOnline ? 'Broadcasting Profile' : 'Offline'}</p>
                           </div>
                       </div>
                   </div>
                   <button onClick={handleConnectionToggle} className={`p-3 rounded-xl border transition-all active:scale-95 ${isOnline ? 'bg-green-500/10 border-green-500/50 text-green-400 hover:bg-green-500/20' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}><Power size={24} /></button>
               </div>
               {isOnline ? (
                   <div className="bg-black/20 backdrop-blur-md rounded-xl p-4 border border-white/5">
                       <div className="flex items-center justify-between mb-3"><span className="text-sm text-gray-300">Live Location Source</span><Wifi size={16} className="text-green-400" /></div>
                       <div className="flex items-center justify-between bg-black/30 p-2 rounded-lg mb-2">
                           <div className="flex items-center gap-2 text-xs text-gray-400 font-mono"><Radio size={14} className="text-purple-400" /><span>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span></div>
                           <button onClick={handleUseDeviceLocation} className="p-1.5 bg-white/10 rounded-md hover:bg-white/20 text-gray-300" title="Refresh from GPS"><Crosshair size={12} /></button>
                       </div>
                       <p className="mt-3 text-xs text-green-300 flex items-center gap-1"><Globe size={12} />Receiving customers at this location.</p>
                   </div>
               ) : (
                   <div className="bg-white/5 rounded-xl p-4 border border-white/5 text-center"><p className="text-gray-400 text-sm">You are offline. Customers cannot find you on the map.</p></div>
               )}
           </div>
       </div>

       <div className="bg-[#1e1b4b] rounded-3xl border border-blue-500/20 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-blue-900/30 flex justify-between items-center bg-blue-900/10">
                <div className="flex items-center gap-2"><Radar className="text-blue-400 animate-pulse" size={20} /><h3 className="font-bold text-lg text-blue-100">Live Customer Radar</h3></div>
                <button onClick={() => setShowRadar(!showRadar)} className="text-xs bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full hover:bg-blue-500/30 transition-colors">{showRadar ? 'Hide Map' : 'View Map'}</button>
            </div>
            {showRadar ? (
                <div className="h-64 w-full relative">
                    <MapContainer center={[coords.lat, coords.lng]} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false} dragging={false} scrollWheelZoom={false}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" className="custom-map-filter" />
                        <Marker position={[coords.lat, coords.lng]} icon={RestaurantIcon}><Popup className="custom-popup-minimal"><div className="text-xs font-bold px-2 py-1">You</div></Popup></Marker>
                        {nearbyCustomers.map((cust) => (
                            <Marker key={cust.id} position={[cust.lat, cust.lng]} icon={CustomerIcon}><Popup className="custom-popup-minimal"><div className="text-center"><p className="text-xs text-gray-500 font-bold mb-1">Potential Customer</p><div className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full inline-block">{cust.status}</div></div></Popup></Marker>
                        ))}
                    </MapContainer>
                    <div className="absolute bottom-3 left-3 z-[400] bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-blue-500/30 flex items-center gap-2"><Users size={14} className="text-blue-400" /><span className="text-xs font-bold text-white">{nearbyCustomers.length} active nearby</span></div>
                </div>
            ) : (
                <div className="p-6 text-center" onClick={() => setShowRadar(true)}><div className="w-16 h-16 rounded-full bg-blue-500/10 mx-auto mb-3 flex items-center justify-center"><Scan size={32} className="text-blue-400" /></div><p className="text-gray-400 text-sm">Tap to visualize potential customers in your area.<br/><span className="text-xs text-gray-500 mt-1 block">Based on recent searches and activity.</span></p></div>
            )}
       </div>

       <div className={`grid grid-cols-2 gap-4 transition-opacity ${isOnline ? 'opacity-100' : 'opacity-50 grayscale'}`}>
           <div className="bg-[#1e1b4b] p-4 rounded-2xl border border-purple-500/20"><div className="flex items-center gap-2 text-purple-300 mb-2"><Users size={16} /><span className="text-xs font-bold uppercase">Active Leads</span></div><span className="text-3xl font-black text-white">{state.currentRestaurantData.leads}</span></div>
           <div className="bg-[#1e1b4b] p-4 rounded-2xl border border-purple-500/20"><div className="flex items-center gap-2 text-amber-300 mb-2"><DollarSign size={16} /><span className="text-xs font-bold uppercase">Balance Due</span></div><span className="text-3xl font-black text-amber-400">{state.currentRestaurantData.balance} AED</span></div>
       </div>

       <div className="bg-[#1e1b4b] rounded-3xl border border-purple-500/20 overflow-hidden">
            <div className="p-4 border-b border-purple-900/50 flex justify-between items-center"><div className="flex items-center gap-2"><MessageSquare className="text-purple-400" size={20} /><h3 className="font-bold text-lg">Customer Messages</h3></div><span className="bg-purple-600 px-2 py-0.5 rounded-full text-xs font-bold">{myChats.length}</span></div>
            <div className="divide-y divide-purple-900/30">{myChats.length === 0 ? (<div className="p-8 text-center text-gray-500"><p>No messages yet.</p><p className="text-xs mt-1">Customers nearby will appear here.</p></div>) : (myChats.map(chat => (<div key={chat.id} onClick={() => handleOpenChat(chat.id)} className="p-4 hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-4"><img src={`https://ui-avatars.com/api/?name=${chat.userName}&background=random`} className="w-10 h-10 rounded-full" alt={chat.userName} /><div className="flex-1 min-w-0"><div className="flex justify-between items-start"><h4 className="font-bold text-sm truncate">{chat.userName}</h4><span className="text-[10px] text-gray-500 flex items-center gap-1"><Clock size={10} /> {new Date(chat.messages[chat.messages.length - 1].timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div><p className="text-xs text-gray-400 truncate mt-0.5">{chat.messages[chat.messages.length - 1].senderId === 'system' ? 'System: ' + chat.messages[chat.messages.length - 1].text : chat.messages[chat.messages.length - 1].text}</p></div><ChevronRight size={16} className="text-gray-600" /></div>)))}</div>
       </div>

       <div className="bg-gradient-to-br from-[#2e1065] to-[#1e1b4b] p-6 rounded-3xl border border-purple-500/30 shadow-xl">
           <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-purple-500 rounded-lg text-white"><Globe size={20} /></div><h3 className="text-lg font-bold">Smart Sync</h3></div>
           <p className="text-sm text-gray-300 mb-4">Enter your website URL. Our AI will automatically update your <strong>Menu</strong> and <strong>Live Location</strong>.</p>
           <div className="flex gap-2"><input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://restaurant.com" className="flex-1 bg-black/30 border border-purple-500/30 rounded-xl px-4 py-2 text-sm text-white focus:border-purple-400 outline-none" /><button onClick={handleSync} disabled={syncing} className="bg-purple-600 px-4 py-2 rounded-xl text-white font-bold hover:bg-purple-500 disabled:opacity-50">{syncing ? <RefreshCw className="animate-spin" /> : 'Sync'}</button></div>
       </div>
    </div>
  );
};
