import React, { useRef, useState, useEffect } from 'react';
import { Camera, ScanLine, Utensils, X, MapPin, Image as ImageIcon } from 'lucide-react';
import { identifyDish, findNearbyRestaurantsForDish } from '../services/geminiService';
import { useAppStore } from '../services/store';
import { FoodScan, RestaurantMatch } from '../types';

export const HomeView: React.FC = () => {
  const { dispatch } = useAppStore();
  
  // Separate refs for camera and gallery inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{ dish: string; desc: string; matches: RestaurantMatch[] } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number}>({ lat: 25.2048, lng: 55.2708 });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => console.warn("Location denied", err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setResult(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        setPreview(base64);

        const analysis = await identifyDish(base64.split(',')[1]);
        const matches = await findNearbyRestaurantsForDish(analysis.dishName, location.lat, location.lng);

        setResult({
            dish: analysis.dishName,
            desc: analysis.description,
            matches: matches as RestaurantMatch[]
        });
        
        const newScan: FoodScan = {
            id: Date.now().toString(),
            imageUrl: base64,
            dishName: analysis.dishName,
            timestamp: Date.now(),
            matchedRestaurants: matches as RestaurantMatch[]
        };
        dispatch({ type: 'ADD_SCAN', payload: newScan });
        setAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRestaurantClick = (match: RestaurantMatch) => {
      dispatch({
          type: 'FOCUS_MAP',
          payload: {
              lat: match.location.lat,
              lng: match.location.lng,
              restaurantId: match.id
          }
      });
  };

  const clear = () => {
    setPreview(null);
    setResult(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const triggerCamera = () => cameraInputRef.current?.click();
  const triggerGallery = () => galleryInputRef.current?.click();

  return (
    <div className="h-full flex flex-col p-4 space-y-6 overflow-y-auto no-scrollbar">
      <header className="flex justify-between items-center pt-2 shrink-0">
        <div>
            <h2 className="text-2xl font-bold text-white">Discover</h2>
            <p className="text-purple-300 text-sm">Scan food to find it nearby</p>
        </div>
      </header>

      {/* Main Action Area */}
      <div className={`flex flex-col items-center justify-center shrink-0 transition-all duration-300 ${result ? 'h-64' : 'flex-1 min-h-[50vh]'}`}>
        {!preview ? (
            <div className="w-full h-full min-h-[300px] rounded-[2rem] border-2 border-dashed border-purple-500/30 bg-purple-900/10 flex flex-col items-center justify-center space-y-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-purple-900/20 pointer-events-none"></div>
                
                {/* Camera Trigger */}
                <button 
                    onClick={triggerCamera}
                    className="group flex flex-col items-center gap-3 relative z-10 active:scale-95 transition-transform"
                >
                    <div className="p-6 bg-purple-600 rounded-full shadow-2xl shadow-purple-500/50 group-hover:bg-purple-500 transition-colors animate-pulse">
                        <Camera size={40} className="text-white" />
                    </div>
                    <p className="text-white font-bold text-lg">Snap Dish</p>
                </button>
                
                {/* Divider */}
                <div className="flex items-center gap-3 w-32 relative z-10 opacity-50">
                    <div className="h-px bg-gray-400 flex-1"></div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold">OR</span>
                    <div className="h-px bg-gray-400 flex-1"></div>
                </div>

                {/* Gallery Trigger */}
                <button 
                    onClick={triggerGallery}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors relative z-10 active:scale-95"
                >
                    <ImageIcon size={18} className="text-purple-300" />
                    <span className="text-gray-300 font-medium text-sm">Upload Photo</span>
                </button>

                {/* Hidden Inputs */}
                <input 
                    type="file" 
                    accept="image/*"
                    capture="environment"
                    ref={cameraInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                />
                <input 
                    type="file" 
                    accept="image/*"
                    ref={galleryInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>
        ) : (
            <div className="w-full h-full relative rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-purple-500/50">
                <img src={preview} alt="Scan" className="w-full h-full object-cover" />
                <button 
                    onClick={clear}
                    className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 z-20"
                >
                    <X size={20} />
                </button>
                {analyzing && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10">
                        <ScanLine size={48} className="animate-spin text-purple-400 mb-4" />
                        <p className="font-medium animate-pulse">Identifying flavors...</p>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Results Card */}
      {result && (
        <div className="bg-[#1e1b4b] rounded-2xl p-5 border border-purple-500/20 shadow-xl animate-slide-up shrink-0">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-400">
                        {result.dish}
                    </h3>
                    <p className="text-sm text-gray-300 mt-1">{result.desc}</p>
                </div>
                <div className="bg-purple-600/30 p-2 rounded-lg">
                    <Utensils size={20} className="text-purple-300" />
                </div>
            </div>

            <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Available Nearby ({result.matches.length})</p>
                {result.matches.length === 0 && <p className="text-gray-500 text-sm">No exact matches found nearby.</p>}
                {result.matches.map((match) => (
                    <div 
                        key={match.id} 
                        onClick={() => handleRestaurantClick(match)}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer active:scale-95 border border-transparent hover:border-purple-500/30"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300">
                                <MapPin size={18} />
                            </div>
                            <div>
                                <p className="font-bold text-white text-sm">{match.name}</p>
                                <p className="text-xs text-gray-400">{match.distance} • {match.price}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 bg-amber-500/20 px-2 py-1 rounded-lg">
                            <span className="text-amber-400 text-xs font-bold">★ {match.rating}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};