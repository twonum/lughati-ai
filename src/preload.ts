import { contextBridge, ipcRenderer } from 'electron';
import {
	AiRequest,
	AiResponse,
	Favorite,
	HistoryItem,
	Note,
	SearchRequest,
	SearchResult,
	WordOfDay,
} from './types';

const api = {
	search: (payload: SearchRequest): Promise<SearchResult> =>
		ipcRenderer.invoke('search:lookup', payload),
	enhance: (payload: AiRequest): Promise<AiResponse> =>
		ipcRenderer.invoke('ai:enhance', payload),
	favorites: {
		get: (): Promise<Favorite[]> => ipcRenderer.invoke('favorites:get'),
		toggle: (word: string, translation?: string): Promise<Favorite[]> =>
			ipcRenderer.invoke('favorites:toggle', word, translation),
	},
	history: {
		get: (): Promise<HistoryItem[]> => ipcRenderer.invoke('history:get'),
		clear: (): Promise<HistoryItem[]> => ipcRenderer.invoke('history:clear'),
	},
	notes: {
		get: (): Promise<Record<string, Note>> => ipcRenderer.invoke('notes:get'),
		save: (note: Note): Promise<Note> => ipcRenderer.invoke('notes:save', note),
	},
	settings: {
		get: (): Promise<{
			theme: 'light' | 'dark' | 'system';
			profile: { mode: 'guest' | 'local'; displayName: string };
			targetLanguage: 'ur' | 'en';
		}> => ipcRenderer.invoke('settings:get'),
		setTheme: (theme: 'light' | 'dark' | 'system') =>
			ipcRenderer.invoke('settings:setTheme', theme),
		setTarget: (target: 'ur' | 'en') =>
			ipcRenderer.invoke('settings:setTarget', target),
		setProfile: (profile: { mode: 'guest' | 'local'; displayName: string }) =>
			ipcRenderer.invoke('settings:setProfile', profile),
	},
	wordOfDay: (): Promise<WordOfDay> => ipcRenderer.invoke('wotd:get'),
};

contextBridge.exposeInMainWorld('lughat', api);

declare global {
	interface Window {
		lughat: typeof api;
	}
}
