import './index.css';
import { AiMode, Favorite, HistoryItem, SearchResult } from './types';

type SpeechRecognitionType = (typeof window)['SpeechRecognition'] | (typeof window)['webkitSpeechRecognition'] | null;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector(selector) as T;
const $$ = <T extends HTMLElement>(selector: string) =>
  Array.from(document.querySelectorAll(selector)) as T[];

const state = {
  activeRoute: 'search',
  lastResult: null as SearchResult | null,
  favorites: [] as Favorite[],
  history: [] as HistoryItem[],
  settings: { theme: 'system' as 'light' | 'dark' | 'system', targetLanguage: 'ur' as 'ur' | 'en' },
  recognition: null as SpeechRecognitionType,
  debounceTimer: 0 as unknown as number,
};

const navItems = $$('.nav__item');
const pages = $$('.page');
const statusLabel = $('#status');
const collapseBtn = $('#collapse-btn');
const sidebar = $('.sidebar');

const searchForm = $('#search-form') as HTMLFormElement;
const queryInput = $('#query') as HTMLInputElement;
const sourceSelect = $('#source-lang') as HTMLSelectElement;
const targetSelect = $('#target-lang') as HTMLSelectElement;
const resultContainer = $('#result');
const resultCard = $('#result-card');
const aiButtons = $$('#ai-actions .pill') as HTMLButtonElement[];
const noteBox = $('#notes') as HTMLTextAreaElement;
const saveNoteBtn = $('#save-note');
const noteStatus = $('#note-status');
const ttsBtn = $('#tts-btn');
const micBtn = $('#mic-btn');
const ocrBtn = $('#ocr-btn');
const ocrInput = $('#ocr-input') as HTMLInputElement;
const themeToggle = $('#theme-toggle');
const profileChip = $('#profile-chip');

const favoritesGrid = $('#favorites-grid');
const favoritesSearch = $('#favorites-search') as HTMLInputElement;
const favoritesSort = $('#favorites-sort') as HTMLSelectElement;
const historyGroups = $('#history-groups');
const wotdWord = $('#wotd-word');
const wotdMeaning = $('#wotd-meaning');
const wotdExample = $('#wotd-example');
const wotdDate = $('#wotd-date');
const clearHistoryBtn = $('#clear-history');

const profileNameInput = $('#profile-name') as HTMLInputElement;
const profileModeSelect = $('#profile-mode') as HTMLSelectElement;
const profileSaveBtn = $('#profile-save');
const profileStats = $('#profile-stats');

const settingsTheme = $('#settings-theme') as HTMLSelectElement;
const settingsTarget = $('#settings-target') as HTMLSelectElement;

const aiStudioText = $('#ai-text') as HTMLTextAreaElement;
const aiStudioActions = $('#ai-studio-actions');
const aiOutput = $('#ai-output');

const setStatus = (msg: string) => {
  if (statusLabel) statusLabel.textContent = msg;
};

const applyTheme = (theme: 'light' | 'dark' | 'system') => {
  state.settings.theme = theme;
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  document.documentElement.dataset.theme = resolved;
};

const routeTo = (route: string) => {
  state.activeRoute = route;
  pages.forEach((p) => {
    const active = p.dataset.route === route;
    p.hidden = !active;
  });
  navItems.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.route === route));
};

const debounce = (fn: () => void, delay = 260) => {
  window.clearTimeout(state.debounceTimer);
  state.debounceTimer = window.setTimeout(fn, delay);
};

const groupHistory = (items: HistoryItem[]) => {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: Record<string, HistoryItem[]> = { Today: [], Yesterday: [], Older: [] };
  items.forEach((item) => {
    const label = new Date(item.when).toDateString();
    if (label === today) groups.Today.push(item);
    else if (label === yesterday) groups.Yesterday.push(item);
    else groups.Older.push(item);
  });
  return groups;
};

const renderHistory = async () => {
  const history = await window.lughat.history.get();
  state.history = history;
  const groups = groupHistory(history);
  historyGroups.innerHTML = Object.entries(groups)
    .filter(([, list]) => list.length)
    .map(
      ([label, list]) => `
        <div class="history-group">
          <h4>${label}</h4>
          ${list
            .map(
              (item) => `
                <div class="history-item" data-history="${item.query}">
                  <span>${item.query}</span>
                  <small class="muted">${new Date(item.when).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}</small>
                </div>
              `,
            )
            .join('')}
        </div>
      `,
    )
    .join('');
};

const renderFavorites = async () => {
  const favorites = await window.lughat.favorites.get();
  const query = favoritesSearch.value.toLowerCase();
  const sorted = [...favorites].sort((a, b) => {
    if (favoritesSort.value === 'az') return a.word.localeCompare(b.word);
    return b.addedAt.localeCompare(a.addedAt);
  });
  state.favorites = sorted;
  const filtered = sorted.filter((f) => f.word.toLowerCase().includes(query));
  favoritesGrid.innerHTML = filtered
    .map(
      (fav) => `
        <div class="favorite-card" data-fav="${fav.word}">
          <header>
            <strong>${fav.word}</strong>
            <button class="ghost" data-remove="${fav.word}">Remove</button>
          </header>
          <p class="urdu">${fav.translation || ''}</p>
          <small class="muted">Saved ${new Date(fav.addedAt).toLocaleDateString()}</small>
        </div>
      `,
    )
    .join('');
};

const renderResultCard = (result: SearchResult) => {
  state.lastResult = result;
  const { entry, offlineHit, fromCache } = result;

  const pronunciation = entry.pronunciations?.length
    ? `<div class="muted">${entry.pronunciations.join(', ')}</div>`
    : '';

  const definitions = entry.definitions
    .map((def, idx) => {
      const synonyms = def.synonyms?.length
        ? `<div class="synonyms"><strong>Synonyms:</strong> ${def.synonyms.join(', ')}</div>`
        : '';
      const antonyms = def.antonyms?.length
        ? `<div class="antonyms"><strong>Antonyms:</strong> ${def.antonyms.join(', ')}</div>`
        : '';
      const examples = def.examples?.length
        ? `<div class="examples">${def.examples.map((e) => `<span class="urdu-small">${e}</span>`).join(' • ')}</div>`
        : '';
      return `
        <div class="meaning-card" aria-label="definition-${idx}">
          <div class="word-heading">
            <div class="badge-row">
              ${def.partOfSpeech ? `<span class="badge">${def.partOfSpeech}</span>` : ''}
              ${def.source ? `<span class="badge">${def.source}</span>` : ''}
            </div>
            <button class="ghost" data-copy="${encodeURIComponent(def.meaning)}">Copy</button>
          </div>
          <div class="definition">${def.meaning}</div>
          ${synonyms}
          ${antonyms}
          ${examples}
        </div>
      `;
    })
    .join('');

  resultContainer.innerHTML = `
    <div class="result-card">
      <div class="word-heading">
        <div>
          <p class="eyebrow">${entry.sourceLanguage.toUpperCase()} → ${entry.targetLanguage.toUpperCase()}</p>
          <h2 class="word-title">${entry.query}</h2>
          <p class="urdu">${entry.translation || ''}</p>
          ${pronunciation}
        </div>
        <div class="badge-row">
          ${offlineHit ? '<span class="badge">Offline</span>' : ''}
          ${fromCache ? '<span class="badge">Cached</span>' : ''}
          <button id="favorite-btn" class="ghost">★ Favorite</button>
        </div>
      </div>
      ${definitions}
      <div class="pill-row" style="margin-top:8px;">
        <button class="pill" id="pronounce-btn">Hear</button>
        <button class="pill" id="copy-btn">Copy translation</button>
        <button class="pill" id="ai-explain">Explain Simply</button>
      </div>
    </div>
  `;

  const favBtn = $('#favorite-btn');
  favBtn?.addEventListener('click', async () => {
    await window.lughat.favorites.toggle(entry.query, entry.translation);
    await renderFavorites();
  });

  $('#copy-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(entry.translation || entry.query);
    setStatus('Copied to clipboard');
  });

  $('#pronounce-btn')?.addEventListener('click', () => {
    const utterance = new SpeechSynthesisUtterance(entry.translation || entry.query);
    utterance.lang = entry.targetLanguage || 'ur';
    speechSynthesis.speak(utterance);
  });

  $('#ai-explain')?.addEventListener('click', async () => {
    await runAi('explain');
  });
};

const loadNotes = async () => {
  if (!state.lastResult) return;
  const notes = await window.lughat.notes.get();
  noteBox.value = notes[state.lastResult.entry.query]?.content || '';
};

const handleSearch = async (query: string) => {
  if (!query.trim()) return;
  setStatus('Searching…');
  resultContainer.innerHTML = '';
  try {
    const res = await window.lughat.search({
      query,
      sourceLanguage: sourceSelect.value,
      targetLanguage: targetSelect.value,
    });
    renderResultCard(res);
    await loadNotes();
    await renderHistory();
    setStatus(res.offlineHit ? 'Offline result' : res.fromCache ? 'Cached result' : 'Online result');
  } catch (err) {
    console.error(err);
    setStatus('Search failed');
  }
};

const runAi = async (mode: AiMode) => {
  const text = noteBox.value || state.lastResult?.entry.translation || state.lastResult?.entry.query;
  if (!text) return;
  const btn = aiButtons.find((b) => b.dataset.aiMode === mode);
  if (btn) btn.disabled = true;
  setStatus('AI thinking…');
  try {
    const res = await window.lughat.enhance({ text, mode, language: 'ur' });
    noteBox.value = res.text;
    setStatus(`AI (${res.provider}) ready`);
  } finally {
    if (btn) btn.disabled = false;
  }
};

const wireNav = () => {
  navItems.forEach((btn) =>
    btn.addEventListener('click', () => {
      routeTo(btn.dataset.route || 'search');
    }),
  );
};

const wireSearchForm = () => {
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSearch(queryInput.value);
  });

  queryInput.addEventListener('input', () => debounce(() => handleSearch(queryInput.value)));

  targetSelect.addEventListener('change', async () => {
    document.body.dir = targetSelect.value === 'ur' ? 'rtl' : 'ltr';
    await window.lughat.settings.setTarget(targetSelect.value as 'ur' | 'en');
  });
};

const wireFavorites = () => {
  favoritesGrid.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset.remove) {
      await window.lughat.favorites.toggle(target.dataset.remove);
      await renderFavorites();
    }
    const card = (e.target as HTMLElement).closest('[data-fav]') as HTMLElement | null;
    if (card?.dataset.fav) {
      queryInput.value = card.dataset.fav;
      routeTo('search');
      handleSearch(card.dataset.fav);
    }
  });

  favoritesSearch.addEventListener('input', () => renderFavorites());
  favoritesSort.addEventListener('change', () => renderFavorites());
};

const wireHistory = () => {
  historyGroups.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('.history-item') as HTMLElement | null;
    if (item?.dataset.history) {
      queryInput.value = item.dataset.history;
      routeTo('search');
      handleSearch(item.dataset.history);
    }
  });

  clearHistoryBtn.addEventListener('click', async () => {
    await window.lughat.history.clear();
    await renderHistory();
  });
};

const wireNotes = () => {
  saveNoteBtn.addEventListener('click', async () => {
    if (!state.lastResult) return;
    await window.lughat.notes.save({
      word: state.lastResult.entry.query,
      content: noteBox.value,
      updatedAt: new Date().toISOString(),
    });
    noteStatus.textContent = 'Saved';
    setTimeout(() => (noteStatus.textContent = ''), 1500);
  });
};

const wireAi = () => {
  aiButtons.forEach((btn) =>
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.aiMode as AiMode;
      await runAi(mode);
    }),
  );

  ['explain', 'clarify', 'grammar', 'rephrase', 'formal', 'casual'].forEach((mode) => {
    const pill = document.createElement('button');
    pill.className = 'pill';
    pill.dataset.aiMode = mode;
    pill.textContent = mode;
    pill.addEventListener('click', async () => {
      const res = await window.lughat.enhance({ text: aiStudioText.value, mode: mode as AiMode });
      aiOutput.textContent = res.text;
    });
    aiStudioActions.appendChild(pill);
  });
};

const wireTheme = () => {
  themeToggle.addEventListener('click', async () => {
    const next = state.settings.theme === 'light' ? 'dark' : state.settings.theme === 'dark' ? 'system' : 'light';
    applyTheme(next);
    await window.lughat.settings.setTheme(next);
    settingsTheme.value = next;
  });

  settingsTheme.addEventListener('change', async () => {
    applyTheme(settingsTheme.value as 'light' | 'dark' | 'system');
    await window.lughat.settings.setTheme(settingsTheme.value as 'light' | 'dark' | 'system');
  });

  settingsTarget.addEventListener('change', async () => {
    targetSelect.value = settingsTarget.value;
    await window.lughat.settings.setTarget(settingsTarget.value as 'ur' | 'en');
  });
};

const wireProfile = () => {
  profileSaveBtn.addEventListener('click', async () => {
    const name = profileNameInput.value.trim() || 'Guest';
    const mode = profileModeSelect.value as 'guest' | 'local';
    await window.lughat.settings.setProfile({ mode, displayName: name });
    profileChip.querySelector('.chip-label')!.textContent = name;
    profileChip.querySelector('.muted')!.textContent = mode === 'guest' ? 'Local profile' : 'Sync-ready';
    setStatus('Profile saved');
  });
};

const wireVoiceAndOcr = () => {
  micBtn.addEventListener('click', () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setStatus('Speech recognition not supported');
      return;
    }
    if (!state.recognition) {
      state.recognition = new SpeechRec();
      state.recognition.lang = targetSelect.value === 'ur' ? 'ur-PK' : 'en-US';
      state.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        queryInput.value = transcript;
        handleSearch(transcript);
      };
      state.recognition.onerror = () => setStatus('Speech input error');
    }
    state.recognition.start();
    setStatus('Listening…');
  });

  ttsBtn.addEventListener('click', () => {
    if (!state.lastResult) return;
    const utterance = new SpeechSynthesisUtterance(
      state.lastResult.entry.translation || state.lastResult.entry.query,
    );
    utterance.lang = state.lastResult.entry.targetLanguage || 'ur';
    speechSynthesis.speak(utterance);
  });

  ocrBtn.addEventListener('click', () => ocrInput.click());
  ocrInput.addEventListener('change', async () => {
    const file = ocrInput.files?.[0];
    if (!file) return;
    ocrBtn.textContent = 'Scanning…';
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const { data } = await worker.recognize(await file.arrayBuffer());
      await worker.terminate();
      queryInput.value = data.text.trim();
      handleSearch(queryInput.value);
      setStatus('OCR complete');
    } catch (err) {
      console.error(err);
      setStatus('OCR failed');
    } finally {
      ocrBtn.textContent = '📷';
    }
  });
};

const loadWordOfDay = async () => {
  const w = await window.lughat.wordOfDay();
  wotdWord.textContent = w.word;
  wotdMeaning.textContent = w.meaning;
  wotdExample.textContent = w.example || '';
  wotdDate.textContent = new Date().toLocaleDateString();
};

const hydrateProfile = async () => {
  const settings = await window.lughat.settings.get();
  state.settings.theme = settings.theme;
  state.settings.targetLanguage = settings.targetLanguage || 'ur';
  applyTheme(settings.theme);
  profileNameInput.value = settings.profile?.displayName || 'Guest';
  profileModeSelect.value = settings.profile?.mode || 'guest';
  settingsTheme.value = settings.theme;
  settingsTarget.value = settings.targetLanguage;
  targetSelect.value = settings.targetLanguage;
  profileChip.querySelector('.chip-label')!.textContent = settings.profile?.displayName || 'Guest';
};

const hydrateStats = () => {
  profileStats.textContent = `${state.favorites.length} favorites • ${state.history.length} history entries`;
};

const bootstrap = async () => {
  wireNav();
  wireSearchForm();
  wireFavorites();
  wireHistory();
  wireNotes();
  wireAi();
  wireTheme();
  wireProfile();
  wireVoiceAndOcr();

  await hydrateProfile();
  await renderFavorites();
  await renderHistory();
  await loadWordOfDay();
  hydrateStats();
  document.body.dir = targetSelect.value === 'ur' ? 'rtl' : 'ltr';
  setStatus('Ready to search');
};

bootstrap();
