
import React, { useRef, useState } from 'react';
import { Camera, Utensils, X, MapPin, Image as ImageIcon, Loader2, Star } from 'lucide-react';
import { useAppStore } from '../services/store.tsx';
import { identifyDish, findNearbyRestaurantsForDish } from '../services/geminiService.ts';
import { RestaurantMatch } from '../types.ts';

/**
 * HomeView component allows users to discover restaurants by scanning food items.
 * Fixes the error: Module '"./components/HomeView.tsx"' has no exported member 'HomeView'.
 */
export const HomeView: React.FC = () => {
  const { dispatch } = useAppStore();
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RestaurantMatch[]>([]);
  const [dishInfo, setDishInfo] = useState<{ name: string; description: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);

  // Handle image upload from file system
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImage(base64);
        processImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // Activate device camera
  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setShowCamera(false);
    }
  };

  // Capture frame from video stream
  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg');
      
      const stream = videoRef.current.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      
      setShowCamera(false);
      setImage(base64);
      processImage(base64);
    }
  };

  // Use Gemini to process the captured or uploaded image
  const processImage = async (base64: string) => {
    setLoading(true);
    setResults([]);
    setDishInfo(null);

    const base64Data = base64.split(',')[1];
    
    try {
      // Step 1: Identify dish using Gemini 3 Flash
      const identification = await identifyDish(base64Data);
      setDishInfo({ name: identification.dishName, description: identification.description });

      // Step 2: Determine user's location
      let lat = 25.2048; // Default to Dubai
      let lng = 55.2708;
      
      if (navigator.geolocation) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject);
          }).catch(() => null);
          if (pos) {
              lat = pos.coords.latitude;
              lng = pos.coords.longitude;
          }
      }

      // Step 3: Find nearby restaurants using Gemini 2.5 Flash with Maps grounding
      const matched = await findNearbyRestaurantsForDish(identification.dishName, lat, lng);
      setResults(matched);

      // Step 4: Add the scan event to global history
      dispatch({
        type: 'ADD_SCAN',
        payload: {
          id: `scan_${Date.now()}`,
          imageUrl: base64,
          dishName: identification.dishName,
          timestamp: Date.now(),
          matchedRestaurants: matched
        }
      });
    } catch (error) {
      console.error("Processing failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = (restaurant: RestaurantMatch) => {
      dispatch({ type: 'START_CHAT', payload: restaurant });
  };

  const handleViewOnMap = (restaurant: RestaurantMatch) => {
      dispatch({ 
          type: 'FOCUS_MAP', 
          payload: { lat: restaurant.location.lat, lng: restaurant.location.lng, restaurantId: restaurant.id } 
      });
  };

  return (
    <div className="h-full flex flex-col bg-[#0f0718]">
      <div className="p-6 pb-2">
        <h1 className="text-3xl font-black text-white">Find your next <span className="text-purple-400">craving</span></h1>
        <p className="text-gray-400 mt-1 text-sm">Scan any food photo to find restaurants serving it nearby.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-20">
        {!image && !showCamera && (
          <div className="space-y-4">
            <button 
                onClick={startCamera}
                className="w-full aspect-[4/3] bg-[#1a0b2e] border-2 border-dashed border-purple-500/30 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-purple-500 transition-all group"
            >
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center shadow-lg group-active:scale-90 transition-transform">
                    <Camera className="text-white" size={32} />
                </div>
                <span className="font-bold text-gray-300">Take a Photo</span>
            </button>
            <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10"></div>
                <span className="text-xs text-gray-500 font-bold uppercase">or</span>
                <div className="h-px flex-1 bg-white/10"></div>
            </div>
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-3 font-bold text-gray-300 hover:bg-white/10 transition-all"
            >
                <ImageIcon size={20} />
                Upload from Gallery
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          </div>
        )}

        {showCamera && (
            <div className="fixed inset-0 z-[100] bg-black flex flex-col">
                <div className="relative flex-1">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <button 
                        onClick={() => setShowCamera(false)}
                        className="absolute top-6 right-6 p-3 bg-black/50 text-white rounded-full"
                    >
                        <X size={24} />
                    </button>
                </div>
                <div className="p-10 bg-black flex justify-center">
                    <button 
                        onClick={capturePhoto}
                        className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center"
                    >
                        <div className="w-16 h-16 rounded-full bg-white"></div>
                    </button>
                </div>
            </div>
        )}

        {image && (
          <div className="space-y-6 animate-fade-in">
            <div className="relative rounded-3xl overflow-hidden border-2 border-purple-500/30">
                <img src={image} className="w-full aspect-[4/3] object-cover" alt="Scanned food" />
                {!loading && (
                  <button 
                      onClick={() => { setImage(null); setDishInfo(null); setResults([]); }}
                      className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-black"
                  >
                      <X size={20} />
                  </button>
                )}
                {loading && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-white">
                        <Loader2 className="animate-spin text-purple-400" size={48} />
                        <span className="font-bold tracking-widest text-sm">IDENTIFYING...</span>
                    </div>
                )}
            </div>

            {dishInfo && (
                <div className="bg-purple-900/20 border border-purple-500/20 rounded-3xl p-6 space-y-2">
                    <div className="flex items-center gap-2 text-purple-400">
                        <Utensils size={18} />
                        <span className="text-xs font-black uppercase tracking-widest">Matched Dish</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">{dishInfo.name}</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">{dishInfo.description}</p>
                </div>
            )}

            {results.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <MapPin size={20} className="text-purple-400" />
                        Nearby Matches
                    </h3>
                    <div className="space-y-3">
                        {results.map((res) => (
                            <div key={res.id} className="bg-[#1a0b2e] border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:border-purple-500/30 transition-all">
                                <div className="w-16 h-16 bg-purple-600/20 rounded-xl flex items-center justify-center text-purple-400 shrink-0">
                                    <Utensils size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-white truncate">{res.name}</h4>
                                        <div className="flex items-center gap-1 text-amber-400 text-xs">
                                            <Star size={12} fill="currentColor" />
                                            <span>{res.rating}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-1">
                                        <span className="bg-white/5 px-2 py-0.5 rounded-full">{res.distance}</span>
                                        <span className="text-amber-500 font-bold">{res.price}</span>
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                        <button 
                                            onClick={() => handleStartChat(res)}
                                            className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold active:scale-95 transition-transform"
                                        >
                                            Chat & Order
                                        </button>
                                        <button 
                                            onClick={() => handleViewOnMap(res)}
                                            className="px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg text-xs font-bold active:scale-95 transition-transform"
                                        >
                                            Map
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
