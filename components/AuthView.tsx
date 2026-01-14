import React, { useState } from 'react';
import { useAppStore } from '../services/store';
import { UserType, Restaurant, User } from '../types';
import { Mail, Lock, Store, User as UserIcon, Loader2, ArrowRight, MapPin, Globe, AlertCircle, Crosshair } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { dispatch } = useAppStore();
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [role, setRole] = useState<UserType>(UserType.USER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationDetecting, setLocationDetecting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    website: '',
    lat: 25.2048, // Default Dubai
    lng: 55.2708
  });

  const validate = () => {
    if (!formData.email || !formData.password) return false;
    if (!isLoginMode && !formData.name) return false;
    return true;
  };

  const handleGetLocation = (e: React.MouseEvent) => {
      e.preventDefault();
      if (!navigator.geolocation) {
          setError("Geolocation is not supported by your browser");
          return;
      }
      
      setLocationDetecting(true);
      navigator.geolocation.getCurrentPosition(
          (pos) => {
              setFormData({
                  ...formData,
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude
              });
              setLocationDetecting(false);
          },
          (err) => {
              setError("Could not detect location. Please allow permissions.");
              setLocationDetecting(false);
          }
      );
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setError(null);
    setLoading(true);

    // Simulate Network Latency
    setTimeout(() => {
        try {
            const usersDb = JSON.parse(localStorage.getItem('dishout_users') || '{}');
            const emailKey = formData.email.toLowerCase().trim();

            if (isLoginMode) {
                // --- LOGIN FLOW ---
                const userRecord = usersDb[emailKey];
                
                if (!userRecord) {
                    throw new Error("Account not found. Please sign up.");
                }
                
                if (userRecord.password !== formData.password) {
                    throw new Error("Incorrect password.");
                }

                // Success
                dispatch({ type: 'LOGIN_USER', payload: userRecord.profile });

            } else {
                // --- SIGN UP FLOW ---
                if (usersDb[emailKey]) {
                    throw new Error("Email already registered. Please log in.");
                }

                const timestamp = Date.now();
                const baseUser = {
                    id: `user_${timestamp}`,
                    name: formData.name,
                    email: formData.email,
                    avatar: `https://ui-avatars.com/api/?name=${formData.name}&background=random`,
                };

                let userProfile;

                if (role === UserType.RESTAURANT) {
                    userProfile = {
                        ...baseUser,
                        type: UserType.RESTAURANT,
                        location: { lat: formData.lat, lng: formData.lng }, 
                        website: formData.website,
                        leads: 0,
                        balance: 0,
                        menu: []
                    };
                } else {
                    userProfile = {
                        ...baseUser,
                        type: UserType.USER
                    };
                }

                // Save to DB
                usersDb[emailKey] = {
                    profile: userProfile,
                    password: formData.password
                };
                localStorage.setItem('dishout_users', JSON.stringify(usersDb));

                // Auto Login
                dispatch({ type: 'LOGIN_USER', payload: userProfile });
            }
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    }, 1200);
  };

  const toggleMode = () => {
      setIsLoginMode(!isLoginMode);
      setError(null);
      setFormData({ name: '', email: '', password: '', website: '', lat: 25.2048, lng: 55.2708 });
  };

  return (
    <div className="fixed inset-0 bg-[#0f0718] overflow-y-auto">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1974&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f0718] via-[#0f0718]/90 to-[#0f0718]"></div>
      </div>
      
      <div className="min-h-full flex flex-col items-center justify-center relative z-10 p-6 py-12">
        {/* Logo Area */}
        <div className="text-center space-y-2 mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg shadow-purple-900/50 mb-4 transform rotate-12">
                <MapPin className="text-white transform -rotate-12" size={32} />
            </div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400">
            DishOut
            </h1>
            <p className="text-purple-200/60 text-lg">Connect through flavor & location.</p>
        </div>

        {/* Auth Card */}
        <div className="w-full max-w-md bg-[#1a0b2e]/80 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 shadow-2xl animate-fade-in-up">
            
            <div className="flex justify-center mb-6 border-b border-white/10 pb-4">
                <button 
                    onClick={() => !loading && setIsLoginMode(true)}
                    className={`px-6 py-2 text-sm font-bold transition-colors ${isLoginMode ? 'text-white border-b-2 border-purple-500' : 'text-gray-500 hover:text-white'}`}
                >
                    Log In
                </button>
                <button 
                    onClick={() => !loading && setIsLoginMode(false)}
                    className={`px-6 py-2 text-sm font-bold transition-colors ${!isLoginMode ? 'text-white border-b-2 border-purple-500' : 'text-gray-500 hover:text-white'}`}
                >
                    Sign Up
                </button>
            </div>

            {/* Role Toggles - Only visible in Sign Up */}
            {!isLoginMode && (
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#0f0718]/50 rounded-xl mb-6 animate-fade-in">
                    <button 
                        onClick={() => setRole(UserType.USER)}
                        className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${
                            role === UserType.USER 
                                ? 'bg-purple-600 text-white shadow-lg' 
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <UserIcon size={16} /> Foodie
                    </button>
                    <button 
                        onClick={() => setRole(UserType.RESTAURANT)}
                        className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${
                            role === UserType.RESTAURANT 
                                ? 'bg-amber-500 text-black shadow-lg' 
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <Store size={16} /> Business
                    </button>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-200 text-xs font-bold animate-shake">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleAuth} className="space-y-4">
                
                {/* Name / Business Name (Sign Up Only) */}
                {!isLoginMode && (
                    <div className="space-y-1 animate-slide-up">
                        <label className="text-xs text-purple-300 ml-1">
                            {role === UserType.RESTAURANT ? 'Restaurant Name' : 'Full Name'}
                        </label>
                        <div className="relative group">
                            {role === UserType.RESTAURANT ? 
                                <Store className="absolute left-4 top-3.5 text-gray-500 group-focus-within:text-amber-400 transition-colors" size={18} /> :
                                <UserIcon className="absolute left-4 top-3.5 text-gray-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                            }
                            <input 
                                type="text"
                                placeholder={role === UserType.RESTAURANT ? "e.g. Burger King" : "e.g. John Doe"}
                                className={`w-full bg-[#0f0718] border border-purple-900 rounded-xl py-3 pl-11 pr-4 text-white outline-none transition-all placeholder:text-gray-600 ${role === UserType.RESTAURANT ? 'focus:border-amber-400' : 'focus:border-purple-400'}`}
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-1">
                    <label className="text-xs text-purple-300 ml-1">Email Address</label>
                    <div className="relative group">
                        <Mail className={`absolute left-4 top-3.5 text-gray-500 transition-colors ${role === UserType.RESTAURANT && !isLoginMode ? 'group-focus-within:text-amber-400' : 'group-focus-within:text-purple-400'}`} size={18} />
                        <input 
                            type="email"
                            placeholder="hello@example.com"
                            className={`w-full bg-[#0f0718] border border-purple-900 rounded-xl py-3 pl-11 pr-4 text-white outline-none transition-all placeholder:text-gray-600 ${role === UserType.RESTAURANT && !isLoginMode ? 'focus:border-amber-400' : 'focus:border-purple-400'}`}
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                    </div>
                </div>

                {/* Location Input (Sign Up Restaurant Only) */}
                {!isLoginMode && role === UserType.RESTAURANT && (
                    <div className="space-y-1 animate-slide-up">
                        <label className="text-xs text-purple-300 ml-1">Business Location</label>
                        <div className="bg-[#0f0718] border border-purple-900 rounded-xl p-3 flex items-center justify-between">
                             <div className="flex flex-col">
                                 <span className="text-xs text-gray-500">Coordinates</span>
                                 <span className="text-sm font-mono text-gray-300">
                                     {formData.lat.toFixed(4)}, {formData.lng.toFixed(4)}
                                 </span>
                             </div>
                             <button
                                onClick={handleGetLocation}
                                className="px-3 py-1.5 bg-purple-600/20 text-purple-300 rounded-lg text-xs font-bold hover:bg-purple-600/40 border border-purple-500/30 flex items-center gap-1 transition-colors"
                             >
                                 {locationDetecting ? (
                                     <Loader2 size={12} className="animate-spin" />
                                 ) : (
                                     <Crosshair size={12} />
                                 )}
                                 Detect
                             </button>
                        </div>
                    </div>
                )}

                {/* Website (Sign Up Restaurant Only) */}
                {!isLoginMode && role === UserType.RESTAURANT && (
                    <div className="space-y-1 animate-slide-up">
                        <label className="text-xs text-purple-300 ml-1">Website URL (Optional)</label>
                        <div className="relative group">
                            <Globe className="absolute left-4 top-3.5 text-gray-500 group-focus-within:text-amber-400 transition-colors" size={18} />
                            <input 
                                type="url"
                                placeholder="https://myrestaurant.com"
                                className="w-full bg-[#0f0718] border border-purple-900 rounded-xl py-3 pl-11 pr-4 text-white focus:border-amber-400 outline-none transition-all placeholder:text-gray-600"
                                value={formData.website}
                                onChange={e => setFormData({...formData, website: e.target.value})}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-1">
                    <label className="text-xs text-purple-300 ml-1">Password</label>
                    <div className="relative group">
                        <Lock className={`absolute left-4 top-3.5 text-gray-500 transition-colors ${role === UserType.RESTAURANT && !isLoginMode ? 'group-focus-within:text-amber-400' : 'group-focus-within:text-purple-400'}`} size={18} />
                        <input 
                            type="password"
                            placeholder="••••••••"
                            className={`w-full bg-[#0f0718] border border-purple-900 rounded-xl py-3 pl-11 pr-4 text-white outline-none transition-all placeholder:text-gray-600 ${role === UserType.RESTAURANT && !isLoginMode ? 'focus:border-amber-400' : 'focus:border-purple-400'}`}
                            value={formData.password}
                            onChange={e => setFormData({...formData, password: e.target.value})}
                        />
                    </div>
                </div>

                <button 
                    type="submit"
                    disabled={loading || !formData.email || !formData.password}
                    className={`w-full py-4 mt-4 font-bold rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                        role === UserType.RESTAURANT && !isLoginMode
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black' 
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                    }`}
                >
                    {loading ? (
                        <Loader2 className="animate-spin" />
                    ) : (
                        <>
                            {isLoginMode ? 'Sign In' : 'Create Account'} <ArrowRight size={18} />
                        </>
                    )}
                </button>
            </form>
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
            {isLoginMode 
                ? "Don't have an account yet?" 
                : "Already have an account?"}
            <button onClick={toggleMode} className="ml-1 text-purple-400 hover:text-white font-bold transition-colors">
                {isLoginMode ? "Sign Up" : "Log In"}
            </button>
        </p>
      </div>
    </div>
  );
};