
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAppStore } from '../services/store.tsx';
import { MessageSquare, Star, UtensilsCrossed, Crosshair } from 'lucide-react';

// Initialize default icons safely
const getIcon = () => L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const PurpleIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-8 h-8 bg-purple-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-bounce">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
         </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

const UserLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `<div class="relative flex items-center justify-center w-6 h-6">
            <div class="absolute w-full h-full bg-blue-500 rounded-full animate-ping opacity-75"></div>
            <div class="relative w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-md shadow-blue-900/50"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const RecenterMap = ({ lat, lng }: { lat: number, lng: number }) => {
    const map = useMap();
    useEffect(() => {
        map.flyTo([lat, lng], 15, { animate: true, duration: 1.5 });
    }, [lat, lng, map]);
    return null;
};

const MapControls = ({ userPosition }: { userPosition: [number, number] | null }) => {
    const map = useMap();
    const handleCenterUser = () => {
        if (userPosition) {
            map.flyTo(userPosition, 16, { animate: true });
        }
    };
    return (
        <div className="absolute bottom-24 right-4 z-[400] flex flex-col gap-2 pointer-events-auto">
            <button 
                onClick={handleCenterUser}
                className="p-3 bg-[#1a0b2e]/90 backdrop-blur-md border border-purple-500/30 text-white rounded-full shadow-xl hover:bg-purple-900 active:scale-95 transition-all flex items-center justify-center"
            >
                <Crosshair size={24} className={userPosition ? "text-blue-400" : "text-gray-500"} />
            </button>
        </div>
    );
};

export const MapView: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const defaultCenter: [number, number] = [25.2048, 55.2708];

  const mapCenter = state.mapFocus 
    ? [state.mapFocus.lat, state.mapFocus.lng] as [number, number] 
    : (userLocation || defaultCenter);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        (err) => console.warn(err)
      );
    }
  }, []);

  const handleStartChat = (restaurant: any) => {
      dispatch({ type: 'START_CHAT', payload: restaurant });
  };

  const restaurants = state.scans.flatMap(s => s.matchedRestaurants);

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer 
        center={mapCenter} 
        zoom={13} 
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <RecenterMap lat={mapCenter[0]} lng={mapCenter[1]} />
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          className="custom-map-filter"
        />
        {userLocation && <Marker position={userLocation} icon={UserLocationIcon} />}
        {restaurants.map((rest, i) => (
             <Marker key={`${rest.id}-${i}`} position={[rest.location.lat, rest.location.lng]} icon={PurpleIcon}>
                <Popup className="custom-popup">
                    <div className="p-2">
                        <strong className="block text-lg font-bold">{rest.name}</strong>
                        <div className="flex items-center gap-2 text-sm my-2">
                            <span className="text-amber-500 font-bold">★ {rest.rating}</span>
                            <span>{rest.price}</span>
                        </div>
                        <button 
                            onClick={() => handleStartChat(rest)}
                            className="w-full py-2 bg-purple-600 text-white rounded-lg font-bold"
                        >
                            Chat & Order
                        </button>
                    </div>
                </Popup>
             </Marker>
        ))}
        <MapControls userPosition={userLocation} />
      </MapContainer>
    </div>
  );
};
