export interface SurahIntro {
  index: number;
  period: string;
  summary: string;
  keyThemes: string[];
}

export const surahIntrosList: Record<number, SurahIntro> = {
  1: {
    index: 1,
    period: "Early Meccan",
    summary: "Known as 'Al-Fatihah' (The Opening), this Surah is the essence of the Holy Quran. It is repeated in every unit of prayer and constitutes a dialogue between the servant and Allah ﷻ, encompassing praise, worship, and a request for guidance.",
    keyThemes: ["Praise & gratitude to Allah", "The Master of the Day of Judgment", "Seeking guidance on the Straight Path"]
  },
  2: {
    index: 2,
    period: "Medinan",
    summary: "Surah Al-Baqarah (The Cow) is the longest Surah of the Quran. It details comprehensive guidance on legal frameworks, theology, stories of prophets (especially Prophet Moses and Prophet Abraham), and establishes guidelines for social and economic life in Islam.",
    keyThemes: ["Guidance for the God-conscious (Muttaqin)", "Story of Bani Israel (Children of Israel)", "Legal rulings (marriage, interest, charity)", "Ayat al-Kursi (The Verse of the Throne)"]
  },
  18: {
    index: 18,
    period: "Meccan",
    summary: "Surah Al-Kahf (The Cave) is read every Friday. It outlines four stories designed to test different aspects of faith: the People of the Cave (faith), the Owner of the Two Gardens (wealth), Moses and Khidr (knowledge), and Dhul-Qarnayn (power).",
    keyThemes: ["Trials of faith, wealth, knowledge, and power", "The arrival of Gog and Magog", "Protection from trials of the Dajjal (Antichrist)"]
  },
  36: {
    index: 36,
    period: "Meccan",
    summary: "Surah Ya-Sin is described as the 'Heart of the Quran'. It focuses on establishing the Quran as a divine source, warns of the fate of past generations that mocked the messengers, and contains beautiful arguments for resurrection and life after death.",
    keyThemes: ["Divine origins of the Quran", "The truth of the Resurrection", "Signs of nature testifying to Allah's sovereignty"]
  },
  55: {
    index: 55,
    period: "Medinan (some sources say Meccan)",
    summary: "Surah Ar-Rahman (The Most Merciful) is a poetic, rhythmic masterpiece that repeatedly asks the question: 'So which of the favors of your Lord will you deny?'. It details Allah's countless gifts on earth and describes Paradise and Hell.",
    keyThemes: ["The mercy and creation of Allah", "Gratitude for worldly and spiritual favors", "Vivid descriptions of Paradise (Jannah)"]
  },
  67: {
    index: 67,
    period: "Meccan",
    summary: "Surah Al-Mulk (The Dominion) is a source of protection for the believer in the grave. It calls on humanity to reflect on the perfect creation of the universe, the stars, and the skies as signs of the Creator's power.",
    keyThemes: ["Sovereignty and control of Allah", "The perfect design of the heavens", "The reality of accountability in the Hereafter"]
  }
};

export function getSurahIntro(index: number, englishName: string, englishMeaning: string, type: string, versesCount: number): SurahIntro {
  if (surahIntrosList[index]) {
    return surahIntrosList[index];
  }
  
  return {
    index,
    period: type === "Meccan" ? "Meccan Period" : "Medinan Period",
    summary: `Surah ${englishName} (${englishMeaning}) is a ${type} Surah consisting of ${versesCount} verses. It contains guidance on spiritual growth, moral principles, and historical narratives designed to strengthen faith and connect the reader to Allah.`,
    keyThemes: [
      `Sovereignty and oneness of Allah (Tawheed)`,
      `Reflecting on lessons from historical prophets`,
      `Developing righteousness (Taqwa) and good character`
    ]
  };
}
