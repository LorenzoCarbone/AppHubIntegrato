// --- SMART INPUT & PARSER NATURALE ---
// Giorni della settimana e Mesi in italiano per linguaggio naturale
const ITALIAN_WEEKDAYS = {
    'domenica': 0, 'dom': 0,
    'lunedi': 1, 'lunedì': 1, 'lun': 1,
    'martedi': 2, 'martedì': 2, 'mar': 2,
    'mercoledi': 3, 'mercoledì': 3, 'mer': 3,
    'giovedi': 4, 'giovedì': 4, 'gio': 4,
    'venerdi': 5, 'venerdì': 5, 'ven': 5,
    'sabato': 6, 'sab': 6
};

const ITALIAN_MONTHS = {
    'gennaio': 0, 'gen': 0,
    'febbraio': 1, 'feb': 1,
    'marzo': 2, 'mar': 2,
    'aprile': 3, 'apr': 3,
    'maggio': 4, 'mag': 4,
    'giugno': 5, 'giu': 5,
    'luglio': 6, 'lug': 6,
    'agosto': 7, 'ago': 7,
    'settembre': 8, 'set': 8, 'sett': 8,
    'ottobre': 9, 'ott': 9,
    'novembre': 10, 'nov': 10,
    'dicembre': 11, 'dic': 11
};

// Parser In-Text Tagging (Priorità p1-3, Date naturali @giorno/@mese/@anno, Contesto #nome)
function parseSmartInput(inputStr, defaultCtx) {
    let title = inputStr; 
    let priority = 0; 
    let date = ''; 
    let contextId = defaultCtx || '';
    
    // 1. Priorità: scorciatoia diretta p1, p2, p3 (o [[p1-3)
    const pMatches = [...title.matchAll(/(?:^|\s)(?:\[\[)?p([0-3])\]?(?=\s|$)/gi)];
    if (pMatches.length > 0) { 
        // Prende l'ultima specificata
        priority = parseInt(pMatches[pMatches.length - 1][1]);
        title = title.replace(/(?:^|\s)(?:\[\[)?p[0-3]\]?(?=\s|$)/gi, ' '); 
    }
    
    // 2. Data Naturale: @giorno, @mese, @anno, @oggi, @domani, etc.
    const dMatches = [...title.matchAll(/@([^\s]+)/g)];
    if (dMatches.length > 0) {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');

        for (let i = dMatches.length - 1; i >= 0; i--) {
            const dRaw = dMatches[i][1].toLowerCase();
            const dClean = dRaw.replace(/[.,;:]$/, '');
            let parsedDate = '';

            if (dClean === 'oggi' || dClean === 'stasera') {
                parsedDate = getISODate(now);
            } else if (dClean === 'domani') {
                const d = new Date(now);
                d.setDate(now.getDate() + 1);
                parsedDate = getISODate(d);
            } else if (dClean === 'dopodomani') {
                const d = new Date(now);
                d.setDate(now.getDate() + 2);
                parsedDate = getISODate(d);
            } else if (dClean === 'prossimasettimana' || dClean === 'settimanaprossima') {
                const curDay = now.getDay();
                let addDays = (1 - curDay + 7) % 7;
                if (addDays === 0) addDays = 7;
                const d = new Date(now);
                d.setDate(now.getDate() + addDays);
                parsedDate = getISODate(d);
            } else if (dClean === 'finemese') {
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                parsedDate = getISODate(lastDay);
            } else if (dClean === 'prossimomese' || dClean === 'meseprossimo') {
                const nextM = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                parsedDate = getISODate(nextM);
            } else if (dClean === 'prossimoanno' || dClean === 'annoprossimo') {
                parsedDate = `${now.getFullYear() + 1}-01-01`;
            } else if (ITALIAN_WEEKDAYS[dClean] !== undefined) {
                const targetDay = ITALIAN_WEEKDAYS[dClean];
                const currentDay = now.getDay();
                let daysToAdd = (targetDay - currentDay + 7) % 7;
                if (daysToAdd === 0) daysToAdd = 7;
                const d = new Date(now);
                d.setDate(now.getDate() + daysToAdd);
                parsedDate = getISODate(d);
            } else if (ITALIAN_MONTHS[dClean] !== undefined) {
                const targetMonth = ITALIAN_MONTHS[dClean];
                let targetYear = now.getFullYear();
                if (targetMonth < now.getMonth()) {
                    targetYear += 1;
                }
                parsedDate = `${targetYear}-${pad(targetMonth + 1)}-01`;
            } else if (/^20\d{2}$/.test(dClean)) {
                parsedDate = `${dClean}-01-01`;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(dClean)) {
                parsedDate = dClean;
            } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dClean)) {
                const p = dClean.split('/');
                parsedDate = `${p[2]}-${pad(p[1])}-${pad(p[0])}`;
            } else if (/^\d{1,2}\/\d{1,2}$/.test(dClean)) {
                const p = dClean.split('/');
                parsedDate = `${now.getFullYear()}-${pad(p[1])}-${pad(p[0])}`;
            }

            if (parsedDate) {
                date = parsedDate;
                break;
            }
        }
        title = title.replace(/@[^\s]+/g, ' ');
    }
    
    // 3. Contesto: #nome (supporta sfere, progetti e sottoprogetti; usa l'ultimo contesto digitato)
    const cMatches = [...title.matchAll(/#([^\s]+)/g)];
    if (cMatches.length > 0) {
        for (let i = cMatches.length - 1; i >= 0; i--) {
            const cTerm = cMatches[i][1].toLowerCase();
            const foundCtx = [...(state.data.spheres||[]), ...(state.data.projects||[]), ...(state.data.subprojects||[])].find(c => 
                c.name.toLowerCase().replace(/\s+/g, '').includes(cTerm.replace(/\s+/g, '')) || 
                c.name.toLowerCase().includes(cTerm)
            );
            if (foundCtx) {
                contextId = foundCtx.id;
                break;
            }
        }
        title = title.replace(/#[^\s]+/g, ' ');
    }
    return { title: title.trim().replace(/\s+/g, ' '), priority, date, contextId };
}

let activeAutocompleteIndex = 0;
let currentAutocompleteItems = [];

function updateAutocompleteVisual(feedbackEl) {
    if (!feedbackEl) return;
    const items = feedbackEl.querySelectorAll('.autocomplete-item');
    items.forEach((item, idx) => {
        if (idx === activeAutocompleteIndex) {
            item.classList.add('bg-blue-100', 'dark:bg-blue-900/60', 'text-blue-700', 'dark:text-blue-200', 'border-blue-300', 'dark:border-blue-600');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('bg-blue-100', 'dark:bg-blue-900/60', 'text-blue-700', 'dark:text-blue-200', 'border-blue-300', 'dark:border-blue-600');
        }
    });
}

function handleSmartInputKeyDown(e, inputEl) {
    const feedbackEl = inputEl.nextElementSibling;
    const isFeedbackOpen = feedbackEl && !feedbackEl.classList.contains('hidden');
    const items = isFeedbackOpen ? feedbackEl.querySelectorAll('.autocomplete-item') : [];
    const hasItems = items.length > 0 && currentAutocompleteItems && currentAutocompleteItems.length > 0;

    if (e.key === 'ArrowDown') {
        if (!hasItems) return true;
        e.preventDefault();
        e.stopPropagation();
        activeAutocompleteIndex = (activeAutocompleteIndex + 1) % currentAutocompleteItems.length;
        updateAutocompleteVisual(feedbackEl);
        return false;
    } else if (e.key === 'ArrowUp') {
        if (!hasItems) return true;
        e.preventDefault();
        e.stopPropagation();
        activeAutocompleteIndex = (activeAutocompleteIndex - 1 + currentAutocompleteItems.length) % currentAutocompleteItems.length;
        updateAutocompleteVisual(feedbackEl);
        return false;
    } else if (e.key === 'Enter') {
        if (hasItems) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            const targetIdx = (activeAutocompleteIndex >= 0 && activeAutocompleteIndex < currentAutocompleteItems.length) ? activeAutocompleteIndex : 0;
            applyActiveAutocomplete(inputEl, targetIdx);
            return false;
        }
    } else if (e.key === 'Tab') {
        if (hasItems) {
            e.preventDefault();
            e.stopPropagation();
            const targetIdx = (activeAutocompleteIndex >= 0 && activeAutocompleteIndex < currentAutocompleteItems.length) ? activeAutocompleteIndex : 0;
            applyActiveAutocomplete(inputEl, targetIdx);
            return false;
        }
    } else if (e.key === 'Escape') {
        if (isFeedbackOpen) {
            feedbackEl.classList.add('hidden');
            feedbackEl.classList.remove('flex');
            activeAutocompleteIndex = -1;
            currentAutocompleteItems = [];
            e.stopPropagation();
            return false;
        }
    }
    return true;
}

function applyActiveAutocomplete(inputEl, index) {
    if (!currentAutocompleteItems || !currentAutocompleteItems[index]) return;
    const item = currentAutocompleteItems[index];
    applyAutocomplete(inputEl.id, item.patternToReplace, item.textToInsert);
}

function handleSmartInput(inputEl, ctxId) {
    // Evita di ricalcolare e azzerare l'indice quando l'utente naviga con i tasti freccia
    if (window.event && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab', 'Shift', 'Control', 'Alt'].includes(window.event.key)) {
        return;
    }

    const val = inputEl.value;
    let feedbackEl = inputEl.nextElementSibling;
    if(!feedbackEl || !feedbackEl.classList.contains('smart-feedback-container')) {
        feedbackEl = document.createElement('div');
        feedbackEl.className = 'smart-feedback-container absolute w-full left-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl flex-col hidden p-2.5 backdrop-blur-md transition-all';
        inputEl.parentElement.style.position = 'relative';
        inputEl.parentElement.insertBefore(feedbackEl, inputEl.nextSibling);
    }

    // Se il valore testuale non è cambiato e il dropdown è già visibile, non ricreare il DOM
    if (inputEl._lastInputVal === val && !feedbackEl.classList.contains('hidden') && currentAutocompleteItems.length > 0) {
        return;
    }
    inputEl._lastInputVal = val;
    
    // Considera il testo fino alla posizione del cursore per supportare l'inserimento ovunque nel testo
    const cursorPos = (inputEl.selectionStart !== undefined && inputEl.selectionStart !== null) ? inputEl.selectionStart : val.length;
    const textBeforeCursor = val.substring(0, cursorPos);

    // 1. Gestione Autocomplete Contesto # (Sfere, Progetti attivi, Sottoprogetti)
    const hashMatch = textBeforeCursor.match(/#([^\s]*)$/);
    if (hashMatch) {
        const search = hashMatch[1].toLowerCase();
        
        let availableContexts = [];
        (state.data.spheres || []).forEach(s => {
            availableContexts.push({ id: s.id, name: s.name, icon: s.icon || 'fa-globe', color: s.color || '#3b82f6', typeName: 'Sfera' });
        });
        (state.data.projects || []).filter(p => !p.archived).forEach(p => {
            const sphere = (state.data.spheres || []).find(s => s.id === p.sphereId);
            availableContexts.push({ id: p.id, name: p.name, icon: p.icon || 'fa-folder', color: p.color || (sphere ? sphere.color : '#3b82f6'), typeName: 'Progetto', parentName: sphere ? sphere.name : '' });
        });
        (state.data.subprojects || []).filter(sp => !sp.archived).forEach(sp => {
            const proj = (state.data.projects || []).find(p => p.id === sp.projectId);
            availableContexts.push({ id: sp.id, name: sp.name, icon: sp.icon || 'fa-file-alt', color: sp.color || '#94a3b8', typeName: 'Sub', parentName: proj ? proj.name : '' });
        });

        const filtered = availableContexts.filter(c => {
            if (!search) return true;
            return c.name.toLowerCase().includes(search) || c.name.toLowerCase().replace(/\s+/g, '').includes(search);
        }).slice(0, 7);

        if (filtered.length > 0) {
            activeAutocompleteIndex = 0;
            currentAutocompleteItems = filtered.map(c => ({
                patternToReplace: hashMatch[0],
                textToInsert: '#' + c.name.replace(/\s+/g, ''),
                title: c.name
            }));

            let html = `<div class="text-[10px] font-bold text-slate-400 uppercase px-2 py-1 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-1 mb-1">
                <span class="flex items-center gap-1.5"><i class="fas fa-search text-blue-500"></i> Seleziona Contesto:</span>
                <span class="text-[9px] text-slate-400 font-normal lowercase opacity-75">↑↓ naviga · invio seleziona</span>
            </div>`;

            filtered.forEach((c, idx) => { 
                const isActive = idx === activeAutocompleteIndex;
                html += `<div data-idx="${idx}" class="autocomplete-item ${isActive ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 border-blue-300 dark:border-blue-600' : 'text-slate-700 dark:text-slate-200 border-transparent'} hover:bg-blue-50 dark:hover:bg-slate-700/60 rounded-lg p-2 text-xs font-semibold cursor-pointer flex items-center justify-between transition-colors border" 
                              onmouseenter="activeAutocompleteIndex=${idx}; updateAutocompleteVisual(this.parentElement)"
                              onmousedown="event.preventDefault(); applyActiveAutocomplete(document.getElementById('${inputEl.id}'), ${idx})">
                    <span class="flex items-center truncate mr-2">
                        <i class="fas ${c.icon||'fa-hashtag'} mr-2 shrink-0" style="color:${c.color||'#94a3b8'}"></i>
                        <span class="truncate">${c.name}</span>
                        ${c.parentName ? `<span class="ml-1.5 text-[9px] font-normal text-slate-400 truncate opacity-75">(${c.parentName})</span>` : ''}
                    </span>
                    <span class="text-[9px] uppercase tracking-wider text-slate-400 opacity-70 shrink-0 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">${c.typeName}</span>
                </div>`; 
            });
            feedbackEl.innerHTML = html;
            feedbackEl.classList.remove('hidden');
            feedbackEl.classList.add('flex');
            return;
        }
    }

    // 2. Gestione Autocomplete Data @ (Date, Giorni della settimana, Mesi)
    const atMatch = textBeforeCursor.match(/@([^\s]*)$/);
    if (atMatch) {
        const search = atMatch[1].toLowerCase();
        const dateSuggestions = [
            { label: 'Oggi', tag: '@oggi', desc: 'Oggi' },
            { label: 'Domani', tag: '@domani', desc: 'Domani' },
            { label: 'Dopodomani', tag: '@dopodomani', desc: 'Tra 2 giorni' },
            { label: 'Lunedì', tag: '@lunedi', desc: 'Prossimo lunedì' },
            { label: 'Martedì', tag: '@martedi', desc: 'Prossimo martedì' },
            { label: 'Mercoledì', tag: '@mercoledi', desc: 'Prossimo mercoledì' },
            { label: 'Giovedì', tag: '@giovedi', desc: 'Prossimo giovedì' },
            { label: 'Venerdì', tag: '@venerdi', desc: 'Prossimo venerdì' },
            { label: 'Sabato', tag: '@sabato', desc: 'Prossimo sabato' },
            { label: 'Domenica', tag: '@domenica', desc: 'Prossima domenica' },
            { label: 'Fine Mese', tag: '@finemese', desc: 'Ultimo giorno mese corrente' },
            { label: 'Prossimo Mese', tag: '@prossimomese', desc: '1° giorno mese prossimo' }
        ].filter(s => !search || s.tag.toLowerCase().includes('@' + search) || s.label.toLowerCase().includes(search)).slice(0, 6);

        if (dateSuggestions.length > 0) {
            activeAutocompleteIndex = 0;
            currentAutocompleteItems = dateSuggestions.map(s => ({
                patternToReplace: atMatch[0],
                textToInsert: s.tag,
                title: s.label
            }));

            let html = `<div class="text-[10px] font-bold text-slate-400 uppercase px-2 py-1 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-1 mb-1">
                <span class="flex items-center gap-1.5"><i class="far fa-calendar-alt text-indigo-500"></i> Suggerimenti Data:</span>
                <span class="text-[9px] text-slate-400 font-normal lowercase opacity-75">↑↓ naviga · invio seleziona</span>
            </div>`;
            dateSuggestions.forEach((s, idx) => { 
                const isActive = idx === activeAutocompleteIndex;
                html += `<div data-idx="${idx}" class="autocomplete-item ${isActive ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 border-blue-300 dark:border-blue-600' : 'text-slate-700 dark:text-slate-200 border-transparent'} hover:bg-blue-50 dark:hover:bg-slate-700/60 rounded-lg p-2 text-xs font-semibold cursor-pointer flex items-center justify-between transition-colors border" 
                              onmouseenter="activeAutocompleteIndex=${idx}; updateAutocompleteVisual(this.parentElement)"
                              onmousedown="event.preventDefault(); applyActiveAutocomplete(document.getElementById('${inputEl.id}'), ${idx})">
                    <span class="flex items-center"><i class="far fa-clock mr-2 text-indigo-500"></i>${s.label} <code class="ml-2 text-[10px] opacity-60 bg-slate-200 dark:bg-slate-700 px-1 rounded">${s.tag}</code></span>
                    <span class="text-[9px] uppercase tracking-wider text-slate-400 opacity-70">${s.desc}</span>
                </div>`; 
            });
            feedbackEl.innerHTML = html;
            feedbackEl.classList.remove('hidden');
            feedbackEl.classList.add('flex');
            return;
        }
    }

    // 3. Gestione Autocomplete Priorità p (p1, p2, p3)
    const priMatch = textBeforeCursor.match(/(?:^|\s)(p([0-3]?))$/i);
    if (priMatch) {
        const searchPri = priMatch[2];
        const priSuggestions = [
            { label: 'Alta Priorità', tag: 'p3', icon: 'fa-fire text-rose-500', desc: 'Urgente / Importante' },
            { label: 'Media Priorità', tag: 'p2', icon: 'fa-exclamation-circle text-amber-500', desc: 'Attività standard' },
            { label: 'Bassa Priorità', tag: 'p1', icon: 'fa-flag text-blue-500', desc: 'Secondaria' },
            { label: 'Nessuna Priorità', tag: 'p0', icon: 'fa-minus text-slate-400', desc: 'Default' }
        ].filter(p => !searchPri || p.tag === 'p' + searchPri || p.label.toLowerCase().includes(searchPri));

        if (priSuggestions.length > 0) {
            activeAutocompleteIndex = 0;
            currentAutocompleteItems = priSuggestions.map(p => ({
                patternToReplace: priMatch[1],
                textToInsert: p.tag,
                title: p.label
            }));

            let html = `<div class="text-[10px] font-bold text-slate-400 uppercase px-2 py-1 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-1 mb-1">
                <span class="flex items-center gap-1.5"><i class="fas fa-flag text-amber-500"></i> Seleziona Priorità:</span>
                <span class="text-[9px] text-slate-400 font-normal lowercase opacity-75">↑↓ naviga · invio seleziona</span>
            </div>`;
            priSuggestions.forEach((p, idx) => {
                const isActive = idx === activeAutocompleteIndex;
                html += `<div data-idx="${idx}" class="autocomplete-item ${isActive ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 border-blue-300 dark:border-blue-600' : 'text-slate-700 dark:text-slate-200 border-transparent'} hover:bg-blue-50 dark:hover:bg-slate-700/60 rounded-lg p-2 text-xs font-semibold cursor-pointer flex items-center justify-between transition-colors border" 
                              onmouseenter="activeAutocompleteIndex=${idx}; updateAutocompleteVisual(this.parentElement)"
                              onmousedown="event.preventDefault(); applyActiveAutocomplete(document.getElementById('${inputEl.id}'), ${idx})">
                    <span class="flex items-center"><i class="fas ${p.icon} mr-2"></i>${p.label} <code class="ml-2 text-[10px] opacity-60 bg-slate-200 dark:bg-slate-700 px-1 rounded">${p.tag}</code></span>
                    <span class="text-[9px] text-slate-400 opacity-70">${p.desc}</span>
                </div>`;
            });
            feedbackEl.innerHTML = html;
            feedbackEl.classList.remove('hidden');
            feedbackEl.classList.add('flex');
            return;
        }
    }

    currentAutocompleteItems = [];
    activeAutocompleteIndex = -1;

    // 4. Parametri recepiti con riscontro visivo avanzato
    const parsed = parseSmartInput(val, ctxId);
    let badges = '';
    let hasRecognized = false;

    if (parsed.priority > 0) {
        hasRecognized = true;
        const pConfigs = {
            1: { text: 'Bassa (p1)', icon: 'fa-flag', bg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800' },
            2: { text: 'Media (p2)', icon: 'fa-exclamation-circle', bg: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
            3: { text: 'Alta (p3)', icon: 'fa-fire text-rose-500', bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 font-extrabold' }
        };
        const cfg = pConfigs[parsed.priority];
        badges += `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-xs ${cfg.bg}"><i class="fas ${cfg.icon}"></i> ${cfg.text}</span>`;
    }

    if (parsed.date) {
        hasRecognized = true;
        const dueInfo = getDueDateStatus(parsed.date);
        const labelText = dueInfo ? dueInfo.label : formatDisplayDate(parsed.date);
        badges += `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-xs"><i class="far fa-calendar-check text-indigo-500"></i> Scadenza: ${formatDisplayDate(parsed.date)} (${labelText})</span>`;
    }

    if (parsed.contextId) {
        const ctx = getContextInfo(parsed.contextId);
        if (ctx && ctx.name) {
            hasRecognized = true;
            badges += `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-xs" style="background:${ctx.color}15; color:${ctx.color}; border-color:${ctx.color}40"><i class="fas ${ctx.icon}"></i> ${ctx.name}</span>`;
        }
    }

    let hints = '';
    if (/(?:^|\s)p$/i.test(val)) {
        hints += `<div class="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><i class="fas fa-lightbulb"></i> Scrivi <b>p1</b>, <b>p2</b> o <b>p3</b> per la priorità</div>`;
    }
    if (/(?:^|\s)@$/.test(val)) {
        hints += `<div class="text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5"><i class="fas fa-lightbulb"></i> Scrivi <b>@sabato</b>, <b>@novembre</b>, <b>@domani</b> o <b>@2027</b></div>`;
    }
    if (/(?:^|\s)#$/.test(val)) {
        hints += `<div class="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1.5"><i class="fas fa-lightbulb"></i> Scrivi le prime lettere di un progetto o sfera</div>`;
    }

    if (hasRecognized || hints) {
        let htmlOut = '';
        if (hasRecognized) {
            htmlOut += `
                <div class="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <i class="fas fa-magic text-blue-500"></i> Parametri recepiti:
                </div>
                <div class="flex flex-wrap gap-1.5 items-center mb-1">
                    ${badges}
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700/60 truncate">
                    Titolo task: <span class="font-bold text-slate-700 dark:text-slate-200">"${parsed.title || '...'}"</span>
                </div>`;
        }
        if (hints) {
            htmlOut += `<div class="${hasRecognized ? 'pt-1.5 border-t border-slate-100 dark:border-slate-700/60 mt-1.5' : ''}">${hints}</div>`;
        }
        feedbackEl.innerHTML = htmlOut;
        feedbackEl.classList.remove('hidden');
        feedbackEl.classList.add('flex');
    } else {
        feedbackEl.classList.add('hidden');
        feedbackEl.classList.remove('flex');
    }
}

function applyAutocomplete(inputId, oldText, newText) {
    const el = document.getElementById(inputId);
    if (!el) return;
    
    const cursorPos = (el.selectionStart !== undefined && el.selectionStart !== null) ? el.selectionStart : el.value.length;
    let textBefore = el.value.substring(0, cursorPos);
    let textAfter = el.value.substring(cursorPos);
    
    // Se stiamo sostituendo o cambiando un tag (#, @, p), puliamo eventuali tag precedenti dello stesso tipo
    if (newText.startsWith('#')) {
        textBefore = textBefore.replace(/#[^\s]+\s*/g, '');
        textAfter = textAfter.replace(/#[^\s]+\s*/g, '');
    } else if (newText.startsWith('@')) {
        textBefore = textBefore.replace(/@[^\s]+\s*/g, '');
        textAfter = textAfter.replace(/@[^\s]+\s*/g, '');
    } else if (/^p[0-3]$/i.test(newText)) {
        textBefore = textBefore.replace(/(?:^|\s)p[0-3](?=\s|$)/gi, ' ');
        textAfter = textAfter.replace(/(?:^|\s)p[0-3](?=\s|$)/gi, ' ');
    }
    
    const lastIdx = textBefore.lastIndexOf(oldText);
    let finalCursorPos = 0;
    if (lastIdx !== -1) {
        const prefix = textBefore.substring(0, lastIdx).trimEnd();
        const base = prefix ? prefix + ' ' : '';
        el.value = base + newText + ' ' + textAfter.trimStart();
        finalCursorPos = (base + newText + ' ').length;
    } else {
        const trimmedBefore = textBefore.trimEnd();
        const base = trimmedBefore ? trimmedBefore + ' ' : '';
        el.value = base + newText + ' ' + textAfter.trimStart();
        finalCursorPos = el.value.length;
    }
    
    el.focus(); 
    if (typeof el.setSelectionRange === 'function') {
        el.setSelectionRange(finalCursorPos, finalCursorPos);
    }
    activeAutocompleteIndex = -1;
    currentAutocompleteItems = [];
    el._lastInputVal = el.value;
    
    window._justAppliedAutocomplete = true;
    setTimeout(() => { window._justAppliedAutocomplete = false; }, 400);
    handleSmartInput(el, '');
}