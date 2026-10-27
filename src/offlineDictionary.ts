import { Definition } from './types';

export interface OfflineEntry {
  word: string;
  language: string; // iso-639-1
  translation: string;
  definitions: Definition[];
  synonyms?: string[];
  antonyms?: string[];
  example?: string;
  pronunciation?: string;
}

// A compact offline seed so the app works without internet; users can extend it via caching.
export const offlineDictionary: OfflineEntry[] = [
  {
    word: 'book',
    language: 'en',
    translation: 'کتاب',
    pronunciation: 'book',
    definitions: [
      {
        meaning: 'A written or printed work consisting of pages glued or sewn together.',
        partOfSpeech: 'noun',
        examples: ['She picked up a book on Urdu poetry.'],
        synonyms: ['volume', 'tome'],
      },
      {
        meaning: 'To reserve accommodations, tickets, etc.',
        partOfSpeech: 'verb',
        examples: ['Please book two seats for tonight.'],
      },
    ],
    synonyms: ['volume', 'text'],
    antonyms: ['erase'],
    example: 'This book explains basic Urdu grammar.',
  },
  {
    word: 'water',
    language: 'en',
    translation: 'پانی',
    pronunciation: 'waa-ter',
    definitions: [
      {
        meaning: 'A transparent, tasteless liquid essential for life.',
        partOfSpeech: 'noun',
        examples: ['Drink more water during summer.'],
        synonyms: ['H₂O'],
      },
    ],
    example: 'Cold water is refreshing.',
  },
  {
    word: 'education',
    language: 'en',
    translation: 'تعلیم',
    pronunciation: 'ej-oo-kay-shun',
    definitions: [
      {
        meaning: 'The process of receiving or giving systematic instruction.',
        partOfSpeech: 'noun',
        examples: ['Education empowers communities.'],
        synonyms: ['learning', 'schooling'],
      },
    ],
    antonyms: ['ignorance'],
  },
  {
    word: 'dream',
    language: 'en',
    translation: 'خواب',
    definitions: [
      {
        meaning: 'A series of thoughts or images during sleep.',
        partOfSpeech: 'noun',
        examples: ['I had a beautiful dream last night.'],
      },
      {
        meaning: 'To experience dreams during sleep.',
        partOfSpeech: 'verb',
        examples: ['Children often dream vividly.'],
      },
    ],
  },
  {
    word: 'hope',
    language: 'en',
    translation: 'امید',
    definitions: [
      {
        meaning: 'A feeling of expectation and desire for a certain thing to happen.',
        partOfSpeech: 'noun',
        examples: ['Hope keeps us moving forward.'],
      },
      {
        meaning: 'To want something to happen and think it is possible.',
        partOfSpeech: 'verb',
        examples: ['We hope for the best.'],
      },
    ],
  },
  {
    word: 'محبت',
    language: 'ur',
    translation: 'love',
    definitions: [
      {
        meaning: 'کسی کے لئے گہرا جذبہ، انسیت اور خیرخواہی کا احساس',
        partOfSpeech: 'اسم',
        examples: ['ماں کی محبت بے مثال ہوتی ہے۔'],
      },
    ],
    synonyms: ['عشق', 'الفت'],
  },
  {
    word: 'سلام',
    language: 'ur',
    translation: 'peace / greeting',
    definitions: [
      {
        meaning: 'امن اور خیرسگالی کی دعا یا سلام',
        partOfSpeech: 'اسم',
        examples: ['میں نے استاد کو سلام کیا۔'],
      },
    ],
  },
  {
    word: 'دوستی',
    language: 'ur',
    translation: 'friendship',
    definitions: [
      {
        meaning: 'دو افراد یا گروہوں کے درمیان محبت اور بھروسے کا تعلق',
        partOfSpeech: 'اسم',
        examples: ['سچی دوستی ہر مشکل میں ساتھ دیتی ہے۔'],
      },
    ],
    synonyms: ['یارانہ', 'رفاقت'],
  },
  {
    word: 'learn',
    language: 'en',
    translation: 'سیکھنا',
    definitions: [
      {
        meaning: 'Gain or acquire knowledge of or skill in something.',
        partOfSpeech: 'verb',
        examples: ['You can learn Urdu quickly with practice.'],
      },
    ],
  },
  {
    word: 'language',
    language: 'en',
    translation: 'زبان',
    definitions: [
      {
        meaning: 'The method of human communication, spoken or written.',
        partOfSpeech: 'noun',
        examples: ['Urdu is a beautiful language.'],
      },
    ],
  },
];
