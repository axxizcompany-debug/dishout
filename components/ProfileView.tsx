import React, { useRef, useState } from 'react';
import { useAppStore } from '../services/store';
import { Settings, LogOut, Camera, Loader2 } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const user = state.user!;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleAvatarClick = () => {
    if (!isUploading) {
        fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const reader = new FileReader();
    reader.onloadend = () => {
        // Simulate network delay for better UX
        setTimeout(() => {
            const base64String = reader.result as string;
            dispatch({ type: 'UPDATE_USER_AVATAR', payload: base64String });
            setIsUploading(false);
        }, 1200);
    };
    reader.readAsDataURL(file);
  };

  // Get the latest 3 scans
  const recentScans = state.scans.slice(0, 3);
  const emptySlots = Math.max(0, 3 - recentScans.length);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      <div className="flex justify-between items-start">
         <h2 className="text-2xl font-bold">My Profile</h2>
         <button onClick={() => dispatch({type: 'LOGOUT'})} className="p-2 bg-red-500/20 text-red-400 rounded-lg">
             <LogOut size={20} />
         </button>
      </div>

      <div className="flex flex-col items-center space-y-3">
          <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
              <div className="w-24 h-24 rounded-full border-4 border-purple-500 shadow-xl overflow-hidden relative">
                  <img src={user.avatar} className="w-full h-full object-cover" alt="Profile" />
                  
                  {/* Upload Overlay */}
                  {isUploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                          <Loader2 className="animate-spin text-purple-300" size={24} />
                      </div>
                  )}
                  
                  {/* Hover Overlay (Desktop) */}
                  {!isUploading && (
                     <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <Camera size={20} className="text-white" />
                     </div>
                  )}
              </div>
              
              {/* Edit Button */}
              <button className="absolute bottom-0 right-0 p-2 bg-purple-600 rounded-full border-2 border-[#0f0718] hover:bg-purple-500 transition-colors z-20 shadow-lg">
                  <Camera size={14} className="text-white" />
              </button>

              <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
              />
          </div>
          <div className="text-center">
              <h3 className="text-xl font-bold">{user.name}</h3>
              <p className="text-purple-300 text-sm">Food Explorer Level 5</p>
          </div>
      </div>

      <div>
          <h4 className="font-bold text-gray-400 mb-3 uppercase text-xs tracking-wider">Inspiration Gallery (Last 3)</h4>
          <div className="grid grid-cols-3 gap-2">
              {recentScans.map((scan) => (
                  <div key={scan.id} className="aspect-square rounded-xl overflow-hidden relative group border border-purple-500/20">
                      <img src={scan.imageUrl} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                          <span className="text-[10px] font-bold truncate w-full text-white">{scan.dishName}</span>
                      </div>
                  </div>
              ))}
              {/* Placeholders */}
              {Array.from({ length: emptySlots }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square rounded-xl bg-purple-900/20 border border-dashed border-purple-500/20 flex items-center justify-center">
                      <span className="text-xs text-purple-500/40 font-medium">Empty</span>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};