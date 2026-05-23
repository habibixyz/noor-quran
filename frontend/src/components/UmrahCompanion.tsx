import React, { useState, useEffect, useRef } from "react";
import { 
  Compass, Plus, Trash2, RefreshCw, Sun, Moon, CheckSquare, Square,
  MessageSquare, ExternalLink, Send, BookOpen, Info, Plane, Award, Sparkles, MapPin, Clock
} from "lucide-react";
import confetti from "canvas-confetti";

// Sound synthesizer helper for physical buttons (so it works offline with premium feel)
const playBeep = (freq = 800, duration = 0.08) => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    // Smooth ramp down to prevent popping sound
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.warn("Web Audio API not supported or blocked by user interaction.", e);
  }
};

// Types & Interfaces
interface ChecklistItem {
  id: string;
  text: string;
  category: "documents" | "clothing" | "hygiene" | "health" | "electronics" | "other";
  checked: boolean;
  isCustom?: boolean;
}

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
  timestamp: string;
}

interface LeadForm {
  name: string;
  email: string;
  whatsapp: string;
  travelMonth: string;
  budget: string;
  notes: string;
}

export const UmrahCompanion: React.FC = () => {
  const [subTab, setSubTab] = useState<"guide" | "counter" | "duas" | "checklist" | "travel" | "assistant" | "packages">("guide");
  
  // Weather state
  const [weatherMakkah, setWeatherMakkah] = useState({ temp: 39, desc: "Sunny", humidity: 18, wind: 14 });
  const [weatherMadinah, setWeatherMadinah] = useState({ temp: 36, desc: "Clear Night", humidity: 12, wind: 10 });
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);

  // Live Time state for Saudi Arabia (UTC+3)
  const [saudiTime, setSaudiTime] = useState("");

  // Counter state
  const [tawafRound, setTawafRound] = useState(0);
  const [saiTrip, setSaiTrip] = useState(0);
  const [completedTawafs, setCompletedTawafs] = useState(0);
  const [completedSais, setCompletedSais] = useState(0);

  // Checklist state
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<"all" | "documents" | "clothing" | "hygiene" | "health" | "electronics">("all");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newChecklistCategory, setNewChecklistCategory] = useState<ChecklistItem["category"]>("other");

  // Chat/Assistant state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Agency Lead state
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [leadForm, setLeadForm] = useState<LeadForm>({ name: "", email: "", whatsapp: "", travelMonth: "October 2026", budget: "medium", notes: "" });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [submittedLeads, setSubmittedLeads] = useState<any[]>([]);

  // Estimator State
  const [pilgrimsCount, setPilgrimsCount] = useState(2);
  const [hotelCategory, setHotelCategory] = useState<3 | 4 | 5>(4);
  const [stayDuration, setStayDuration] = useState(10);
  const [groundTransport, setGroundTransport] = useState<"train_economy" | "train_business" | "taxi" | "bus">("train_economy");
  const [includeFlights, setIncludeFlights] = useState(true);
  const [flightCostEstimate, setFlightCostEstimate] = useState(800);
  const [isAgencyPartnerForm, setIsAgencyPartnerForm] = useState(false);
  const needleRef = useRef<HTMLDivElement>(null);

  // Dynamic cost estimator logic
  const calculateEstimate = () => {
    const hotelNightlyRate = hotelCategory === 3 ? 55 : hotelCategory === 4 ? 115 : 280;
    // Assume double occupancy (i.e. number of rooms needed = pilgrimsCount / 2, minimum 1 room)
    const roomsCount = Math.max(1, Math.ceil(pilgrimsCount / 2));
    const hotelTotal = stayDuration * hotelNightlyRate * roomsCount;
    
    const visaFee = 120 * pilgrimsCount;
    
    const transportTotal = (() => {
      if (groundTransport === "bus") return 15 * pilgrimsCount;
      if (groundTransport === "train_economy") return 45 * pilgrimsCount;
      if (groundTransport === "train_business") return 85 * pilgrimsCount;
      // Private Taxi is a flat rate of $120 per vehicle, fits up to 4 passengers
      const carsNeeded = Math.max(1, Math.ceil(pilgrimsCount / 4));
      return carsNeeded * 120;
    })();
    
    const flightTotal = includeFlights ? flightCostEstimate * pilgrimsCount : 0;
    const foodAndMisc = stayDuration * 25 * pilgrimsCount;
    
    const subtotal = hotelTotal + visaFee + transportTotal + flightTotal + foodAndMisc;
    const lowRange = Math.round(subtotal * 0.95);
    const highRange = Math.round(subtotal * 1.08);
    
    return {
      hotelTotal,
      visaFee,
      transportTotal,
      flightTotal,
      foodAndMisc,
      lowRange,
      highRange
    };
  };

  const costBreakdown = calculateEstimate();

  // Expanded guide steps state
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  // 1. Initial Load Checklist & Leads from LocalStorage
  useEffect(() => {
    // Default checklist items
    const defaultChecklist: ChecklistItem[] = [
      { id: "d1", text: "Passport (valid > 6 months)", category: "documents", checked: false },
      { id: "d2", text: "Umrah eVisa printout", category: "documents", checked: false },
      { id: "d3", text: "Flight tickets & Hotel vouchers", category: "documents", checked: false },
      { id: "d4", text: "Nusuk App installed & registered", category: "documents", checked: false },
      { id: "c1", text: "White Ihram garments (2 sets for men)", category: "clothing", checked: false },
      { id: "c2", text: "Comfortable, worn-in sandals/slippers", category: "clothing", checked: false },
      { id: "c3", text: "Ihram belt/pouch (for money & keys)", category: "clothing", checked: false },
      { id: "c4", text: "Lightweight, breathable clothes for Medina", category: "clothing", checked: false },
      { id: "h1", text: "Fragrance-free soap & shampoo (for Ihram)", category: "hygiene", checked: false },
      { id: "h2", text: "Fragrance-free Vaseline (to prevent chafing)", category: "hygiene", checked: false },
      { id: "h3", text: "Miswak / Toothbrush & toothpaste", category: "hygiene", checked: false },
      { id: "h4", text: "Small nail clipper & scissors", category: "hygiene", checked: false },
      { id: "m1", text: "Personal prescription medications", category: "health", checked: false },
      { id: "m2", text: "Painkillers (Paracetamol/Ibuprofen)", category: "health", checked: false },
      { id: "m3", text: "Rehydration salts (ORS packets)", category: "health", checked: false },
      { id: "m4", text: "Unscented sunscreen & face mist", category: "health", checked: false },
      { id: "e1", text: "Power bank (high capacity for long Haram stays)", category: "electronics", checked: false },
      { id: "e2", text: "Saudi Travel SIM or roaming setup", category: "electronics", checked: false },
      { id: "e3", text: "Universal adapter plugs", category: "electronics", checked: false },
    ];

    const savedChecklist = localStorage.getItem("umrah_checklist");
    if (savedChecklist) {
      try {
        setChecklist(JSON.parse(savedChecklist));
      } catch (e) {
        setChecklist(defaultChecklist);
      }
    } else {
      setChecklist(defaultChecklist);
      localStorage.setItem("umrah_checklist", JSON.stringify(defaultChecklist));
    }

    // Load inquiries
    const savedLeads = localStorage.getItem("umrah_leads");
    if (savedLeads) {
      try {
        setSubmittedLeads(JSON.parse(savedLeads));
      } catch (e) {}
    }

    // Load initial bot greetings
    setChatHistory([
      {
        sender: "bot",
        text: "Assalamu Alaykum! I am your AI Umrah Assistant. Ask me anything about the rituals, Ihram conditions, travel tips, or how to prepare. I am trained on authentic Fiqh guidelines.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, []);

  // Live Time Clock effect (Makkah & Medina Time: AST / UTC+3)
  useEffect(() => {
    const updateSaudiTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Riyadh'
      };
      try {
        setSaudiTime(new Intl.DateTimeFormat('en-US', options).format(now));
      } catch (e) {
        // Fallback calculation for AST (UTC+3)
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const saudiDate = new Date(utc + (3600000 * 3));
        const hours = saudiDate.getHours();
        const minutes = saudiDate.getMinutes();
        const seconds = saudiDate.getSeconds();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
        const displaySeconds = seconds < 10 ? '0' + seconds : seconds;
        setSaudiTime(`${displayHours}:${displayMinutes}:${displaySeconds} ${ampm}`);
      }
    };

    updateSaudiTime();
    const interval = setInterval(updateSaudiTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync checklist to LocalStorage
  const updateAndSyncChecklist = (newItems: ChecklistItem[]) => {
    setChecklist(newItems);
    localStorage.setItem("umrah_checklist", JSON.stringify(newItems));
  };

  // Weather Refresh Logic
  const handleRefreshWeather = () => {
    setIsRefreshingWeather(true);
    playBeep(900, 0.05);
    setTimeout(() => {
      // Add slight randomized fluctuations
      const tempDiff1 = Math.floor(Math.random() * 3) - 1;
      const tempDiff2 = Math.floor(Math.random() * 3) - 1;
      
      setWeatherMakkah(prev => ({
        ...prev,
        temp: Math.max(34, Math.min(46, prev.temp + tempDiff1))
      }));
      
      setWeatherMadinah(prev => ({
        ...prev,
        temp: Math.max(30, Math.min(42, prev.temp + tempDiff2))
      }));
      
      setIsRefreshingWeather(false);
    }, 850);
  };

  // Counter click behaviors
  const incrementTawaf = () => {
    if (tawafRound >= 7) return;
    
    const nextRound = tawafRound + 1;
    setTawafRound(nextRound);
    playBeep(700 + nextRound * 50, 0.1);

    if (nextRound === 7) {
      setTimeout(() => {
        // Play success beep
        playBeep(1200, 0.2);
        playBeep(1500, 0.3);
        setCompletedTawafs(prev => prev + 1);
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 },
          colors: ["#c9a84c", "#e8d5a3", "#ffffff"]
        });
      }, 500);
    }
  };

  const decrementTawaf = () => {
    if (tawafRound === 0) return;
    setTawafRound(prev => prev - 1);
    playBeep(500, 0.08);
  };

  const resetTawaf = () => {
    if (confirm("Are you sure you want to reset your Tawaf round counter?")) {
      setTawafRound(0);
      playBeep(400, 0.15);
    }
  };

  const incrementSai = () => {
    if (saiTrip >= 7) return;

    const nextTrip = saiTrip + 1;
    setSaiTrip(nextTrip);
    playBeep(700 + nextTrip * 50, 0.1);

    if (nextTrip === 7) {
      setTimeout(() => {
        playBeep(1200, 0.2);
        playBeep(1500, 0.3);
        setCompletedSais(prev => prev + 1);
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 },
          colors: ["#c9a84c", "#d9a05b", "#ffffff"]
        });
      }, 500);
    }
  };

  const decrementSai = () => {
    if (saiTrip === 0) return;
    setSaiTrip(prev => prev - 1);
    playBeep(500, 0.08);
  };

  const resetSai = () => {
    if (confirm("Are you sure you want to reset your Sa'i trip counter?")) {
      setSaiTrip(0);
      playBeep(400, 0.15);
    }
  };

  // Checklist actions
  const toggleChecklistItem = (id: string) => {
    const updated = checklist.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    playBeep(900, 0.04);
    updateAndSyncChecklist(updated);
  };

  const addCustomChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;

    const newItem: ChecklistItem = {
      id: "custom_" + Date.now(),
      text: newChecklistItem.trim(),
      category: newChecklistCategory,
      checked: false,
      isCustom: true
    };

    const updated = [...checklist, newItem];
    updateAndSyncChecklist(updated);
    setNewChecklistItem("");
    playBeep(850, 0.07);
  };

  const deleteChecklistItem = (id: string) => {
    const updated = checklist.filter(item => item.id !== id);
    updateAndSyncChecklist(updated);
    playBeep(550, 0.06);
  };

  // AI Knowledge Base Answers
  const aiKnowledgeBase: { keywords: string[]; answer: string }[] = [
    {
      keywords: ["break", "violate", "ihram", "invalid", "restrictions", "breaks"],
      answer: "In the state of Ihram, the following acts are forbidden and violate its conditions: 1) Cutting hair or nails. 2) Using scented soap, perfume, or fragrances on body or clothes. 3) For men: wearing sewn clothes or covering the head with hats/turbans. 4) Sexual relationship or marital intimacy. 5) Hunting land animals. 6) Initiating a marriage contract. If a prohibition is committed due to forgetfulness, there is no penalty, but one must stop immediately."
    },
    {
      keywords: ["nusuk", "rawdah", "book", "permit", "appointment"],
      answer: "Visiting the Rawdah (the resting place of Prophet Muhammad ﷺ in Medina) requires booking a slot ahead of time. Download the official 'Nusuk' app from the iOS App Store or Android Play Store. Register using your passport, visa details, and border number. Slots are released periodically. Ensure you carry your permit barcode on your phone at your scheduled entry time."
    },
    {
      keywords: ["women", "rules", "dress", "ihram for women", "socks"],
      answer: "For women, Ihram has specific guidelines: 1) Women do not wear the two white sheets; they can wear regular, modest Islamic clothing of any color. 2) The face and hands must remain uncovered (though she can cover her face if foreign men are passing close by using a cloth that doesn't touch the face directly). 3) Wearing socks and closed shoes is fully permitted and recommended. 4) Hair should be gathered modestly."
    },
    {
      keywords: ["meeqat", "miqat", "where", "boundary"],
      answer: "Meeqat is the geographical boundary where pilgrims must enter the state of Ihram before crossing towards Mecca. The main Meeqats are: 1) Dhul Hulaifah (Abyar Ali) - for those coming from Medina. 2) Yalamlam - for those coming from Yemen/India/Asia by sea. 3) Qarn al-Manazil (As-Sayl al-Kabir) - for pilgrims coming from Najd/Riyadh/Gulf. 4) Al-Juhfah - for pilgrims from Egypt/Syria. 5) Dhat Irq - for Iraq. If traveling by airplane, you must wear your Ihram before the flight or change onboard, and state your intention when the pilot announces the crossing of Meeqat."
    },
    {
      keywords: ["miss", "forget", "round", "tawaf mistake", "doubt"],
      answer: "If you doubt the number of rounds completed during Tawaf (e.g. wondering if you did 3 or 4), you must default to the lower number (e.g. assume 3) and continue from there. If you miss a round entirely and leave the Masjid al-Haram, your Tawaf is incomplete and must be repeated. If you remember while still in the Haram, you can simply complete the missing round(s) immediately if the gap was short."
    },
    {
      keywords: ["visa", "evisa", "how", "apply", "requirement"],
      answer: "Most nationalities can now apply for an Umrah eVisa directly through the official Saudi Ministry of Hajj platform (nusuk.sa) or through verified platforms. Visas are usually issued within 24-48 hours. Requirements include a passport valid for at least 6 months, a passport-sized photograph, and a return ticket confirmation."
    },
    {
      keywords: ["taxis", "train", "haramain", "uber", "transport"],
      answer: "Transportation options are highly modern. The Haramain High-Speed Railway connects Medina and Mecca in just 2 hours and 20 minutes (highly recommended; book tickets early via sar.hhr.sa). Taxis are widely available outside the Haram areas, though pricing should be bargained beforehand. Ride-sharing apps like Uber and Careem function very efficiently in both Mecca and Medina."
    },
    {
      keywords: ["sabr", "crowd", "patience", "hot"],
      answer: "Umrah is as much a spiritual trial of character as it is physical. With millions of pilgrims, crowds are inevitable. Quran reminds us of patience: 'For Hajj, there is no lewdness, nor abuse, nor disputing' (Surah Al-Baqarah 2:197). Stay hydrated, avoid pushing, utilize cooler hours (midnight to 4 AM) for Tawaf, and maintain a quiet tongue busy with Dhikr."
    }
  ];

  // Core chatbot response execution helper
  const executeSend = (text: string) => {
    const userMsg: ChatMessage = {
      sender: "user",
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatHistory(prev => [...prev, userMsg]);
    const currentQuery = text.toLowerCase();
    setIsBotTyping(true);
    playBeep(950, 0.05);

    // Auto scroll to bottom
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    // Simulate AI response delay
    setTimeout(() => {
      let matchedAnswer = "";
      
      // Match keywords in knowledge base
      for (const item of aiKnowledgeBase) {
        const matches = item.keywords.some(kw => currentQuery.includes(kw));
        if (matches) {
          matchedAnswer = item.answer;
          break;
        }
      }

      if (!matchedAnswer) {
        matchedAnswer = `I have received your question regarding this spiritual matter. While I am looking into our database, please remember: 1) Enter Meeqat in pure state of Ihram. 2) Supplicate during Tawaf with the words of your heart. 3) For specific religious decrees (Fatwas), please consult an authentic local scholar. Is there another travel requirement or checklist item I can help you find?`;
      }

      const botMsg: ChatMessage = {
        sender: "bot",
        text: matchedAnswer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatHistory(prev => [...prev, botMsg]);
      setIsBotTyping(false);
      playBeep(850, 0.05);

      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }, 700);
  };

  // Send message to AI Assistant
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    executeSend(userInput.trim());
    setUserInput("");
  };

  const handleQuickQuestion = (text: string) => {
    executeSend(text);
  };

  // Lead Form submission
  const handleOpenLeadModal = (pkgName: string) => {
    setSelectedPackage(pkgName);
    setIsAgencyPartnerForm(false);
    setShowInquiryModal(true);
    setFormSubmitted(false);
    playBeep(900, 0.06);
  };

  const handleOpenAgencyModal = () => {
    setSelectedPackage("Agency Partnership Registration");
    setIsAgencyPartnerForm(true);
    setShowInquiryModal(true);
    setFormSubmitted(false);
    playBeep(900, 0.06);
  };

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.email || !leadForm.whatsapp) {
      alert("Please fill in all required fields.");
      return;
    }

    const newLead = {
      id: "lead_" + Date.now(),
      packageName: selectedPackage,
      ...leadForm,
      date: new Date().toLocaleDateString()
    };

    const updated = [...submittedLeads, newLead];
    setSubmittedLeads(updated);
    localStorage.setItem("umrah_leads", JSON.stringify(updated));

    // Securely post submission to the backend to route email notifications
    fetch("/api/submit-lead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: isAgencyPartnerForm ? "agency" : "pilgrim",
        packageName: selectedPackage,
        name: leadForm.name,
        email: leadForm.email,
        whatsapp: leadForm.whatsapp,
        travelMonth: leadForm.travelMonth,
        budget: leadForm.budget,
        notes: leadForm.notes
      })
    }).catch(err => console.error("Error submitting lead to server:", err));

    setFormSubmitted(true);
    playBeep(1100, 0.1);
    playBeep(1400, 0.15);

    // Confetti for booking
    confetti({
      particleCount: 50,
      spread: 40,
      colors: ["#c9a84c", "#ffffff"]
    });
  };

  // Checklist statistics
  const filteredChecklist = checklist.filter(item => 
    activeCategory === "all" ? true : item.category === activeCategory
  );

  const totalItems = checklist.length;
  const checkedItems = checklist.filter(item => item.checked).length;
  const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  // Duas list
  const duas = [
    {
      title: "1. The Talbiyah (Recited frequently in Ihram)",
      arabic: "لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لاَ شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكُ لاَ شَرِيكَ لَكَ",
      transliteration: "Labbayk-Allāhumma labbayk, labbayka lā sharīka laka labbayk. Inna-l-ḥamda wa-n-ni'mata laka wa-l-mulk, lā sharīka lak.",
      translation: "Here I am at Your service, O Allah, here I am. Here I am, You have no partner, here I am. Verily all praise, grace, and sovereignty belong to You. You have no partner."
    },
    {
      title: "2. Entering Masjid al-Haram",
      arabic: "بِسْمِ اللهِ، وَالصَّلَاةُ وَالسَّلَامُ عَلَى رَسُولِ اللهِ، اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ",
      transliteration: "Bismillāh, waṣ-ṣalātu was-salāmu 'alā Rasūlillāh. Allāhumma-ftaḥ lī abwāba raḥmatik.",
      translation: "In the name of Allah, and peace and blessings be upon the Messenger of Allah. O Allah, open for me the gates of Your mercy."
    },
    {
      title: "3. Between Yemeni Corner & Black Stone (Tawaf)",
      arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
      transliteration: "Rabbanā ātinā fid-dunyā ḥasanatan wa fil-ākhirati ḥasanatan wa qinā 'adhāban-nār.",
      translation: "Our Lord, give us in this world that which is good and in the Hereafter that which is good, and protect us from the punishment of the Fire."
    },
    {
      title: "4. Supplication at Mount Safa & Marwah",
      arabic: "إِنَّ الصَّفَا وَالْمَرْوَةَ مِن شَعَائِرِ اللَّهِ ۖ فَمَنْ حَجَّ الْبَيْتَ أَوِ اعْتَمَرَ فَلَا جُنَاحَ عَلَيْهِ أَن يَطَّوَّفَ بِهِمَا",
      transliteration: "Innaṣ-Ṣafā wal-Marwata min sha'ā'irillāh. Faman ḥajjal-Bayta awi-'tamara falā junāḥa 'alayhi ay-yaṭṭawwafa bihimā.",
      translation: "Indeed, Safa and Marwah are among the symbols of Allah. So whoever makes Hajj to the House or performs Umrah - there is no blame upon him for walking between them."
    }
  ];

  return (
    <section className="flex flex-col gap-4 p-0 md:p-4" aria-label="Umrah Spiritual Companion">
      {/* Top Welcome Panel with Weather & Stats */}
      <div className="glass-panel p-4 md:p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[var(--color-bg-dark)]">
        <div className="flex-1 w-full">
          <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
            <Compass className="text-[var(--color-gold)] animate-spin star-rotate" style={{ animationDuration: '30s' }} size={24} />
            <span className="gold-text-gradient">Umrah &amp; Hajj Spiritual Companion</span>
          </h2>
          <p className="text-xs text-[#8c6b4a] mt-1.5 max-w-xl">
            A premium, AI-powered interactive guide, round counter, offline checklist, and dua companion for your sacred journey to Makkah and Madinah.
          </p>
        </div>

        {/* Live Weather & Time Panels */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 w-full lg:w-auto">
          <div className="flex flex-wrap md:flex-nowrap gap-2.5 w-full md:w-auto">
            <div className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3 flex items-center gap-3 shrink-0 companion-card-weather">
              <Sun className="text-amber-500 shrink-0" size={20} />
              <div>
                <div className="text-[9px] uppercase tracking-wider font-bold text-[#8c6b4a] leading-none mb-1">Makkah</div>
                <div className="text-sm font-bold text-white leading-tight">{weatherMakkah.temp}°C</div>
                <div className="text-[9px] text-[#8c6b4a] leading-none mt-0.5">{weatherMakkah.desc}</div>
              </div>
            </div>

            <div className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3 flex items-center gap-3 shrink-0 companion-card-weather">
              <Moon className="text-indigo-400 shrink-0" size={20} />
              <div>
                <div className="text-[9px] uppercase tracking-wider font-bold text-[#8c6b4a] leading-none mb-1">Medina</div>
                <div className="text-sm font-bold text-white leading-tight">{weatherMadinah.temp}°C</div>
                <div className="text-[9px] text-[#8c6b4a] leading-none mt-0.5">{weatherMadinah.desc}</div>
              </div>
            </div>

            <div className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3 flex items-center gap-3 shrink-0 animate-fade-in companion-card-time">
              <Clock className="text-[var(--color-gold)] shrink-0 animate-pulse" size={20} />
              <div>
                <div className="text-[9px] uppercase tracking-wider font-bold text-[#8c6b4a] leading-none mb-1">Makkah Time</div>
                <div className="text-sm font-bold text-white leading-tight">{saudiTime || "Loading..."}</div>
                <div className="text-[9px] text-[#8c6b4a] leading-none mt-0.5">AST (UTC+3)</div>
              </div>
            </div>

            <div className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3 flex items-center gap-3 shrink-0 animate-fade-in companion-card-time">
              <Clock className="text-[var(--color-gold)] shrink-0 animate-pulse" size={20} />
              <div>
                <div className="text-[9px] uppercase tracking-wider font-bold text-[#8c6b4a] leading-none mb-1">Medina Time</div>
                <div className="text-sm font-bold text-white leading-tight">{saudiTime || "Loading..."}</div>
                <div className="text-[9px] text-[#8c6b4a] leading-none mt-0.5">AST (UTC+3)</div>
              </div>
            </div>
          </div>

          <button 
            id="refresh-weather-btn"
            onClick={handleRefreshWeather} 
            disabled={isRefreshingWeather}
            className="bg-[#1c140c] border border-[var(--color-glass-border)] hover:border-[var(--color-gold)] rounded-xl p-3 flex items-center justify-center gap-2 text-[#8c6b4a] hover:text-[var(--color-gold)] transition-all disabled:opacity-50 shrink-0 companion-refresh-btn"
            aria-label="Refresh Weather &amp; Time"
          >
            <RefreshCw className={`shrink-0 ${isRefreshingWeather ? "animate-spin" : ""}`} size={16} />
            <span className="md:hidden text-xs font-bold">Refresh Weather &amp; Time</span>
          </button>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div 
        className="flex flex-wrap gap-1.5 p-1 bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl w-full" 
        style={{ minWidth: 0 }}
        aria-label="Umrah Section Tabs"
      >
        <button
          onClick={() => { setSubTab("guide"); playBeep(800, 0.05); }}
          className={`nav-tab shrink-0 ${subTab === "guide" ? "active" : ""}`}
        >
          <BookOpen size={13} />
          <span>Ritual Guide</span>
        </button>

        <button
          onClick={() => { setSubTab("counter"); playBeep(800, 0.05); }}
          className={`nav-tab shrink-0 ${subTab === "counter" ? "active" : ""}`}
        >
          <Award size={13} />
          <span>Tawaf Counters</span>
        </button>

        <button
          onClick={() => { setSubTab("duas"); playBeep(800, 0.05); }}
          className={`nav-tab shrink-0 ${subTab === "duas" ? "active" : ""}`}
        >
          <Sparkles size={13} />
          <span>Duas</span>
        </button>

        <button
          onClick={() => { setSubTab("checklist"); playBeep(800, 0.05); }}
          className={`nav-tab shrink-0 ${subTab === "checklist" ? "active" : ""}`}
        >
          <CheckSquare size={13} />
          <span>Packing Checklist ({progressPercent}%)</span>
        </button>

        <button
          onClick={() => { setSubTab("travel"); playBeep(800, 0.05); }}
          className={`nav-tab shrink-0 ${subTab === "travel" ? "active" : ""}`}
        >
          <Info size={13} />
          <span>Travel Info</span>
        </button>

        <button
          onClick={() => { setSubTab("assistant"); playBeep(800, 0.05); }}
          className={`nav-tab shrink-0 ${subTab === "assistant" ? "active" : ""}`}
        >
          <MessageSquare size={13} />
          <span>AI Assistant</span>
        </button>

        <button
          onClick={() => { setSubTab("packages"); playBeep(800, 0.05); }}
          className={`nav-tab shrink-0 ${subTab === "packages" ? "active" : ""}`}
        >
          <Plane size={13} />
          <span>Trip Estimator</span>
        </button>
      </div>

      {/* Main Content Layout with Sticky Phone Mockup */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">
        {/* Left Column: Sub Tab Contents (span 2 on desktop) */}
        <div className="lg:col-span-2 flex flex-col gap-4 w-full">
          {/* SUB TAB 1: RITUAL GUIDE */}
          {subTab === "guide" && (
        <div className="flex flex-col gap-4">
          <div className="glass-panel p-4 md:p-6 bg-[var(--color-bg-dark)]">
            <h3 className="text-md font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="text-[var(--color-gold)]" size={16} />
              <span>Step-by-Step Umrah Walkthrough</span>
            </h3>
            <p className="text-xs text-[#8c6b4a] mb-6">
              Umrah consists of four essential pillars. Below is a comprehensive guide to completing each phase, including spiritual protocols and common errors to avoid.
            </p>

            <div className="flex flex-col gap-3.5 relative border-l-2 border-[#33261a] ml-2 pl-5 md:pl-7">
              {/* Step 1 */}
              <div className="relative">
                <span className={`timeline-step-number ${expandedStep === 1 ? "active" : ""}`}>
                  1
                </span>
                <div 
                  className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3.5 cursor-pointer hover:border-[var(--color-gold)] transition-all"
                  onClick={() => { setExpandedStep(expandedStep === 1 ? null : 1); playBeep(800, 0.04); }}
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-white">Ihram &amp; Intention (Meeqat)</h4>
                    <span className="text-[10px] text-[var(--color-gold)] font-semibold" style={{ color: 'var(--color-gold)' }}>
                      {expandedStep === 1 ? "Collapse ▲" : "Expand ▼"}
                    </span>
                  </div>
                  {expandedStep === 1 && (
                    <div className="mt-3 text-[11px] text-[#b39a7d] leading-relaxed space-y-2 border-t border-[#33261a] pt-2.5">
                      <p><strong>Spiritual Intention (Niyyah):</strong> Enter the state of consecration (Ihram) before passing the designated Meeqat point. Make ghusl (purification), dress in Ihram, and declare your intention.</p>
                      <p><strong>Sunnahs:</strong> Perform 2 Rakah prayers after dressing, and start reciting the Talbiyah loudly (for men) or quietly (for women).</p>
                      <div className="p-2 rounded-lg bg-emerald-950/20 border border-[#33261a] text-[10px] text-amber-300 flex items-start gap-1.5 mt-2">
                        <Info size={12} className="shrink-0 text-[var(--color-gold)] mt-0.5" style={{ color: 'var(--color-gold)' }} />
                        <span><strong>Important restriction:</strong> Once Niyyah is made, you cannot apply perfume, trim hair/nails, or cover your head (men).</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <span className={`timeline-step-number ${expandedStep === 2 ? "active" : ""}`}>
                  2
                </span>
                <div 
                  className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3.5 cursor-pointer hover:border-[var(--color-gold)] transition-all"
                  onClick={() => { setExpandedStep(expandedStep === 2 ? null : 2); playBeep(800, 0.04); }}
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-white">Tawaf (Circumambulating Kaaba 7 Times)</h4>
                    <span className="text-[10px] text-[var(--color-gold)] font-semibold" style={{ color: 'var(--color-gold)' }}>
                      {expandedStep === 2 ? "Collapse ▲" : "Expand ▼"}
                    </span>
                  </div>
                  {expandedStep === 2 && (
                    <div className="mt-3 text-[11px] text-[#b39a7d] leading-relaxed space-y-2 border-t border-[#33261a] pt-2.5">
                      <p><strong>The Ritual:</strong> Start at the corner containing the Black Stone (Hajr al-Aswad). Keep the Kaaba on your left and circle it seven times counter-clockwise.</p>
                      <p><strong>Sunnahs:</strong> For men, expose the right shoulder (Idtiba'a) throughout Tawaf, and jog/march quickly during the first three rounds (Raml).</p>
                      <p><strong>Pro Tip:</strong> Between the Yemeni Corner (Rukn al-Yamani) and the Black Stone, recite the famous Quranic Dua: <em>"Rabbana atina fid-dunya hasanatan..."</em>. Use our <strong>Tawaf Counter</strong> tab to avoid forgetting rounds.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <span className={`timeline-step-number ${expandedStep === 3 ? "active" : ""}`}>
                  3
                </span>
                <div 
                  className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3.5 cursor-pointer hover:border-[var(--color-gold)] transition-all"
                  onClick={() => { setExpandedStep(expandedStep === 3 ? null : 3); playBeep(800, 0.04); }}
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-white">Maqam Ibrahim &amp; Zamzam</h4>
                    <span className="text-[10px] text-[var(--color-gold)] font-semibold" style={{ color: 'var(--color-gold)' }}>
                      {expandedStep === 3 ? "Collapse ▲" : "Expand ▼"}
                    </span>
                  </div>
                  {expandedStep === 3 && (
                    <div className="mt-3 text-[11px] text-[#b39a7d] leading-relaxed space-y-2 border-t border-[#33261a] pt-2.5">
                      <p><strong>Maqam Ibrahim Prayer:</strong> Upon completing Tawaf, walk towards Maqam Ibrahim (Station of Abraham) and perform a short 2 Rakah prayer. If too crowded, you can perform it anywhere in Masjid al-Haram.</p>
                      <p><strong>Drinking Zamzam:</strong> Walk down to the Zamzam water dispensing coolers, drink your fill while standing, pour a little over your head, and make any Dua you wish. It is verified as a source of healing.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 4 */}
              <div className="relative">
                <span className={`timeline-step-number ${expandedStep === 4 ? "active" : ""}`}>
                  4
                </span>
                <div 
                  className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3.5 cursor-pointer hover:border-[var(--color-gold)] transition-all"
                  onClick={() => { setExpandedStep(expandedStep === 4 ? null : 4); playBeep(800, 0.04); }}
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-white">Sa'i (Safa &amp; Marwah - 7 Trips)</h4>
                    <span className="text-[10px] text-[var(--color-gold)] font-semibold" style={{ color: 'var(--color-gold)' }}>
                      {expandedStep === 4 ? "Collapse ▲" : "Expand ▼"}
                    </span>
                  </div>
                  {expandedStep === 4 && (
                    <div className="mt-3 text-[11px] text-[#b39a7d] leading-relaxed space-y-2 border-t border-[#33261a] pt-2.5">
                      <p><strong>The Walk:</strong> Recreate the search of Hajar (wife of Abraham) by walking between the hills of Safa and Marwah. Start at Safa, end at Marwah. A one-way trip is counted as one round (7 rounds total, ending at Marwah).</p>
                      <p><strong>Guideline:</strong> Men are highly encouraged to speed up/jog in the section marked by green overhead lighting. Engage in deep remembrance at the peak of Safa and Marwah facing the Kaaba.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 5 */}
              <div className="relative">
                <span className={`timeline-step-number ${expandedStep === 5 ? "active" : ""}`}>
                  5
                </span>
                <div 
                  className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3.5 cursor-pointer hover:border-[var(--color-gold)] transition-all"
                  onClick={() => { setExpandedStep(expandedStep === 5 ? null : 5); playBeep(800, 0.04); }}
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-white">Halq or Taqsir (Shaving / Cutting Hair)</h4>
                    <span className="text-[10px] text-[var(--color-gold)] font-semibold" style={{ color: 'var(--color-gold)' }}>
                      {expandedStep === 5 ? "Collapse ▲" : "Expand ▼"}
                    </span>
                  </div>
                  {expandedStep === 5 && (
                    <div className="mt-3 text-[11px] text-[#b39a7d] leading-relaxed space-y-2 border-t border-[#33261a] pt-2.5">
                      <p><strong>Concluding Ritual:</strong> Once Sa'i is complete, pilgrims exit Ihram: Men shave their heads (Halq - highly rewarded) or cut their hair short (Taqsir). Women cut a finger-tip length of their hair.</p>
                      <p><strong>Freedom:</strong> Once completed, all Ihram restrictions are immediately lifted, and your Umrah is complete! May Allah accept it.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: TAWAF & SAI COUNTERS */}
      {subTab === "counter" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* TAWAF ROUND COUNTER */}
          <div className="glass-panel p-5 bg-[var(--color-bg-dark)] flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-[#33261a] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Tawaf Round Counter</h3>
                <p className="text-[10px] text-[#8c6b4a]">Kaaba circumambulation (7 rounds total)</p>
              </div>
              {completedTawafs > 0 && (
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded-md">
                  {completedTawafs} completed today
                </span>
              )}
            </div>

            {/* Visualizer Circle */}
            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative w-40 h-40 rounded-full border-4 border-[#33261a] flex flex-col items-center justify-center bg-[#120d08] shadow-[0_0_20px_rgba(201,168,76,0.05)]">
                {/* Progress Ring approximation via CSS border */}
                <div 
                  className="absolute inset-0 rounded-full border-4 border-transparent transition-all duration-300"
                  style={{
                    borderTopColor: tawafRound >= 1 ? 'var(--color-gold)' : 'transparent',
                    borderRightColor: tawafRound >= 3 ? 'var(--color-gold)' : 'transparent',
                    borderBottomColor: tawafRound >= 5 ? 'var(--color-gold)' : 'transparent',
                    borderLeftColor: tawafRound >= 7 ? 'var(--color-gold)' : 'transparent',
                    transform: 'rotate(45deg)'
                  }}
                ></div>
                <span className="text-[10px] text-[#8c6b4a] uppercase tracking-widest font-bold">Round</span>
                <span className="text-4xl font-extrabold text-white font-mono mt-1">{tawafRound}</span>
                <span className="text-[10px] text-[var(--color-gold)] font-bold mt-1">of 7</span>
              </div>

              {/* Instructive Tip based on Round */}
              <div className="mt-4 text-center px-4 min-h-[50px]">
                <p className="text-[11px] text-[#b39a7d] leading-relaxed">
                  {tawafRound === 0 && "Stand facing Hajr al-Aswad, raise your hand, declare Niyyah, and press +1 Round."}
                  {tawafRound === 1 && "Round 1: Keep Kaaba on your left. Expose right shoulder (men). Begin prayers/Dhikr."}
                  {(tawafRound > 1 && tawafRound < 7) && `Round ${tawafRound}: Recite prayers. When passing Yemeni Corner, recite: \"Rabbana atina fid-dunya hasanatan...\"`}
                  {tawafRound === 7 && "Round 7 (Final): Point to Black Stone at the end. Perform 2 Rakah prayers behind Maqam Ibrahim."}
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={decrementTawaf}
                disabled={tawafRound === 0}
                className="py-3 bg-[#1c140c] hover:bg-[#33261a] border border-[#33261a] hover:border-[#4d3926] text-[#8c6b4a] font-bold rounded-xl text-sm transition-all disabled:opacity-30 cursor-pointer"
                style={{ width: '25%' }}
              >
                -1
              </button>
              <button
                onClick={incrementTawaf}
                disabled={tawafRound >= 7}
                className="py-3 gold-button flex items-center justify-center text-xs font-bold rounded-xl transition-all cursor-pointer"
                style={{ width: '75%' }}
              >
                {tawafRound === 0 ? "Start Round 1" : tawafRound === 6 ? "Finish Round 7" : `Completed Round ${tawafRound}`}
              </button>
            </div>
            <button
              onClick={resetTawaf}
              className="text-[10px] text-center text-rose-400 hover:text-rose-300 font-semibold mt-1 transition-all cursor-pointer"
            >
              Reset Counter
            </button>
          </div>

          {/* SA'I TRIP COUNTER */}
          <div className="glass-panel p-5 bg-[var(--color-bg-dark)] flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-[#33261a] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Sa'i Trip Counter</h3>
                <p className="text-[10px] text-[#8c6b4a]">Safa &amp; Marwah walking paths (7 trips total)</p>
              </div>
              {completedSais > 0 && (
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded-md">
                  {completedSais} completed today
                </span>
              )}
            </div>

            {/* Visualizer Circle */}
            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative w-40 h-40 rounded-full border-4 border-[#33261a] flex flex-col items-center justify-center bg-[#120d08] shadow-[0_0_20px_rgba(217,160,91,0.03)]">
                <div 
                  className="absolute inset-0 rounded-full border-4 border-transparent transition-all duration-300"
                  style={{
                    borderTopColor: saiTrip >= 1 ? '#d9a05b' : 'transparent',
                    borderRightColor: saiTrip >= 3 ? '#d9a05b' : 'transparent',
                    borderBottomColor: saiTrip >= 5 ? '#d9a05b' : 'transparent',
                    borderLeftColor: saiTrip >= 7 ? '#d9a05b' : 'transparent',
                    transform: 'rotate(45deg)'
                  }}
                ></div>
                <span className="text-[10px] text-[#8c6b4a] uppercase tracking-widest font-bold">Trip</span>
                <span className="text-4xl font-extrabold text-white font-mono mt-1">{saiTrip}</span>
                <span className="text-[10px] text-[var(--color-gold)] font-bold mt-1">of 7</span>
              </div>

              {/* Instructive Tip based on Trip */}
              <div className="mt-4 text-center px-4 min-h-[50px]">
                <p className="text-[11px] text-[#b39a7d] leading-relaxed">
                  {saiTrip === 0 && "Go to Mount Safa, face the Kaaba, raise your hands, make Dua, and click Start Trip 1."}
                  {saiTrip === 1 && "Trip 1: Walking from Safa to Marwah. Jog in the green light section (men). Supplicate at Safa/Marwah."}
                  {saiTrip > 1 && saiTrip < 7 && `Trip ${saiTrip}: Walking from ${saiTrip % 2 === 1 ? "Safa to Marwah" : "Marwah to Safa"}. Focus on remembrance & prayer.`}
                  {saiTrip === 7 && "Trip 7: Final stretch from Safa to Marwah. Once finished, exit to barbers for Halq/Taqsir."}
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={decrementSai}
                disabled={saiTrip === 0}
                className="py-3 bg-[#1c140c] hover:bg-[#33261a] border border-[#33261a] hover:border-[#4d3926] text-[#8c6b4a] font-bold rounded-xl text-sm transition-all disabled:opacity-30 cursor-pointer"
                style={{ width: '25%' }}
              >
                -1
              </button>
              <button
                onClick={incrementSai}
                disabled={saiTrip >= 7}
                className="py-3 gold-button flex items-center justify-center text-xs font-bold rounded-xl transition-all cursor-pointer"
                style={{ width: '75%' }}
              >
                {saiTrip === 0 ? "Start Trip 1" : saiTrip === 6 ? "Finish Trip 7" : `Completed Trip ${saiTrip}`}
              </button>
            </div>
            <button
              onClick={resetSai}
              className="text-[10px] text-center text-rose-400 hover:text-rose-300 font-semibold mt-1 transition-all cursor-pointer"
            >
              Reset Counter
            </button>
          </div>
        </div>
      )}

      {/* SUB TAB 3: DUAS */}
      {subTab === "duas" && (
        <div className="flex flex-col gap-4">
          <div className="glass-panel p-4 md:p-6 bg-[var(--color-bg-dark)]">
            <h3 className="text-md font-bold text-white mb-2 flex items-center gap-2">
              <BookOpen className="text-[var(--color-gold)]" size={16} />
              <span>Essential Duas for Pilgrim Journey</span>
            </h3>
            <p className="text-xs text-[#8c6b4a] mb-5">
              Read these authentic supplications at different stages of the pilgrimage. Tap on any text to copy to your clipboard.
            </p>

            <div className="flex flex-col gap-4">
              {duas.map((dua, idx) => (
                <div 
                  key={idx}
                  className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-4 flex flex-col gap-3 relative group"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-[11px] font-bold text-[var(--color-gold)] tracking-wide">{dua.title}</h4>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${dua.arabic}\n\n${dua.translation}`);
                        playBeep(900, 0.05);
                        alert("Dua copied successfully!");
                      }}
                      className="text-[10px] text-[#8c6b4a] hover:text-white border border-[#33261a] hover:border-[#4d3926] px-2.5 py-1 rounded-md transition-all cursor-pointer"
                    >
                      Copy Dua
                    </button>
                  </div>

                  <div className="font-arabic text-xl md:text-2xl text-[#e8d5a3] text-right leading-[1.8] mt-2">
                    {dua.arabic}
                  </div>

                  <div className="text-[10px] font-medium text-[#b39a7d] italic leading-relaxed border-t border-[#1c140c] pt-2.5">
                    <strong>Transliteration:</strong> {dua.transliteration}
                  </div>

                  <div className="text-[10px] text-[#8c6b4a] leading-relaxed">
                    <strong>Translation:</strong> {dua.translation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 4: PACKING CHECKLIST */}
      {subTab === "checklist" && (
        <div className="glass-panel p-4 md:p-6 bg-[var(--color-bg-dark)]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[#33261a] pb-4 mb-4">
            <div>
              <h3 className="text-md font-bold text-white">Interactive Packing Checklist</h3>
              <p className="text-xs text-[#8c6b4a] mt-0.5">Prepare documents and materials before leaving. Saves automatically.</p>
            </div>
            
            {/* Progress bar */}
            <div className="checklist-progress-container">
              <div className="flex justify-between items-center text-[10px] font-bold text-[#8c6b4a] mb-1">
                <span>Completed</span>
                <span style={{ color: 'var(--color-gold)' }}>{progressPercent}% ({checkedItems}/{totalItems})</span>
              </div>
              <div className="premium-progress-track">
                <div className="premium-progress-fill" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>
          </div>

          {/* Add custom item form */}
          <form onSubmit={addCustomChecklistItem} className="flex flex-col md:flex-row gap-2 mb-5">
            <input
              type="text"
              value={newChecklistItem}
              onChange={(e) => setNewChecklistItem(e.target.value)}
              placeholder="Add custom packing item..."
              className="flex-grow bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[var(--color-gold)]"
            />
            <div className="flex gap-2">
              <select
                value={newChecklistCategory}
                onChange={(e) => setNewChecklistCategory(e.target.value as ChecklistItem["category"])}
                className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl px-2.5 py-2 text-xs text-[#b39a7d] outline-none cursor-pointer"
              >
                <option value="documents">Documents</option>
                <option value="clothing">Ihram &amp; Clothes</option>
                <option value="hygiene">Hygiene</option>
                <option value="health">Health</option>
                <option value="electronics">Electronics</option>
                <option value="other">Other</option>
              </select>
              <button
                type="submit"
                className="gold-button flex items-center justify-center p-2.5 rounded-xl shrink-0 cursor-pointer"
                aria-label="Add Checklist Item"
              >
                <Plus size={16} />
              </button>
            </div>
          </form>

          {/* Categories select filters */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(["all", "documents", "clothing", "hygiene", "health", "electronics"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); playBeep(800, 0.04); }}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border uppercase tracking-wider transition-all cursor-pointer ${activeCategory === cat ? "bg-[var(--color-gold)] text-[#011309] border-[var(--color-gold)]" : "bg-[#120d08] border-[#33261a] text-[#8c6b4a] hover:text-white"}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* List items */}
          <div className="flex flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar" style={{ maxHeight: '400px' }}>
            {filteredChecklist.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#8c6b4a] italic">
                No checklist items found in this category.
              </div>
            ) : (
              filteredChecklist.map((item) => (
                <div 
                  key={item.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${item.checked ? "bg-[#120d08]/40 border-[#1c140c] opacity-50" : "bg-[#120d08] border-[var(--color-glass-border)] hover:border-[#4d3926]"}`}
                >
                  <div 
                    className="flex items-center gap-2.5 cursor-pointer flex-grow select-none"
                    onClick={() => toggleChecklistItem(item.id)}
                  >
                    {item.checked ? (
                      <CheckSquare className="text-[var(--color-gold)] shrink-0" size={16} />
                    ) : (
                      <Square className="text-[#8c6b4a] shrink-0" size={16} />
                    )}
                    <span className={`text-[11px] font-medium leading-relaxed ${item.checked ? "line-through text-[#8c6b4a]" : "text-[#f0e8d0]"}`}>
                      {item.text}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-[#1c140c] text-[#8c6b4a] border border-[#33261a] text-center">
                      {item.category}
                    </span>
                    {item.isCustom && (
                      <button
                        onClick={() => deleteChecklistItem(item.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                        aria-label="Delete Checklist Item"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB TAB 5: TRAVEL INFO & GUIDELINES */}
      {subTab === "travel" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-panel p-5 bg-[var(--color-bg-dark)] flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white border-b border-[#33261a] pb-2 flex items-center gap-2">
              <MapPin className="text-[var(--color-gold)]" size={16} />
              <span>Nusuk App &amp; Rawdah Visit</span>
            </h3>
            <p className="text-xs text-[#b39a7d] leading-relaxed">
              Visiting the resting place of Prophet Muhammad ﷺ in Medina (the Rawdah) is legally managed by the Saudi Ministry.
            </p>
            <div className="premium-info-block flex flex-col gap-1.5">
              <div><strong>1. Install:</strong> Search 'Nusuk' on App Store/Play Store.</div>
              <div><strong>2. Register:</strong> Select visitor role, fill in visa and passport ID.</div>
              <div><strong>3. Book:</strong> Choose 'Praying in the Noble Rawdah' (men or women), pick date/time slot.</div>
              <div><strong>4. Print/Save:</strong> Take a screenshot of the permit barcode. Show it at entry gate.</div>
            </div>
            <p className="text-[10px] text-[#8c6b4a] italic">
              * Note: Permits are mandatory. Security guards verify barcode scans strictly at the Medina entry gates.
            </p>
          </div>

          <div className="glass-panel p-5 bg-[var(--color-bg-dark)] flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white border-b border-[#33261a] pb-2 flex items-center gap-2">
              <Plane className="text-[var(--color-gold)]" size={16} />
              <span>Haramain High-Speed Train</span>
            </h3>
            <p className="text-xs text-[#b39a7d] leading-relaxed">
              Ditch long, hot bus rides. The bullet train links Makkah and Madinah in comfort.
            </p>
            <div className="premium-info-block flex flex-col gap-1.5">
              <div><strong>Speed:</strong> Travels up to 300 km/h. Journey takes 2.2 hours.</div>
              <div><strong>Stops:</strong> Makkah Station, Jeddah Airport (KAIA), King Abdullah Economic City, Madinah Station.</div>
              <div><strong>Luggage:</strong> 1 large bag (up to 25kg) and 1 hand bag allowed per passenger.</div>
              <div><strong>Bookings:</strong> Reserve at <em>sar.hhr.sa</em> 1-2 months early. Slots fill up fast.</div>
            </div>
            <a 
              href="https://sar.hhr.sa/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] border border-[var(--color-gold)] rounded-xl px-3.5 py-2 mt-3 transition-all cursor-pointer hover:bg-[var(--color-gold)]"
              style={{ 
                color: 'var(--color-gold)',
                borderColor: 'var(--color-gold)',
                width: 'fit-content'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#011309';
                e.currentTarget.style.backgroundColor = 'var(--color-gold)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-gold)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span>Book Haramain Train</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>
      )}

      {/* SUB TAB 6: AI UMRAH ASSISTANT CHATBOT */}
      {subTab === "assistant" && (
        <div className="glass-panel bg-[var(--color-bg-dark)] flex flex-col overflow-hidden assistant-chat-panel">
          {/* Chat Header */}
          <div className="p-3.5 bg-[#120d08] border-b border-[#33261a] flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <div>
                <h3 className="text-xs font-bold text-white">AI Scholarly Assistant</h3>
                <p className="text-[9px] text-[#8c6b4a]">Spiritual Companion Knowledge Base</p>
              </div>
            </div>
            <span className="text-[9px] font-bold bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20" style={{ color: 'var(--color-gold)' }}>
              Sunnah AI Mode
            </span>
          </div>

          {/* Chat Messages */}
          <div className="flex-grow min-h-0 p-4 overflow-y-auto flex flex-col gap-3 custom-scrollbar">
            {chatHistory.map((msg, idx) => (
              <div 
                key={idx}
                className="flex flex-col"
                style={{
                  alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                  alignItems: msg.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: '80%',
                  width: 'fit-content'
                }}
              >
                <div 
                  className="p-3 rounded-2xl text-[11px] leading-relaxed"
                  style={{
                    backgroundColor: msg.sender === "user" ? "var(--color-gold)" : "#120d08",
                    border: msg.sender === "user" ? "none" : "1px solid var(--color-glass-border)",
                    color: msg.sender === "user" ? "#011309" : "#f0e8d0",
                    borderRadius: msg.sender === "user" ? "16px 16px 0px 16px" : "16px 16px 16px 0px",
                    fontWeight: msg.sender === "user" ? "bold" : "normal",
                    boxShadow: msg.sender === "user" ? "var(--shadow-gold)" : "none"
                  }}
                >
                  {msg.text}
                </div>
                <span className="text-[8px] text-[#8c6b4a] mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}
            
            {/* Bot Typing Indicator */}
            {isBotTyping && (
              <div 
                className="flex flex-col"
                style={{
                  alignSelf: "flex-start",
                  alignItems: "flex-start",
                  maxWidth: '80%'
                }}
              >
                <div className="bg-[#120d08] border border-[var(--color-glass-border)] p-3 rounded-2xl rounded-tl-none text-[11px] text-[#8c6b4a] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick suggestions block */}
          <div 
            className="px-3.5 py-2 bg-[#120d08]/60 border-t border-[#33261a]/50 flex flex-wrap gap-1.5 shrink-0 w-full"
          >
            <button
              onClick={() => { handleQuickQuestion("What breaks my Ihram?"); playBeep(800, 0.03); }}
              className="text-[9px] font-semibold px-2.5 py-1 rounded-lg border border-[#33261a] bg-[#120d08] text-[#8c6b4a] hover:text-white hover:border-[#4d3926] transition-all shrink-0 cursor-pointer"
            >
              What breaks Ihram?
            </button>
            <button
              onClick={() => { handleQuickQuestion("How to book Rawdah visit?"); playBeep(800, 0.03); }}
              className="text-[9px] font-semibold px-2.5 py-1 rounded-lg border border-[#33261a] bg-[#120d08] text-[#8c6b4a] hover:text-white hover:border-[#4d3926] transition-all shrink-0 cursor-pointer"
            >
              Book Rawdah Permit
            </button>
            <button
              onClick={() => { handleQuickQuestion("What is Meeqat boundary?"); playBeep(800, 0.03); }}
              className="text-[9px] font-semibold px-2.5 py-1 rounded-lg border border-[#33261a] bg-[#120d08] text-[#8c6b4a] hover:text-white hover:border-[#4d3926] transition-all shrink-0 cursor-pointer"
            >
              What is Meeqat?
            </button>
            <button
              onClick={() => { handleQuickQuestion("Ihram rules for women?"); playBeep(800, 0.03); }}
              className="text-[9px] font-semibold px-2.5 py-1 rounded-lg border border-[#33261a] bg-[#120d08] text-[#8c6b4a] hover:text-white hover:border-[#4d3926] transition-all shrink-0 cursor-pointer"
            >
              Women Ihram Rules
            </button>
          </div>

          {/* Chat Form Input */}
          <form onSubmit={handleSendMessage} className="p-3 bg-[#120d08] border-t border-[#33261a] flex gap-2 shrink-0">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Ask about rituals, Nusuk, Meeqat, rules..."
              className="flex-grow bg-[#1c140c] border border-[var(--color-glass-border)] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[var(--color-gold)]"
            />
            <button
              type="submit"
              disabled={!userInput.trim() || isBotTyping}
              className="gold-button flex items-center justify-center p-2.5 rounded-xl shrink-0 cursor-pointer disabled:opacity-50"
              aria-label="Send Message"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* SUB TAB 7: TRIP ESTIMATOR / LEAD GENERATION */}
      {subTab === "packages" && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="glass-panel p-4 md:p-6 bg-[var(--color-bg-dark)]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-[#33261a] pb-3 mb-4">
              <div>
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  <Plane className="text-[var(--color-gold)]" size={16} />
                  <span>Umrah Trip Estimator &amp; Partner Network</span>
                </h3>
                <p className="text-xs text-[#8c6b4a] mt-0.5">Calculate your custom budget. Submit your plan to receive partner quotes when verified agencies register.</p>
              </div>
              {submittedLeads.length > 0 && (
                <div className="text-[10px] text-emerald-400 font-bold bg-emerald-950/20 px-2.5 py-1 rounded-md border border-emerald-900 flex items-center gap-1 shrink-0">
                  <span>✓ {submittedLeads.length} active submissions</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Col 1: Trip Parameters (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <h4 className="text-xs font-bold text-[#8c6b4a] uppercase tracking-wider mb-2">Trip Specifications</h4>
                
                {/* Pilgrims Count & Stay Duration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pilgrims Count */}
                  <div className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-[#8c6b4a] uppercase">No. of Pilgrims</span>
                      <p className="text-[9px] text-[#6b5436] mt-0.5">Determines hotel rooms &amp; visa fees</p>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <button 
                        onClick={() => { setPilgrimsCount(prev => Math.max(1, prev - 1)); playBeep(750, 0.04); }}
                        className="w-8 h-8 rounded-lg bg-[#1c140c] border border-[#33261a] hover:border-[var(--color-gold)] text-white font-bold text-sm flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-sm font-mono font-bold text-white">{pilgrimsCount} {pilgrimsCount === 1 ? "Pilgrim" : "Pilgrims"}</span>
                      <button 
                        onClick={() => { setPilgrimsCount(prev => Math.min(15, prev + 1)); playBeep(850, 0.04); }}
                        className="w-8 h-8 rounded-lg bg-[#1c140c] border border-[#33261a] hover:border-[var(--color-gold)] text-white font-bold text-sm flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Stay Duration */}
                  <div className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-[#8c6b4a] uppercase">Duration of Stay</span>
                      <p className="text-[9px] text-[#6b5436] mt-0.5">Total nights in Makkah &amp; Madinah</p>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <button 
                        onClick={() => { setStayDuration(prev => Math.max(5, prev - 1)); playBeep(750, 0.04); }}
                        className="w-8 h-8 rounded-lg bg-[#1c140c] border border-[#33261a] hover:border-[var(--color-gold)] text-white font-bold text-sm flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-sm font-mono font-bold text-white">{stayDuration} Nights</span>
                      <button 
                        onClick={() => { setStayDuration(prev => Math.min(30, prev + 1)); playBeep(850, 0.04); }}
                        className="w-8 h-8 rounded-lg bg-[#1c140c] border border-[#33261a] hover:border-[var(--color-gold)] text-white font-bold text-sm flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Hotel Standard */}
                <div className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3.5">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <span className="text-[10px] font-extrabold text-[#8c6b4a] uppercase">Hotel Standard</span>
                      <p className="text-[9px] text-[#6b5436] mt-0.5">Estimates accommodation nightly cost</p>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--color-gold)] font-bold">
                      {hotelCategory === 3 ? "3★ Budget (~$55/nt)" : hotelCategory === 4 ? "4★ Premium (~$115/nt)" : "5★ Luxury Suite (~$280/nt)"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => { setHotelCategory(3); playBeep(800, 0.04); }}
                      className={`py-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${hotelCategory === 3 ? "border-[var(--color-gold)] bg-amber-400/10 text-white" : "border-[#33261a] bg-[#1c140c] text-[#8c6b4a] hover:text-white"}`}
                    >
                      3★ Standard
                    </button>
                    <button
                      onClick={() => { setHotelCategory(4); playBeep(800, 0.04); }}
                      className={`py-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${hotelCategory === 4 ? "border-[var(--color-gold)] bg-amber-400/10 text-white" : "border-[#33261a] bg-[#1c140c] text-[#8c6b4a] hover:text-white"}`}
                    >
                      4★ Executive
                    </button>
                    <button
                      onClick={() => { setHotelCategory(5); playBeep(800, 0.04); }}
                      className={`py-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${hotelCategory === 5 ? "border-[var(--color-gold)] bg-amber-400/10 text-white" : "border-[#33261a] bg-[#1c140c] text-[#8c6b4a] hover:text-white"}`}
                    >
                      5★ VIP Kaaba
                    </button>
                  </div>
                </div>

                {/* Ground Transport & Flight Toggles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Ground Transport dropdown */}
                  <div className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3.5">
                    <span className="text-[10px] font-extrabold text-[#8c6b4a] uppercase block mb-2">Ground Transport</span>
                    <select
                      value={groundTransport}
                      onChange={(e: any) => { setGroundTransport(e.target.value); playBeep(800, 0.04); }}
                      className="w-full bg-[#1c140c] border border-[#33261a] rounded-lg px-2.5 py-2 text-xs text-white outline-none cursor-pointer focus:border-[var(--color-gold)]"
                      style={{ backgroundColor: '#1c140c', color: '#ffffff' }}
                    >
                      <option value="bus" style={{ backgroundColor: '#1c140c', color: '#ffffff' }}>SAPTCO Public Bus ($15/pax)</option>
                      <option value="train_economy" style={{ backgroundColor: '#1c140c', color: '#ffffff' }}>Haramain Train Economy ($45/pax)</option>
                      <option value="train_business" style={{ backgroundColor: '#1c140c', color: '#ffffff' }}>Haramain Train Business ($85/pax)</option>
                      <option value="taxi" style={{ backgroundColor: '#1c140c', color: '#ffffff' }}>Private Chauffeur Taxi (~$120 flat)</option>
                    </select>
                  </div>

                  {/* Flight Toggle */}
                  <div className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3.5 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-extrabold text-[#8c6b4a] uppercase">Include Flights</span>
                      <input 
                        type="checkbox"
                        checked={includeFlights}
                        onChange={(e) => { setIncludeFlights(e.target.checked); playBeep(800, 0.04); }}
                        className="rounded accent-[var(--color-gold)] cursor-pointer"
                      />
                    </div>
                    {includeFlights ? (
                      <div className="mt-2.5">
                        <div className="flex justify-between text-[8px] text-[#8c6b4a] mb-1 font-mono">
                          <span>Est. Airfare/pax</span>
                          <span className="text-[9px] font-bold text-white">${flightCostEstimate}</span>
                        </div>
                        <input
                          type="range"
                          min="300"
                          max="2000"
                          step="50"
                          value={flightCostEstimate}
                          onChange={(e) => setFlightCostEstimate(parseInt(e.target.value))}
                          className="w-full h-1 bg-[#1c140c] rounded-lg appearance-none cursor-pointer accent-[var(--color-gold)]"
                        />
                      </div>
                    ) : (
                      <p className="text-[8px] text-[#6b5436] mt-2">Exclude airfare from total estimate</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Col 2: Invoice Breakdown (5 cols) */}
              <div className="lg:col-span-5">
                <div className="bg-[#120d08] border border-[var(--color-gold)]/20 rounded-xl p-5 flex flex-col justify-between gap-4 relative overflow-hidden min-h-0 md:min-h-[340px]">
                  {/* Decorative background logo */}
                  <div className="absolute -right-8 -bottom-8 pointer-events-none" style={{ opacity: 0.04, color: '#33261a' }}>
                    <Compass size={180} />
                  </div>

                  <div className="space-y-3 relative z-10">
                    <h4 className="text-xs font-bold text-white border-b border-[#33261a] pb-2 uppercase tracking-wider">Estimated Invoice</h4>
                    
                    <div className="space-y-2 text-[10px] text-[#b39a7d] font-mono">
                      <div className="flex justify-between">
                        <span>Visa &amp; Mandatory Health Ins:</span>
                        <span className="text-white">${costBreakdown.visaFee}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Est. Hotel Accomodation:</span>
                        <span className="text-white">${costBreakdown.hotelTotal}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ground Transfers (Haramain/Taxi):</span>
                        <span className="text-white">${costBreakdown.transportTotal}</span>
                      </div>
                      {includeFlights && (
                        <div className="flex justify-between">
                          <span>Estimated Airfare Total:</span>
                          <span className="text-white">${costBreakdown.flightTotal}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Est. Food &amp; Daily Allowance:</span>
                        <span className="text-white">${costBreakdown.foodAndMisc}</span>
                      </div>
                    </div>

                    <div className="h-[1px] bg-[#33261a] my-2"></div>
                    
                    <div className="text-center py-2 bg-[#1c140c]/80 border border-[#33261a] rounded-lg">
                      <span className="text-[9px] uppercase tracking-wider text-[#8c6b4a] font-bold">Estimated Cost Range</span>
                      <div className="text-lg font-mono font-extrabold text-[var(--color-gold)] mt-0.5">
                        ${costBreakdown.lowRange.toLocaleString()} - ${costBreakdown.highRange.toLocaleString()}
                      </div>
                      <span className="text-[8px] text-[#6b5436] font-sans block mt-0.5">*Includes flight, visa, stay, meals &amp; transport</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenLeadModal(`Custom Estimate ($${costBreakdown.lowRange}-$${costBreakdown.highRange} for ${pilgrimsCount} pax)`)}
                    className="w-full text-center py-3 gold-button rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative z-10"
                  >
                    Submit Plan &amp; Request Quotes
                  </button>
                </div>
              </div>
            </div>

            {/* Agency Partner Registration Invitation Card */}
            <div className="bg-[#1f1810]/40 border border-[#c9a84c]/20 rounded-xl p-4 mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h5 className="text-xs font-bold text-white">Are you a Hajj &amp; Umrah Travel Agency?</h5>
                <p className="text-[10px] text-[#8c6b4a] mt-0.5">Register your agency to integrate your packages and receive pilgrim booking leads.</p>
              </div>
              <button
                onClick={handleOpenAgencyModal}
                className="shrink-0 px-3 py-1.5 bg-[#120d08] hover:bg-[#1c140c] border border-[var(--color-gold)] hover:shadow-[0_0_8px_rgba(201,168,76,0.3)] text-[9px] font-extrabold text-[var(--color-gold)] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
              >
                Register Agency Partner
              </button>
            </div>

            {/* List Submitted Inquiries */}
            {submittedLeads.length > 0 && (
              <div className="mt-6 border-t border-[#33261a] pt-4">
                <h4 className="text-xs font-bold text-white mb-3">Your Submissions History:</h4>
                <div className="flex flex-col gap-2">
                  {submittedLeads.map((ld: any) => (
                    <div key={ld.id} className="bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl p-3 flex justify-between items-center text-[10px] text-[#b39a7d]">
                      <div>
                        <div><strong>Submission:</strong> {ld.packageName}</div>
                        <div className="text-[9px] text-[#8c6b4a] mt-0.5">Registered by {ld.name} on {ld.date}</div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                        ld.packageName.includes("Agency Partner") 
                          ? "text-blue-300 bg-blue-950/20 border-blue-900/40" 
                          : "text-amber-300 bg-amber-950/20 border-amber-900/40"
                      }`}>
                        {ld.packageName.includes("Agency Partner") ? "Under Review" : "Quotes Pending Partners"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        </div>

        {/* Right Column: Submerged Phone Mockup */}
        <div className="lg:col-span-1 w-full lg:sticky lg:top-4 flex flex-col items-center gap-4 py-2" style={{ willChange: 'transform' }}>
          <div className="text-center lg:text-left w-full px-2">
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-[#8c6b4a] mb-1 flex items-center gap-1.5 justify-center lg:justify-start">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              Live Pocket Companion
            </h3>
            <p className="text-[10px] text-[#6d5135] text-center lg:text-left">
              Simulated view of your digital pilgrim assistant on the go.
            </p>
          </div>

          {/* Interactive Phone Mockup */}
          <div className="companion-phone-wrapper" style={{ willChange: 'transform' }}>
            {/* Phone Screen Reflection / Glass overlay */}
            <div className="companion-phone-reflection"></div>
            
            {/* Speaker / Notch (Dynamic Island) */}
            <div className="companion-phone-notch">
              <div className="companion-phone-notch-camera"></div>
              <div className="companion-phone-notch-sensor"></div>
            </div>

            {/* Screen Wallpaper background image */}
            <img 
              src="/mecca_madina_phone_bg.png" 
              alt="Makkah and Madinah Wallpaper" 
              className="companion-phone-bg select-none pointer-events-none"
            />
            
            {/* Submerged Overlay Gradient */}
            <div className="companion-phone-overlay"></div>

            {/* Simulated System Status Bar */}
            <div className="companion-phone-status-bar">
              <span>{new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false })} AST</span>
              <div className="flex items-center gap-1.5">
                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                  <path d="M2 22h20V2z" />
                </svg>
                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 21l-12-18h24z" />
                </svg>
                <div className="companion-phone-battery-track">
                  <div className="companion-phone-battery-fill"></div>
                </div>
              </div>
            </div>

            {/* Phone App Content */}
            <div className="companion-phone-content select-none custom-scrollbar">
              {/* App Header */}
              <div className="companion-phone-header">
                <div className="companion-phone-app-title">
                  <Compass className="text-[var(--color-gold)] animate-spin star-rotate" style={{ animationDuration: '60s' }} size={14} />
                  <span>Noor App</span>
                </div>
                <span className="companion-phone-status-badge">
                  <span className="companion-phone-badge-ping"></span>
                  Connected
                </span>
              </div>

              {/* Middle Container */}
              <div className="companion-phone-main">
                {/* Dynamic Counter Card */}
                <div className="companion-phone-card">
                  <span className="companion-phone-card-title">Pilgrim Tracker</span>
                  <div className="companion-phone-grid-2">
                    {/* Tawaf Round */}
                    <div className="companion-phone-subcard">
                      <span className="companion-phone-subcard-label">Tawaf</span>
                      <span className="companion-phone-subcard-value">{tawafRound}<span>/7</span></span>
                      <div className="companion-phone-progress-bar">
                        <div 
                          className="companion-phone-progress-fill-gold"
                          style={{ width: `${(tawafRound / 7) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* Sa'i Trip */}
                    <div className="companion-phone-subcard">
                      <span className="companion-phone-subcard-label">Sa'i</span>
                      <span className="companion-phone-subcard-value">{saiTrip}<span>/7</span></span>
                      <div className="companion-phone-progress-bar">
                        <div 
                          className="companion-phone-progress-fill-orange"
                          style={{ width: `${(saiTrip / 7) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submerged Weather & Prayer Times Card */}
                <div className="companion-phone-card">
                  <div className="flex justify-between items-center" style={{ width: '100%' }}>
                    <span className="companion-phone-card-title">Haramain Weather</span>
                    <span className="text-[8px] text-amber-300 font-bold">Live Updates</span>
                  </div>
                  <div className="companion-phone-grid-2">
                    <div className="companion-phone-weather-row">
                      <Sun className="text-amber-500 shrink-0" size={12} />
                      <div className="companion-phone-weather-info">
                        <span className="companion-phone-weather-city">Makkah</span>
                        <span className="companion-phone-weather-temp">{weatherMakkah.temp}°C, {weatherMakkah.desc.split(' ')[0]}</span>
                      </div>
                    </div>
                    <div className="companion-phone-weather-row">
                      <Moon className="text-indigo-400 shrink-0" size={12} />
                      <div className="companion-phone-weather-info">
                        <span className="companion-phone-weather-city">Medina</span>
                        <span className="companion-phone-weather-temp">{weatherMadinah.temp}°C, {weatherMadinah.desc.split(' ')[0]}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Interactive Qibla Compass Card */}
                <div 
                  className="companion-phone-card cursor-crosshair"
                  style={{ alignItems: 'center' }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - (rect.left + rect.width / 2);
                    const y = e.clientY - (rect.top + rect.height / 2);
                    const angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
                    if (needleRef.current) {
                      needleRef.current.style.transform = `rotate(${angle}deg)`;
                    }
                  }}
                  onMouseLeave={() => {
                    if (needleRef.current) {
                      needleRef.current.style.transform = 'rotate(182deg)';
                    }
                  }}
                >
                  <div className="flex justify-between w-full">
                    <span className="companion-phone-card-title" style={{ alignSelf: 'flex-start' }}>Interactive Qibla</span>
                    <span className="text-[8px] text-[var(--color-gold)] font-mono font-bold">182.4° S</span>
                  </div>
                  
                  <div className="companion-phone-compass-disc">
                    <span className="absolute top-0.5 text-[7px] font-bold text-rose-500">N</span>
                    <span className="absolute right-0.5 text-[7px] font-bold text-white/50">E</span>
                    <span className="absolute bottom-0.5 text-[7px] font-bold text-white/80">S</span>
                    <span className="absolute left-0.5 text-[7px] font-bold text-white/50">W</span>
                    
                    <div 
                      ref={needleRef}
                      className="companion-phone-compass-needle"
                      style={{ transform: 'rotate(182deg)', transition: 'transform 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
                    >
                      <div className="companion-phone-compass-center">
                        <div className="companion-phone-compass-dot"></div>
                      </div>
                    </div>
                  </div>
                  <span className="text-[8px] text-[#b39a7d] text-center">Move cursor to search direction.</span>
                </div>

                {/* Nusuk Permit Pass */}
                <div className="companion-phone-permit-card">
                  <div className="companion-phone-permit-shine"></div>
                  
                  <div className="companion-phone-permit-info">
                    <span className="companion-phone-permit-badge">Nusuk Digital Pass</span>
                    <span className="companion-phone-permit-title">Rawdah Permit</span>
                    <span className="companion-phone-permit-date">Date: 25 Shawwal 1447</span>
                  </div>
                  
                  <div className="companion-phone-qr">
                    <div className="companion-phone-qr-pixel"></div>
                    <div className="companion-phone-qr-pixel"></div>
                    <div className="companion-phone-qr-bar"></div>
                    <div className="companion-phone-qr-pixel"></div>
                    <div className="companion-phone-qr-pixel"></div>
                  </div>
                </div>
              </div>

              {/* Phone App Footer Bar */}
              <div className="companion-phone-footer">
                <span className="companion-phone-footer-active">Home</span>
                <span>Rituals</span>
                <span>Duas</span>
                <span>Settings</span>
              </div>
            </div>

            {/* Virtual Home Button Indicator Bar */}
            <div className="companion-phone-home-indicator"></div>
          </div>
        </div>
      </div>

      {/* LEAD CONSULTATION INQUIRY MODAL */}
      {showInquiryModal && (
        <div className="fixed inset-0 z-50 bg-[#010905]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div 
            className="glass-panel w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 flex flex-col bg-[var(--color-bg-dark)]"
            style={{ maxWidth: '400px' }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-white">
                {isAgencyPartnerForm ? "Register Agency Partner" : "Register Custom Trip Plan"}
              </h3>
              <button
                onClick={() => { setShowInquiryModal(false); playBeep(500, 0.05); }}
                className="text-[#8c6b4a] hover:text-white font-bold p-1 text-sm cursor-pointer"
                aria-label="Close Inquiry Modal"
              >
                ✕
              </button>
            </div>

            {!formSubmitted ? (
              <form onSubmit={handleLeadSubmit} className="space-y-3.5">
                {!isAgencyPartnerForm && (
                  <p className="text-[10px] text-[#8c6b4a]">
                    Calculated Estimate: <strong className="text-[var(--color-gold)]">{selectedPackage}</strong>
                  </p>
                )}

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-[#8c6b4a] uppercase">
                    {isAgencyPartnerForm ? "Agency Name & Contact Person *" : "Full Name *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={leadForm.name}
                    onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                    placeholder={isAgencyPartnerForm ? "e.g. Al Haram Journeys (Ahmed)" : "e.g. Abdullah Khan"}
                    className="w-full bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[var(--color-gold)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-[#8c6b4a] uppercase">
                    {isAgencyPartnerForm ? "Business Email *" : "Email Address *"}
                  </label>
                  <input
                    type="email"
                    required
                    value={leadForm.email}
                    onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                    placeholder={isAgencyPartnerForm ? "e.g. contact@alharamjourneys.com" : "e.g. abdullah@gmail.com"}
                    className="w-full bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[var(--color-gold)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-[#8c6b4a] uppercase">
                    {isAgencyPartnerForm ? "Business WhatsApp Number *" : "WhatsApp Number *"}
                  </label>
                  <input
                    type="tel"
                    required
                    value={leadForm.whatsapp}
                    onChange={(e) => setLeadForm({ ...leadForm, whatsapp: e.target.value })}
                    placeholder="e.g. +966 50000 0000"
                    className="w-full bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[var(--color-gold)]"
                  />
                </div>

                {isAgencyPartnerForm ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-[#8c6b4a] uppercase">Operational Base</label>
                      <select
                        value={leadForm.travelMonth}
                        onChange={(e) => setLeadForm({ ...leadForm, travelMonth: e.target.value })}
                        className="w-full bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl px-2 py-2 text-xs text-[#b39a7d] outline-none cursor-pointer"
                        style={{ backgroundColor: '#120d08', color: '#b39a7d' }}
                      >
                        <option value="Saudi Arabia Operations" style={{ backgroundColor: '#120d08', color: '#b39a7d' }}>Saudi Arabia (Local)</option>
                        <option value="International Operator" style={{ backgroundColor: '#120d08', color: '#b39a7d' }}>International Agent</option>
                        <option value="Regional Sub-Agent" style={{ backgroundColor: '#120d08', color: '#b39a7d' }}>Regional Sub-Agent</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-[#8c6b4a] uppercase">License Type</label>
                      <select
                        value={leadForm.budget}
                        onChange={(e) => setLeadForm({ ...leadForm, budget: e.target.value })}
                        className="w-full bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl px-2 py-2 text-xs text-[#b39a7d] outline-none cursor-pointer"
                        style={{ backgroundColor: '#120d08', color: '#b39a7d' }}
                      >
                        <option value="Ministry Licensed" style={{ backgroundColor: '#120d08', color: '#b39a7d' }}>Ministry Licensed</option>
                        <option value="Registered Agent" style={{ backgroundColor: '#120d08', color: '#b39a7d' }}>Registered Agent</option>
                        <option value="Applying Status" style={{ backgroundColor: '#120d08', color: '#b39a7d' }}>Applying Status</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-[#8c6b4a] uppercase">Travel Month</label>
                      <select
                        value={leadForm.travelMonth}
                        onChange={(e) => setLeadForm({ ...leadForm, travelMonth: e.target.value })}
                        className="w-full bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl px-2 py-2 text-xs text-[#b39a7d] outline-none cursor-pointer"
                        style={{ backgroundColor: '#120d08', color: '#b39a7d' }}
                      >
                        <option value="June 2026" style={{ backgroundColor: '#120d08', color: '#b39a7d' }}>June 2026</option>
                        <option value="September 2026" style={{ backgroundColor: '#120d08', color: '#b39a7d' }}>September 2026</option>
                        <option value="October 2026" style={{ backgroundColor: '#120d08', color: '#b39a7d' }}>October 2026</option>
                        <option value="December 2026" style={{ backgroundColor: '#120d08', color: '#b39a7d' }}>December 2026</option>
                        <option value="Ramadan 2027" style={{ backgroundColor: '#120d08', color: '#b39a7d' }}>Ramadan 2027</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-[#8c6b4a] uppercase">Budget Level</label>
                      <select
                        value={leadForm.budget}
                        onChange={(e) => setLeadForm({ ...leadForm, budget: e.target.value })}
                        className="w-full bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl px-2 py-2 text-xs text-[#b39a7d] outline-none cursor-pointer"
                        style={{ backgroundColor: '#120d08', color: '#b39a7d' }}
                      >
                        <option value="economy" style={{ backgroundColor: '#120d08', color: '#b39a7d' }}>Economy</option>
                        <option value="medium" style={{ backgroundColor: '#120d08', color: '#b39a7d' }}>Medium</option>
                        <option value="luxury" style={{ backgroundColor: '#120d08', color: '#b39a7d' }}>Luxury / VIP</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-[#8c6b4a] uppercase">
                    {isAgencyPartnerForm ? "Services Offered & Hotel Contracts" : "Special requests / Notes"}
                  </label>
                  <textarea
                    value={leadForm.notes}
                    onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                    placeholder={isAgencyPartnerForm ? "e.g. Sourcing 3★/4★ hotels in Makkah, VIP bullet train bookings..." : "e.g. Wheelchair assistance, specific hotels..."}
                    rows={2}
                    className="w-full bg-[#120d08] border border-[var(--color-glass-border)] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[var(--color-gold)] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 mt-2 gold-button flex items-center justify-center text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  {isAgencyPartnerForm ? "Submit Agency Registration" : "Register Cost Plan"}
                </button>
              </form>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-950/40 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 font-bold text-lg">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {isAgencyPartnerForm ? "Registration Received!" : "Plan Submitted Successfully!"}
                  </h4>
                  <p className="text-[10px] text-[#b39a7d] mt-2 leading-relaxed">
                    {isAgencyPartnerForm 
                      ? "Your application for Agency Partnership has been securely registered. Our operations team will review your credentials and contact you on WhatsApp/Email within 24 hours to set up your profile."
                      : "Your estimated Umrah cost plan has been successfully submitted to our database registry. When licensed Hajj & Umrah travel partners register on our network, they will message you custom quotes directly on WhatsApp."}
                  </p>
                </div>
                <button
                  onClick={() => { setShowInquiryModal(false); playBeep(800, 0.05); }}
                  className="w-full py-2.5 bg-[#120d08] hover:bg-[#1c140c] border border-[#33261a] hover:border-[var(--color-gold)] text-[10px] font-bold text-white rounded-xl uppercase tracking-wider transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
