export interface DailyVerse {
  surah: number;
  verse: number;
  arabic: string;
  english: string;
  context: string;
}

export const dailyVerses: DailyVerse[] = [
  {
    surah: 2,
    verse: 152,
    arabic: "فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ",
    english: "So remember Me; I will remember you. And be grateful to Me and do not deny Me.",
    context: "Surah Al-Baqarah (2:152) - A reminder of the power of remembrance (Dhikr) and gratitude."
  },
  {
    surah: 2,
    verse: 186,
    arabic: "وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ",
    english: "And when My servants ask you, [O Muhammad], concerning Me - indeed I am near. I respond to the invocation of the supplicant when he calls upon Me.",
    context: "Surah Al-Baqarah (2:186) - The ultimate promise of Allah's closeness and response to our Duas."
  },
  {
    surah: 2,
    verse: 286,
    arabic: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
    english: "Allah does not charge a soul except [with that within] its capacity.",
    context: "Surah Al-Baqarah (2:286) - Comfort in times of difficulty, knowing Allah never gives us burdens we cannot bear."
  },
  {
    surah: 3,
    verse: 139,
    arabic: "وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنتُمُ الْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ",
    english: "So do not weaken and do not grieve, and you will be superior if you are [true] believers.",
    context: "Surah Ali 'Imran (3:139) - Encouragement to keep hope and maintain faith during trials."
  },
  {
    surah: 3,
    verse: 159,
    arabic: "فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللَّهِ ۚ إِنَّ اللَّهَ يُحِبُّ الْمُتَوَكِّلِينَ",
    english: "And when you have decided, then rely upon Allah. Indeed, Allah loves those who rely [upon Him].",
    context: "Surah Ali 'Imran (3:159) - The virtue of Tawakkul (reliance on Allah) after consultation and planning."
  },
  {
    surah: 9,
    verse: 129,
    arabic: "حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ ۖ عَلَيْهِ تَوَكَّلْتُ ۖ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ",
    english: "Sufficient for me is Allah; there is no deity except Him. On Him I have relied, and He is the Lord of the Great Throne.",
    context: "Surah At-Tawbah (9:129) - A powerful prayer of reliance and trust in Allah's protection."
  },
  {
    surah: 13,
    verse: 28,
    arabic: "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
    english: "Unquestionably, by the remembrance of Allah hearts find rest.",
    context: "Surah Ar-Ra'd (13:28) - The secret to true peace of mind and emotional tranquility."
  },
  {
    surah: 14,
    verse: 7,
    arabic: "لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ",
    english: "If you are grateful, I will surely increase you [in favor].",
    context: "Surah Ibrahim (14:7) - The divine law of abundance: gratitude unlocks more blessings."
  },
  {
    surah: 39,
    verse: 53,
    arabic: "قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ ۚ إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا",
    english: "Say, 'O My servants who have transgressed against themselves [by sinning], do not despair of the mercy of Allah. Indeed, Allah forgives all sins.'",
    context: "Surah Az-Zumar (39:53) - A beautiful calling to repentance, showing Allah's boundless mercy."
  },
  {
    surah: 94,
    verse: 6,
    arabic: "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
    english: "Indeed, with hardship [will be] ease.",
    context: "Surah Ash-Sharh (94:6) - A reminder that relief is paired with every trial."
  }
];

export function getDailyVerse(): DailyVerse {
  if (typeof window === "undefined") return dailyVerses[0];
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const index = dayOfYear % dailyVerses.length;
  return dailyVerses[index];
}
