import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  shell,
  session,
} from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import Store from 'electron-store';
import { nanoid } from 'nanoid';
import Iso6391 from 'iso-639-1';
import { franc } from 'franc-min';
import { offlineDictionary } from './offlineDictionary';
import {
  AiRequest,
  AiResponse,
  DictionaryEntry,
  Favorite,
  HistoryItem,
  Note,
  SearchRequest,
  SearchResult,
  WordOfDay,
} from './types';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const isDev = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const LIBRE_TRANSLATE_URL =
  process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.de/translate';

type StoreSchema = {
  favorites: Favorite[];
  history: HistoryItem[];
  notes: Record<string, Note>;
  cache: Record<string, DictionaryEntry>;
  settings: {
    theme: 'light' | 'dark' | 'system';
    targetLanguage: 'ur' | 'en';
    profile: { mode: 'guest' | 'local'; displayName: string };
  };
};

const store = new Store<StoreSchema>({
  name: 'lughati-ai',
  defaults: {
    favorites: [],
    history: [],
    notes: {},
    cache: {},
    settings: {
      theme: 'system',
      targetLanguage: 'ur',
      profile: { mode: 'guest', displayName: 'Guest' },
    },
  },
});

const iso3ToIso1: Record<string, string> = {
  urd: 'ur',
  eng: 'en',
  ara: 'ar',
  spa: 'es',
  fra: 'fr',
  deu: 'de',
  hin: 'hi',
};

const detectLanguage = (text: string): string => {
  const candidate = franc(text || '').toLowerCase();
  if (candidate === 'und') return 'auto';
  if (iso3ToIso1[candidate]) return iso3ToIso1[candidate];
  const iso1 = Iso6391.getAllCodes().includes(candidate) ? candidate : '';
  return iso1 || 'auto';
};

const buildWindow = () => {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f172a' : '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      devTools: isDev,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
};

const ensureCsp = () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:* https://api.dictionaryapi.dev https://libretranslate.de https://api.mymemory.translated.net https://generativelanguage.googleapis.com;",
        ],
      },
    });
  });
};

const cacheResult = (key: string, entry: DictionaryEntry) => {
  const cache = store.get('cache');
  cache[key] = entry;
  store.set('cache', cache);
};

const addHistory = (query: string) => {
  const history = store.get('history');
  const existingIndex = history.findIndex((h) => h.query.toLowerCase() === query.toLowerCase());
  const entry = { query, when: new Date().toISOString() } as HistoryItem;
  if (existingIndex >= 0) {
    history.splice(existingIndex, 1);
  }
  history.unshift(entry);
  store.set('history', history.slice(0, 100));
};

const lookupOffline = (
  query: string,
  sourceLanguage: string,
  targetLanguage: string,
): DictionaryEntry | null => {
  const normalized = query.trim().toLowerCase();
  const match = offlineDictionary.find(
    (entry) => entry.word.toLowerCase() === normalized && entry.language === sourceLanguage,
  );

  if (!match) return null;

  return {
    id: nanoid(),
    query,
    sourceLanguage,
    targetLanguage,
    translation: targetLanguage === match.language ? match.word : match.translation,
    definitions: match.definitions.map((d) => ({ ...d, source: 'offline' })),
    pronunciations: match.pronunciation ? [match.pronunciation] : [],
    createdAt: new Date().toISOString(),
    provider: 'offline',
  };
};

const fetchOnlineMeaning = async (
  query: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<DictionaryEntry | null> => {
  const dictionaryApiUrl = `https://api.dictionaryapi.dev/api/v2/entries/${sourceLanguage}/${encodeURIComponent(
    query,
  )}`;

  let definitions = [] as DictionaryEntry['definitions'];
  let translation = '';
  let pronunciations: string[] = [];

  try {
    const res = await fetch(dictionaryApiUrl);
    if (res.ok) {
      const body = (await res.json()) as any[];
      const first = body?.[0];
      if (first?.meanings) {
        definitions = first.meanings.flatMap((meaning: any) =>
          (meaning.definitions || []).map((def: any) => ({
            meaning: def.definition,
            partOfSpeech: meaning.partOfSpeech,
            examples: def.example ? [def.example] : [],
            synonyms: def.synonyms,
            antonyms: def.antonyms,
            source: 'online' as const,
          })),
        );
      }
      pronunciations = (first?.phonetics || [])
        .map((p: any) => p.text)
        .filter(Boolean);
    }
  } catch (err) {
    console.warn('dictionary api failed', err);
  }

  translation = await translateText(query, sourceLanguage, targetLanguage);

  if (!definitions.length && !translation) return null;

  return {
    id: nanoid(),
    query,
    sourceLanguage,
    targetLanguage,
    translation,
    definitions,
    pronunciations,
    createdAt: new Date().toISOString(),
    provider: 'online',
  };
};

const translateText = async (
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string> => {
  if (!text.trim()) return '';

  // LibreTranslate first
  try {
    const response = await fetch(LIBRE_TRANSLATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: sourceLanguage === 'auto' ? 'auto' : sourceLanguage,
        target: targetLanguage,
        format: 'text',
      }),
    });
    if (response.ok) {
      const data = (await response.json()) as { translatedText?: string };
      if (data.translatedText) return data.translatedText;
    }
  } catch (err) {
    console.warn('LibreTranslate failed', err);
  }

  // MyMemory fallback (rate-limited but free)
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        text,
      )}&langpair=${sourceLanguage}|${targetLanguage}`,
    );
    if (res.ok) {
      const data = (await res.json()) as any;
      const alt = data?.responseData?.translatedText;
      if (alt) return alt;
    }
  } catch (err) {
    console.warn('MyMemory failed', err);
  }

  return '';
};

const searchDictionary = async (
  payload: SearchRequest,
): Promise<SearchResult> => {
  const query = payload.query.trim();
  const detected = payload.sourceLanguage || detectLanguage(query) || 'auto';
  const sourceLanguage = detected === 'auto' ? 'en' : detected;
  const targetLanguage = payload.targetLanguage || (sourceLanguage === 'ur' ? 'en' : 'ur');

  const cacheKey = `${sourceLanguage}:${targetLanguage}:${query.toLowerCase()}`;
  const cached = store.get('cache')[cacheKey];
  if (cached) {
    addHistory(query);
    return { entry: cached, fromCache: true, offlineHit: cached.provider === 'offline' };
  }

  const offlineHit = lookupOffline(query, sourceLanguage, targetLanguage);
  if (offlineHit) {
    cacheResult(cacheKey, offlineHit);
    addHistory(query);
    return { entry: offlineHit, fromCache: false, offlineHit: true };
  }

  const online = await fetchOnlineMeaning(query, sourceLanguage, targetLanguage);
  if (online) {
    cacheResult(cacheKey, online);
    addHistory(query);
    return { entry: online, fromCache: false, offlineHit: false };
  }

  return {
    entry: {
      id: nanoid(),
      query,
      sourceLanguage,
      targetLanguage,
      definitions: [
        {
          meaning: 'معذرت، فی الحال اس لفظ کی تعریف دستیاب نہیں ہے۔',
          partOfSpeech: 'info',
          source: 'offline',
        },
      ],
      createdAt: new Date().toISOString(),
      provider: 'offline',
    },
    fromCache: false,
    offlineHit: false,
    suggestions: ['Check spelling', 'Try another language'],
  };
};

const performAi = async (payload: AiRequest): Promise<AiResponse> => {
  const { text, mode, language } = payload;
  const prompt = `You are an Urdu-first language assistant. Mode: ${mode}. Language hint: ${
    language || 'ur'
  }. Text: ${text}`;

  if (!GEMINI_API_KEY) {
    // Fallback: simple heuristics
    const prepend = {
      explain: 'سادہ الفاظ میں:',
      grammar: 'گرامر کی درستی:',
      rephrase: 'متبادل انداز:',
      formal: 'باوقار انداز:',
      casual: 'غیر رسمی انداز:',
      clarify: 'وضاحت:',
    }[mode];
    return {
      text: `${prepend} ${text}`,
      mode,
      provider: 'local',
    };
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );

    if (!res.ok) throw new Error(`Gemini error ${res.status}`);
    const data = (await res.json()) as any;
    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return { text: textOut || text, mode, provider: 'gemini' };
  } catch (err) {
    console.warn('Gemini call failed', err);
    return { text: text, mode, provider: 'local' };
  }
};

const wordOfDay = (): WordOfDay => {
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 0);
  const diff = today.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  const pick = offlineDictionary[day % offlineDictionary.length];
  return {
    word: pick.word,
    meaning: pick.definitions[0]?.meaning || pick.translation,
    example: pick.example,
  };
};

const registerIpc = () => {
  ipcMain.handle('search:lookup', async (_event, payload: SearchRequest) =>
    searchDictionary(payload),
  );

  ipcMain.handle('ai:enhance', async (_event, payload: AiRequest) =>
    performAi(payload),
  );

  ipcMain.handle('favorites:get', () => store.get('favorites'));

  ipcMain.handle('favorites:toggle', (_event, word: string, translation?: string) => {
    const favorites = store.get('favorites');
    const existing = favorites.findIndex((f) => f.word === word);
    if (existing >= 0) {
      favorites.splice(existing, 1);
    } else {
      favorites.unshift({ word, translation, addedAt: new Date().toISOString() });
    }
    store.set('favorites', favorites);
    return favorites;
  });

  ipcMain.handle('history:get', () => store.get('history'));
  ipcMain.handle('history:clear', () => {
    store.set('history', []);
    return [];
  });

  ipcMain.handle('notes:get', () => store.get('notes'));
  ipcMain.handle('notes:save', (_event, note: Note) => {
    const notes = store.get('notes');
    notes[note.word] = note;
    store.set('notes', notes);
    return notes[note.word];
  });

  ipcMain.handle('settings:get', () => store.get('settings'));
  ipcMain.handle('settings:setTheme', (_event, theme: 'light' | 'dark' | 'system') => {
    const settings = store.get('settings');
    settings.theme = theme;
    store.set('settings', settings);
    return settings;
  });

  ipcMain.handle('settings:setTarget', (_event, target: 'ur' | 'en') => {
    const settings = store.get('settings');
    settings.targetLanguage = target;
    store.set('settings', settings);
    return settings;
  });

  ipcMain.handle(
    'settings:setProfile',
    (_event, profile: { mode: 'guest' | 'local'; displayName: string }) => {
      const settings = store.get('settings');
      settings.profile = profile;
      store.set('settings', settings);
      return settings;
    },
  );

  ipcMain.handle('wotd:get', () => wordOfDay());
};

app.whenReady().then(() => {
  app.setAppUserModelId('com.lughatai.app');
  ensureCsp();
  registerIpc();
  buildWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      buildWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
