export type Provider = 'offline' | 'online' | 'cache';

export type AiMode =
  | 'explain'
  | 'grammar'
  | 'rephrase'
  | 'formal'
  | 'casual'
  | 'clarify';

export interface Definition {
  meaning: string;
  partOfSpeech?: string;
  examples?: string[];
  synonyms?: string[];
  antonyms?: string[];
  pronunciation?: string;
  source?: Provider | 'ai';
}

export interface DictionaryEntry {
  id: string;
  query: string;
  sourceLanguage: string;
  targetLanguage: string;
  translation?: string;
  definitions: Definition[];
  pronunciations?: string[];
  createdAt: string;
  provider: Provider;
}

export interface SearchRequest {
  query: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

export interface SearchResult {
  entry: DictionaryEntry;
  fromCache: boolean;
  offlineHit: boolean;
  suggestions?: string[];
}

export interface AiRequest {
  text: string;
  mode: AiMode;
  language?: string;
}

export interface AiResponse {
  text: string;
  mode: AiMode;
  provider: 'gemini' | 'local';
}

export interface Note {
  word: string;
  content: string;
  updatedAt: string;
}

export interface Favorite {
  word: string;
  translation?: string;
  addedAt: string;
}

export interface HistoryItem {
  query: string;
  when: string;
}

export interface WordOfDay {
  word: string;
  meaning: string;
  example?: string;
}
