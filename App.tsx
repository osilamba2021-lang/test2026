
import React, { useState, useEffect } from 'react';
import { ClothingItem, ClothingCategory, StylingState, InspirationImage, StyleProfile } from './types';
import ClothingCard from './components/ClothingCard';
import { generateOutfits } from './services/geminiService';

const CATEGORIES: ClothingCategory[] = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories'];

interface DailyContext {
  event: string;
  weather: string;
  location: string;
  vibe: string;
  color: string;
  comfort: number;
  pinterestUrl: string;
}

const App: React.FC = () => {
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [inspiration, setInspiration] = useState<InspirationImage[]>([]);
  const [activeTab, setActiveTab] = useState<'wardrobe' | 'generator' | 'identity'>('generator');
  const [categoryFilter, setCategoryFilter] = useState<ClothingCategory | 'All'>('All');
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
    signatureColors: ''
  });

  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const savedWardrobe = localStorage.getItem('ladys_wardrobe');
    const savedInspo = localStorage.getItem('ladys_inspo');
    const savedContext = localStorage.getItem('ladys_context');
    const savedProfile = localStorage.getItem('ladys_profile');
    
    if (savedWardrobe) setWardrobe(JSON.parse(savedWardrobe));
    if (savedInspo) setInspiration(JSON.parse(savedInspo));
    if (savedContext) {
      const parsed = JSON.parse(savedContext);
      setContext(prev => ({ ...prev, pinterestUrl: parsed.pinterestUrl || '' }));
    }
    if (savedProfile) setProfile(JSON.parse(savedProfile));

    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  useEffect(() => {
    localStorage.setItem('ladys_wardrobe', JSON.stringify(wardrobe));
    localStorage.setItem('ladys_inspo', JSON.stringify(inspiration));
    localStorage.setItem('ladys_context', JSON.stringify({ pinterestUrl: context.pinterestUrl }));
    localStorage.setItem('ladys_profile', JSON.stringify(profile));
  }, [wardrobe, inspiration, context.pinterestUrl, profile]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, category: ClothingCategory) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newItem: ClothingItem = {
          id: Math.random().toString(36).substring(7),
          image: reader.result as string,
          category,
          name: file.name.split('.')[0]
        };
        setWardrobe(prev => [newItem, ...prev]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
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

  const filteredWardrobe = wardrobe.filter(item => 
    categoryFilter === 'All' ? true : item.category === categoryFilter
  );

  const handleGenerate = async () => {
    if (wardrobe.length < 2) {
      setStyling(prev => ({ ...prev, error: "Please add items to your wardrobe first." }));
      return;
    }

    setStyling({ isGenerating: true, suggestions: null, error: null });
    setActiveTab('generator');

    const promptText = `
      DAILY BRIEFING:
      - Time: ${greeting}
      - Event/Agenda: ${context.event || 'Productive Day'}
      - Weather: ${context.weather || 'Standard'}
      - Location: ${context.location || 'Local'}
      - Requested Vibe: ${context.vibe || 'Timeless'}
      - Requested Color: ${context.color || 'Any'}
      - Comfort: ${context.comfort}/10
    `;

    try {
      const results = await generateOutfits(wardrobe, inspiration, promptText, profile, context.pinterestUrl);
      setStyling({ isGenerating: false, suggestions: results, error: null });
    } catch (err: any) {
      setStyling({ isGenerating: false, suggestions: null, error: err.message });
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#faf9f6] text-stone-800">
      <nav className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-stone-200 p-6 flex flex-col sticky top-0 md:h-screen z-20">
        <div className="mb-10">
          <h1 className="text-2xl font-bold italic text-amber-900 flex items-center gap-2">
            <i className="fa-solid fa-gem text-amber-600"></i>
            The Lady's
          </h1>
          <p className="text-[10px] tracking-widest uppercase text-stone-400 mt-1 font-sans">Wardrobe Stylist</p>
        </div>

        <div className="space-y-2 flex-grow">
          <button 
            onClick={() => setActiveTab('generator')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${activeTab === 'generator' ? 'bg-amber-50 text-amber-900 shadow-sm border border-amber-100' : 'text-stone-500 hover:bg-stone-50'}`}
          >
            <i className="fa-solid fa-sun"></i>
            <span className="font-medium">Daily Ritual</span>
          </button>
          <button 
            onClick={() => setActiveTab('identity')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${activeTab === 'identity' ? 'bg-amber-50 text-amber-900 shadow-sm border border-amber-100' : 'text-stone-500 hover:bg-stone-50'}`}
          >
            <i className="fa-solid fa-fingerprint"></i>
            <span className="font-medium">Style Identity</span>
          </button>
          <button 
            onClick={() => setActiveTab('wardrobe')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${activeTab === 'wardrobe' ? 'bg-amber-50 text-amber-900 shadow-sm border border-amber-100' : 'text-stone-500 hover:bg-stone-50'}`}
          >
            <i className="fa-solid fa-clapperboard"></i>
            <span className="font-medium">My Wardrobe</span>
          </button>
        </div>

        <div className="mt-auto pt-6 border-t border-stone-100 hidden md:block">
          <p className="text-[10px] text-stone-400 leading-relaxed italic">
            "Identity is not found in a wardrobe, but a wardrobe can reflect identity."
          </p>
        </div>
      </nav>

      <main className="flex-grow p-4 md:p-10 pb-24 md:pb-10 overflow-auto">
        {activeTab === 'wardrobe' ? (
          <div className="max-w-6xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <h2 className="text-3xl font-bold mb-2 font-serif tracking-tight">Digital Collection</h2>
                <p className="text-stone-500">Document your finest garments.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setCategoryFilter('All')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${categoryFilter === 'All' ? 'bg-stone-800 text-white shadow-md' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>All</button>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${categoryFilter === cat ? 'bg-stone-800 text-white shadow-md' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>{cat}</button>
                ))}
              </div>
            </header>

            <section className="mb-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {CATEGORIES.map(cat => (
                <label key={cat} className="group flex flex-col items-center justify-center p-4 border border-dashed border-stone-300 rounded-2xl cursor-pointer hover:border-amber-400 hover:bg-amber-50/20 transition-all active:scale-95">
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, cat)} multiple />
                  <i className="fa-solid fa-cloud-arrow-up text-stone-300 group-hover:text-amber-500 mb-2"></i>
                  <span className="text-[9px] font-black uppercase tracking-tighter text-stone-400 group-hover:text-amber-700">{cat}</span>
                </label>
              ))}
            </section>

            {filteredWardrobe.length === 0 ? (
              <div className="text-center py-32 bg-white rounded-[2rem] border border-stone-100 shadow-sm">
                <i className="fa-solid fa-shirt text-stone-100 text-8xl mb-6"></i>
                <h3 className="text-xl font-medium text-stone-300">Your gallery is quiet...</h3>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {filteredWardrobe.map(item => <ClothingCard key={item.id} item={item} onRemove={removeItem} />)}
              </div>
            )}
          </div>
        ) : activeTab === 'identity' ? (
          <div className="max-w-4xl mx-auto">
            <header className="mb-12">
              <h2 className="text-4xl font-bold mb-2 font-serif">Aesthetic Identity</h2>
              <p className="text-stone-500">Define your core style philosophy. This persists across all daily look generations.</p>
            </header>

            <div className="bg-white rounded-[3rem] p-10 shadow-sm border border-stone-100 space-y-10">
              <div className="grid md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Core Aesthetic</label>
                  <input 
                    type="text"
                    value={profile.aesthetic}
                    onChange={(e) => setProfile({...profile, aesthetic: e.target.value})}
                    placeholder="e.g. Minimalist Parisian, Dark Academia, Corporate Chic"
                    className="w-full px-6 py-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-amber-200 transition-all"
                  />
                  <p className="text-[10px] text-stone-400 italic">Your "Base Style" that the AI will always pivot towards.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Preferred Silhouettes</label>
                  <input 
                    type="text"
                    value={profile.silhouettes}
                    onChange={(e) => setProfile({...profile, silhouettes: e.target.value})}
                    placeholder="e.g. High-waisted, Oversized, Tailored, A-line"
                    className="w-full px-6 py-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-amber-200 transition-all"
                  />
                  <p className="text-[10px] text-stone-400 italic">How you like your clothes to fit and flow.</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Signature Colors</label>
                  <input 
                    type="text"
                    value={profile.signatureColors}
                    onChange={(e) => setProfile({...profile, signatureColors: e.target.value})}
                    placeholder="e.g. Navy, Camel, Burgundy, monochrome"
                    className="w-full px-6 py-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-amber-200 transition-all"
                  />
                  <p className="text-[10px] text-stone-400 italic">Colors that feel most like "you".</p>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">The "Never" Rules</label>
                  <input 
                    type="text"
                    value={profile.forbidden}
                    onChange={(e) => setProfile({...profile, forbidden: e.target.value})}
                    placeholder="e.g. No crop tops, No neons, No mixed prints"
                    className="w-full px-6 py-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-amber-200 transition-all"
                  />
                  <p className="text-[10px] text-stone-400 italic">Things the AI should NEVER suggest to you.</p>
                </div>
              </div>

              <div className="pt-6 border-t border-stone-100 flex justify-between items-center">
                <span className="text-[10px] text-amber-800 font-bold uppercase tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-circle-check"></i>
                  Identity Active
                </span>
                <button 
                  onClick={() => setActiveTab('generator')}
                  className="bg-stone-800 text-white px-8 py-3 rounded-full text-xs font-bold hover:bg-black transition-all"
                >
                  Return to Daily Ritual
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <header className="mb-10 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <span className="text-amber-600 font-black uppercase tracking-[0.4em] text-[10px] mb-2 block">{greeting}, My Lady</span>
                <h2 className="text-4xl font-bold mb-2 font-serif">Daily Style Curation</h2>
                <p className="text-stone-500">What does today's agenda look like?</p>
              </div>
              <button 
                onClick={() => setActiveTab('identity')}
                className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-amber-900 flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-stone-100 shadow-sm transition-all"
              >
                <i className="fa-solid fa-sliders"></i>
                Tune Identity
              </button>
            </header>

            <div className="grid lg:grid-cols-3 gap-8 mb-12">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100">
                  <div className="grid sm:grid-cols-2 gap-6">
                    {['Event', 'Weather', 'Location', 'Vibe', 'Color'].map(field => (
                      <div key={field} className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{field}</label>
                        <input 
                          type="text"
                          value={(context as any)[field.toLowerCase()]}
                          onChange={(e) => setContext({...context, [field.toLowerCase()]: e.target.value})}
                          placeholder={`Specify ${field.toLowerCase()}...`}
                          className="w-full px-4 py-3 rounded-xl bg-stone-50 border-none focus:ring-2 focus:ring-amber-200 text-sm transition-all"
                        />
                      </div>
                    ))}
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Comfort Level</label>
                        <span className="text-[10px] font-bold text-amber-800">{context.comfort}/10</span>
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
                
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 border-l-4 border-l-red-600">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                      <i className="fa-brands fa-pinterest text-xl"></i>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Pinterest Aesthetic Sync</h4>
                      <p className="text-xs text-stone-500">Sync with a board for trend-mapping.</p>
                    </div>
                  </div>
                  <input 
                    type="url"
                    value={context.pinterestUrl}
                    onChange={(e) => setContext({...context, pinterestUrl: e.target.value})}
                    placeholder="https://pinterest.com/yourboard..."
                    className="w-full px-4 py-3 rounded-xl bg-stone-50 border-none focus:ring-2 focus:ring-red-100 text-sm transition-all"
                  />
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col">
                <h3 className="text-xs uppercase tracking-widest font-black text-stone-400 mb-6 flex items-center justify-between">
                  Inspiration Vault
                  <label className="cursor-pointer text-amber-600 hover:text-amber-800">
                    <input type="file" className="hidden" accept="image/*" onChange={handleInspoUpload} multiple />
                    <i className="fa-solid fa-plus-circle"></i>
                  </label>
                </h3>
                <div className="grid grid-cols-3 gap-2 flex-grow content-start">
                  {inspiration.length === 0 ? (
                    <div className="col-span-3 py-10 border border-dashed border-stone-100 rounded-xl text-center">
                      <p className="text-[10px] text-stone-300 uppercase font-bold italic tracking-tighter">Vault empty</p>
                    </div>
                  ) : inspiration.map(inspo => (
                    <div key={inspo.id} className="relative group aspect-square rounded-lg overflow-hidden border border-stone-50 shadow-sm">
                      <img src={inspo.image} className="w-full h-full object-cover" />
                      <button onClick={() => removeInspo(inspo.id)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><i className="fa-solid fa-trash text-[10px]"></i></button>
                    </div>
                  ))}
                </div>
                {profile.aesthetic && (
                  <div className="mt-6 pt-6 border-t border-stone-50">
                    <span className="text-[8px] font-black uppercase text-stone-300 tracking-[0.2em] block mb-2">Active Identity</span>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[9px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-bold">{profile.aesthetic}</span>
                      <span className="text-[9px] bg-stone-50 text-stone-600 px-2 py-0.5 rounded-full font-bold">{profile.silhouettes}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={styling.isGenerating || wardrobe.length < 2}
              className={`w-full py-5 rounded-2xl font-black text-white tracking-[0.2em] uppercase text-xs transition-all shadow-xl ${styling.isGenerating ? 'bg-stone-300' : 'bg-amber-950 hover:bg-black hover:-translate-y-1'}`}
            >
              {styling.isGenerating ? (
                <span className="flex items-center justify-center gap-3">
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                  Syncing Identity & Trends...
                </span>
              ) : "Synthesize My Daily Look"}
            </button>

            {styling.error && (
              <div className="mt-8 p-4 bg-red-50 text-red-600 rounded-xl text-center text-xs italic border border-red-100">{styling.error}</div>
            )}

            {styling.suggestions && (
              <div className="mt-16 space-y-16 pb-20">
                <div className="text-center mb-10">
                   <h3 className="text-2xl font-serif italic text-stone-400">The Morning Editorial</h3>
                   <div className="w-16 h-1 bg-amber-100 mx-auto mt-4 rounded-full"></div>
                </div>
                
                <div className="grid lg:grid-cols-3 gap-8">
                  {styling.suggestions.map((outfit, idx) => (
                    <div key={idx} className="group animate-in fade-in slide-in-from-bottom-8 duration-700" style={{animationDelay: `${idx * 200}ms`}}>
                      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-lg border border-stone-100 h-full flex flex-col hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                        <div className={`p-6 ${outfit.type === 'Bold' ? 'bg-amber-900 text-white' : 'bg-stone-50 text-stone-800'} border-b border-stone-100`}>
                           <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-60 mb-1 block">{outfit.type} Choice</span>
                           <h4 className="text-xl font-serif font-bold">{outfit.title}</h4>
                        </div>
                        
                        <div className="p-6 flex-grow flex flex-col">
                          <div className="grid grid-cols-2 gap-3 mb-6">
                            {outfit.items.map(itemId => {
                              const item = wardrobe.find(w => w.id === itemId);
                              return item ? (
                                <div key={itemId} className="aspect-[3/4] rounded-xl overflow-hidden border border-stone-50 shadow-sm bg-stone-50">
                                  <img src={item.image} className="w-full h-full object-cover" />
                                </div>
                              ) : null;
                            })}
                          </div>
                          
                          <p className="text-xs text-stone-500 leading-relaxed mb-6 italic">
                            {outfit.description}
                          </p>

                          <div className="mt-auto pt-6 border-t border-stone-50 space-y-4">
                            <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50">
                               <span className="text-[9px] font-black uppercase text-amber-900 tracking-widest block mb-1">Identity Match</span>
                               <p className="text-[10px] text-amber-800 leading-relaxed italic">{outfit.identityMatch}</p>
                            </div>
                            
                            <div>
                               <span className="text-[9px] font-black uppercase text-stone-400 tracking-widest block mb-2">The Guideline</span>
                               <p className="text-[11px] text-stone-600 font-serif leading-relaxed italic">"{outfit.fashionGuideline}"</p>
                            </div>
                            
                            {outfit.sources && outfit.sources.length > 0 && (
                              <div className="pt-2">
                                <span className="text-[8px] font-black uppercase text-stone-300 tracking-widest block mb-2">Trend Sources</span>
                                <div className="flex flex-wrap gap-2">
                                  {outfit.sources.map((source, sIdx) => (
                                    <a 
                                      key={sIdx} 
                                      href={source.uri} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-[9px] text-amber-700 hover:underline flex items-center gap-1 bg-white border border-amber-100 px-2 py-0.5 rounded-full"
                                    >
                                      <i className="fa-solid fa-link text-[7px]"></i>
                                      {source.title.length > 15 ? source.title.substring(0, 15) + '...' : source.title}
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
            
            {!styling.suggestions && !styling.isGenerating && (
              <div className="text-center py-32 opacity-10">
                <i className="fa-solid fa-mug-saucer text-[10rem] text-stone-300"></i>
                <p className="font-serif italic text-2xl mt-4">Pour a coffee and begin your ritual...</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
