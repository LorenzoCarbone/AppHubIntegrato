// --- RENDERING CENTRALE & AVVIO APPLICAZIONE ---
function render() {
            renderBreadcrumbs();
            const c = document.getElementById('app-content');
            
            // Trigger animation re-flow
            c.classList.remove('page-fade');
            void c.offsetWidth;
            c.classList.add('page-fade');

            if(state.view === 'home') c.innerHTML = renderDashboard();
            else if(state.view === 'sphere') c.innerHTML = renderSphere();
            else if(state.view === 'project') c.innerHTML = renderProject();
            else if(state.view === 'subproject') c.innerHTML = renderSubproject();
            else if(state.view === 'global_tasks') c.innerHTML = renderAdvancedTaskManager();
            else if(state.view === 'global_contacts') c.innerHTML = renderGlobalContacts();
            else if(state.view === 'global_calendar') c.innerHTML = renderCalendar(); 
            else if(state.view === 'global_pages') c.innerHTML = renderGlobalPages(); 
            
            initQuillEditors(); 
            if(typeof updateMobileBottomNav === 'function') updateMobileBottomNav();
            if(typeof applyFeatureVisibility === 'function') applyFeatureVisibility();
        }

// --- WIDGET AGENDA & GOOGLE CALENDAR IN DASHBOARD ---
async function refreshDashboardGCal(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const btn = document.getElementById('dashGcalRefreshBtn');
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs"></i>';
    try {
        await AppData.fetchGCalEvents();
        render();
        showToast("Google Calendar sincronizzato", "success");
    } catch(err) {
        showToast("Errore sincronizzazione Google Calendar", "error");
    }
}

function renderDashboardAgendaWidget() {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Logica intelligente: la sera (dalle 20:00 alle 23:59) mostra l'agenda di domani.
    // Dalla mezzanotte in poi (dalle 00:00 alle 19:59) mostra l'agenda di oggi.
    const isEvening = currentHour >= 20;
    
    // Modalità di visualizzazione: 'auto' (default intelligente), oppure 'today' / 'tomorrow' se l'utente clicca il selettore
    let dayMode = state.ui.agendaViewMode || 'auto';
    let isShowingTomorrow = false;
    if (dayMode === 'tomorrow') {
        isShowingTomorrow = true;
    } else if (dayMode === 'today') {
        isShowingTomorrow = false;
    } else {
        // Auto
        isShowingTomorrow = isEvening;
    }

    const targetDate = new Date(now);
    if (isShowingTomorrow) {
        targetDate.setDate(now.getDate() + 1);
    }
    const targetDateStr = getISODate(targetDate);
    
    // Formattazione data italiana elegante (es. Mercoledì, 4 Novembre)
    const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const formattedDate = `${dayNames[targetDate.getDay()]}, ${targetDate.getDate()} ${monthNames[targetDate.getMonth()]}`;

    // Eventi del giorno selezionato da blocchi locali (Time Blocking) e da Google Calendar
    const localBlocks = (state.data.calendarBlocks || []).filter(b => typeof isBlockOnDate === 'function' ? isBlockOnDate(b, targetDateStr) : b.date === targetDateStr);
    const gcalEvents = (AppData.gcalCache || []).filter(e => e.date === targetDateStr);

    let allItems = [];
    
    localBlocks.forEach(b => {
        allItems.push({
            id: b.id,
            isGcal: false,
            title: b.title,
            startTime: b.startTime || '00:00',
            endTime: b.endTime || '',
            category: b.category || 'focus',
            notes: b.notes || '',
            color: b.color || '#3b82f6',
            taskIds: b.taskIds || [],
            isAllDay: false
        });
    });

    gcalEvents.forEach(e => {
        allItems.push({
            id: e.id,
            isGcal: true,
            title: e.title,
            startTime: e.startTime || '00:00',
            endTime: e.endTime || '',
            category: 'gcal',
            notes: e.notes || '',
            color: e.color || '#4285F4',
            link: e.link || 'https://calendar.google.com',
            isAllDay: e.isAllDay || false
        });
    });

    // Ordinamento cronologico (eventi tutto il giorno in cima)
    allItems.sort((a,b) => {
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
        return (a.startTime || '').localeCompare(b.startTime || '');
    });

    const isGcalConfigured = !!(AppData.gcalApiKey && AppData.gcalId);

    let itemsHtml = '';
    if (allItems.length === 0) {
        itemsHtml = `
            <div class="text-center py-6 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/80">
                <i class="far fa-calendar-check text-2xl text-slate-300 dark:text-slate-600 mb-2"></i>
                <p class="text-xs font-semibold text-slate-600 dark:text-slate-400">Nessun impegno in programma per ${isShowingTomorrow ? 'domani' : 'oggi'}</p>
                <p class="text-[10px] text-slate-400 mt-0.5">Giornata libera o da pianificare con Time Blocking!</p>
            </div>`;
    } else {
        itemsHtml = `<div class="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">`;
        allItems.forEach(item => {
            if (item.isGcal) {
                const timeText = item.isAllDay ? 'Tutto il giorno' : `${item.startTime}${item.endTime ? ' - ' + item.endTime : ''}`;
                itemsHtml += `
                    <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1f2430] border border-slate-200/80 dark:border-slate-700/60 border-l-[4px] hover:shadow-sm transition flex items-start justify-between gap-2.5 group" style="border-left-color: ${item.color}">
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5 mb-1">
                                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100/70 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                                    <i class="fab fa-google text-[10px]"></i> ${timeText}
                                </span>
                                <span class="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Google Cal</span>
                            </div>
                            <p class="text-xs font-bold text-slate-800 dark:text-slate-100 break-words leading-snug">${item.title}</p>
                            ${item.notes ? `<p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 italic">${item.notes}</p>` : ''}
                        </div>
                        <div class="flex items-center gap-1 shrink-0 pt-0.5">
                            <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Apri in Google Calendar">
                                <i class="fas fa-external-link-alt text-xs"></i>
                            </a>
                        </div>
                    </div>`;
            } else {
                const catLabels = { focus: 'Focus', routine: 'Routine', break: 'Pausa', task: 'Task' };
                const catIcons = { focus: 'fa-bullseye text-blue-500', routine: 'fa-redo text-purple-500', break: 'fa-coffee text-amber-500', task: 'fa-check text-emerald-500' };
                const timeText = `${item.startTime}${item.endTime ? ' - ' + item.endTime : ''}`;
                const taskCount = item.taskIds ? item.taskIds.length : 0;
                
                itemsHtml += `
                    <div onclick="openBlockModal('${item.id}', '${targetDateStr}')" class="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1f2430] border border-slate-200/80 dark:border-slate-700/60 border-l-[4px] hover:shadow-sm transition cursor-pointer flex items-start justify-between gap-2.5 group" style="border-left-color: ${item.color}">
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5 mb-1">
                                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200">
                                    <i class="far fa-clock mr-1 text-[10px]"></i>${timeText}
                                </span>
                                <span class="text-[9px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                                    <i class="fas ${catIcons[item.category] || 'fa-tag'} text-[9px]"></i> ${catLabels[item.category] || 'Blocco'}
                                </span>
                            </div>
                            <p class="text-xs font-bold text-slate-800 dark:text-slate-100 break-words leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${item.title}</p>
                            ${item.notes ? `<p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 italic">${item.notes}</p>` : ''}
                        </div>
                        <div class="flex items-center gap-1 shrink-0 pt-0.5">
                            ${taskCount > 0 ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300" title="${taskCount} task collegate"><i class="fas fa-tasks mr-1"></i>${taskCount}</span>` : ''}
                            <button class="text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 p-1 rounded transition" title="Modifica blocco"><i class="fas fa-chevron-right text-xs"></i></button>
                        </div>
                    </div>`;
            }
        });
        itemsHtml += `</div>`;
    }

    const titlePrefix = isShowingTomorrow ? 'Agenda di Domani' : 'Agenda di Oggi';
    const eveningBadge = isEvening ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ml-1.5 flex items-center gap-1"><i class="fas fa-moon text-[8px]"></i> Sera</span>` : '';

    return `
        <div class="panel p-5 bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow-sm rounded-2xl flex flex-col mb-6">
            <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-darkborder">
                <div>
                    <h2 class="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center">
                        <i class="fas ${isShowingTomorrow ? 'fa-calendar-alt' : 'fa-calendar-day'} text-indigo-500 mr-2 text-sm"></i>
                        ${titlePrefix}
                        ${eveningBadge}
                    </h2>
                    <p class="text-[10px] font-semibold text-slate-400 capitalize mt-0.5">${formattedDate}</p>
                </div>
                <div class="flex items-center gap-2">
                    <!-- Selettore rapido Oggi / Domani -->
                    <div class="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold">
                        <button onclick="state.ui.agendaViewMode='today'; render();" class="px-2 py-0.5 rounded-md transition ${!isShowingTomorrow ? 'bg-white dark:bg-darkpanel text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}">Oggi</button>
                        <button onclick="state.ui.agendaViewMode='tomorrow'; render();" class="px-2 py-0.5 rounded-md transition ${isShowingTomorrow ? 'bg-white dark:bg-darkpanel text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}">Domani</button>
                    </div>

                    ${isGcalConfigured ? `
                        <button id="dashGcalRefreshBtn" onclick="refreshDashboardGCal(event)" class="text-[10px] font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg transition active:scale-95 flex items-center gap-1" title="Sincronizza Google Calendar">
                            <i class="fas fa-sync-alt text-[10px]"></i>
                        </button>
                        <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" class="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg transition flex items-center gap-1" title="Apri Google Calendar web">
                            <i class="fab fa-google"></i>
                        </a>
                        <button onclick="window.print()" class="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg transition active:scale-95 flex items-center gap-1" title="Stampa o Salva PDF Agenda">
                            <i class="fas fa-print text-[10px]"></i>
                        </button>` : `
                        <button onclick="openSettingsModal()" class="text-[10px] font-bold text-slate-500 hover:text-blue-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg transition flex items-center gap-1" title="Collega Google Calendar nelle Impostazioni">
                            <i class="fab fa-google text-amber-500"></i> Collega GCal
                        </button>`}
                </div>
            </div>
            
            ${itemsHtml}

            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                <button onclick="openBlockModal(null, '${targetDateStr}')" class="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition flex items-center gap-1.5 active:scale-95">
                    <i class="fas fa-plus text-[10px]"></i> Nuovo Blocco
                </button>
                <button onclick="navigate('global_calendar')" class="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition flex items-center gap-1 active:scale-95">
                    <i class="far fa-calendar-alt text-[10px]"></i> Vista Calendario <i class="fas fa-arrow-right text-[9px] ml-0.5"></i>
                </button>
            </div>
        </div>`;
}

function renderDashboard() {
    let pinnedSectionsHtml = '', spheresHtml = '';
    
    // Sfere di Vita
    state.data.spheres.sort((a,b)=>(a.order||0)-(b.order||0)).forEach(s => {
        const projs = (state.data.projects || []).filter(p => p.sphereId === s.id && !p.archived);
        spheresHtml += `
            <div onclick="navigate('sphere', '${s.id}')" 
                 class="panel panel-hover p-5 flex flex-col items-center justify-center text-center rounded-2xl bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow-sm hover:shadow-md transition group cursor-pointer relative overflow-hidden" 
                 style="border-top: 4px solid ${s.color}">
                <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 shadow-xs" style="background-color: ${s.color}18">
                    <i class="fas ${s.icon} text-2xl" style="color: ${s.color}"></i>
                </div>
                <h3 class="font-extrabold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">${s.name}</h3>
                <span class="text-[11px] font-bold text-slate-400 mt-1">${projs.length} ${projs.length === 1 ? 'progetto' : 'progetti'}</span>
            </div>`;
    });
    
    // Livelli di elementi fissati (Pinned Levels)
    state.data.pinnedLevels.forEach(level => {
        let itemsInLevel = [...state.data.projects.filter(p=>p.pinned && !p.archived && (p.pinnedLevelId === level.id || (!p.pinnedLevelId && level.id === 'pl_default'))),
                            ...state.data.subprojects.filter(sp=>sp.pinned && !sp.archived && (sp.pinnedLevelId === level.id || (!sp.pinnedLevelId && level.id === 'pl_default')))]
                            .sort((a,b)=>(a.pinnedOrder||0)-(b.pinnedOrder||0));
        
        let cardsHtml = '';
        itemsInLevel.forEach(item => {
            if(item.projectId) { 
                const p = getEntity('project', item.projectId); 
                const s = p ? getEntity('sphere', p.sphereId) : null;
                const color = item.color || (p?p.color:null) || (s?s.color:null) || '#94a3b8';
                const pName = p ? p.name : 'Sconosciuto';
                cardsHtml += createDraggableCardHtml(item.name, `${pName} (Sub)`, 'subproject', s?s.id:null, p?p.id:null, item.id, color, `dashboard_pinned_${level.id}`, item);
            } else { 
                const s = getEntity('sphere', item.sphereId);
                const color = item.color || (s?s.color:null) || '#94a3b8';
                const sName = s ? s.name : 'Sconosciuto';
                cardsHtml += createDraggableCardHtml(item.name, sName, 'project', s?s.id:null, item.id, null, color, `dashboard_pinned_${level.id}`, item);
            }
        });

        pinnedSectionsHtml += `
            <div class="mb-8">
                <div class="flex justify-between items-center mb-4 group">
                    <h2 class="text-xs font-bold flex items-center text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        <i class="fas fa-layer-group text-amber-500 mr-2 text-xs"></i> ${level.name}
                    </h2>
                    <div class="opacity-0 group-hover:opacity-100 transition flex gap-1">
                        <button onclick="renamePinnedLevel('${level.id}')" class="text-xs p-1.5 text-slate-400 hover:text-blue-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Rinomina livello"><i class="fas fa-edit"></i></button>
                        ${level.id !== 'pl_default' ? `<button onclick="deletePinnedLevel('${level.id}')" class="text-xs p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Elimina livello"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 min-h-[60px] p-2 -m-2 rounded-2xl drop-zone" 
                     ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event, null, null, 'dashboard_pinned_${level.id}')">
                    ${cardsHtml || `<p class="text-xs text-slate-400 italic col-span-full pt-3 pb-2 text-center">Trascina qui i progetti in evidenza per averli sempre a portata di mano.</p>`}
                </div>
            </div>`;
    });

    pinnedSectionsHtml += `<button onclick="addPinnedLevel()" class="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition w-full text-center py-3.5 border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 rounded-2xl mb-8"><i class="fas fa-plus mr-1.5"></i> Aggiungi Nuovo Livello</button>`;

    // Metriche rapide
    const activeTasksCount = (state.data.tasks || []).filter(t => !t.completed).length;
    const pagesCount = (state.data.pages || []).length;
    const contactsCount = (state.data.contacts || []).length;

    // Formattazione data odierna estesa
    const now = new Date();
    const daysItalian = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const monthsItalian = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const dateFormatted = `${daysItalian[now.getDay()]}, ${now.getDate()} ${monthsItalian[now.getMonth()]} ${now.getFullYear()}`;

    return `
        <div class="max-w-6xl mx-auto space-y-8 pb-10">
            <!-- BANNER BENVENUTO / HERO -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-darkpanel p-6 rounded-3xl border border-slate-200 dark:border-darkborder shadow-sm">
                <div>
                    <span class="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mb-1">
                        <i class="far fa-calendar-alt"></i> ${dateFormatted}
                    </span>
                    <h1 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Panoramica Life Hub</h1>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">La tua centrale operativa personale: sfere, progetti e documentazione</p>
                </div>
                <div class="flex flex-wrap items-center gap-2.5">
                    <button onclick="navigate('global_tasks')" class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-2">
                        <i class="fas fa-check-double text-xs"></i> Vai alle Task
                    </button>
                    <button onclick="navigate('global_pages')" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition active:scale-95 flex items-center gap-2">
                        <i class="fas fa-book-open text-xs text-indigo-500"></i> Pagine & Note
                    </button>
                </div>
            </div>

            <!-- 4 SCHEDE DI ACCESSO RAPIDO -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div onclick="navigate('global_tasks')" class="p-4 rounded-2xl bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow-sm hover:shadow-md transition cursor-pointer group">
                    <div class="flex items-center justify-between mb-2">
                        <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg group-hover:scale-105 transition-transform">
                            <i class="fas fa-check-double"></i>
                        </div>
                        <span class="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">${activeTasksCount}</span>
                    </div>
                    <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 transition">Attività in Corso</h4>
                    <p class="text-[10px] text-slate-400 mt-0.5">Task aperte e scadenze</p>
                </div>

                <div onclick="navigate('global_calendar')" class="p-4 rounded-2xl bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow-sm hover:shadow-md transition cursor-pointer group">
                    <div class="flex items-center justify-between mb-2">
                        <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg group-hover:scale-105 transition-transform">
                            <i class="fas fa-calendar-alt"></i>
                        </div>
                        <i class="fas fa-arrow-right text-xs text-slate-300 group-hover:text-emerald-500 transition-colors"></i>
                    </div>
                    <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 transition">Calendario</h4>
                    <p class="text-[10px] text-slate-400 mt-0.5">Time blocking e impegni</p>
                </div>

                <div onclick="navigate('global_pages')" class="p-4 rounded-2xl bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow-sm hover:shadow-md transition cursor-pointer group">
                    <div class="flex items-center justify-between mb-2">
                        <div class="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center text-lg group-hover:scale-105 transition-transform">
                            <i class="fas fa-book-open"></i>
                        </div>
                        <span class="text-xl font-black text-purple-600 dark:text-purple-400 font-mono">${pagesCount}</span>
                    </div>
                    <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-purple-600 transition">Pagine & Note</h4>
                    <p class="text-[10px] text-slate-400 mt-0.5">Verbali, appunti e schede</p>
                </div>

                <div onclick="navigate('global_contacts')" class="p-4 rounded-2xl bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow-sm hover:shadow-md transition cursor-pointer group">
                    <div class="flex items-center justify-between mb-2">
                        <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg group-hover:scale-105 transition-transform">
                            <i class="fas fa-address-book"></i>
                        </div>
                        <span class="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">${contactsCount}</span>
                    </div>
                    <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-amber-600 transition">Rubrica Contatti</h4>
                    <p class="text-[10px] text-slate-400 mt-0.5">Persone e collaboratori</p>
                </div>
            </div>

            <!-- SEZIONE SFERE DI VITA -->
            <section class="space-y-4">
                <div class="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-darkborder">
                    <h2 class="text-xs font-bold flex items-center text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        <i class="fas fa-globe text-blue-500 mr-2 text-xs"></i> Le tue Sfere di Vita
                    </h2>
                    <button onclick="openEntityModal('create', 'sphere')" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition flex items-center bg-blue-50 dark:bg-blue-900/20 px-3.5 py-1.5 rounded-xl active:scale-95 shadow-xs">
                        <i class="fas fa-plus mr-1.5"></i> Nuova Sfera
                    </button>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">${spheresHtml}</div>
            </section>

            <!-- SEZIONE PROGETTI IN EVIDENZA -->
            <section class="space-y-4 pt-2">
                ${pinnedSectionsHtml}
            </section>
        </div>`;
}

        // --- ENTITY VIEWS & NOTES ---

function renderSphere() {
    const s = getEntity('sphere', state.path.sphereId);
    if(!s) return `<div class="text-center p-10"><p>Sfera non trovata.</p></div>`;
    const projs = getChildren('sphere', s.id);
    const pinned = projs.filter(p => p.pinned && p.archived === state.ui.showArchived);
    const unpinned = projs.filter(p => !p.pinned && p.archived === state.ui.showArchived);
    
    const renderProjList = (list, listType) => list.map(p => {
        const color = p.color || s.color;
        return `
        <div draggable="true" ondragstart="onDragStart(event, '${p.id}', 'project', '${listType}')" ondragend="onDragEnd(event)" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event, '${p.id}', 'project', '${listType}')"
             class="panel panel-hover p-4 flex justify-between items-start mb-4 border-l-[5px] group draggable bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow-sm" style="border-left-color: ${color}">
            <div class="word-wrap flex-1" onclick="navigate('project', '${s.id}', '${p.id}')">
                <h3 class="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100 mb-2">${p.pinned ? `<i class="fas fa-star text-amber-500 text-[10px]"></i>` : ''} <i class="fas ${p.icon||'fa-folder'} text-slate-400 dark:text-slate-500 mr-1 text-[13px]"></i> ${p.name}</h3>
                <div class="flex gap-2 text-[10px] font-bold mt-1">
                    <span class="text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">${p.type}</span> 
                    <span class="text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">${p.status}</span>
                </div>
            </div>
            <div class="flex gap-1 items-center opacity-0 group-hover:opacity-100 transition">
                <button onclick="togglePin('project', '${p.id}')" class="text-slate-400 hover:text-amber-500 p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Fissa"><i class="fas fa-star text-xs"></i></button>
                <button onclick="toggleArchiveEntity('project', '${p.id}')" class="text-slate-400 hover:text-blue-500 p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Archivia"><i class="fas fa-archive text-xs"></i></button>
                <button onclick="openEntityModal('edit', 'project', '${s.id}', '${p.id}')" class="text-slate-400 hover:text-slate-800 dark:hover:text-white p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"><i class="fas fa-edit text-xs"></i></button>
                <i class="fas fa-grip-lines text-slate-300 dark:text-slate-600 text-sm ml-2 cursor-grab p-1"></i>
            </div>
        </div>`}).join('');

    return `
        <div class="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 pb-5 border-b border-slate-200 dark:border-darkborder gap-4">
            <h2 class="text-3xl font-bold flex items-center tracking-tight" style="color: ${s.color}"><i class="fas ${s.icon} mr-3 opacity-80"></i> ${s.name}</h2>
            <div class="flex flex-wrap gap-2.5 text-sm relative z-20">
                <button onclick="toggleArchivedView()" class="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition px-4 py-2 bg-white dark:bg-darkpanel rounded-lg shadow-sm border border-slate-200 dark:border-darkborder active:scale-95"><i class="fas fa-archive mr-1.5"></i> ${state.ui.showArchived ? 'Mostra Attivi' : 'Mostra Archivio'}</button>
                <button onclick="openEntityModal('edit', 'sphere', '${s.id}')" class="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition px-4 py-2 bg-white dark:bg-darkpanel rounded-lg shadow-sm border border-slate-200 dark:border-darkborder active:scale-95"><i class="fas fa-edit mr-1.5"></i> Impostazioni</button>
                <button onclick="openEntityModal('create', 'project', '${s.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs rounded-lg font-bold shadow transition active:scale-95"><i class="fas fa-plus mr-1.5"></i> Nuovo Progetto</button>
            </div>
        </div>
        
        <div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div class="xl:col-span-3 space-y-6">
                <!-- QUADERNONE SFERA (Note Fisse + Pagine & Verbali) -->
                <div class="panel flex flex-col bg-white dark:bg-darkpanel shadow-sm border border-slate-200 dark:border-darkborder border-t-[5px]" style="border-top-color: ${s.color}">
                    ${renderProjectNotebook('sphere', s.id, s)}
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="panel p-6 bg-white dark:bg-darkpanel shadow-sm border border-slate-200 dark:border-darkborder">
                        <h3 class="text-[11px] font-bold text-amber-500 uppercase tracking-widest flex items-center mb-5 pb-3 border-b border-slate-100 dark:border-slate-700"><i class="fas fa-star mr-1.5"></i> Progetti In Evidenza</h3>
                        <div class="space-y-4">${renderProjList(pinned, 'sphere_pinned') || `<p class="text-xs text-slate-400 italic">Niente in evidenza.</p>`}</div>
                    </div>
                    <div class="panel p-6 bg-white dark:bg-darkpanel shadow-sm border border-slate-200 dark:border-darkborder">
                        <h3 class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center mb-5 pb-3 border-b border-slate-100 dark:border-slate-700"><i class="fas fa-folder mr-1.5"></i> ${state.ui.showArchived ? 'Archivio Progetti' : 'Tutti i Progetti'}</h3>
                        <div class="space-y-4">${renderProjList(unpinned, 'sphere_unpinned') || `<p class="text-xs text-slate-400 italic">Nessun progetto in questa sezione.</p>`}</div>
                    </div>
                </div>
            </div>
            <div class="space-y-6">
                <div class="panel p-6 bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow-sm">
                    <h3 class="font-bold text-[11px] text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-5 pb-3 border-b border-slate-200 dark:border-darkborder flex items-center"><i class="fas fa-tasks text-blue-500 mr-2 text-sm"></i> Tasks Sfera</h3>
                    ${renderInlineTasks(s.id)}
                </div>
            </div>
        </div>`;
}

function renderEntityTimelineAndProgress(entity, type) {
    return '';
}

function renderProject() {
            const p = getEntity('project', state.path.projId);
            if(!p) return `<div class="text-center p-10"><p>Progetto non trovato.</p></div>`;
            const s = getEntity('sphere', state.path.sphereId);
            const subs = getChildren('project', p.id);
            const pinned = subs.filter(sp => sp.pinned && sp.archived === state.ui.showArchived);
            const unpinned = subs.filter(sp => !sp.pinned && sp.archived === state.ui.showArchived);
            const prjColor = p.color || (s?s.color:'#94a3b8');
            
            const renderSubList = (list, listType) => list.map(sp => {
                const spColor = sp.color || p.color || (s?s.color:'#94a3b8');
                return `
                <div draggable="true" ondragstart="onDragStart(event, '${sp.id}', 'subproject', '${listType}')" ondragend="onDragEnd(event)" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event, '${sp.id}', 'subproject', '${listType}')"
                     class="panel panel-hover p-4 flex justify-between items-center mb-3 border-l-[5px] group draggable bg-slate-50 dark:bg-[#202938] border border-slate-200 dark:border-darkborder" style="border-left-color: ${spColor}" onclick="navigate('subproject', '${s?s.id:null}', '${p.id}', '${sp.id}')">
                    <div class="word-wrap flex-1">
                        <h4 class="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                            ${sp.pinned ? '<i class="fas fa-star text-amber-500 text-[10px]"></i>' : ''} <i class="fas ${sp.icon||'fa-file-alt'} text-slate-400 dark:text-slate-500 text-xs"></i> ${sp.name}
                        </h4>
                    </div>
                    <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                        <button onclick="event.stopPropagation(); togglePin('subproject', '${sp.id}')" class="text-slate-400 hover:text-amber-500 p-2.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition"><i class="fas fa-star text-[11px]"></i></button>
                        <button onclick="event.stopPropagation(); toggleArchiveEntity('subproject', '${sp.id}')" class="text-slate-400 hover:text-blue-500 p-2.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition"><i class="fas fa-archive text-[11px]"></i></button>
                        <i class="fas fa-grip-lines text-slate-300 dark:text-slate-600 text-sm ml-2 cursor-grab p-1"></i>
                    </div>
                </div>`}).join('');

            return `
                <div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
                    <div class="xl:col-span-3 space-y-6">
                        <div class="panel flex flex-col bg-white dark:bg-darkpanel shadow-sm border border-slate-200 dark:border-darkborder border-t-[6px]" style="border-top-color: ${prjColor}">
                            <div class="p-6 md:p-8 border-b border-slate-200 dark:border-darkborder relative">
                                <div class="absolute top-6 md:top-8 right-6 md:right-8 flex gap-2 text-sm z-10">
                                    <button onclick="togglePin('project', '${p.id}')" class="text-slate-400 hover:text-amber-500 transition p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Fissa in alto"><i class="fas fa-star ${p.pinned ? 'text-amber-500':''}"></i></button>
                                    <button onclick="toggleArchiveEntity('project', '${p.id}')" class="text-slate-400 hover:text-blue-500 transition p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Archivia Progetto"><i class="fas fa-archive"></i></button>
                                    <button onclick="openEntityModal('edit', 'project', '${s?s.id:null}', '${p.id}')" class="text-slate-400 hover:text-slate-800 dark:hover:text-white transition p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Modifica"><i class="fas fa-edit"></i></button>
                                </div>
                                <div class="flex items-center gap-2 mb-3">
                                    <span class="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-widest border border-slate-200 dark:border-slate-700" style="color:${s?s.color:'#94a3b8'}">${s?s.name:'Sconosciuta'}</span>
                                </div>
                                <h2 class="text-3xl font-bold mb-4 pr-32 text-slate-900 dark:text-white tracking-tight"><i class="fas ${p.icon||'fa-folder'} mr-3 opacity-70"></i> ${p.name}</h2>
                                <div class="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                                    <span class="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700">${p.type}</span>
                                    <span class="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700">${p.status}</span>
                                    ${p.archived ? `<span class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 px-3 py-1.5 rounded-md"><i class="fas fa-archive mr-1.5"></i>Archiviato</span>` : ''}
                                </div>
                            </div>
                            
                            ${renderProjectNotebook('project', p.id, p)}
                        </div>

                        <div class="panel p-6 md:p-8 bg-white dark:bg-darkpanel shadow-sm border border-slate-200 dark:border-darkborder">
                            <div class="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 dark:border-darkborder">
                                <h3 class="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center"><i class="fas fa-sitemap text-blue-500 mr-2 text-sm"></i> Sottoprogetti</h3>
                                <div class="flex gap-2.5 text-sm z-10 relative">
                                    <button onclick="toggleArchivedView()" class="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkborder bg-slate-50 dark:bg-[#202938] transition active:scale-95"><i class="fas fa-archive mr-1.5"></i> ${state.ui.showArchived ? 'Attivi':'Archivio'}</button>
                                    <button onclick="openEntityModal('create', 'subproject', '${s?s.id:null}', '${p.id}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-4 py-1.5 rounded-lg shadow transition active:scale-95"><i class="fas fa-plus mr-1.5"></i> Nuovo</button>
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="space-y-3">
                                    ${pinned.length > 0 ? `<h4 class="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-3 flex items-center"><i class="fas fa-star mr-1.5"></i> In Evidenza</h4>${renderSubList(pinned, 'project_pinned')}` : ''}
                                </div>
                                <div class="space-y-3">
                                    <h4 class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">${state.ui.showArchived ? 'Archiviati' : 'Tutti i Sottoprogetti'}</h4>
                                    ${renderSubList(unpinned, 'project_unpinned') || `<p class="text-sm text-slate-400 italic">Nessun sottoprogetto.</p>`}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="space-y-6">
                        <div class="panel p-6 bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow-sm">
                            <h3 class="font-bold text-[11px] text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-5 pb-4 border-b border-slate-200 dark:border-darkborder flex items-center"><i class="fas fa-tasks text-blue-500 mr-2 text-sm"></i> Tasks Progetto</h3>
                            ${renderInlineTasks(p.id)}
                        </div>
                        ${(state.data.features?.contacts !== false) ? `
                        <div class="panel p-6 bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow-sm">
                            <div class="flex justify-between items-center mb-5 pb-4 border-b border-slate-200 dark:border-darkborder">
                                <h3 class="font-bold text-[11px] text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center"><i class="fas fa-users text-purple-500 mr-2 text-sm"></i> Contatti</h3>
                                <button onclick="openContactModal(null, '${p.id}')" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline transition p-1"><i class="fas fa-plus"></i></button>
                            </div>
                            ${renderContextContacts(p.id)}
                        </div>
                        ` : ''}
                    </div>
                </div>`;
        }

function renderSubproject() {
            const sp = getEntity('subproject', state.path.subprojId);
            if(!sp) return `<div class="text-center p-10"><p>Sottoprogetto non trovato.</p></div>`;
            const p = getEntity('project', sp.projectId);
            const s = p ? getEntity('sphere', p.sphereId) : null;
            const spColor = sp.color || (p?p.color:null) || (s?s.color:'#94a3b8');

            return `
                <div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
                    <div class="xl:col-span-3 space-y-6">
                        <div class="panel flex flex-col bg-white dark:bg-darkpanel shadow-sm border border-slate-200 dark:border-darkborder border-t-[6px]" style="border-top-color: ${spColor}">
                            <div class="p-6 md:p-8 border-b border-slate-200 dark:border-darkborder relative">
                                <div class="absolute top-6 md:top-8 right-6 md:right-8 flex gap-2 text-sm z-10">
                                    <button onclick="togglePin('subproject', '${sp.id}')" class="text-slate-400 hover:text-amber-500 transition p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Fissa in alto"><i class="fas fa-star ${sp.pinned ? 'text-amber-500':''}"></i></button>
                                    <button onclick="toggleArchiveEntity('subproject', '${sp.id}')" class="text-slate-400 hover:text-blue-500 transition p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Archivia"><i class="fas fa-archive"></i></button>
                                    <button onclick="openEntityModal('edit', 'subproject', '${s?s.id:null}', '${p?p.id:null}', '${sp.id}')" class="text-slate-400 hover:text-slate-800 dark:hover:text-white transition p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><i class="fas fa-edit"></i></button>
                                </div>
                                <div class="flex items-center gap-2 mb-3">
                                    <span class="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-widest border border-slate-200 dark:border-slate-700" style="color:${spColor}">${p?p.name:'Sconosciuto'}</span>
                                </div>
                                <h2 class="text-3xl font-bold mb-4 pr-32 text-slate-900 dark:text-white tracking-tight"><i class="fas ${sp.icon||'fa-file-alt'} mr-3 opacity-70"></i> ${sp.name}</h2>
                                <div class="flex gap-3 text-xs font-bold text-slate-500">
                                    <span class="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700">${sp.type || 'A termine'}</span>
                                    <span class="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700">${sp.status || 'Attivo'}</span>
                                </div>
                            </div>
                            
                            ${renderProjectNotebook('subproject', sp.id, sp)}
                        </div>
                    </div>
                    <div class="space-y-6">
                        <div class="panel p-6 bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow-sm">
                            <h3 class="font-bold text-[11px] text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-5 pb-4 border-b border-slate-200 dark:border-darkborder flex items-center"><i class="fas fa-tasks text-blue-500 mr-2 text-sm"></i> Tasks Specifici</h3>
                            ${renderInlineTasks(sp.id)}
                        </div>
                        ${(state.data.features?.contacts !== false) ? `
                        <div class="panel p-6 bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow-sm">
                            <div class="flex justify-between items-center mb-5 pb-4 border-b border-slate-200 dark:border-darkborder">
                                <h3 class="font-bold text-[11px] text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center"><i class="fas fa-users text-purple-500 mr-2 text-sm"></i> Contatti</h3>
                                <button onclick="openContactModal(null, '${sp.id}')" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline transition p-1"><i class="fas fa-plus"></i></button>
                            </div>
                            ${renderContextContacts(sp.id)}
                        </div>
                        ` : ''}
                    </div>
                </div>`;
        }

function renderInlineTasks(contextId, showGlobal=false, showCompletedOption=true) {
            let validCtxIds = [];
            if (contextId) {
                validCtxIds = [contextId];
                const s = getEntity('sphere', contextId);
                const p = getEntity('project', contextId);
                if (s) {
                    getChildren('sphere', s.id).forEach(proj => {
                        validCtxIds.push(proj.id);
                        getChildren('project', proj.id).forEach(sub => validCtxIds.push(sub.id));
                    });
                } else if (p) {
                    getChildren('project', p.id).forEach(sub => validCtxIds.push(sub.id));
                }
            }

            let tasks = contextId ? state.data.tasks.filter(t => validCtxIds.includes(t.contextId)) : [...state.data.tasks];

            if (showGlobal && !contextId) {
                const filter = state.ui.homeTaskFilter || 'all';
                const ctxFilter = state.ui.homeContextFilter || 'all';
                const todayStr = getISODate(new Date());

                if (ctxFilter !== 'all') {
                    let globalValidCtxIds = [ctxFilter];
                    const gs = getEntity('sphere', ctxFilter);
                    const gp = getEntity('project', ctxFilter);
                    if (gs) {
                        getChildren('sphere', gs.id).forEach(proj => {
                            globalValidCtxIds.push(proj.id);
                            getChildren('project', proj.id).forEach(sub => globalValidCtxIds.push(sub.id));
                        });
                    } else if (gp) {
                        getChildren('project', gp.id).forEach(sub => globalValidCtxIds.push(sub.id));
                    }
                    tasks = tasks.filter(t => globalValidCtxIds.includes(t.contextId));
                }

                if(filter === 'today') { tasks = tasks.filter(t => t.dueDate === todayStr); }
                else if(filter === 'next7') { 
                    const today = new Date();
                    const nextWeek = new Date();
                    nextWeek.setDate(today.getDate() + 7);
                    const tStr = getISODate(today);
                    const nStr = getISODate(nextWeek);
                    tasks = tasks.filter(t => t.dueDate >= tStr && t.dueDate <= nStr); 
                }
                else if(filter === 'inbox') { tasks = tasks.filter(t => !t.contextId); }
            }

            const hasCompleted = tasks.some(t => t.completed);
            tasks = tasks.filter(t => !(t.startDate && t.startDate > getISODate(new Date()) && !t.completed));
            if(!state.ui.showCompletedTasks) tasks = tasks.filter(t => !t.completed);
            tasks.sort((a,b) => a.completed - b.completed || b.priority - a.priority);

            const listCtxOpts = generateCtxOpts(contextId || '');

            let html = `
                <div class="flex gap-2 mb-6 relative">
                    <div class="flex-1 relative">
                        <input type="text" id="tIn_${contextId||'g'}" class="input-base w-full font-semibold text-sm py-2" placeholder="Aggiungi task... (es. Studiare p3 @domani #Progetto)" onkeydown="return handleSmartInputKeyDown(event, this)" onkeypress="if(event.key === 'Enter') addTask('${contextId||''}')" onkeyup="handleSmartInput(this, '${contextId||''}')" onfocus="handleSmartInput(this, '${contextId||''}')" onblur="setTimeout(()=>this.nextElementSibling?.classList.add('hidden'), 200)">
                    </div>
                    <select id="tCtx_${contextId||'g'}" class="input-base w-32 text-xs font-bold hidden sm:block">${listCtxOpts}</select>
                    <button onclick="addTask('${contextId||''}')" class="bg-blue-600 hover:bg-blue-700 px-4 rounded-lg text-white transition shadow-sm active:scale-95"><i class="fas fa-plus"></i></button>
                </div>
                <div class="space-y-2.5 max-h-[350px] overflow-y-auto pr-2">`;
            
            if(tasks.length === 0) html += `<p class="text-xs text-slate-400 text-center py-6 italic">Nessun task in questa lista.</p>`;
            
            tasks.forEach(t => {
                const ctx = getContextInfo(t.contextId);
                
                let cbClass = "";
                if(t.priority === 3) cbClass = "!border-red-400 checked:!bg-red-500 checked:!border-red-500 text-red-500";
                else if(t.priority === 2) cbClass = "!border-amber-400 checked:!bg-amber-500 checked:!border-amber-500 text-amber-500";
                else if(t.priority === 1) cbClass = "!border-blue-400 checked:!bg-blue-500 checked:!border-blue-500 text-blue-500";
                else cbClass = "text-slate-400 dark:text-slate-500";
                if(t.subtasks && t.subtasks.length > 0 && !t.completed) cbClass += " has-subtasks";
                
                const ctxBorder = ctx.color !== '#94a3b8' ? `border-left-color: ${ctx.color};` : `border-left-color: transparent;`;

                if (editingTaskId === t.id) {
                            let subHtml = `<div class="mt-2 space-y-1"><div class="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider"><i class="fas fa-list-ul mr-1"></i> Subtasks</div>`;
                            (t.subtasks||[]).forEach(st => {
                        subHtml += `<div draggable="true" ondragstart="onSubtaskDragStart(event, '${t.id}', '${st.id}')" ondragend="onSubtaskDragEnd(event)" ondragover="onSubtaskDragOver(event)" ondragleave="onSubtaskDragLeave(event)" ondrop="onSubtaskDrop(event, '${t.id}', '${st.id}')" class="flex items-center gap-2 p-1 rounded transition-colors"><i class="fas fa-grip-vertical subtask-drag-handle text-[10px] opacity-50 hover:opacity-100"></i><input type="checkbox" ${st.completed?'checked':''} onchange="toggleSubtask('${t.id}','${st.id}')" class="task-checkbox min-w-[14px] min-h-[14px] w-3.5 h-3.5 shrink-0"><input type="text" class="input-base text-xs py-1 flex-1 ${st.completed?'line-through opacity-50':''}" value="${st.title}" onchange="updateSubtask('${t.id}','${st.id}', this.value)"><button onclick="deleteSubtask('${t.id}','${st.id}')" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded"><i class="fas fa-times text-xs"></i></button></div>`;
                    });
                    subHtml += `<div class="flex items-center gap-2 mt-2 pl-4"><input type="text" id="newSt_${t.id}" class="input-base text-xs py-1 flex-1" placeholder="Aggiungi subtask..." onkeypress="if(event.key==='Enter') addSubtask('${t.id}')"><button onclick="addSubtask('${t.id}')" class="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-white px-2 py-1 rounded shadow-sm"><i class="fas fa-plus text-xs"></i></button></div></div>`;

                    html += `
                        <div class="flex flex-col gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-600 shadow-inner">
                            <input type="text" id="etTitle_${t.id}" value="${t.title}" class="input-base font-bold text-sm py-1.5">
                            <div class="flex flex-wrap gap-2">
                                <select id="etPri_${t.id}" class="input-base w-24 text-xs font-bold py-1.5"><option value="0" ${t.priority===0?'selected':''}>No Prio</option><option value="1" ${t.priority===1?'selected':''}>Bassa</option><option value="2" ${t.priority===2?'selected':''}>Media</option><option value="3" ${t.priority===3?'selected':''}>Alta</option></select>
                                <input type="date" id="etDate_${t.id}" value="${t.dueDate||''}" class="input-base w-32 text-xs font-bold py-1.5" title="Data Scadenza">
                                <div class="flex items-center gap-1 bg-indigo-50/50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800/40">
                                    <span class="text-[9px] text-indigo-500 font-bold uppercase" title="Visibile solo a partire da questa data">Attiva dal:</span>
                                    <input type="date" id="etStartDate_${t.id}" value="${t.startDate||''}" class="bg-transparent text-xs font-bold py-1 border-none outline-none text-indigo-600 dark:text-indigo-400">
                                </div>
                                <select id="etCtx_${t.id}" class="input-base flex-1 min-w-[140px] text-xs font-bold py-1.5">${generateCtxOpts(t.contextId)}</select>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                                <div class="flex items-center gap-1.5">
                                    <span class="text-[10px] text-slate-400 font-bold uppercase">Ricorrenza:</span>
                                    <select id="etRec_${t.id}" class="input-base py-1.5 text-xs font-bold">
                                        <option value="none" ${(!t.recurrence||t.recurrence==='none')?'selected':''}>Nessuna</option>
                                        <option value="daily" ${t.recurrence==='daily'?'selected':''}>Ogni giorno</option>
                                        <option value="weekly" ${t.recurrence==='weekly'?'selected':''}>Settimanale</option>
                                        <option value="monthly" ${t.recurrence==='monthly'?'selected':''}>Mensile</option>
                                        <option value="yearly" ${t.recurrence==='yearly'?'selected':''}>Annuale</option>
                                    </select>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <span class="text-[10px] text-slate-400 font-bold uppercase" title="Minuti stimati">Stima (m):</span>
                                    <input type="number" id="etEst_${t.id}" value="${t.estimatedMinutes||0}" min="0" step="5" class="input-base w-16 py-1.5 font-bold">
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <span class="text-[10px] text-slate-400 font-bold uppercase" title="Minuti spesi">Spesi (m):</span>
                                    <input type="number" id="etSpent_${t.id}" value="${t.spentMinutes||0}" min="0" step="5" class="input-base w-16 py-1.5 font-bold">
                                </div>
                            </div>
                            ${subHtml}
                            <div class="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <button onclick="editingTaskId=null; render()" class="text-xs font-bold px-4 py-2 rounded-lg text-slate-500 hover:text-slate-800 bg-slate-200 dark:bg-slate-700 transition">Chiudi</button>
                                <button onclick="duplicateTask('${t.id}')" class="text-xs font-bold px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition active:scale-95"><i class="fas fa-clone mr-1"></i> Duplica</button>
                                <button onclick="saveTaskEdit('${t.id}', 'etCtx_${t.id}')" class="text-xs font-bold px-5 py-2 rounded-lg bg-blue-600 text-white shadow-sm transition active:scale-95">Salva</button>
                            </div>
                        </div>`;
                } else {
                    const hasSub = t.subtasks && t.subtasks.length > 0;
                    const doneSubCount = hasSub ? t.subtasks.filter(st => st.completed).length : 0;
                    const totalSubCount = hasSub ? t.subtasks.length : 0;
                    const isExpanded = !!(state.ui.expandedTasks && state.ui.expandedTasks[t.id]);
                    const { isBlocked, blockers, lockBadge, unlocksBadge, duePill } = getTaskLockAndDueHtml(t);
                    const effectiveCbClass = isBlocked ? 'task-checkbox-locked' : cbClass;

                    html += `
                        <div id="taskRow_${t.id}" class="panel p-2 md:p-3 flex flex-col bg-slate-50 dark:bg-[#202938] border border-slate-200 dark:border-darkborder rounded-xl hover:shadow-md transition group border-l-[3px] ${t.completed ? 'opacity-50 grayscale' : ''}" style="${ctxBorder}">
                            <div class="flex items-start gap-3 w-full">
                                <input type="checkbox" class="task-checkbox shrink-0 mt-0.5 ml-1 ${effectiveCbClass}" ${t.completed ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleTask('${t.id}')" title="${isBlocked ? 'Task bloccata: devi prima completare ' + blockers.join(', ') : ''}">
                                <div class="flex-1 min-w-0 flex flex-col justify-center cursor-pointer select-none" onclick="editTask('${t.id}')">
                                    <p class="${t.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'} text-[13px] sm:text-[14px] font-medium leading-snug break-words">${t.title}</p>
                                    ${(t.dueDate || (t.contextId && showGlobal) || hasSub || t.startDate || t.recurrence || t.estimatedMinutes || t.spentMinutes) ? `
                                    <div class="flex flex-wrap items-center gap-2 mt-1.5">
                                        ${duePill}
                                        ${typeof renderTaskBadges === 'function' ? renderTaskBadges(t) : ''}
                                        ${hasSub ? `
                                        <button onclick="event.stopPropagation(); toggleSubtasksVisibility('${t.id}')" class="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700/80 hover:bg-blue-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 border border-slate-300/60 dark:border-slate-600 transition active:scale-95" title="Mostra/Nascondi sottotask">
                                            <i class="fas ${isExpanded ? 'fa-chevron-down text-blue-500' : 'fa-chevron-right text-slate-400'} text-[8px]"></i>
                                            <i class="fas fa-list-check text-blue-500 text-[10px]"></i>
                                            <span>${doneSubCount}/${totalSubCount} subtask</span>
                                        </button>
                                        ${getSubtaskProgressHtml(t)}` : ''}
                                        ${showGlobal && t.contextId ? `<span class="text-[9px] uppercase font-bold tracking-wider truncate px-2 py-0.5 rounded border" style="color:${ctx.color}; border-color:${ctx.color}40; background-color:${ctx.color}10"><i class="fas ${ctx.icon} mr-1 opacity-50"></i>${ctx.name}</span>` : ''}
                                    </div>` : ''}
                                </div>
                                <div class="flex items-center opacity-0 group-hover:opacity-100 transition mr-1 pt-0.5">
                                    <button class="text-slate-400 hover:text-amber-500 text-sm p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition" onclick="event.stopPropagation(); duplicateTask('${t.id}')" title="Duplica"><i class="fas fa-clone text-xs"></i></button>
                                    <button class="text-slate-400 hover:text-blue-500 text-sm p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition ml-1" onclick="event.stopPropagation(); editTask('${t.id}')" title="Modifica"><i class="fas fa-edit text-xs"></i></button>
                                    <button class="text-slate-400 hover:text-red-500 text-sm p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition ml-1" onclick="event.stopPropagation(); deleteTask('${t.id}')" title="Elimina"><i class="fas fa-trash text-xs"></i></button>
                                </div>
                            </div>
                            ${(isExpanded && hasSub) ? `
                            <div class="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 pl-8 space-y-1.5 w-full" onclick="event.stopPropagation()">
                                ${t.subtasks.map(st => `
                                    <div class="flex items-center gap-2.5 py-1 px-2 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition">
                                        <input type="checkbox" ${st.completed ? 'checked' : ''} 
                                               onclick="event.stopPropagation()" 
                                               onchange="toggleSubtask('${t.id}', '${st.id}')" 
                                               class="task-checkbox min-w-[13px] min-h-[13px] w-3.5 h-3.5 !border-slate-400 checked:!bg-blue-500 checked:!border-blue-500 shrink-0 cursor-pointer">
                                        <span class="text-xs ${st.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'} break-words flex-1 select-none">
                                            ${st.title}
                                        </span>
                                    </div>
                                `).join('')}
                            </div>` : ''}
                        </div>`;
                }
            });

            if(showCompletedOption && hasCompleted) {
                html += `<div class="mt-5 text-center border-t border-slate-200 dark:border-darkborder pt-4"><button onclick="state.ui.showCompletedTasks = !state.ui.showCompletedTasks; render();" class="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg">${state.ui.showCompletedTasks ? 'Nascondi completati' : 'Mostra completati'}</button></div>`;
            }
            return html + `</div>`;
        }

function getFilteredAdvancedTasksData() {
    let tasks = [...state.data.tasks];
    const todayStr = getISODate(new Date());
    let listTitle = "Tutte le task";

    if(state.ui.tmView === 'today') { tasks = tasks.filter(t => t.dueDate === todayStr); listTitle = "Oggi"; }
    else if(state.ui.tmView === 'next7') { 
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        const tStr = getISODate(today);
        const nStr = getISODate(nextWeek);
        tasks = tasks.filter(t => t.dueDate >= tStr && t.dueDate <= nStr); 
        listTitle = "Prossimi 7 Giorni"; 
    }
    else if(state.ui.tmView === 'overdue') {
        tasks = tasks.filter(t => t.dueDate && t.dueDate < todayStr && !t.completed);
        listTitle = "Task Scadute (In Ritardo)";
    }
    else if(state.ui.tmView === 'inbox') { tasks = tasks.filter(t => !t.contextId); listTitle = "Posta in arrivo"; }
    else if(state.ui.tmView === 'future') {
        tasks = tasks.filter(t => t.startDate && t.startDate > todayStr && !t.completed);
        listTitle = "In Attesa di Attivazione (Future)";
    }
    else if(state.ui.tmView === 'all') { listTitle = "Tutte le task"; }
    else if(state.ui.tmView.startsWith('s_')) { 
        const id = state.ui.tmView.replace('s_',''); 
        tasks = tasks.filter(t => {
            if(t.contextId === id) return true;
            let p = getEntity('project', t.contextId);
            if(p && p.sphereId === id) return true;
            let sp = getEntity('subproject', t.contextId);
            if(sp) { let pp = getEntity('project', sp.projectId); if(pp && pp.sphereId === id) return true; }
            return false;
        }); 
        let sObj = getEntity('sphere', id); listTitle = sObj ? sObj.name : 'Lista'; 
    }
    else if(state.ui.tmView.startsWith('p_')) { 
        const id = state.ui.tmView.replace('p_',''); 
        tasks = tasks.filter(t => t.contextId === id || (getEntity('subproject', t.contextId)?.projectId === id)); 
        let pObj = getEntity('project', id); listTitle = pObj ? pObj.name : 'Lista'; 
    }
    else if(state.ui.tmView.startsWith('sp_')) { 
        const id = state.ui.tmView.replace('sp_',''); 
        tasks = tasks.filter(t => t.contextId === id); 
        let spObj = getEntity('subproject', id); listTitle = spObj ? spObj.name : 'Lista'; 
    }

    // Escludi le task future non ancora attive dalle viste standard
    if (state.ui.tmView !== 'future') {
        tasks = tasks.filter(t => !(t.startDate && t.startDate > todayStr && !t.completed));
    }

    // Filtro Ricerca Live (Cerca per titolo, contesto o sottotask)
    if (state.ui.taskSearchQuery && state.ui.taskSearchQuery.trim()) {
        const q = state.ui.taskSearchQuery.toLowerCase().trim();
        tasks = tasks.filter(t => {
            const titleMatch = t.title && t.title.toLowerCase().includes(q);
            const ctx = getContextInfo(t.contextId);
            const ctxMatch = ctx && ctx.name && ctx.name.toLowerCase().includes(q);
            const subMatch = (t.subtasks || []).some(s => s.title && s.title.toLowerCase().includes(q));
            return titleMatch || ctxMatch || subMatch;
        });
        listTitle += ` · Risultati per "${state.ui.taskSearchQuery}"`;
    }

    const listConf = tmListSettings[state.ui.tmView] || { groupBy: 'priority', sortBy: 'priority' };
    const hasCompleted = tasks.some(t => t.completed);
    if(!state.ui.showCompletedTasks) tasks = tasks.filter(t => !t.completed);

    tasks.sort((a,b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if(listConf.sortBy === 'priority') return b.priority - a.priority;
        if(listConf.sortBy === 'date') return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
        if(listConf.sortBy === 'name') return a.title.localeCompare(b.title);
        return 0;
    });

    return { tasks, listTitle, listConf, hasCompleted, todayStr };
}


function generateAdvancedTasksHtml() {
    const { tasks, listConf, hasCompleted, todayStr } = getFilteredAdvancedTasksData();
    let groups = {};
    if(listConf.groupBy === 'priority') {
        groups = { "Alta": [], "Media": [], "Bassa": [], "Nessuna": [] };
        tasks.forEach(t => {
            if(t.priority === 3) groups["Alta"].push(t);
            else if(t.priority === 2) groups["Media"].push(t);
            else if(t.priority === 1) groups["Bassa"].push(t);
            else groups["Nessuna"].push(t);
        });
    } else if (listConf.groupBy === 'date') {
        groups = { "Oggi": [], "Prossimamente": [], "Senza Data": [] };
        tasks.forEach(t => {
            if(!t.dueDate) groups["Senza Data"].push(t);
            else if(t.dueDate === todayStr) groups["Oggi"].push(t);
            else groups["Prossimamente"].push(t);
        });
    } else if (listConf.groupBy === 'none') {
        groups = { "": tasks }; 
    }

    let tasksHtml = '';
    if(tasks.length === 0) {
        tasksHtml = `<div class="text-center py-20 text-slate-400"><i class="fas fa-clipboard-check text-6xl mb-5 opacity-20"></i><p class="font-bold text-sm">${state.ui.taskSearchQuery ? 'Nessuna task trovata per i criteri cercati.' : 'Tutto completato per ora!'}</p></div>`;
    } else {
        for (const [groupName, groupTasks] of Object.entries(groups)) {
            if(groupTasks.length === 0) continue;
            
            let groupColor = "text-slate-500";
            if(groupName === "Alta") groupColor = "text-red-500";
            if(groupName === "Media") groupColor = "text-amber-500";
            if(groupName === "Bassa") groupColor = "text-blue-500";

            if(groupName !== "") {
                tasksHtml += `<div class="flex justify-between items-center px-2 mb-3 mt-6"><h3 class="text-xs font-bold ${groupColor} uppercase tracking-wider">${groupName}</h3><span class="text-[10px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">${groupTasks.length}</span></div>`;
            }
            
            tasksHtml += `<div class="bg-white dark:bg-darkpanel rounded-2xl shadow-sm border border-slate-100 dark:border-darkborder overflow-hidden mb-5">`;
            
            groupTasks.forEach((t, idx) => {
                const ctx = getContextInfo(t.contextId);
                const isLast = idx === groupTasks.length - 1;
                const borderBottom = isLast ? '' : 'border-b border-slate-100 dark:border-slate-700/50';
                const ctxBorder = ctx.color !== '#94a3b8' ? `border-left-color: ${ctx.color};` : `border-left-color: transparent;`;
                
                if (editingTaskId === t.id) {
                    let subHtml = `<div class="mt-2 space-y-1"><div class="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider"><i class="fas fa-list-ul mr-1"></i> Subtasks</div>`;
                    (t.subtasks||[]).forEach(st => {
                        subHtml += `<div class="flex items-center gap-2"><input type="checkbox" ${st.completed?'checked':''} onchange="toggleSubtask('${t.id}','${st.id}')" class="task-checkbox min-w-[14px] min-h-[14px] w-3.5 h-3.5"><input type="text" class="input-base text-xs py-1 flex-1 ${st.completed?'line-through opacity-50':''}" value="${st.title}" onchange="updateSubtask('${t.id}','${st.id}', this.value)"><button onclick="deleteSubtask('${t.id}','${st.id}')" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded"><i class="fas fa-times text-xs"></i></button></div>`;
                    });
                    subHtml += `<div class="flex items-center gap-2 mt-2"><input type="text" id="newSt_${t.id}" class="input-base text-xs py-1 flex-1" placeholder="Aggiungi subtask..." onkeypress="if(event.key==='Enter') addSubtask('${t.id}')"><button onclick="addSubtask('${t.id}')" class="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-white px-2 py-1 rounded shadow-sm"><i class="fas fa-plus text-xs"></i></button></div></div>`;

                    tasksHtml += `
                        <div class="p-3 bg-slate-50 dark:bg-[#1a1c23] ${borderBottom} flex flex-col gap-3">
                            <input type="text" id="etTitle_${t.id}" value="${t.title}" class="input-base font-bold text-base py-2">
                            <div class="flex flex-wrap items-center gap-3">
                                <select id="etPri_${t.id}" class="input-base w-28 text-xs font-bold py-2"><option value="0" ${t.priority===0?'selected':''}>No Prio</option><option value="1" ${t.priority===1?'selected':''}>Bassa</option><option value="2" ${t.priority===2?'selected':''}>Media</option><option value="3" ${t.priority===3?'selected':''}>Alta</option></select>
                                <input type="date" id="etDate_${t.id}" value="${t.dueDate||''}" class="input-base w-32 text-xs font-bold py-2" title="Data Scadenza">
                                <div class="flex items-center gap-1.5 bg-indigo-50/50 dark:bg-indigo-950/20 px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/40">
                                    <span class="text-[10px] text-indigo-500 font-bold uppercase" title="Visibile solo a partire da questa data">Attiva dal:</span>
                                    <input type="date" id="etStartDate_${t.id}" value="${t.startDate||''}" class="bg-transparent text-xs font-bold border-none outline-none text-indigo-600 dark:text-indigo-400">
                                </div>
                                <select id="etCtx_${t.id}" class="input-base flex-1 min-w-[140px] text-xs font-bold py-2">${generateCtxOpts(t.contextId)}</select>
                                <select id="etRec_${t.id}" class="input-base w-36 text-xs font-bold py-2">
                                    <option value="none" ${(!t.recurrence||t.recurrence.frequency==='none')?'selected':''}>No Ricorrenza</option>
                                    <option value="daily" ${t.recurrence?.frequency==='daily'?'selected':''}>🔁 Giornaliera</option>
                                    <option value="weekdays" ${t.recurrence?.frequency==='weekdays'?'selected':''}>🔁 Lun-Ven</option>
                                    <option value="weekly" ${t.recurrence?.frequency==='weekly'?'selected':''}>🔁 Settimanale</option>
                                    <option value="monthly" ${t.recurrence?.frequency==='monthly'?'selected':''}>🔁 Mensile</option>
                                </select>
                            </div>
                            <div class="flex flex-wrap items-center gap-3 pt-1 text-xs">
                                <div class="flex items-center gap-1.5">
                                    <span class="text-[10px] text-slate-400 font-bold uppercase">Stima (min):</span>
                                    <input type="number" id="etEst_${t.id}" value="${t.estimatedMinutes||0}" min="0" step="5" class="input-base w-20 py-1.5 font-bold">
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <span class="text-[10px] text-slate-400 font-bold uppercase">Speso (min):</span>
                                    <input type="number" id="etSpent_${t.id}" value="${t.spentMinutes||0}" min="0" step="5" class="input-base w-20 py-1.5 font-bold">
                                </div>
                            </div>
                            ${subHtml}
                            <div class="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <button onclick="editingTaskId=null; render()" class="text-[11px] font-bold px-4 py-2 rounded-lg text-slate-500 hover:text-slate-800 bg-slate-200 dark:bg-slate-700 transition">Chiudi</button>
                                <button onclick="duplicateTask('${t.id}')" class="text-[11px] font-bold px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow transition active:scale-95"><i class="fas fa-clone mr-1"></i> Duplica</button>
                                <button onclick="saveTaskEdit('${t.id}', 'etCtx_${t.id}')" class="text-[11px] font-bold px-5 py-2 rounded-lg bg-blue-600 text-white shadow transition active:scale-95">Salva</button>
                            </div>
                        </div>`;
                } else {
                    let cbClass = "";
                    if(t.priority === 3) cbClass = "!border-red-400 checked:!bg-red-500 checked:!border-red-500 text-red-500";
                    else if(t.priority === 2) cbClass = "!border-amber-400 checked:!bg-amber-500 checked:!border-amber-500 text-amber-500";
                    else if(t.priority === 1) cbClass = "!border-blue-400 checked:!bg-blue-500 checked:!border-blue-500 text-blue-500";
                    else cbClass = "text-slate-400 dark:text-slate-500";
                    if(t.subtasks && t.subtasks.length > 0 && !t.completed) cbClass += " has-subtasks";

                    const hasSub = t.subtasks && t.subtasks.length > 0;
                    const doneSubCount = hasSub ? t.subtasks.filter(st => st.completed).length : 0;
                    const totalSubCount = hasSub ? t.subtasks.length : 0;
                    const isExpanded = !!(state.ui.expandedTasks && state.ui.expandedTasks[t.id]);
                    const { isBlocked, blockers, duePill } = getTaskLockAndDueHtml(t);
                    const effectiveCbClass = cbClass;

                    tasksHtml += `
                        <div id="taskRow_${t.id}" class="p-2.5 md:p-3 flex flex-col ${borderBottom} group hover:bg-slate-50 dark:hover:bg-[#202938] transition-colors border-l-[3px] ${t.completed ? 'opacity-50 grayscale' : ''}" style="${ctxBorder}">
                            <div class="flex items-start gap-3 w-full">
                                <input type="checkbox" class="task-checkbox shrink-0 mt-0.5 ml-1 ${effectiveCbClass}" ${t.completed ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleTask('${t.id}')">
                                <div class="flex-1 min-w-0 flex flex-col justify-center cursor-pointer select-none" onclick="editTask('${t.id}')">
                                    <p class="${t.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'} text-[13px] sm:text-[14px] font-medium leading-snug break-words">${t.title}</p>
                                    ${(t.dueDate || t.contextId || hasSub || t.startDate || t.recurrence || t.estimatedMinutes || t.spentMinutes) ? `
                                    <div class="flex flex-wrap items-center gap-2 mt-1.5">
                                        ${duePill}
                                        ${typeof renderTaskBadges === 'function' ? renderTaskBadges(t) : ''}
                                        ${hasSub ? `
                                        <button onclick="event.stopPropagation(); toggleSubtasksVisibility('${t.id}')" class="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition active:scale-95" title="Mostra/Nascondi sottotask">
                                            <i class="fas ${isExpanded ? 'fa-chevron-down text-blue-500' : 'fa-chevron-right text-slate-400'} text-[8px]"></i>
                                            <i class="fas fa-list-check text-blue-500 text-[10px]"></i>
                                            <span>${doneSubCount}/${totalSubCount} subtask</span>
                                        </button>
                                        ${getSubtaskProgressHtml(t)}` : ''}
                                        ${t.contextId ? `<span class="text-[9px] text-slate-400 font-bold truncate bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700"><i class="fas ${ctx.icon} mr-1 opacity-50"></i>${ctx.name}</span>` : ''}
                                    </div>` : ''}
                                </div>
                                <div class="flex items-center opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition ml-2 pt-0.5">
                                    <button onclick="event.stopPropagation(); duplicateTask('${t.id}')" class="text-slate-400 hover:text-amber-500 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Duplica"><i class="fas fa-clone text-[12px]"></i></button>
                                    <button onclick="event.stopPropagation(); editTask('${t.id}')" class="text-slate-400 hover:text-blue-500 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition ml-1" title="Modifica"><i class="fas fa-edit text-[12px]"></i></button>
                                    <button onclick="event.stopPropagation(); deleteTask('${t.id}')" class="text-slate-400 hover:text-red-500 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition ml-1" title="Elimina"><i class="fas fa-trash-alt text-[12px]"></i></button>
                                </div>
                            </div>
                            ${(isExpanded && hasSub) ? `
                            <div class="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 pl-8 space-y-1.5 w-full" onclick="event.stopPropagation()">
                                ${t.subtasks.map(st => `
                                    <div class="flex items-center gap-2.5 py-1 px-2 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition">
                                        <input type="checkbox" ${st.completed ? 'checked' : ''} 
                                               onclick="event.stopPropagation()" 
                                               onchange="toggleSubtask('${t.id}', '${st.id}')" 
                                               class="task-checkbox min-w-[13px] min-h-[13px] w-3.5 h-3.5 !border-slate-400 checked:!bg-blue-500 checked:!border-blue-500 shrink-0 cursor-pointer">
                                        <span class="text-xs ${st.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'} break-words flex-1 select-none">
                                            ${st.title}
                                        </span>
                                    </div>
                                `).join('')}
                            </div>` : ''}
                        </div>`;
                }
            });
            tasksHtml += `</div>`;
        }
    }

    if(hasCompleted) {
        tasksHtml += `<div class="mt-8 text-center pb-6"><button onclick="state.ui.showCompletedTasks = !state.ui.showCompletedTasks; render();" class="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition bg-slate-200 dark:bg-slate-800 px-4 py-2 rounded-lg shadow-sm active:scale-95">${state.ui.showCompletedTasks ? 'Nascondi completati' : 'Mostra completati'}</button></div>`;
    }
    return tasksHtml;
}

function handleTaskSearch(query) {
    state.ui.taskSearchQuery = query;
    const titleEl = document.getElementById('tmListTitle');
    const containerEl = document.getElementById('tmTasksListContainer');
    const clearBtn = document.getElementById('tmSearchClearBtn');
    
    const { listTitle } = getFilteredAdvancedTasksData();
    if (titleEl) {
        titleEl.innerHTML = `<i class="far fa-clipboard text-slate-400 mr-2 hidden md:inline-block"></i> ${listTitle}`;
    }
    if (containerEl) {
        containerEl.innerHTML = generateAdvancedTasksHtml();
    }
    if (clearBtn) {
        if (query && query.trim()) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }
}

function clearTaskSearch() {
    state.ui.taskSearchQuery = '';
    const input = document.getElementById('tmSearchInput');
    if (input) {
        input.value = '';
        input.focus();
    }
    handleTaskSearch('');
}

function renderAdvancedTaskManager() {
    if (state.data.features?.eisenhowerMatrix === false && state.ui.tmViewMode === 'eisenhower') {
        state.ui.tmViewMode = 'list';
    }
    let navHtml = `
                <div class="flex items-center gap-3 p-5 mb-2 md:hidden border-b border-slate-200 dark:border-slate-700">
                    <button onclick="navigate('home')" class="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-lg transition hover:text-blue-500 shadow-sm active:scale-95"><i class="fas fa-home"></i></button>
                    <div class="font-bold text-slate-800 dark:text-white flex-1 leading-tight text-sm">Dashboard<br><span class="text-[10px] text-slate-400 font-normal">Torna alla home</span></div>
                    <button onclick="toggleTmSidebar()" class="p-2 text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full w-9 h-9 flex items-center justify-center transition active:scale-95"><i class="fas fa-times text-sm"></i></button>
                </div>
                
                <div class="mb-4 space-y-1 mt-4 md:mt-0 px-3 md:px-0">
                    ${(() => {
                        const todayIso = getISODate(new Date());
                        const overdueCount = (state.data.tasks || []).filter(t => t.dueDate && t.dueDate < todayIso && !t.completed).length;
                        const futureCount = (state.data.tasks || []).filter(t => t.startDate && t.startDate > todayIso && !t.completed).length;
                        
                        const advancedViews = ['overdue', 'future'];
                        const isAdvancedActive = advancedViews.includes(state.ui.tmView);
                        const isExpanded = state.ui.tmAdvancedViewsExpanded !== undefined ? state.ui.tmAdvancedViewsExpanded : isAdvancedActive;

                        return `
                            <div class="tm-nav-item ${state.ui.tmView==='all'?'active':''}" onclick="state.ui.tmView='all'; toggleTmSidebar(); render();"><i class="fas fa-layer-group w-5 text-blue-500 text-center"></i> Tutte le task</div>
                            <div class="tm-nav-item ${state.ui.tmView==='inbox'?'active':''}" onclick="state.ui.tmView='inbox'; toggleTmSidebar(); render();"><i class="fas fa-inbox w-5 text-slate-500 text-center"></i> Posta in arrivo</div>
                            <div class="tm-nav-item ${state.ui.tmView==='today'?'active':''}" onclick="state.ui.tmView='today'; toggleTmSidebar(); render();"><i class="fas fa-calendar-day w-5 text-amber-500 text-center"></i> Oggi</div>
                            <div class="tm-nav-item ${state.ui.tmView==='next7'?'active':''}" onclick="state.ui.tmView='next7'; toggleTmSidebar(); render();"><i class="fas fa-calendar-alt w-5 text-purple-500 text-center"></i> Prossimi 7 Giorni</div>
                            
                            <div class="pt-1.5 pb-0.5">
                                <button type="button" onclick="state.ui.tmAdvancedViewsExpanded = ${!isExpanded}; render();" class="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition font-semibold group">
                                    <span class="flex items-center gap-1.5 truncate">
                                        <i class="fas fa-filter text-[10px] text-slate-400 group-hover:text-blue-500 transition-colors"></i>
                                        <span>Filtri & Viste</span>
                                    </span>
                                    <span class="flex items-center gap-1.5 shrink-0">
                                        ${overdueCount > 0 && !isExpanded ? `<span class="text-[9px] font-bold bg-rose-500 text-white px-1.5 py-0.2 rounded-full shrink-0" title="${overdueCount} scadute">${overdueCount}</span>` : ''}
                                        <i class="fas fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-blue-500' : ''}"></i>
                                    </span>
                                </button>
                                
                                <div class="${isExpanded ? 'block' : 'hidden'} space-y-1 mt-1 pl-2.5 border-l-2 border-slate-200/80 dark:border-slate-700/80 ml-2.5">
                                    <div class="tm-nav-item ${state.ui.tmView==='overdue'?'active':''}" onclick="state.ui.tmView='overdue'; toggleTmSidebar(); render();">
                                        <i class="fas fa-exclamation-triangle w-5 text-rose-500 text-center"></i> 
                                        <span class="flex-1">Scadute</span>
                                        ${overdueCount > 0 ? `<span class="text-[9px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full shrink-0">${overdueCount}</span>` : ''}
                                    </div>
                                    <div class="tm-nav-item ${state.ui.tmView==='future'?'active':''}" onclick="state.ui.tmView='future'; toggleTmSidebar(); render();">
                                        <i class="fas fa-hourglass-start w-5 text-indigo-500 text-center"></i>
                                        <span class="flex-1">In Attesa di Attivazione</span>
                                        ${futureCount > 0 ? `<span class="text-[9px] font-bold bg-indigo-500 text-white px-1.5 py-0.5 rounded-full shrink-0">${futureCount}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    })()}
                </div>
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-5 md:px-2 border-t border-slate-200 dark:border-slate-700 pt-5">Le Tue Liste</div>
                <div class="space-y-1 max-h-[60vh] overflow-y-auto px-3 md:px-0 pb-20">`;
            
            state.data.spheres.sort((a,b)=>(a.order||0)-(b.order||0)).forEach(s => {
                navHtml += `<div class="mb-2">
                            <div class="flex items-center group"><i class="fas fa-chevron-down text-[11px] text-slate-400 cursor-pointer w-8 text-center hover:text-slate-800 dark:hover:text-white transition p-2" onclick="toggleNavFolder(event, 'nav_s_${s.id}')"></i><div class="tm-nav-item flex-1 ${state.ui.tmView==='s_'+s.id?'active':''}" onclick="state.ui.tmView='s_${s.id}'; toggleTmSidebar(); render();" style="color: ${state.ui.tmView==='s_'+s.id ? s.color : ''}"><i class="fas ${s.icon} w-5 text-center" style="color:${s.color}"></i> ${s.name}</div></div>
                            <div id="nav_s_${s.id}" class="pl-3 ml-4 mt-1 mb-2 space-y-1">`;
                
                getChildren('sphere', s.id).filter(p=>!p.archived).forEach(p => {
                    const subs = getChildren('project', p.id).filter(sp=>!sp.archived);
                    navHtml += `<div>`;
                    if(subs.length > 0) {
                        navHtml += `<div class="flex items-center group"><i class="fas fa-chevron-down text-[10px] text-slate-400 cursor-pointer w-8 text-center hover:text-slate-800 dark:hover:text-white transition p-2" onclick="toggleNavFolder(event, 'nav_p_${p.id}')"></i><div class="tm-nav-item flex-1 text-sm ${state.ui.tmView==='p_'+p.id?'active':''}" onclick="state.ui.tmView='p_${p.id}'; toggleTmSidebar(); render();"><i class="fas ${p.icon||'fa-folder'} w-5 text-center text-slate-400"></i> ${p.name}</div></div>`;
                        navHtml += `<div id="nav_p_${p.id}" class="pl-3 ml-4 mt-1 space-y-1">`;
                        subs.forEach(sp => {
                            navHtml += `<div class="flex items-center ml-1"><div class="tm-nav-item flex-1 text-xs ${state.ui.tmView==='sp_'+sp.id?'active':''}" onclick="state.ui.tmView='sp_${sp.id}'; toggleTmSidebar(); render();"><i class="fas ${sp.icon||'fa-file-alt'} w-5 text-center text-slate-400"></i> ${sp.name}</div></div>`;
                        });
                        navHtml += `</div>`;
                    } else {
                        navHtml += `<div class="flex items-center group"><div class="w-8"></div><div class="tm-nav-item flex-1 text-sm ${state.ui.tmView==='p_'+p.id?'active':''}" onclick="state.ui.tmView='p_${p.id}'; toggleTmSidebar(); render();"><i class="fas ${p.icon||'fa-folder'} w-5 text-center text-slate-400"></i> ${p.name}</div></div>`;
                    }
                    navHtml += `</div>`;
                });
                navHtml += `</div></div>`;
            });
            navHtml += `</div>`;

            let currentCtxId = "";
            if(state.ui.tmView.startsWith('s_')) currentCtxId = state.ui.tmView.replace('s_','');
            else if(state.ui.tmView.startsWith('p_')) currentCtxId = state.ui.tmView.replace('p_','');
            else if(state.ui.tmView.startsWith('sp_')) currentCtxId = state.ui.tmView.replace('sp_','');

            let ctxOpts = generateCtxOpts(currentCtxId);
            const { listTitle, listConf } = getFilteredAdvancedTasksData();
            const tasksHtml = generateAdvancedTasksHtml();

            return `
                <div class="fixed inset-0 md:relative flex overflow-hidden bg-slate-50 dark:bg-darkbg md:rounded-2xl md:border border-slate-200 dark:border-darkborder md:shadow-2xl md:min-h-[85vh] z-[60] md:z-auto">
                    
                    <div id="tmOverlayInner" class="tm-overlay md:hidden" style="z-index: 50;" onclick="toggleTmSidebar()"></div>

                    <!-- SIDEBAR -->
                    <div id="tmSidebar" class="tm-sidebar-mobile bg-[#eff4f9] dark:bg-[#13151a] md:border-r border-slate-200 dark:border-darkborder md:p-5 shrink-0 overflow-y-auto" style="z-index: 60;">
                        ${navHtml}
                    </div>

                    <!-- MAIN AREA -->
                    <div class="flex-1 flex flex-col bg-[#fdfaf5] dark:bg-darkpanel overflow-hidden w-full relative">
                        
                        <!-- HEADER MOBILE & DESKTOP -->
                        <div class="flex flex-wrap items-center justify-between gap-3 p-4 md:px-8 md:pt-8 bg-white dark:bg-slate-800 md:bg-transparent z-10 shrink-0 border-b border-slate-200 dark:border-slate-700 md:border-none shadow-sm md:shadow-none">
                            <div class="flex items-center gap-2 sm:gap-3">
                                <button onclick="toggleTmSidebar()" class="md:hidden text-slate-600 dark:text-slate-300 text-xl p-2 sm:p-1 transition rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95"><i class="fas fa-bars"></i></button>
                                <h2 id="tmListTitle" class="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center"><i class="far fa-clipboard text-slate-400 mr-2 hidden md:inline-block"></i> ${listTitle}</h2>
                            </div>
                            
                            <div class="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
                                <div class="relative w-36 sm:w-64">
                                    <i class="fas fa-search absolute left-3 top-2.5 text-xs text-slate-400"></i>
                                    <input type="text" id="tmSearchInput" value="${state.ui.taskSearchQuery || ''}" 
                                           placeholder="Cerca..." 
                                           oninput="handleTaskSearch(this.value)" 
                                           class="input-base pl-8 pr-7 py-1.5 text-xs font-semibold w-full bg-slate-100 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-darkpanel border-transparent focus:border-blue-500 transition-all rounded-lg">
                                    <button id="tmSearchClearBtn" onclick="clearTaskSearch()" class="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ${state.ui.taskSearchQuery ? '' : 'hidden'}" title="Azzera ricerca"><i class="fas fa-times"></i></button>
                                </div>
                                <div class="relative group">
                                    <button class="text-slate-500 hover:text-slate-800 dark:hover:text-white p-2 text-lg rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition"><i class="fas fa-ellipsis-v"></i></button>
                                    <div class="absolute right-0 mt-1 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-3">
                                        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Raggruppa per</div>
                                        <select class="input-base text-sm font-bold mb-4" onchange="setListSetting('groupBy', this.value)">
                                            <option value="none" ${listConf.groupBy==='none'?'selected':''}>Nessuno</option>
                                            <option value="priority" ${listConf.groupBy==='priority'?'selected':''}>Priorità</option>
                                            <option value="date" ${listConf.groupBy==='date'?'selected':''}>Data</option>
                                        </select>
                                        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Ordina per</div>
                                        <select class="input-base text-sm font-bold" onchange="setListSetting('sortBy', this.value)">
                                            <option value="priority" ${listConf.sortBy==='priority'?'selected':''}>Priorità</option>
                                            <option value="date" ${listConf.sortBy==='date'?'selected':''}>Data</option>
                                            <option value="name" ${listConf.sortBy==='name'?'selected':''}>Nome</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- BARRA INSERIMENTO TASK (Desktop) -->
                        <div class="hidden md:flex mx-8 mb-6 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex-row gap-3 shadow-sm relative z-40">
                            <div class="flex-1 relative">
                                <input type="text" id="gtIn" class="input-base w-full font-semibold text-sm py-2 px-3 border-transparent bg-transparent focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors" placeholder="Scrivi una nuova task... (es. Studiare p3 @domani #Progetto)" onkeydown="return handleSmartInputKeyDown(event, this)" onkeypress="if(event.key==='Enter') addTaskFromGlobal()" onkeyup="handleSmartInput(this, '')" onfocus="handleSmartInput(this, '')" onblur="setTimeout(()=>this.nextElementSibling?.classList.add('hidden'), 200)">
                            </div>
                            <select id="gtCtx" class="input-base w-36 text-xs font-bold py-2">${ctxOpts}</select>
                            <select id="gtPri" class="input-base w-28 text-xs font-bold py-2"><option value="0">No Prio</option><option value="1">Bassa</option><option value="2">Media</option><option value="3">Alta</option></select>
                            <input type="date" id="gtDate" class="input-base w-[130px] text-xs font-bold py-2">
                            <button onclick="addTaskFromGlobal()" class="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg text-white font-bold shadow transition active:scale-95"><i class="fas fa-plus"></i></button>
                        </div>

                        <!-- LISTA TASKS SCROLLABILE -->
                        <div id="tmTasksListContainer" class="flex-1 overflow-y-auto px-4 md:px-8 pb-28 pt-4 md:pt-0">
                            ${tasksHtml}
                        </div>
                    </div>
                </div>`;
        }

// --- SCHEDA GLOBALE PAGINE & NOTE (DATABASE CENTRALIZZATO NOTION-STYLE) ---

function openGlobalPageEditor(pageId) {
    activeSubpageId = pageId;
    render();
}

function createGlobalNewPage(prefill = {}) {
    const defaultProj = prefill.contextId || (state.ui.selectedPageContext !== 'all' ? state.ui.selectedPageContext : ((state.data.projects && state.data.projects[0]) ? state.data.projects[0].id : null));
    let sphereId = prefill.sphereId || (state.ui.selectedPageSphere !== 'all' ? state.ui.selectedPageSphere : null);
    if (!sphereId && defaultProj) {
        const p = getEntity('project', defaultProj);
        if (p) sphereId = p.sphereId;
        else {
            const sp = getEntity('subproject', defaultProj);
            if (sp) {
                const pp = getEntity('project', sp.projectId);
                if (pp) sphereId = pp.sphereId;
            }
        }
    }
    const tipologia = prefill.tipologia || (state.ui.selectedPageTipologia !== 'all' ? state.ui.selectedPageTipologia : 'Riunione');
    const now = getISODate(new Date());

    const newPage = {
        id: 'page_' + Date.now(),
        contextId: defaultProj,
        sphereId: sphereId,
        tipologia: tipologia,
        date: now,
        title: prefill.title || 'Nuova Pagina',
        content: '<p></p>',
        tags: [],
        createdAt: now,
        updatedAt: now
    };
    if (!state.data.pages) state.data.pages = [];
    state.data.pages.push(newPage);
    AppData.triggerSave();
    activeSubpageId = newPage.id;
    render();
    showToast(`Pagina "${newPage.title}" creata`, "success");
}

// Helpers di risoluzione Progetto e Ambito per le pagine
function resolvePageProject(page) {
    if (!page || !page.contextId) return null;
    const p = getEntity('project', page.contextId);
    if (p) {
        return { id: p.id, name: p.name, icon: p.icon || 'fa-folder', color: p.color || '#6366f1', isSub: false, sphereId: p.sphereId };
    }
    const sp = getEntity('subproject', page.contextId);
    if (sp) {
        const pp = getEntity('project', sp.projectId);
        return { id: sp.id, name: sp.name, icon: sp.icon || 'fa-file-alt', color: sp.color || '#8b5cf6', isSub: true, sphereId: pp ? pp.sphereId : null, parentName: pp ? pp.name : '' };
    }
    return null;
}

function resolvePageSphere(page, projInfo = null) {
    if (page && page.sphereId) {
        const s = getEntity('sphere', page.sphereId);
        if (s) return s;
    }
    const info = projInfo || resolvePageProject(page);
    if (info && info.sphereId) {
        const s = getEntity('sphere', info.sphereId);
        if (s) return s;
    }
    return null;
}

function formatPageDateDisplay(dateStr) {
    if (!dateStr) return '<span class="text-slate-400 dark:text-slate-600 text-[11px] italic">—</span>';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return escapeNoteHtml(dateStr);
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const mIdx = parseInt(parts[1], 10) - 1;
    const monthName = months[mIdx] || parts[1];
    return `${parts[2]} ${monthName} ${parts[0]}`;
}

function renderTipologiaBadge(tipologia) {
    const tipo = tipologia || 'Riunione';
    const types = (typeof getDocumentTypes === 'function') ? getDocumentTypes() : [];
    const found = types.find(t => t.name.toLowerCase() === tipo.toLowerCase());
    const color = found ? (found.color || '#64748b') : '#64748b';

    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold border transition shadow-xs" style="background-color: ${color}20; color: ${color}; border-color: ${color}40;">
        <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${color};"></span>
        ${escapeNoteHtml(tipo)}
    </span>`;
}

function renderAmbitoBadge(sphere) {
    if (!sphere) {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
            <i class="fas fa-circle text-[6px] text-slate-400"></i> Nessuno
        </span>`;
    }
    const color = sphere.color || '#6366f1';
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold border transition shadow-xs" style="background-color: ${color}22; color: ${color}; border-color: ${color}44;">
        <i class="fas fa-circle text-[7px]" style="color: ${color};"></i>
        ${escapeNoteHtml(sphere.name)}
    </span>`;
}

function renderProjectBadge(projInfo) {
    if (!projInfo) {
        return `<span class="inline-flex items-center gap-1 text-[11px] text-slate-400 italic">
            <i class="far fa-folder text-[10px]"></i> Generale
        </span>`;
    }
    let iconHtml = '';
    const icon = projInfo.icon || 'fa-folder';
    if (icon.startsWith('fa-')) {
        iconHtml = `<i class="fas ${icon} text-[10px]" style="color: ${projInfo.color || '#6366f1'};"></i>`;
    } else {
        iconHtml = `<span class="text-xs">${icon}</span>`;
    }

    return `<button type="button" onclick="event.stopPropagation(); navigateToNotebookContext('${projInfo.id}', ${projInfo.isSub})" class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition group/p">
        ${iconHtml}
        <span class="group-hover/p:underline truncate max-w-[150px]">${escapeNoteHtml(projInfo.name)}</span>
        ${projInfo.isSub ? '<span class="text-[9px] text-slate-400 font-normal">(sotto)</span>' : ''}
    </button>`;
}

// Navigazione rapida al quaderno del progetto
function navigateToNotebookContext(ctxId, isSub = false) {
    if (isSub) {
        const sp = getEntity('subproject', ctxId);
        if (sp) {
            const p = getEntity('project', sp.projectId);
            navigate('subproject', p ? p.sphereId : null, sp.projectId, sp.id);
            currentNotebookTab = 'pages';
            return;
        }
    } else {
        const p = getEntity('project', ctxId);
        if (p) {
            navigate('project', p.sphereId, p.id);
            currentNotebookTab = 'pages';
            return;
        }
    }
}

// Selezione pagine e azioni massive
function togglePageSelection(pageId, checked) {
    if (!state.ui.selectedPageIds) state.ui.selectedPageIds = [];
    if (checked) {
        if (!state.ui.selectedPageIds.includes(pageId)) state.ui.selectedPageIds.push(pageId);
    } else {
        state.ui.selectedPageIds = state.ui.selectedPageIds.filter(id => id !== pageId);
    }
    render();
}

function toggleSelectAllPages(checked, visibleIds) {
    if (!state.ui.selectedPageIds) state.ui.selectedPageIds = [];
    if (checked) {
        visibleIds.forEach(id => {
            if (!state.ui.selectedPageIds.includes(id)) state.ui.selectedPageIds.push(id);
        });
    } else {
        state.ui.selectedPageIds = state.ui.selectedPageIds.filter(id => !visibleIds.includes(id));
    }
    render();
}

function clearPageSelection() {
    state.ui.selectedPageIds = [];
    render();
}

function deleteBulkSelectedPages() {
    const ids = state.ui.selectedPageIds || [];
    if (ids.length === 0) return;
    if (!confirm(`Sei sicuro di voler eliminare le ${ids.length} pagine selezionate? L'operazione non è reversibile.`)) return;

    state.data.pages = (state.data.pages || []).filter(p => !ids.includes(p.id));
    if (ids.includes(activeSubpageId)) activeSubpageId = null;
    state.ui.selectedPageIds = [];
    AppData.triggerSave();
    render();
    showToast(`${ids.length} pagine eliminate con successo`, "success");
}

function openBulkExportModal(specificIds = null) {
    const modal = document.getElementById('pageExportModal');
    if (!modal) return;
    const isBulkEl = document.getElementById('exportIsBulk');
    if (isBulkEl) isBulkEl.value = 'true';
    const targetIdEl = document.getElementById('exportTargetPageId');
    const ids = specificIds || state.ui.selectedPageIds || [];
    if (targetIdEl) targetIdEl.value = ids.join(',');
    const pkgSel = document.getElementById('exportPackageTypeSelector');
    if (pkgSel) pkgSel.classList.remove('hidden');
    const printBtn = document.getElementById('exportPrintBtn');
    if (printBtn) printBtn.classList.add('hidden');
    const titleEl = document.getElementById('exportModalPageTitle');
    const count = ids.length || (state.data.pages || []).length;
    if (titleEl) titleEl.textContent = `Esporta ${count} Pagine`;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}
window.openBulkExportModal = openBulkExportModal;

// Esportazione multipla pagine pulita (Senza metadati interni) con ZIP o File Unico
function exportBulkPages(format = 'markdown', specificIds = null, packageType = null) {
    const pages = state.data.pages || [];
    let targetPages = [];

    if (specificIds && specificIds.length > 0) {
        targetPages = pages.filter(p => specificIds.includes(p.id));
    } else if (state.ui.selectedPageIds && state.ui.selectedPageIds.length > 0) {
        targetPages = pages.filter(p => state.ui.selectedPageIds.includes(p.id));
    } else {
        // Se nessuna è spuntata, esporta tutte le pagine attualmente visibili dai filtri
        const query = (state.ui.pageSearchQuery || '').toLowerCase().trim();
        targetPages = pages.filter(p => {
            if (state.ui.selectedPageSphere && state.ui.selectedPageSphere !== 'all') {
                const s = resolvePageSphere(p);
                if (!s || s.id !== state.ui.selectedPageSphere) return false;
            }
            if (state.ui.selectedPageContext && state.ui.selectedPageContext !== 'all') {
                if (p.contextId !== state.ui.selectedPageContext) return false;
            }
            if (state.ui.selectedPageTipologia && state.ui.selectedPageTipologia !== 'all') {
                if ((p.tipologia || 'Riunione') !== state.ui.selectedPageTipologia) return false;
            }
            if (state.ui.selectedPageTag && state.ui.selectedPageTag !== 'all') {
                if (!p.tags || !p.tags.includes(state.ui.selectedPageTag)) return false;
            }
            if (query) {
                const plain = (p.content || '').replace(/<[^>]*>?/gm, '').toLowerCase();
                const title = (p.title || '').toLowerCase();
                const matchesTag = (p.tags || []).some(t => t.toLowerCase().includes(query));
                return title.includes(query) || plain.includes(query) || matchesTag;
            }
            return true;
        });
    }

    if (targetPages.length === 0) {
        showToast("Nessuna pagina selezionata da esportare", "warning");
        return;
    }

    const pkgType = packageType || document.querySelector('input[name="exportPackageType"]:checked')?.value || 'zip';
    const todayStr = getISODate(new Date());

    function getCleanPageContent(p, fmt) {
        if (fmt === 'markdown') {
            let md = p.content || '';
            md = md.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
                   .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
                   .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
                   .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
                   .replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
                   .replace(/<b>(.*?)<\/b>/gi, '**$1**')
                   .replace(/<em>(.*?)<\/em>/gi, '*$1*')
                   .replace(/<i>(.*?)<\/i>/gi, '*$1*')
                   .replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1\n\n')
                   .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
                   .replace(/<[^>]+>/g, '');
            return md.trim() + '\n';
        } else if (fmt === 'html') {
            return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeNoteHtml(p.title || '')}</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;line-height:1.6;color:#1e293b;}</style></head><body>${p.content || ''}</body></html>`;
        } else {
            return (p.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
    }

    const ext = format === 'markdown' ? 'md' : (format === 'html' ? 'html' : 'txt');
    const mimeType = format === 'markdown' ? 'text/markdown' : (format === 'html' ? 'text/html' : 'text/plain');

    if (pkgType === 'zip' && typeof JSZip !== 'undefined') {
        const zip = new JSZip();
        targetPages.forEach((p, idx) => {
            const rawTitle = (p.title || `pagina_${idx + 1}`).trim();
            const cleanTitle = rawTitle.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || `pagina_${idx + 1}`;
            const fileName = `${cleanTitle}_${p.date || 'doc'}.${ext}`;
            const bodyOnly = getCleanPageContent(p, format);
            zip.file(fileName, bodyOnly);
        });

        zip.generateAsync({ type: 'blob' }).then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `archivio_pagine_${todayStr}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast(`Esportate ${targetPages.length} pagine in archivio ZIP (.zip)`, "success");
        }).catch(err => {
            console.error("Errore esportazione ZIP:", err);
            showToast("Errore durante la creazione dello ZIP", "error");
        });
    } else {
        // File unico combinato - Solo contenuto
        let combined = '';
        targetPages.forEach((p, idx) => {
            const bodyOnly = getCleanPageContent(p, format);
            if (idx > 0) combined += '\n\n---\n\n';
            combined += bodyOnly;
        });

        const blob = new Blob([combined], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pagine_unite_${todayStr}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Esportate ${targetPages.length} pagine in file unico (.${ext})`, "success");
    }
}

// Funzione principale di rendering della vista centralizzata Pagine
function renderGlobalPages() {
    const pages = state.data.pages || [];
    const currentTagFilter = state.ui.selectedPageTag || 'all';
    const currentSphereFilter = state.ui.selectedPageSphere || 'all';
    const currentContextFilter = state.ui.selectedPageContext || 'all';
    const currentTipoFilter = state.ui.selectedPageTipologia || 'all';
    const groupBy = state.ui.pagesGroupBy || 'none';
    const viewMode = state.ui.pagesViewMode || 'table';
    const query = (state.ui.pageSearchQuery || '').toLowerCase().trim();
    const selectedIds = state.ui.selectedPageIds || [];

    if (activeSubpageId) {
        return `
            <div class="max-w-5xl mx-auto space-y-4">
                <div class="p-4 md:p-6 bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder rounded-2xl shadow-sm">
                    ${renderSubpageEditor('global', null)}
                </div>
            </div>
        `;
    }

    // Calcolo tag per le pillole
    const tagCounts = {};
    pages.forEach(p => {
        (p.tags || []).forEach(t => {
            const clean = t.trim().toLowerCase();
            if (clean) tagCounts[clean] = (tagCounts[clean] || 0) + 1;
        });
    });
    const allTags = Object.keys(tagCounts).sort();

    // Filtro pagine
    let filtered = pages.filter(p => {
        const pInfo = resolvePageProject(p);
        const sInfo = resolvePageSphere(p, pInfo);

        if (currentSphereFilter !== 'all') {
            if (!sInfo || sInfo.id !== currentSphereFilter) return false;
        }
        if (currentContextFilter !== 'all') {
            if (p.contextId !== currentContextFilter) return false;
        }
        if (currentTipoFilter !== 'all') {
            const pt = p.tipologia || 'Riunione';
            if (pt !== currentTipoFilter) return false;
        }
        if (currentTagFilter !== 'all') {
            if (!p.tags || !p.tags.includes(currentTagFilter)) return false;
        }
        if (query) {
            const plain = (p.content || '').replace(/<[^>]*>?/gm, '').toLowerCase();
            const title = (p.title || '').toLowerCase();
            const projName = (pInfo ? pInfo.name : '').toLowerCase();
            const sphereName = (sInfo ? sInfo.name : '').toLowerCase();
            const tipologia = (p.tipologia || '').toLowerCase();
            const matchesTag = (p.tags || []).some(t => t.toLowerCase().includes(query));
            return title.includes(query) || plain.includes(query) || projName.includes(query) || sphereName.includes(query) || tipologia.includes(query) || matchesTag;
        }
        return true;
    });

    // Ordinamento predefinito per data decrescente (le più recenti in cima)
    filtered.sort((a, b) => {
        const da = a.date || a.createdAt || '';
        const db = b.date || b.createdAt || '';
        return db.localeCompare(da);
    });

    // Opzioni Filtri
    let sphereOptions = `<option value="all">Tutti gli Ambiti</option>`;
    (state.data.spheres || []).forEach(s => {
        sphereOptions += `<option value="${s.id}" ${currentSphereFilter === s.id ? 'selected' : ''}>${s.name}</option>`;
    });

    let projOptions = `<option value="all">Tutti i Progetti</option>`;
    (state.data.projects || []).forEach(p => {
        projOptions += `<option value="${p.id}" ${currentContextFilter === p.id ? 'selected' : ''}>📁 ${escapeNoteHtml(p.name)}</option>`;
        (state.data.subprojects || []).filter(sp => sp.projectId === p.id).forEach(sp => {
            projOptions += `<option value="${sp.id}" ${currentContextFilter === sp.id ? 'selected' : ''}>  ↳ ${escapeNoteHtml(sp.name)}</option>`;
        });
    });

    const isAllVisibleSelected = filtered.length > 0 && filtered.every(p => selectedIds.includes(p.id));
    const visibleIds = filtered.map(p => p.id);

    // Funzione interna per generare una singola riga tabella (esatta tabella dello screenshot)
    function renderTableRow(p) {
        const isSelected = selectedIds.includes(p.id);
        const pInfo = resolvePageProject(p);
        const sInfo = resolvePageSphere(p, pInfo);
        const dateDisplay = formatPageDateDisplay(p.date || p.createdAt);

        return `
            <tr class="group border-b border-slate-200 dark:border-darkborder hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-slate-700 dark:text-slate-200 ${isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''}">
                <!-- Checkbox Selezione -->
                <td class="py-2.5 px-3 w-8 text-center" onclick="event.stopPropagation();">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="togglePageSelection('${p.id}', this.checked)" class="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-900 cursor-pointer">
                </td>

                <!-- Colonna 1: Aa Titolo riunione -->
                <td class="py-2.5 px-3 min-w-[220px]">
                    <div class="flex items-center gap-2">
                        <span class="text-slate-400 dark:text-slate-500 shrink-0 text-sm">
                            <i class="far fa-file-alt"></i>
                        </span>
                        <div class="min-w-0">
                            <a href="javascript:void(0)" onclick="openGlobalPageEditor('${p.id}')" class="font-bold text-xs text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition hover:underline truncate block max-w-xs md:max-w-md">
                                ${escapeNoteHtml(p.title || 'Senza titolo')}
                            </a>
                            ${(p.tags && p.tags.length > 0) ? `
                                <div class="flex flex-wrap gap-1 mt-0.5">
                                    ${p.tags.slice(0, 3).map(t => `<span class="text-[9px] text-slate-400 font-mono">#${escapeNoteHtml(t)}</span>`).join('')}
                                    ${p.tags.length > 3 ? `<span class="text-[9px] text-slate-400">+${p.tags.length - 3}</span>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </td>

                <!-- Colonna 2: 📅 Data -->
                <td class="py-2.5 px-3 whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-300 font-mono">
                    ${dateDisplay}
                </td>

                <!-- Colonna 3: ↗ Progetto -->
                <td class="py-2.5 px-3 whitespace-nowrap">
                    ${renderProjectBadge(pInfo)}
                </td>

                <!-- Colonna 4: ☉ Tipologia -->
                <td class="py-2.5 px-3 whitespace-nowrap">
                    ${renderTipologiaBadge(p.tipologia)}
                </td>

                <!-- Colonna 5: Q Ambito -->
                <td class="py-2.5 px-3 whitespace-nowrap">
                    ${renderAmbitoBadge(sInfo)}
                </td>

                <!-- Colonna 6: Azioni Rapide -->
                <td class="py-2.5 px-3 text-right whitespace-nowrap" onclick="event.stopPropagation();">
                    <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="openGlobalPageEditor('${p.id}')" class="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Apri ed elabora pagina">
                            <i class="fas fa-edit text-xs"></i>
                        </button>
                        <button type="button" onclick="event.stopPropagation(); openPageExportModal('${p.id}')" class="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition" title="Esporta documento">
                            <i class="fas fa-download text-xs"></i>
                        </button>
                        <button onclick="deleteNotebookSubpage('${p.id}')" class="p-1.5 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30" title="Elimina pagina">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // Render Table Header con colonne Notion esatte
    function renderTableHeader() {
        return `
            <thead>
                <tr class="border-b border-slate-200 dark:border-darkborder bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider select-none">
                    <th class="py-2.5 px-3 w-8 text-center">
                        <input type="checkbox" ${isAllVisibleSelected ? 'checked' : ''} onchange="toggleSelectAllPages(this.checked, [${visibleIds.map(id => "'" + id + "'").join(',')}])" class="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-900 cursor-pointer" title="Seleziona tutte">
                    </th>
                    <th class="py-2.5 px-3 text-left">
                        <span class="flex items-center gap-1.5 font-normal normal-case text-slate-400 dark:text-slate-400">
                            <span class="font-bold text-[10px] font-mono">Aa</span> Titolo riunione
                        </span>
                    </th>
                    <th class="py-2.5 px-3 text-left">
                        <span class="flex items-center gap-1 font-normal normal-case text-slate-400 dark:text-slate-400">
                            <i class="far fa-calendar-alt text-[11px]"></i> Data
                        </span>
                    </th>
                    <th class="py-2.5 px-3 text-left">
                        <span class="flex items-center gap-1 font-normal normal-case text-slate-400 dark:text-slate-400">
                            <i class="fas fa-arrow-up-right-from-square text-[10px]"></i> Progetto
                        </span>
                    </th>
                    <th class="py-2.5 px-3 text-left">
                        <span class="flex items-center gap-1 font-normal normal-case text-slate-400 dark:text-slate-400">
                            <i class="far fa-dot-circle text-[11px]"></i> Tipologia
                        </span>
                    </th>
                    <th class="py-2.5 px-3 text-left">
                        <span class="flex items-center gap-1 font-normal normal-case text-slate-400 dark:text-slate-400">
                            <i class="fas fa-layer-group text-[11px]"></i> Ambito
                        </span>
                    </th>
                    <th class="py-2.5 px-3 text-right font-normal normal-case text-slate-400 dark:text-slate-400">
                        <span class="text-xs">+ ...</span>
                    </th>
                </tr>
            </thead>
        `;
    }

    // Costruzione contenuto principale (Flat o Raggruppato)
    let mainViewHtml = '';

    if (filtered.length === 0) {
        mainViewHtml = `
            <div class="py-16 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-darkpanel rounded-2xl border border-slate-200 dark:border-darkborder shadow-sm">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 mx-auto flex items-center justify-center text-xl mb-3">
                    <i class="fas fa-file-circle-question"></i>
                </div>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-200">Nessuna pagina o riunione trovata</p>
                <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto mb-4">Non ci sono elementi corrispondenti ai filtri attivi.</p>
                <div class="flex items-center justify-center gap-3">
                    <button onclick="createGlobalNewPage()" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md hover:bg-indigo-700 transition">
                        <i class="fas fa-plus mr-1"></i> Crea Pagina
                    </button>
                    <button onclick="state.ui.selectedPageSphere = 'all'; state.ui.selectedPageContext = 'all'; state.ui.selectedPageTipologia = 'all'; state.ui.selectedPageTag = 'all'; state.ui.pageSearchQuery = ''; render();" class="text-xs font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 underline">
                        Azzera filtri
                    </button>
                </div>
            </div>
        `;
    } else if (viewMode === 'table') {
        if (groupBy === 'none') {
            // Tabella unica (Flat) - esattamente identica allo screenshot
            mainViewHtml = `
                <div class="bg-white dark:bg-darkpanel rounded-2xl border border-slate-200 dark:border-darkborder shadow-sm overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse text-xs">
                            ${renderTableHeader()}
                            <tbody>
                                ${filtered.map(p => renderTableRow(p)).join('')}
                                <!-- Riga finale + New Page -->
                                <tr onclick="createGlobalNewPage()" class="cursor-pointer border-t border-slate-200 dark:border-darkborder text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                                    <td colspan="7" class="py-2.5 px-4 font-semibold text-xs">
                                        <div class="flex items-center gap-2">
                                            <i class="fas fa-plus text-[10px]"></i>
                                            <span>Nuova pagina</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            // Tabella raggruppata per Ambito, Progetto o Tipologia
            const groupsMap = new Map();

            filtered.forEach(p => {
                let groupKey = 'altro';
                let groupTitle = 'Altro';
                let groupColor = '#6366f1';
                let groupIcon = 'fa-folder';

                if (groupBy === 'sphere') {
                    const s = resolvePageSphere(p);
                    if (s) {
                        groupKey = s.id;
                        groupTitle = s.name;
                        groupColor = s.color || '#6366f1';
                        groupIcon = s.icon || 'fa-layer-group';
                    } else {
                        groupTitle = 'Nessun Ambito';
                        groupColor = '#94a3b8';
                    }
                } else if (groupBy === 'project') {
                    const proj = resolvePageProject(p);
                    if (proj) {
                        groupKey = proj.id;
                        groupTitle = proj.name;
                        groupColor = proj.color || '#6366f1';
                        groupIcon = proj.icon || 'fa-folder';
                    } else {
                        groupTitle = 'Generale (Senza Progetto)';
                        groupColor = '#94a3b8';
                    }
                } else if (groupBy === 'tipologia') {
                    const tipo = p.tipologia || 'Riunione';
                    groupKey = tipo;
                    groupTitle = tipo;
                    groupIcon = 'fa-dot-circle';
                }

                if (!groupsMap.has(groupKey)) {
                    groupsMap.set(groupKey, { title: groupTitle, color: groupColor, icon: groupIcon, pages: [], key: groupKey });
                }
                groupsMap.get(groupKey).pages.push(p);
            });

            const groupsArray = Array.from(groupsMap.values());

            mainViewHtml = `
                <div class="space-y-6">
                    ${groupsArray.map(grp => `
                        <div class="bg-white dark:bg-darkpanel rounded-2xl border border-slate-200 dark:border-darkborder shadow-sm overflow-hidden">
                            <!-- HEADER DEL GRUPPO -->
                            <div class="flex items-center justify-between px-4 py-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-darkborder">
                                <div class="flex items-center gap-2.5">
                                    <span class="w-3 h-3 rounded-full shrink-0 shadow-xs" style="background-color: ${grp.color};"></span>
                                    <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                        ${escapeNoteHtml(grp.title)}
                                    </h3>
                                    <span class="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs">${grp.pages.length}</span>
                                </div>
                                <button onclick="createGlobalNewPage({${groupBy === 'sphere' ? `sphereId: '${grp.key}'` : (groupBy === 'project' ? `contextId: '${grp.key}'` : `tipologia: '${grp.key}'`)}})" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                                    <i class="fas fa-plus text-[10px]"></i> Aggiungi qui
                                </button>
                            </div>

                            <div class="overflow-x-auto">
                                <table class="w-full text-left border-collapse text-xs">
                                    ${renderTableHeader()}
                                    <tbody>
                                        ${grp.pages.map(p => renderTableRow(p)).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } else {
        // Modalità Griglia (Card View)
        mainViewHtml = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${filtered.map(p => {
                    const pInfo = resolvePageProject(p);
                    const sInfo = resolvePageSphere(p, pInfo);
                    const plain = (p.content || '').replace(/<[^>]*>?/gm, '').trim();
                    let preview = plain.substring(0, 110);
                    if (plain.length > 110) preview += '...';
                    if (!preview) preview = 'Pagina vuota, clicca per scrivere o aggiungere contenuti...';
                    const isSelected = selectedIds.includes(p.id);

                    return `
                        <div class="p-5 rounded-2xl border border-slate-200 dark:border-darkborder bg-white dark:bg-darkpanel hover:border-indigo-400 dark:hover:border-indigo-600 transition flex flex-col justify-between group shadow-sm hover:shadow-md ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''}">
                            <div>
                                <div class="flex items-center justify-between gap-2 mb-2.5">
                                    <div class="flex items-center gap-2">
                                        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="togglePageSelection('${p.id}', this.checked)" class="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-900 cursor-pointer">
                                        ${renderAmbitoBadge(sInfo)}
                                    </div>
                                    <span class="text-[10px] font-mono text-slate-400">${p.date || 'Oggi'}</span>
                                </div>

                                <div class="flex items-center gap-2 mb-2">
                                    ${renderTipologiaBadge(p.tipologia)}
                                    ${renderProjectBadge(pInfo)}
                                </div>

                                <h3 onclick="openGlobalPageEditor('${p.id}')" class="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition cursor-pointer mb-2 line-clamp-1">
                                    ${escapeNoteHtml(p.title || 'Senza titolo')}
                                </h3>

                                <p onclick="openGlobalPageEditor('${p.id}')" class="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed cursor-pointer mb-4">
                                    ${escapeNoteHtml(preview)}
                                </p>
                            </div>

                            <div class="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                                <button onclick="openGlobalPageEditor('${p.id}')" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 flex items-center gap-1">
                                    <i class="fas fa-edit text-[10px]"></i> Modifica
                                </button>
                                <div class="flex items-center gap-1">
                                    <button onclick="exportSinglePage('${p.id}', 'markdown')" class="p-1.5 text-slate-400 hover:text-blue-600 rounded text-xs" title="Esporta Markdown">
                                        <i class="fas fa-download"></i>
                                    </button>
                                    <button onclick="deleteNotebookSubpage('${p.id}')" class="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg text-xs" title="Elimina">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    return `
        <div class="max-w-6xl mx-auto space-y-4">
            <!-- HEADER DELLA PAGINA CON TITOLO E AZIONI PRINCIPALI -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-darkpanel p-5 rounded-2xl border border-slate-200 dark:border-darkborder shadow-sm">
                <div class="flex items-center gap-3.5">
                    <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-2xl shrink-0">
                        <i class="fas fa-table-list"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h1 class="text-lg font-black text-slate-800 dark:text-white">Note & Pagine Centralizzate</h1>
                            <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 font-mono">${pages.length}</span>
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Database Notion-style: riunioni, verbali e documenti raggruppati per progetto e sfera</p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2 shrink-0">
                    <!-- Switcher Vista: Tabella vs Griglia -->
                    <div class="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-darkborder text-xs">
                        <button onclick="state.ui.pagesViewMode = 'table'; render();" class="px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-white dark:bg-darkpanel text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}" title="Vista Tabella Database">
                            <i class="fas fa-table"></i> <span class="hidden sm:inline">Tabella</span>
                        </button>
                        <button onclick="state.ui.pagesViewMode = 'grid'; render();" class="px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${viewMode === 'grid' ? 'bg-white dark:bg-darkpanel text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}" title="Vista Schede Griglia">
                            <i class="fas fa-th-large"></i> <span class="hidden sm:inline">Griglia</span>
                        </button>
                    </div>

                    <!-- Esporta Globale Dropdown & Modal Trigger -->
                    <div class="relative group/bulk">
                        <button type="button" onclick="openBulkExportModal()" class="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-darkborder transition flex items-center gap-2 shadow-xs">
                            <i class="fas fa-file-export text-indigo-500"></i> Esporta <i class="fas fa-chevron-down text-[9px] opacity-60"></i>
                        </button>
                        <div class="absolute right-0 mt-1 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 opacity-0 invisible group-hover/bulk:opacity-100 group-hover/bulk:visible transition-all z-50 p-1.5 space-y-1">
                            <button onclick="openBulkExportModal()" class="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                                <i class="fas fa-sliders text-indigo-500"></i> Opzioni Esportazione...
                            </button>
                            <div class="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                            <button onclick="exportBulkPages('markdown', null, 'zip')" class="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                <i class="fas fa-file-zipper text-amber-500"></i> Archivio ZIP (.zip)
                            </button>
                            <button onclick="exportBulkPages('markdown', null, 'single')" class="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                <i class="fab fa-markdown text-blue-500"></i> Markdown unico (.md)
                            </button>
                            <button onclick="exportBulkPages('text', null, 'single')" class="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                <i class="fas fa-file-alt text-slate-400"></i> Testo semplice (.txt)
                            </button>
                        </div>
                    </div>

                    <!-- Nuova Pagina -->
                    <button onclick="createGlobalNewPage()" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-2">
                        <i class="fas fa-plus"></i> Nuova Pagina
                    </button>
                </div>
            </div>

            <!-- FLOATING / STICKY ACTION BAR QUANDO CI SONO PAGINE SELEZIONATE -->
            ${selectedIds.length > 0 ? `
                <div class="flex items-center justify-between p-3.5 bg-indigo-600 text-white rounded-2xl shadow-lg border border-indigo-500 animate-fade-in text-xs font-bold">
                    <div class="flex items-center gap-2.5">
                        <i class="fas fa-check-circle text-base text-indigo-200"></i>
                        <span>${selectedIds.length} ${selectedIds.length === 1 ? 'pagina selezionata' : 'pagine selezionate'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="openBulkExportModal([${selectedIds.map(id => `'${id}'`).join(',')}])" class="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition flex items-center gap-1.5 text-xs shadow-sm">
                            <i class="fas fa-file-export"></i> Esporta (${selectedIds.length})
                        </button>
                        <button onclick="exportBulkPages('csv')" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5 text-xs">
                            <i class="fas fa-file-csv"></i> Esporta CSV
                        </button>
                        <button onclick="deleteBulkSelectedPages()" class="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white transition flex items-center gap-1.5 text-xs">
                            <i class="fas fa-trash"></i> Elimina
                        </button>
                        <button onclick="clearPageSelection()" class="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-xs" title="Deseleziona tutto">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            ` : ''}

            <!-- BARRA DI RICERCA, FILTRI E RAGGRUPPAMENTO -->
            <div class="bg-white dark:bg-darkpanel p-4 rounded-2xl border border-slate-200 dark:border-darkborder shadow-sm space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                    <!-- Ricerca Testo -->
                    <div class="relative lg:col-span-2">
                        <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input type="text" value="${escapeNoteHtml(state.ui.pageSearchQuery || '')}" oninput="state.ui.pageSearchQuery = this.value; render();" placeholder="Cerca titolo, contenuto, tag..." class="input-base text-xs pl-9 py-2 w-full">
                    </div>

                    <!-- Filtro Ambito (Sfera) -->
                    <div>
                        <select onchange="state.ui.selectedPageSphere = this.value; render();" class="input-base text-xs py-2 w-full">
                            ${sphereOptions}
                        </select>
                    </div>

                    <!-- Filtro Progetto -->
                    <div>
                        <select onchange="state.ui.selectedPageContext = this.value; render();" class="input-base text-xs py-2 w-full">
                            ${projOptions}
                        </select>
                    </div>

                    <!-- Raggruppamento -->
                    <div>
                        <select onchange="state.ui.pagesGroupBy = this.value; render();" class="input-base text-xs py-2 w-full font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800">
                            <option value="none" ${groupBy === 'none' ? 'selected' : ''}>Raggruppa: Nessuno</option>
                            <option value="sphere" ${groupBy === 'sphere' ? 'selected' : ''}>Raggruppa: Ambito (Sfera)</option>
                            <option value="project" ${groupBy === 'project' ? 'selected' : ''}>Raggruppa: Progetto</option>
                            <option value="tipologia" ${groupBy === 'tipologia' ? 'selected' : ''}>Raggruppa: Tipologia</option>
                        </select>
                    </div>
                </div>

                <!-- FILTRI RAPIDI TIPOLOGIA E TAG -->
                <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-xs border-t border-slate-100 dark:border-slate-800">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0 flex items-center gap-1">
                        <i class="far fa-dot-circle text-emerald-500"></i> Tipologia:
                    </span>
                    <button type="button" onclick="openDocumentTypesModal()" class="px-2 py-1 rounded-lg text-xs font-bold transition shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 mr-1 flex items-center gap-1">
                        <i class="fas fa-cog text-[10px]"></i> Modifica
                    </button>
                    ${['all', ...((typeof getDocumentTypes === 'function' ? getDocumentTypes() : []).map(t => t.name))].map(tipo => {
                        const isSel = currentTipoFilter === tipo;
                        const label = tipo === 'all' ? 'Tutte' : tipo;
                        return `
                            <button onclick="state.ui.selectedPageTipologia = '${tipo}'; render();" class="px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 ${isSel ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">
                                ${label}
                            </button>
                        `;
                    }).join('')}

                    ${allTags.length > 0 ? `
                        <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 shrink-0"></div>
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0 flex items-center gap-1">
                            <i class="fas fa-tags text-purple-500"></i> Tag:
                        </span>
                        <button onclick="state.ui.selectedPageTag = 'all'; render();" class="px-2 py-0.5 rounded-md text-[10px] font-bold transition shrink-0 ${currentTagFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">
                            Tutti
                        </button>
                        ${allTags.map(tag => {
                            const isSel = currentTagFilter === tag;
                            return `
                                <button onclick="state.ui.selectedPageTag = '${tag}'; render();" class="px-2 py-0.5 rounded-md text-[10px] font-bold transition shrink-0 ${isSel ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100'}">
                                    #${escapeNoteHtml(tag)}
                                </button>
                            `;
                        }).join('')}
                    ` : ''}
                </div>
            </div>

            <!-- CONTENUTO PRINCIPALE TABELLA / GRUPPI / GRIGLIA -->
            ${mainViewHtml}
        </div>
    `;
}

// Esponi funzioni su window per chiamate inline
window.openGlobalPageEditor = openGlobalPageEditor;
window.createGlobalNewPage = createGlobalNewPage;
window.togglePageSelection = togglePageSelection;
window.toggleSelectAllPages = toggleSelectAllPages;
window.clearPageSelection = clearPageSelection;
window.deleteBulkSelectedPages = deleteBulkSelectedPages;
window.exportBulkPages = exportBulkPages;
window.navigateToNotebookContext = navigateToNotebookContext;

// AVVIO
window.onload = () => AppData.initialize();