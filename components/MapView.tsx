import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAppStore } from '../services/store';
import { MessageSquare, Star, UtensilsCrossed, Crosshair } from 'lucide-react';

// Fix leaflet default icon
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Purple Icon for Restaurants
const PurpleIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-8 h-8 bg-purple-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-bounce">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
         </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

// Custom User Location Icon (Pulsing Blue Dot)
const UserLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `<div class="relative flex items-center justify-center w-6 h-6">
            <div class="absolute w-full h-full bg-blue-500 rounded-full animate-ping opacity-75"></div>
            <div class="relative w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-md shadow-blue-900/50"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Component to handle map re-centering
const RecenterMap = ({ lat, lng }: { lat: number, lng: number }) => {
    const map = useMap();
    useEffect(() => {
        map.flyTo([lat, lng], 15, { animate: true, duration: 1.5 });
    }, [lat, lng, map]);
    return null;
};

// Controls Component
const MapControls = ({ userPosition }: { userPosition: [number, number] | null }) => {
    const map = useMap();
    
    const handleCenterUser = () => {
        if (userPosition) {
            map.flyTo(userPosition, 16, { animate: true });
        } else {
            // Trigger browser permission prompt if needed by calling generic method
            navigator.geolocation.getCurrentPosition(() => {}, (e) => console.log(e));
        }
    };

    return (
        <div className="absolute bottom-24 right-4 z-[400] flex flex-col gap-2 pointer-events-auto">
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    handleCenterUser();
                }}
                className="p-3 bg-[#1a0b2e]/90 backdrop-blur-md border border-purple-500/30 text-white rounded-full shadow-xl hover:bg-purple-900 active:scale-95 transition-all flex items-center justify-center"
                title="My Location"
            >
                <Crosshair size={24} className={userPosition ? "text-blue-400" : "text-gray-500"} />
            </button>
        </div>
    );
};

interface RestaurantMarkerProps {
    rest: any;
    isFocused: boolean;
    onChat: (r: any) => void;
}

// Sub-component to handle Marker refs and auto-opening popups
const RestaurantMarker: React.FC<RestaurantMarkerProps> = ({ 
    rest, 
    isFocused, 
    onChat 
}) => {
    const markerRef = useRef<L.Marker>(null);

    useEffect(() => {
        if (isFocused && markerRef.current) {
            markerRef.current.openPopup();
        }
    }, [isFocused]);

    return (
        <Marker 
            ref={markerRef}
            position={[rest.location.lat, rest.location.lng]}
            icon={PurpleIcon}
        >
            <Popup className="custom-popup" minWidth={220}>
                {/* Profile Card Style Popup */}
                <div className="p-0 text-gray-900 font-sans">
                    {/* Header Image (Simulated) */}
                    <div className="h-20 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-lg -mx-4 -mt-4 mb-3 flex items-center justify-center overflow-hidden relative">
                         <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=300')] bg-cover bg-center"></div>
                         <UtensilsCrossed className="text-white opacity-80" size={32} />
                    </div>

                    <div className="mb-2">
                        <strong className="block text-lg font-bold text-gray-900 leading-tight">{rest.name}</strong>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">Restaurant Profile</p>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-700 mb-4 bg-gray-50 p-2 rounded-lg">
                            <div className="flex items-center gap-1 text-amber-500 font-bold">
                                <Star size={14} fill="currentColor" />
                                {rest.rating}
                            </div>
                            <span className="text-gray-300">|</span>
                            <span className="font-semibold">{rest.price}</span>
                            <span className="text-gray-300">|</span>
                            <span>{rest.distance}</span>
                    </div>
                    
                    <button 
                        onClick={() => onChat(rest)}
                        className="w-full py-2.5 bg-[#0f0718] text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-purple-900 active:scale-95 transition-all shadow-md"
                    >
                        <MessageSquare size={16} />
                        Chat & Order
                    </button>
                </div>
            </Popup>
        </Marker>
    );
};

export const MapView: React.FC = () => {
  const { state, dispatch } = useAppStore();
  
  // Track actual user location separately from map center
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  
  // Initial fallback center (Dubai)
  const defaultCenter: [number, number] = [25.2048, 55.2708];

  // Logic to determine where the map should look
  // 1. If user selects a restaurant (mapFocus), look there.
  // 2. If no focus, and we have user location, look at user.
  // 3. Otherwise, look at default.
  // Note: We use RecenterMap to trigger movements, so 'center' prop is mostly for initial render
  const mapCenter = state.mapFocus 
    ? [state.mapFocus.lat, state.mapFocus.lng] as [number, number] 
    : (userLocation || defaultCenter);

  useEffect(() => {
    if (navigator.geolocation) {
      // Get initial
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        (err) => console.warn("Location access denied or error:", err)
      );

      // Watch for updates
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        (err) => console.warn("Watch position error:", err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Handle starting chat
  const handleStartChat = (restaurant: any) => {
      dispatch({ type: 'START_CHAT', payload: restaurant });
  };

  // Get all restaurants from recent scans
  const restaurants = state.scans.flatMap(s => s.matchedRestaurants);

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer 
        center={mapCenter} 
        zoom={13} 
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        {/* Helper to fly to new coordinates when props change */}
        <RecenterMap lat={mapCenter[0]} lng={mapCenter[1]} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          className="custom-map-filter"
        />
        
        {/* User Location Marker */}
        {userLocation && (
            <Marker position={userLocation} icon={UserLocationIcon}>
                <Popup className="custom-popup-minimal">
                    <div className="text-center font-bold text-gray-800 text-xs px-2 py-1">You</div>
                </Popup>
            </Marker>
        )}

        {/* Restaurant Markers */}
        {restaurants.map((rest, i) => (
             <RestaurantMarker 
                key={`${rest.id}-${i}`}
                rest={rest}
                isFocused={state.mapFocus?.restaurantId === rest.id}
                onChat={handleStartChat}
             />
        ))}

        {/* Floating Controls */}
        <MapControls userPosition={userLocation} />

      </MapContainer>

      {/* Overlay UI (Tags) */}
      <div className="absolute top-4 left-4 right-4 z-[400] flex gap-2 overflow-x-auto no-scrollbar pb-2 pointer-events-auto">
         {['Burgers', 'Sushi', 'Vegan', 'Dessert'].map(tag => (
             <button key={tag} className="px-4 py-2 bg-purple-900/80 backdrop-blur-md border border-purple-500/30 rounded-full text-sm font-bold whitespace-nowrap shadow-lg hover:bg-purple-800 transition-colors">
                 {tag}
             </button>
         ))}
      </div>
    </div>
  );
};