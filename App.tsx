
import React, { useState, useEffect, useRef } from 'react';
import { ClothingItem, ClothingCategory, ClothingFit, ClothingClassification, StylingState, InspirationImage, StyleProfile, UserAnalysis, SavedOutfit, OutfitSuggestion, DailyContext, UserData, CalendarEvent, GoogleCalendarConfig } from './types';
import ClothingCard from './components/ClothingCard';
import { generateOutfits, analyzeBodyArchitecture, analyzeClothingItem } from './services/geminiService';

const CATEGORIES: ClothingCategory[] = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories'];
const FITS: ClothingFit[] = ['Tailored', 'Oversized', 'Relaxed', 'Slim', 'Petite'];
const CLASSIFICATIONS: ClothingClassification[] = ['Basic', 'Statement'];
const OCCASIONS_DEFAULT = ['Daily', 'Work', 'Date Night', 'Event', 'Travel'];
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/calendar.events.readonly';

declare global {
    interface Window {
      gapi: any;
      google: any;
    }
}

const App: React.FC = () => {
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [knownEmails, setKnownEmails] = useState<string[]>([]);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  // --- App Data State ---
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [inspiration, setInspiration] = useState<InspirationImage[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'wardrobe' | 'generator' | 'identity' | 'lookbook' | 'planner'>('generator');
  
  // Filtering states
  const [filters, setFilters] = useState({
    category: 'All' as ClothingCategory | 'All',
    color: 'All',
    fit: 'All' as ClothingFit | 'All',
    classification: 'All' as ClothingClassification | 'All',
    style: 'All'
  });

  // Modal/Upload states
  const [uploadQueue, setUploadQueue] = useState<{file: File, base64: string}[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [currentUploadMeta, setCurrentUploadMeta] = useState<Partial<ClothingItem>>({
    category: 'Tops',
    classification: 'Basic',
    fit: 'Tailored',
    color: '',
    style: '',
    material: ''
  });

  // Planner States
  const [activeEventId, setActiveEventId] = useState<string | null>(null); // If generating for a specific event
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [showGCalConfig, setShowGCalConfig] = useState(false);
  const [gCalConfigInput, setGCalConfigInput] = useState<GoogleCalendarConfig>({ clientId: '', apiKey: '', isConnected: false });
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const tokenClient = useRef<any>(null);
  const [gapiInitialized, setGapiInitialized] = useState(false);

  // Rating State
  const [ratingModal, setRatingModal] = useState<{isOpen: boolean, outfit: OutfitSuggestion | null}>({isOpen: false, outfit: null});
  const [currentRating, setCurrentRating] = useState({ comfort: 3, style: 3, occasion: '', notes: '' });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [styling, setStyling] = useState<StylingState>({
    isGenerating: false,
    suggestions: null,
    error: null
  });
  
  const [context, setContext] = useState<DailyContext>({
    event: '',
    weather: '',
    location: '',
    vibe: '',
    color: '',
    comfort: 5,
    pinterestUrl: ''
  });

  const [profile, setProfile] = useState<StyleProfile>({
    aesthetic: '',
    silhouettes: '',
    forbidden: '',
    signatureColors: '',
    bodyType: '',
    height: '',
    pinterestProfile: '',
    laundryCycle: 7
  });

  const [greeting, setGreeting] = useState('');
  const [lookbookFilter, setLookbookFilter] = useState('All');

  // --- Initialization & Helper Logic ---

  const loadUserSession = (data: UserData) => {
    setWardrobe(data.wardrobe || []);
    setInspiration(data.inspiration || []);
    setProfile(data.profile || { aesthetic: '', silhouettes: '', forbidden: '', signatureColors: '', bodyType: '', height: '', pinterestProfile: '', laundryCycle: 7 });
    setContext(data.context || { event: '', weather: '', location: '', vibe: '', color: '', comfort: 5, pinterestUrl: '' });
    setSavedOutfits(data.savedOutfits || []);
    setCalendarEvents(data.calendar || []);
    setGCalConfigInput(data.googleCalendar || { clientId: '', apiKey: '', isConnected: false });
    setCurrentUser(data);
    setPasswordInput('');
  };

  const detectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
          const data = await response.json();
          const city = data.city || data.locality || data.principalSubdivision;
          if (city) {
            setContext(prev => ({ ...prev, location: city }));
          }
        } catch (e) {
          console.error("Locating failed", e);
        }
      }, (err) => {
        console.warn("Geolocation permission denied or error", err);
      });
    }
  };

  useEffect(() => {
    const storedEmails = localStorage.getItem('ladys_emails_list');
    if (storedEmails) {
      setKnownEmails(JSON.parse(storedEmails));
    }
    
    const activeUserEmail = localStorage.getItem('ladys_active_user');
    if (activeUserEmail) {
        const storageKey = `ladys_data_${activeUserEmail}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            try {
                const data: UserData = JSON.parse(stored);
                loadUserSession(data);
            } catch (e) {
                console.error("Session restore failed", e);
                localStorage.removeItem('ladys_active_user');
            }
        }
    }

    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  // Save data persistence
  useEffect(() => {
    if (currentUser) {
      const data: UserData = {
        email: currentUser.email,
        password: currentUser.password,
        name: currentUser.name,
        wardrobe,
        inspiration,
        profile,
        context,
        savedOutfits,
        calendar: calendarEvents,
        googleCalendar: gCalConfigInput,
        lastActive: Date.now()
      };
      localStorage.setItem(`ladys_data_${currentUser.email}`, JSON.stringify(data));
    }
  }, [wardrobe, inspiration, profile, context, savedOutfits, calendarEvents, gCalConfigInput, currentUser]);

  // Google Calendar Init
  useEffect(() => {
      if (window.gapi && window.google && gCalConfigInput.apiKey && gCalConfigInput.clientId) {
          initializeGapiClient();
      }
  }, [gCalConfigInput.apiKey, gCalConfigInput.clientId]);

  const initializeGapiClient = async () => {
      if (gapiInitialized) return;
      try {
          await new Promise((resolve, reject) => {
              window.gapi.load('client', {callback: resolve, onerror: reject});
          });
          await window.gapi.client.init({
              apiKey: gCalConfigInput.apiKey,
              discoveryDocs: DISCOVERY_DOCS,
          });
          
          tokenClient.current = window.google.accounts.oauth2.initTokenClient({
              client_id: gCalConfigInput.clientId,
              scope: SCOPES,
              callback: async (resp: any) => {
                  if (resp.error !== undefined) {
                      throw (resp);
                  }
                  await listUpcomingEvents();
              },
          });
          setGapiInitialized(true);
      } catch (err) {
          console.error("GAPI Init Error", err);
      }
  };

  const handleSyncCalendar = () => {
      if (!gCalConfigInput.apiKey || !gCalConfigInput.clientId) {
          setShowGCalConfig(true);
          return;
      }
      
      if (!gapiInitialized) {
         initializeGapiClient().then(() => {
             tokenClient.current?.requestAccessToken({prompt: 'consent'});
         });
      } else {
         tokenClient.current?.requestAccessToken({prompt: ''}); // Skip consent if already granted
      }
  };

  const listUpcomingEvents = async () => {
      setIsSyncingCalendar(true);
      try {
          const now = new Date();
          const nextWeek = new Date();
          nextWeek.setDate(now.getDate() + 7);

          const response = await window.gapi.client.calendar.events.list({
              'calendarId': 'primary',
              'timeMin': now.toISOString(),
              'timeMax': nextWeek.toISOString(),
              'showDeleted': false,
              'singleEvents': true,
              'maxResults': 20,
              'orderBy': 'startTime'
          });

          const events = response.result.items;
          const newGoogleEvents: CalendarEvent[] = events.map((event: any) => ({
              id: `gcal-${event.id}`,
              googleEventId: event.id,
              title: event.summary || 'Busy',
              date: (event.start.dateTime || event.start.date).split('T')[0],
              description: event.description || '',
              source: 'google'
          }));

          // Merge: Remove old google events and add new ones
          setCalendarEvents(prev => {
              const localEvents = prev.filter(e => e.source !== 'google');
              return [...localEvents, ...newGoogleEvents];
          });
          
          setGCalConfigInput(prev => ({...prev, isConnected: true}));
          alert(`Synced ${newGoogleEvents.length} events from Google Calendar.`);

      } catch (err) {
          console.error("Error fetching events", err);
          alert("Failed to fetch Google Calendar events. Check console/network.");
      } finally {
          setIsSyncingCalendar(false);
      }
  };


  // --- Auth Handlers ---
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) return;
    const storageKey = `ladys_data_${emailInput.toLowerCase().trim()}`;
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
        alert("We could not find an account with this email. Please join us.");
        return;
    }
    const data: UserData = JSON.parse(stored);
    if (data.password !== passwordInput) {
        alert("Incorrect credentials.");
        return;
    }
    localStorage.setItem('ladys_active_user', data.email);
    loadUserSession(data);
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput || !nameInput) return;
    const emailKey = emailInput.toLowerCase().trim();
    const storageKey = `ladys_data_${emailKey}`;
    if (localStorage.getItem(storageKey)) {
        alert("An account with this email already exists. Please sign in.");
        setAuthMode('signin');
        return;
    }
    const newUser: UserData = {
        email: emailKey,
        password: passwordInput,
        name: nameInput,
        wardrobe: [],
        inspiration: [],
        savedOutfits: [],
        calendar: [],
        googleCalendar: { clientId: '', apiKey: '', isConnected: false },
        profile: { aesthetic: '', silhouettes: '', forbidden: '', signatureColors: '', bodyType: '', height: '', pinterestProfile: '', laundryCycle: 7 },
        context: { event: '', weather: '', location: '', vibe: '', color: '', comfort: 5, pinterestUrl: '' },
        lastActive: Date.now()
    };
    if (!knownEmails.includes(emailKey)) {
        const newKnown = [...knownEmails, emailKey];
        setKnownEmails(newKnown);
        localStorage.setItem('ladys_emails_list', JSON.stringify(newKnown));
    }
    localStorage.setItem(storageKey, JSON.stringify(newUser));
    localStorage.setItem('ladys_active_user', emailKey);
    loadUserSession(newUser);
    detectLocation();
  };

  const handleLogout = () => {
    localStorage.removeItem('ladys_active_user');
    setCurrentUser(null);
    setAuthMode('signin');
    setEmailInput('');
    setPasswordInput('');
    setNameInput('');
    setStyling({ isGenerating: false, suggestions: null, error: null });
  };

  const handleExportData = () => {
    if (!currentUser) return;
    const data: UserData = {
      email: currentUser.email,
      password: currentUser.password,
      name: currentUser.name,
      wardrobe,
      inspiration,
      profile,
      context,
      savedOutfits,
      calendar: calendarEvents,
      googleCalendar: gCalConfigInput,
      lastActive: Date.now()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ladys_backup_${currentUser.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data: UserData = JSON.parse(event.target?.result as string);
        if (data.email && data.wardrobe) {
            localStorage.setItem(`ladys_data_${data.email}`, JSON.stringify(data));
            if (!knownEmails.includes(data.email)) {
               const newKnown = [...knownEmails, data.email];
               setKnownEmails(newKnown);
               localStorage.setItem('ladys_emails_list', JSON.stringify(newKnown));
            }
            if (!currentUser) {
                setEmailInput(data.email);
                alert(`Access Key for ${data.name} loaded. Please enter password to verify.`);
            } else {
                 if (currentUser.email === data.email) {
                     loadUserSession(data);
                     alert("Session updated from file.");
                 } else {
                     alert("File loaded. Log out to access this different account.");
                 }
            }
        } else {
          alert("Invalid file format.");
        }
      } catch (err) {
        alert("Failed to parse access key.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };


  // --- Event Handlers ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    // Process first file immediately, queue others
    Array.from(files).forEach((file: File, index) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        // If it's the first one, trigger analysis immediately for UX
        if (index === 0 && uploadQueue.length === 0) {
            setUploadQueue([{ file, base64 }]);
            setIsClassifying(true);
            const analysis = await analyzeClothingItem(base64);
            setCurrentUploadMeta(prev => ({...prev, ...analysis}));
            setIsClassifying(false);
        } else {
            setUploadQueue(prev => [...prev, { file, base64 }]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const finalizeUpload = () => {
    if (uploadQueue.length === 0) return;
    const { base64, file } = uploadQueue[0];
    const newItem: ClothingItem = {
      id: Math.random().toString(36).substring(7),
      image: base64,
      name: currentUploadMeta.name || file.name.split('.')[0],
      category: currentUploadMeta.category as ClothingCategory,
      classification: currentUploadMeta.classification as ClothingClassification,
      fit: currentUploadMeta.fit as ClothingFit,
      color: currentUploadMeta.color,
      style: currentUploadMeta.style,
      material: currentUploadMeta.material,
      lastWorn: 0
    };
    setWardrobe(prev => [newItem, ...prev]);
    
    // Prepare next item
    const remaining = uploadQueue.slice(1);
    setUploadQueue(remaining);
    
    if (remaining.length > 0) {
        // Trigger analysis for next item
        setIsClassifying(true);
        setCurrentUploadMeta({ category: 'Tops', classification: 'Basic', fit: 'Tailored', color: '', style: '', material: '' }); // reset
        analyzeClothingItem(remaining[0].base64).then(analysis => {
            setCurrentUploadMeta(prev => ({...prev, ...analysis}));
            setIsClassifying(false);
        });
    }
  };

  const handleAnalysisUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setIsAnalyzing(true);
      try {
        const result = await analyzeBodyArchitecture(base64);
        setProfile(prev => ({
          ...prev,
          analysisPhoto: base64,
          aiAnalysis: result,
          bodyType: result.bodyShape,
          height: result.heightEstimate
        }));
      } catch (err) {
        alert("Proportion analysis failed. Please use a clear full-length photo.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInspoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newItem: InspirationImage = {
          id: Math.random().toString(36).substring(7),
          image: reader.result as string,
        };
        setInspiration(prev => [...prev, newItem].slice(-6));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeItem = (id: string) => setWardrobe(prev => prev.filter(item => item.id !== id));
  const removeInspo = (id: string) => setInspiration(prev => prev.filter(item => item.id !== id));
  const removeSavedOutfit = (id: string) => setSavedOutfits(prev => prev.filter(o => o.id !== id));

  const filteredWardrobe = wardrobe.filter(item => {
    if (filters.category !== 'All' && item.category !== filters.category) return false;
    if (filters.fit !== 'All' && item.fit !== filters.fit) return false;
    if (filters.classification !== 'All' && item.classification !== filters.classification) return false;
    if (filters.color !== 'All' && item.color?.toLowerCase().indexOf(filters.color.toLowerCase()) === -1) return false;
    if (filters.style !== 'All' && item.style?.toLowerCase().indexOf(filters.style.toLowerCase()) === -1) return false;
    return true;
  });

  const handleGenerate = async () => {
    if (wardrobe.length < 2) {
      setStyling(prev => ({ ...prev, error: "Upload your clothing pieces first." }));
      return;
    }

    setStyling({ isGenerating: true, suggestions: null, error: null });
    setActiveTab('generator');

    const promptText = `
      COMFORT RATING: ${context.comfort}/10
      LOCATION: ${context.location || 'Unknown'}
      WEATHER: ${context.weather || 'Unspecified'}
      EVENT: ${context.event || 'Daily Life'}
      VIBE: ${context.vibe || 'Sophisticated'}
      COLOR PREF: ${context.color || 'Balanced'}
    `;

    try {
      const results = await generateOutfits(wardrobe, inspiration, promptText, profile, context.pinterestUrl);
      setStyling({ isGenerating: false, suggestions: results, error: null });
    } catch (err: any) {
      setStyling({ isGenerating: false, suggestions: null, error: err.message });
    }
  };

  const openRatingModal = (outfit: OutfitSuggestion) => {
    setCurrentRating({ comfort: 3, style: 3, occasion: context.event || 'Daily', notes: '' });
    setRatingModal({ isOpen: true, outfit });
  };

  const saveRatedOutfit = () => {
    if (!ratingModal.outfit) return;
    const outfitId = Math.random().toString(36).substring(7);
    const newSavedOutfit: SavedOutfit = {
        ...ratingModal.outfit,
        id: outfitId,
        timestamp: Date.now(),
        occasionCategory: currentRating.occasion,
        rating: {
            comfort: currentRating.comfort,
            style: currentRating.style,
            notes: currentRating.notes
        }
    };
    setSavedOutfits(prev => [newSavedOutfit, ...prev]);
    
    // If active event (Planner mode), link outfit
    if (activeEventId) {
        setCalendarEvents(prev => prev.map(ev => 
            ev.id === activeEventId ? { ...ev, outfitId: outfitId } : ev
        ));
        setActiveEventId(null);
    }

    setRatingModal({ isOpen: false, outfit: null });
    setActiveTab('lookbook');
  };

  const logWear = (outfit: SavedOutfit) => {
     // Update last worn for all items in outfit
     const now = Date.now();
     setWardrobe(prev => prev.map(item => {
         if (outfit.items.includes(item.id)) {
             return { ...item, lastWorn: now };
         }
         return item;
     }));
     alert("Items logged as worn today. Laundry cycle tracking updated.");
  };

  // Planner Logic
  const getNext7Days = () => {
      const days = [];
      for(let i=0; i<7; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          days.push(d.toISOString().split('T')[0]);
      }
      return days;
  };
  
  const addEvent = (date: string) => {
      if (!newEventTitle.trim()) return;
      const newEvent: CalendarEvent = {
          id: Math.random().toString(36).substring(7),
          date,
          title: newEventTitle,
          description: '',
          source: 'local'
      };
      setCalendarEvents(prev => [...prev, newEvent]);
      setNewEventTitle('');
      setNewEventDate('');
  };

  const stylizeEvent = (event: CalendarEvent) => {
      setActiveEventId(event.id);
      setContext(prev => ({ ...prev, event: event.title, vibe: event.description || 'Appropriate' }));
      setActiveTab('generator');
  };


  // --- Auth View ---

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#faf9f6] flex flex-col items-center justify-center p-6 text-stone-800">
         {/* ... (Existing Auth UI - condensed for brevity) ... */}
         <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl border border-stone-100 text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200"></div>
             <div className="mb-10">
                <i className="fa-solid fa-gem text-5xl text-amber-600 mb-6 block drop-shadow-sm"></i>
                <h1 className="text-4xl font-serif font-bold italic text-amber-900 mb-2">The Lady's</h1>
                <p className="text-[10px] tracking-[0.4em] uppercase text-stone-400 font-bold">Private Wardrobe Stylist</p>
             </div>
             <div className="flex rounded-full bg-stone-100 p-1 mb-8 relative">
                <div className={`absolute top-1 bottom-1 w-[48%] bg-white rounded-full shadow-sm transition-all duration-300 ${authMode === 'signup' ? 'left-[50%]' : 'left-[2%]'}`}></div>
                <button onClick={() => setAuthMode('signin')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest z-10 transition-colors ${authMode === 'signin' ? 'text-amber-900' : 'text-stone-400'}`}>Sign In</button>
                <button onClick={() => setAuthMode('signup')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest z-10 transition-colors ${authMode === 'signup' ? 'text-amber-900' : 'text-stone-400'}`}>Join</button>
             </div>
             <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4 mb-8">
               {authMode === 'signup' && (
                 <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="w-full px-5 py-3 rounded-xl bg-stone-50 border border-stone-100 font-serif" placeholder="Full Name" />
               )}
               <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full px-5 py-3 rounded-xl bg-stone-50 border border-stone-100 font-serif" placeholder="Email Address" autoFocus />
               <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full px-5 py-3 rounded-xl bg-stone-50 border border-stone-100 font-serif" placeholder="Password" />
               <button type="submit" className="w-full py-4 bg-stone-900 text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-lg mt-4">{authMode === 'signin' ? "Unlock Wardrobe" : "Create Profile"}</button>
             </form>
             <div className="border-t border-stone-100 pt-6">
               <label className="flex items-center justify-center gap-2 w-full py-3 text-stone-400 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-amber-600 transition-all">
                  <i className="fa-solid fa-cloud-arrow-up"></i> Upload Access Key (Backup) <input type="file" className="hidden" accept=".json" onChange={handleImportData} />
               </label>
             </div>
         </div>
      </div>
    );
  }

  // --- Main App View ---

  const uniqueOccasions = ['All', ...Array.from(new Set(savedOutfits.map(o => o.occasionCategory)))].sort();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#faf9f6] text-stone-800">
      <nav className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-stone-200 p-6 flex flex-col sticky top-0 md:h-screen z-20 shadow-sm">
        {/* ... (Nav Header same) ... */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold italic text-amber-900 flex items-center gap-2">
            <i className="fa-solid fa-gem text-amber-600"></i>
            The Lady's
          </h1>
          <p className="text-[10px] tracking-widest uppercase text-stone-400 mt-1 font-sans font-bold">Wardrobe Stylist</p>
        </div>
        <div className="space-y-2 flex-grow">
          {/* User Info Tile */}
          <div className="px-4 py-3 mb-6 bg-stone-50 rounded-xl border border-stone-100 flex items-center justify-between">
             <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-amber-300 flex items-center justify-center text-xs font-bold text-amber-900 border border-white shadow-sm">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-bold text-stone-800 truncate">{currentUser.name.split(' ')[0]}</span>
                    <span className="text-[9px] text-stone-400 truncate max-w-[80px]">{currentUser.email}</span>
                </div>
             </div>
             <button onClick={handleLogout} title="Sign Out" className="text-stone-400 hover:text-red-400 transition-colors"><i className="fa-solid fa-power-off"></i></button>
          </div>

          <button onClick={() => setActiveTab('generator')} className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${activeTab === 'generator' ? 'bg-amber-50 text-amber-900 shadow-sm border border-amber-100' : 'text-stone-500 hover:bg-stone-50'}`}>
            <i className="fa-solid fa-sun"></i> <span className="font-medium">Daily Ritual</span>
          </button>
           <button onClick={() => setActiveTab('planner')} className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${activeTab === 'planner' ? 'bg-amber-50 text-amber-900 shadow-sm border border-amber-100' : 'text-stone-500 hover:bg-stone-50'}`}>
            <i className="fa-regular fa-calendar-check"></i> <span className="font-medium">Weekly Planner</span>
          </button>
          <button onClick={() => setActiveTab('lookbook')} className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${activeTab === 'lookbook' ? 'bg-amber-50 text-amber-900 shadow-sm border border-amber-100' : 'text-stone-500 hover:bg-stone-50'}`}>
            <i className="fa-solid fa-book-open"></i> <span className="font-medium">Lookbook</span>
          </button>
          <button onClick={() => setActiveTab('identity')} className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${activeTab === 'identity' ? 'bg-amber-50 text-amber-900 shadow-sm border border-amber-100' : 'text-stone-500 hover:bg-stone-50'}`}>
            <i className="fa-solid fa-dna"></i> <span className="font-medium">Style Identity</span>
          </button>
          <button onClick={() => setActiveTab('wardrobe')} className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${activeTab === 'wardrobe' ? 'bg-amber-50 text-amber-900 shadow-sm border border-amber-100' : 'text-stone-500 hover:bg-stone-50'}`}>
            <i className="fa-solid fa-boxes-stacked"></i> <span className="font-medium">Wardrobe</span>
          </button>
        </div>
      </nav>

      <main className="flex-grow p-4 md:p-10 pb-24 md:pb-10 overflow-auto">
        {activeTab === 'wardrobe' ? (
          <div className="max-w-6xl mx-auto">
            {/* ... Wardrobe Content ... */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <h2 className="text-3xl font-bold mb-2 font-serif tracking-tight">Digital Vault</h2>
                <p className="text-stone-500">Curate and filter your personal collection.</p>
              </div>
              <div className="flex items-center gap-4">
                 <label className="flex items-center gap-3 px-6 py-3 bg-stone-800 text-white rounded-full text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-black transition-all shadow-md">
                    <i className="fa-solid fa-plus"></i>
                    Add Pieces
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} multiple />
                 </label>
              </div>
            </header>

            {/* Faceted Filtering */}
            <section className="mb-10 p-6 bg-white rounded-2xl border border-stone-100 shadow-sm flex flex-wrap gap-4">
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-stone-400">Category</label>
                   <select value={filters.category} onChange={e => setFilters({...filters, category: e.target.value as any})} className="block w-40 px-3 py-2 bg-stone-50 border-none rounded-lg text-xs">
                      <option value="All">All Categories</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-stone-400">Classification</label>
                   <select value={filters.classification} onChange={e => setFilters({...filters, classification: e.target.value as any})} className="block w-40 px-3 py-2 bg-stone-50 border-none rounded-lg text-xs">
                      <option value="All">All Types</option>
                      {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-stone-400">Fit</label>
                   <select value={filters.fit} onChange={e => setFilters({...filters, fit: e.target.value as any})} className="block w-40 px-3 py-2 bg-stone-50 border-none rounded-lg text-xs">
                      <option value="All">All Fits</option>
                      {FITS.map(f => <option key={f} value={f}>{f}</option>)}
                   </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-stone-400">Color</label>
                   <input type="text" placeholder="Search color..." value={filters.color === 'All' ? '' : filters.color} onChange={e => setFilters({...filters, color: e.target.value || 'All'})} className="block w-40 px-3 py-2 bg-stone-50 border-none rounded-lg text-xs" />
                </div>
                <button onClick={() => setFilters({category:'All', color:'All', fit:'All', classification:'All', style:'All'})} className="text-[9px] font-black uppercase text-amber-700 mt-auto mb-1 hover:underline">Reset Filters</button>
            </section>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {filteredWardrobe.map(item => <ClothingCard key={item.id} item={item} onRemove={removeItem} />)}
            </div>

            {/* Enhanced AI Upload Modal */}
            {uploadQueue.length > 0 && (
              <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
                   <h3 className="text-xl font-serif font-bold mb-2">Classify Piece</h3>
                   {isClassifying ? (
                       <div className="flex items-center gap-2 text-amber-600 text-xs font-bold mb-4 animate-pulse">
                           <i className="fa-solid fa-wand-magic-sparkles"></i> AI Analyzing fabric & fit...
                       </div>
                   ) : (
                       <p className="text-xs text-stone-400 mb-6">Review the AI-detected details below.</p>
                   )}
                   
                   <div className="aspect-[3/4] rounded-2xl overflow-hidden mb-6 border border-stone-100 relative">
                      <img src={uploadQueue[0].base64} className="w-full h-full object-cover" />
                   </div>
                   
                   <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                       <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-stone-400">Item Name</label>
                          <input type="text" value={currentUploadMeta.name} onChange={e => setCurrentUploadMeta({...currentUploadMeta, name: e.target.value})} className="w-full px-3 py-2 bg-stone-50 border-none rounded-lg text-xs font-bold" />
                       </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-stone-400">Category</label>
                          <select value={currentUploadMeta.category} onChange={e => setCurrentUploadMeta({...currentUploadMeta, category: e.target.value as any})} className="w-full px-3 py-2 bg-stone-50 border-none rounded-lg text-xs">
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-stone-400">Type</label>
                          <select value={currentUploadMeta.classification} onChange={e => setCurrentUploadMeta({...currentUploadMeta, classification: e.target.value as any})} className="w-full px-3 py-2 bg-stone-50 border-none rounded-lg text-xs">
                            {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-stone-400">Color</label>
                          <input type="text" value={currentUploadMeta.color} onChange={e => setCurrentUploadMeta({...currentUploadMeta, color: e.target.value})} className="w-full px-3 py-2 bg-stone-50 border-none rounded-lg text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-stone-400">Material</label>
                          <input type="text" value={currentUploadMeta.material} onChange={e => setCurrentUploadMeta({...currentUploadMeta, material: e.target.value})} className="w-full px-3 py-2 bg-stone-50 border-none rounded-lg text-xs" />
                        </div>
                      </div>
                       <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase text-stone-400">Fit</label>
                              <select value={currentUploadMeta.fit} onChange={e => setCurrentUploadMeta({...currentUploadMeta, fit: e.target.value as any})} className="w-full px-3 py-2 bg-stone-50 border-none rounded-lg text-xs">
                                {FITS.map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                            </div>
                           <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase text-stone-400">Style Vibe</label>
                              <input type="text" value={currentUploadMeta.style} onChange={e => setCurrentUploadMeta({...currentUploadMeta, style: e.target.value})} className="w-full px-3 py-2 bg-stone-50 border-none rounded-lg text-xs" />
                            </div>
                       </div>
                   </div>
                   
                   <div className="mt-6 space-y-2">
                      <button onClick={finalizeUpload} disabled={isClassifying} className="w-full py-4 bg-stone-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50">Add to Vault</button>
                      <button onClick={() => setUploadQueue(prev => prev.slice(1))} className="w-full py-2 text-stone-400 text-[10px] font-black uppercase tracking-widest hover:text-stone-800">Skip</button>
                   </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'planner' ? (
            <div className="max-w-4xl mx-auto">
               <header className="mb-10 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold mb-2 font-serif tracking-tight">Weekly Planner</h2>
                  <p className="text-stone-500">Curate outfits for upcoming events to streamline your routine.</p>
                </div>
                <button 
                  onClick={handleSyncCalendar} 
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border transition-all flex items-center gap-2 ${gCalConfigInput.isConnected ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-white text-stone-500 border-stone-200 hover:border-amber-400'}`}
                >
                  <i className="fa-brands fa-google"></i>
                  {isSyncingCalendar ? "Syncing..." : gCalConfigInput.isConnected ? "Synced with Google" : "Sync Google Calendar"}
                </button>
               </header>
               
               <div className="space-y-8">
                   {getNext7Days().map(dateStr => {
                       const dateObj = new Date(dateStr);
                       const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                       const displayDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                       const events = calendarEvents.filter(e => e.date === dateStr);
                       
                       return (
                           <div key={dateStr} className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                               <div className="p-6 bg-stone-50 border-b border-stone-100 flex justify-between items-center">
                                   <div>
                                       <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{displayDate}</span>
                                       <h3 className="text-xl font-serif font-bold text-stone-800">{dayName}</h3>
                                   </div>
                                   <button 
                                     onClick={() => setNewEventDate(dateStr === newEventDate ? '' : dateStr)}
                                     className="w-8 h-8 rounded-full bg-white border border-stone-200 text-stone-400 hover:text-amber-600 hover:border-amber-300 flex items-center justify-center transition-all"
                                   >
                                       <i className={`fa-solid ${dateStr === newEventDate ? 'fa-minus' : 'fa-plus'}`}></i>
                                   </button>
                               </div>
                               
                               {/* Add Event Form */}
                               {newEventDate === dateStr && (
                                   <div className="p-6 bg-amber-50/50 border-b border-amber-100 flex gap-2 animate-in slide-in-from-top-2">
                                       <input 
                                         autoFocus
                                         type="text" 
                                         placeholder="Event Title (e.g. Board Meeting)" 
                                         value={newEventTitle}
                                         onChange={e => setNewEventTitle(e.target.value)}
                                         className="flex-grow px-4 py-2 rounded-lg border border-amber-200 text-sm focus:outline-none"
                                       />
                                       <button onClick={() => addEvent(dateStr)} className="px-6 py-2 bg-amber-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-black">Add</button>
                                   </div>
                               )}
                               
                               <div className="p-6 space-y-4">
                                   {events.length === 0 ? (
                                       <p className="text-xs text-stone-300 italic">No events scheduled.</p>
                                   ) : (
                                       events.map(ev => {
                                           const assignedOutfit = savedOutfits.find(o => o.id === ev.outfitId);
                                           const isGoogle = ev.source === 'google';
                                           
                                           return (
                                               <div key={ev.id} className={`flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-4 rounded-xl border hover:shadow-sm transition-shadow ${isGoogle ? 'bg-blue-50/30 border-blue-100' : 'border-stone-100'}`}>
                                                   <div>
                                                       <div className="flex items-center gap-2">
                                                          <h4 className={`font-bold ${isGoogle ? 'text-blue-900' : 'text-stone-800'}`}>{ev.title}</h4>
                                                          {isGoogle && <i className="fa-brands fa-google text-blue-400 text-xs" title="Google Calendar Event"></i>}
                                                       </div>
                                                       {assignedOutfit ? (
                                                           <div className="flex items-center gap-2 mt-2">
                                                               <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Outfit Assigned</span>
                                                               <span className="text-xs text-stone-500 italic">{assignedOutfit.title}</span>
                                                           </div>
                                                       ) : (
                                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mt-1 block">Pending Style</span>
                                                       )}
                                                   </div>
                                                   
                                                   {assignedOutfit ? (
                                                       <div className="flex items-center gap-2">
                                                            {assignedOutfit.items.slice(0, 3).map(itemId => {
                                                                const item = wardrobe.find(w => w.id === itemId);
                                                                return item ? <img key={itemId} src={item.image} className="w-10 h-12 object-cover rounded-md border border-stone-100" /> : null;
                                                            })}
                                                       </div>
                                                   ) : (
                                                       <button 
                                                         onClick={() => stylizeEvent(ev)}
                                                         className="px-4 py-2 bg-stone-800 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-colors"
                                                       >
                                                           <i className="fa-solid fa-wand-magic-sparkles mr-2"></i> Style This
                                                       </button>
                                                   )}
                                               </div>
                                           );
                                       })
                                   )}
                               </div>
                           </div>
                       );
                   })}
               </div>
               
               {/* Google Calendar Config Modal */}
               {showGCalConfig && (
                   <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                      <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
                          <h3 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
                              <i className="fa-brands fa-google text-blue-500"></i>
                              Calendar Integration
                          </h3>
                          <p className="text-xs text-stone-500 mb-6">To sync events, please provide your Google Cloud Project credentials. These are stored locally on your device.</p>
                          
                          <div className="space-y-4 mb-6">
                              <div>
                                  <label className="text-[10px] font-black uppercase text-stone-400 block mb-1">Google Client ID</label>
                                  <input 
                                    type="text" 
                                    value={gCalConfigInput.clientId}
                                    onChange={e => setGCalConfigInput({...gCalConfigInput, clientId: e.target.value})}
                                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                                    placeholder="apps.googleusercontent.com"
                                  />
                              </div>
                              <div>
                                  <label className="text-[10px] font-black uppercase text-stone-400 block mb-1">API Key (Calendar Enabled)</label>
                                  <input 
                                    type="password" 
                                    value={gCalConfigInput.apiKey}
                                    onChange={e => setGCalConfigInput({...gCalConfigInput, apiKey: e.target.value})}
                                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                                    placeholder="AIza..."
                                  />
                              </div>
                              <div className="text-[9px] text-stone-400 italic bg-stone-50 p-3 rounded-lg">
                                  Ensure your API Key has "Google Calendar API" enabled and your OAuth Consent Screen is configured in Google Cloud Console.
                              </div>
                          </div>
                          
                          <div className="flex gap-3">
                              <button onClick={() => setShowGCalConfig(false)} className="flex-1 py-3 text-stone-400 font-bold text-xs uppercase tracking-widest hover:text-stone-800">Cancel</button>
                              <button onClick={() => { setShowGCalConfig(false); handleSyncCalendar(); }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 shadow-lg">Save & Connect</button>
                          </div>
                      </div>
                   </div>
               )}
            </div>
        ) : activeTab === 'identity' ? (
          <div className="max-w-4xl mx-auto">
            {/* ... Existing Identity Header ... */}
            <header className="mb-12 flex justify-between items-start">
              <div>
                <h2 className="text-4xl font-bold mb-2 font-serif">Aesthetic Identity</h2>
                <p className="text-stone-500">Defining your permanent style DNA and architectural profile.</p>
              </div>
              <button onClick={handleExportData} className="px-4 py-2 bg-stone-100 hover:bg-amber-100 text-stone-600 hover:text-amber-800 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
                <i className="fa-solid fa-download"></i> Export Access Key
              </button>
            </header>

            <div className="grid lg:grid-cols-3 gap-8 mb-12">
              <div className="lg:col-span-1">
                 {/* ... Existing Silhouette Scan ... */}
                 <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-stone-100 text-center">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-6">Silhouette Scan</h3>
                  <div className="relative aspect-[3/4] bg-stone-50 rounded-2xl overflow-hidden mb-6 border border-stone-100">
                    {profile.analysisPhoto ? (
                      <img src={profile.analysisPhoto} className="w-full h-full object-cover" alt="Silhouette scan" />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-6 text-stone-300">
                        <i className="fa-solid fa-camera-retro text-4xl mb-4"></i>
                        <p className="text-[10px] uppercase font-bold tracking-widest">Full-Length Photo</p>
                      </div>
                    )}
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur flex flex-col items-center justify-center text-amber-900">
                         <i className="fa-solid fa-gear animate-spin text-2xl mb-2"></i>
                         <span className="text-[10px] font-black uppercase tracking-widest">Scanning...</span>
                      </div>
                    )}
                  </div>
                  <label className="block w-full py-3 bg-stone-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-black transition-all">
                    {profile.analysisPhoto ? "Update Architecture" : "Analyze My Proportions"}
                    <input type="file" className="hidden" accept="image/*" onChange={handleAnalysisUpload} />
                  </label>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                {/* ... Existing Analysis ... */}
                {profile.aiAnalysis && (
                  <div className="bg-stone-900 text-stone-50 p-8 rounded-[2rem] shadow-xl animate-in fade-in slide-in-from-right-8">
                     {/* ... dossier details ... */}
                     <div className="flex justify-between items-start mb-8">
                       <h3 className="text-xl font-serif italic">The Dossier</h3>
                       <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-[8px] font-black tracking-widest uppercase border border-amber-500/30">AI Architecture Sync</span>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div><span className="text-[9px] font-black uppercase tracking-widest opacity-60 block mb-1">Body Geometry</span><p className="font-bold text-lg">{profile.aiAnalysis.bodyShape}</p></div>
                      <div><span className="text-[9px] font-black uppercase tracking-widest opacity-60 block mb-1">Height Profile</span><p className="font-bold text-lg">{profile.aiAnalysis.heightEstimate}</p></div>
                      <div className="col-span-2 pt-4 border-t border-white/10"><span className="text-[9px] font-black uppercase tracking-widest opacity-60 block mb-1">Stylist Recommendation</span><p className="italic text-sm leading-relaxed text-amber-200">{`"${profile.aiAnalysis.suggestedFocus}"`}</p></div>
                    </div>
                  </div>
                )}

                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 space-y-6">
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Styling Directives</h3>
                   <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-2">
                       <label className="text-[9px] font-black text-stone-400 uppercase">Core Aesthetic</label>
                       <input type="text" value={profile.aesthetic} onChange={(e) => setProfile({...profile, aesthetic: e.target.value})} placeholder="e.g. Old Money" className="w-full px-4 py-3 rounded-xl bg-stone-50 border-none text-sm" />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[9px] font-black text-stone-400 uppercase">Signature Colors</label>
                       <input type="text" value={profile.signatureColors} onChange={(e) => setProfile({...profile, signatureColors: e.target.value})} placeholder="e.g. Navy, Tan" className="w-full px-4 py-3 rounded-xl bg-stone-50 border-none text-sm" />
                     </div>
                   </div>
                   
                   {/* Laundry Cycle Settings */}
                   <div className="pt-6 border-t border-stone-50">
                       <div className="flex items-center justify-between mb-2">
                           <label className="text-[9px] font-black text-stone-400 uppercase">Laundry Turnaround</label>
                           <span className="text-xs font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">{profile.laundryCycle} Days</span>
                       </div>
                       <input 
                         type="range" 
                         min="1" 
                         max="14" 
                         value={profile.laundryCycle} 
                         onChange={(e) => setProfile({...profile, laundryCycle: parseInt(e.target.value)})}
                         className="w-full h-1.5 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-amber-900"
                       />
                       <p className="text-[9px] text-stone-400 italic mt-2">Used to calculate re-wear logic. We won't suggest "dirty" tops within this window.</p>
                   </div>
                   
                   <div className="space-y-2 pt-4 border-t border-stone-50">
                      <div className="flex items-center gap-2 mb-2">
                         <i className="fa-brands fa-pinterest text-red-600"></i>
                         <label className="text-[9px] font-black text-stone-400 uppercase">Master Pinterest Account</label>
                      </div>
                      <input type="url" value={profile.pinterestProfile} onChange={(e) => setProfile({...profile, pinterestProfile: e.target.value})} placeholder="https://pinterest.com/username" className="w-full px-4 py-3 rounded-xl bg-stone-50 border-none text-sm" />
                   </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'lookbook' ? (
            <div className="max-w-6xl mx-auto">
               {/* ... Existing Lookbook ... */}
               <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                  <h2 className="text-3xl font-bold mb-2 font-serif tracking-tight">The Lookbook</h2>
                  <p className="text-stone-500">Your personal archive of curated excellence.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {uniqueOccasions.map(occ => (
                    <button key={occ} onClick={() => setLookbookFilter(occ)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${lookbookFilter === occ ? 'bg-amber-900 text-white shadow-md' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>{occ}</button>
                  ))}
                </div>
               </header>
               
               <div className="grid lg:grid-cols-3 gap-8">
                 {savedOutfits.filter(o => lookbookFilter === 'All' || o.occasionCategory === lookbookFilter).map(outfit => (
                   <div key={outfit.id} className="group relative bg-white rounded-[2rem] overflow-hidden shadow-lg border border-stone-100 flex flex-col hover:shadow-2xl transition-all duration-300">
                       <div className="p-6 bg-stone-50 border-b border-stone-100 flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-700 block mb-1">{outfit.occasionCategory}</span>
                            <h4 className="text-lg font-serif font-bold">{outfit.title}</h4>
                            <span className="text-[9px] text-stone-400">{new Date(outfit.timestamp).toLocaleDateString()}</span>
                          </div>
                          <button onClick={() => removeSavedOutfit(outfit.id)} className="text-stone-300 hover:text-red-400"><i className="fa-solid fa-trash"></i></button>
                       </div>
                       <div className="p-6 flex-grow">
                          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
                            {outfit.items.slice(0, 3).map(itemId => {
                              const item = wardrobe.find(w => w.id === itemId);
                              return item ? <img key={itemId} src={item.image} className="w-16 h-20 object-cover rounded-lg border border-stone-100 shrink-0" /> : null;
                            })}
                          </div>
                          <p className="text-xs text-stone-500 italic mb-4 line-clamp-2">{outfit.description}</p>
                          
                          <button onClick={() => logWear(outfit)} className="w-full py-2 mb-3 bg-stone-100 hover:bg-stone-800 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all">
                              Wore This Today
                          </button>

                          {outfit.rating && (
                              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50">
                                  <div className="flex justify-between items-center mb-2">
                                      <div className="text-[10px] font-bold text-amber-900">Comfort</div>
                                      <div className="flex text-amber-400 text-[10px]">
                                          {[...Array(5)].map((_, i) => <i key={i} className={`fa-solid fa-star ${i < outfit.rating!.comfort ? '' : 'text-stone-200'}`}></i>)}
                                      </div>
                                  </div>
                                  <div className="flex justify-between items-center">
                                      <div className="text-[10px] font-bold text-amber-900">Style</div>
                                      <div className="flex text-amber-400 text-[10px]">
                                          {[...Array(5)].map((_, i) => <i key={i} className={`fa-solid fa-star ${i < outfit.rating!.style ? '' : 'text-stone-200'}`}></i>)}
                                      </div>
                                  </div>
                              </div>
                          )}
                       </div>
                   </div>
                 ))}
                 {savedOutfits.length === 0 && (
                     <div className="col-span-3 text-center py-24 opacity-30">
                         <i className="fa-solid fa-hanger text-6xl text-stone-400 mb-4"></i>
                         <p className="font-serif text-xl">Your lookbook awaits its first memory.</p>
                     </div>
                 )}
               </div>
            </div>
        ) : (
          <div className="max-w-5xl mx-auto">
             {/* ... Generator View (Daily Ritual) ... */}
            <header className="mb-10 flex items-end justify-between">
              <div>
                <span className="text-amber-600 font-black uppercase tracking-[0.4em] text-[10px] mb-2 block">{greeting}, {currentUser.name.split(' ')[0]}</span>
                {activeEventId ? (
                     <div>
                         <span className="px-3 py-1 bg-stone-800 text-white rounded-full text-[10px] font-bold uppercase tracking-widest mb-1 inline-block">Styling Planner Event</span>
                         <h2 className="text-4xl font-bold mb-2 font-serif text-stone-800">{context.event}</h2>
                     </div>
                ) : (
                    <h2 className="text-4xl font-bold mb-2 font-serif">Daily Style Ritual</h2>
                )}
              </div>
              <button onClick={() => setActiveTab('identity')} className="text-[10px] font-black uppercase bg-white px-5 py-2.5 rounded-full border border-stone-100 shadow-sm transition-all hover:bg-stone-50">
                {profile.aiAnalysis ? "Architecture Synced" : "Unlock Proportions"}
              </button>
            </header>

            <div className="grid lg:grid-cols-3 gap-8 mb-12">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100">
                  <div className="grid sm:grid-cols-2 gap-6">
                    {['Location', 'Event', 'Weather', 'Vibe', 'Color'].map(field => (
                      <div key={field} className="space-y-2 relative">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{field}</label>
                        <div className="relative">
                          <input 
                            type="text"
                            value={(context as any)[field.toLowerCase()]}
                            onChange={(e) => setContext({...context, [field.toLowerCase()]: e.target.value})}
                            placeholder={`Specify ${field.toLowerCase()}...`}
                            className="w-full px-4 py-3 rounded-xl bg-stone-50 border-none text-sm"
                          />
                          {field === 'Location' && (
                            <button 
                              onClick={detectLocation} 
                              title="Auto-detect Location"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-amber-600 transition-colors p-1"
                            >
                              <i className="fa-solid fa-location-crosshairs"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* ... Comfort Rating Slider ... */}
                    <div className="sm:col-span-2 space-y-4 pt-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Comfort Rating</label>
                        <span className="text-xs font-bold text-amber-900 px-3 py-1 bg-amber-50 rounded-full border border-amber-100">Level {context.comfort}/10</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="10" 
                        value={context.comfort} 
                        onChange={(e) => setContext({...context, comfort: parseInt(e.target.value)})} 
                        className="w-full h-1.5 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-amber-900" 
                      />
                    </div>
                  </div>
                </div>
                
                {/* ... Pinterest Override ... */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 border-l-4 border-l-red-600">
                  <div className="flex items-center gap-4 mb-4">
                    <i className="fa-brands fa-pinterest text-red-600 text-xl"></i>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Specific Mood/Board Override</h4>
                  </div>
                  <input type="url" value={context.pinterestUrl} onChange={(e) => setContext({...context, pinterestUrl: e.target.value})} placeholder={profile.pinterestProfile ? "Optional: Override master account with a specific board..." : "Paste board link for trend analysis..."} className="w-full px-4 py-3 rounded-xl bg-stone-50 border-none text-sm" />
                </div>
              </div>

              {/* ... Inspiration Vault ... */}
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col">
                <h3 className="text-xs uppercase tracking-widest font-black text-stone-400 mb-6 flex items-center justify-between">
                  Inspiration Vault
                  <label className="cursor-pointer text-amber-600 hover:text-amber-900 transition-colors">
                    <input type="file" className="hidden" accept="image/*" onChange={handleInspoUpload} multiple />
                    <i className="fa-solid fa-plus-circle text-lg"></i>
                  </label>
                </h3>
                <div className="grid grid-cols-3 gap-2 flex-grow content-start">
                  {inspiration.map(inspo => (
                    <div key={inspo.id} className="relative group aspect-square rounded-lg overflow-hidden border border-stone-50 shadow-sm">
                      <img src={inspo.image} className="w-full h-full object-cover" alt="Inspiration" />
                      <button onClick={() => removeInspo(inspo.id)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"><i className="fa-solid fa-trash text-[10px]"></i></button>
                    </div>
                  ))}
                  {inspiration.length === 0 && (
                    <div className="col-span-3 py-10 text-center border border-dashed border-stone-100 rounded-xl">
                      <span className="text-[9px] text-stone-300 font-bold uppercase">Vault Empty</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button 
              onClick={handleGenerate} 
              disabled={styling.isGenerating || wardrobe.length < 2} 
              className={`w-full py-5 rounded-2xl font-black text-white tracking-[0.2em] uppercase text-[10px] transition-all shadow-xl group ${styling.isGenerating ? 'bg-stone-300 cursor-not-allowed' : 'bg-amber-950 hover:bg-black hover:-translate-y-1'}`}
            >
              {styling.isGenerating ? (
                <span className="flex items-center justify-center gap-4">
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                  Syncing Architecture, Laundry & Trends...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-4">
                  Synthesize Look
                  <i className="fa-solid fa-sparkles text-amber-400 group-hover:animate-bounce"></i>
                </span>
              )}
            </button>

            {/* ... Generator Results (Same as before) ... */}
            {styling.suggestions && (
              <div className="mt-16 space-y-16 pb-20">
                <div className="text-center mb-10">
                   <h3 className="text-2xl font-serif italic text-stone-400">The Curation</h3>
                   <div className="w-12 h-[1px] bg-amber-200 mx-auto mt-4"></div>
                </div>
                <div className="grid lg:grid-cols-3 gap-8">
                  {styling.suggestions.map((outfit, idx) => (
                    <div key={idx} className="group animate-in fade-in slide-in-from-bottom-8 duration-500" style={{animationDelay: `${idx * 150}ms`}}>
                      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-lg border border-stone-100 h-full flex flex-col hover:shadow-2xl transition-all duration-300">
                        <div className={`p-6 ${outfit.type === 'Bold' ? 'bg-amber-900 text-white' : 'bg-stone-50 text-stone-800'} border-b border-stone-100`}>
                           <div className="flex justify-between items-center mb-1">
                             <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-60">{outfit.type}</span>
                             {context.comfort >= 8 && outfit.type === 'Practical' && <i className="fa-solid fa-feather text-[10px] text-amber-600"></i>}
                           </div>
                           <h4 className="text-xl font-serif font-bold">{outfit.title}</h4>
                        </div>
                        <div className="p-6 flex-grow flex flex-col">
                          <div className="grid grid-cols-2 gap-3 mb-6">
                            {outfit.items.map(itemId => {
                              const item = wardrobe.find(w => w.id === itemId);
                              return item ? (
                                <div key={itemId} className="aspect-[3/4] rounded-xl overflow-hidden border border-stone-50 bg-stone-50 shadow-sm">
                                  <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                                </div>
                              ) : null;
                            })}
                          </div>
                          <p className="text-xs text-stone-500 leading-relaxed mb-6 italic">{outfit.description}</p>
                          <div className="mt-auto pt-6 border-t border-stone-50 space-y-4">
                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                               <span className="text-[9px] font-black uppercase text-amber-900 tracking-widest block mb-1">Fashion Protocol</span>
                               <p className="text-[10px] text-amber-800 italic leading-relaxed">{outfit.fashionGuideline}</p>
                            </div>
                            <button onClick={() => openRatingModal(outfit)} className="w-full py-3 mt-2 rounded-xl border border-stone-200 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 transition-all flex items-center justify-center gap-2">
                                <i className="fa-regular fa-bookmark"></i> Rate & Save to Lookbook
                            </button>
                            {outfit.sources && outfit.sources.length > 0 && (
                              <div className="pt-2">
                                <span className="text-[8px] font-black uppercase text-stone-300 tracking-widest block mb-2">Web Analysis</span>
                                <div className="flex flex-wrap gap-2">
                                  {outfit.sources.map((source, sIdx) => (
                                    <a key={sIdx} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-[8px] text-amber-700 hover:underline flex items-center gap-1 bg-white border border-amber-100 px-2 py-0.5 rounded-full transition-all hover:bg-amber-50">
                                      {source.title.length > 20 ? source.title.substring(0, 20) + '...' : source.title}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Rating Modal (Same) */}
            {ratingModal.isOpen && (
                <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-serif font-bold mb-6 text-center">Catalog this Look</h3>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase text-stone-400 block mb-2">Occasion Category</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {OCCASIONS_DEFAULT.map(occ => (
                                        <button 
                                            key={occ}
                                            onClick={() => setCurrentRating(prev => ({...prev, occasion: occ}))}
                                            className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${currentRating.occasion === occ ? 'bg-amber-900 text-white border-amber-900' : 'bg-white text-stone-500 border-stone-200 hover:border-amber-400'}`}
                                        >
                                            {occ}
                                        </button>
                                    ))}
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Or custom occasion..." 
                                    value={currentRating.occasion}
                                    onChange={e => setCurrentRating(prev => ({...prev, occasion: e.target.value}))}
                                    className="w-full px-3 py-2 bg-stone-50 border-none rounded-lg text-xs"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-stone-400 block mb-2">Comfort Rating</label>
                                <div className="flex gap-2 justify-center">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button 
                                            key={star} 
                                            onClick={() => setCurrentRating(prev => ({...prev, comfort: star}))}
                                            className={`text-2xl transition-colors ${currentRating.comfort >= star ? 'text-amber-400' : 'text-stone-200'}`}
                                        >
                                            <i className="fa-solid fa-star"></i>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-stone-400 block mb-2">Style Rating</label>
                                <div className="flex gap-2 justify-center">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button 
                                            key={star} 
                                            onClick={() => setCurrentRating(prev => ({...prev, style: star}))}
                                            className={`text-2xl transition-colors ${currentRating.style >= star ? 'text-amber-400' : 'text-stone-200'}`}
                                        >
                                            <i className="fa-solid fa-star"></i>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setRatingModal({isOpen: false, outfit: null})} className="flex-1 py-3 text-stone-400 font-bold text-xs uppercase tracking-widest hover:text-stone-800">Cancel</button>
                                <button onClick={saveRatedOutfit} className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black shadow-lg">Save Look</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
