// --- MOTORE DATI & CLOUD SYNC (Supabase + localStorage + Google Calendar) ---
class LifeHubDataManager {
    constructor() {
        this.supabaseUrl = localStorage.getItem('hub_supabase_url') || 'https://bbskvjxrutsrznwcrlmi.supabase.co';
        this.anonKey = localStorage.getItem('hub_anon_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJic2t2anhydXRzcnpud2NybG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzIwMDIsImV4cCI6MjEwODYwODAwMn0.l_nFrRcMWn6LDzyI8AJEoc1_J33hAePmNbXTDolVvxU';
        
        // Variabili Google Calendar
        this.gcalId = localStorage.getItem('hub_gcal_id') || '';
        this.gcalApiKey = localStorage.getItem('hub_gcal_apikey') || '';
        this.gcalCache = [];
        this.lastGCalError = null;
        
        this.saveTimeout = null;
        this.isSyncing = false;
        
        this.defaultData = {
            version: "5.1",
            spheres: [], projects: [], subprojects: [], tasks: [], contacts: [],
            calendarBlocks: [],
            gcalCompleted: [],
            trash: [],
            pages: [],
            documentTypes: [
                { id: 'riunione', name: 'Riunione', color: '#64748b' },
                { id: 'colloquio', name: 'Colloquio', color: '#10b981' },
                { id: 'call', name: 'Call', color: '#0ea5e9' },
                { id: 'appunti', name: 'Appunti', color: '#f59e0b' },
                { id: 'brief', name: 'Brief', color: '#8b5cf6' },
                { id: 'verbale', name: 'Verbale', color: '#14b8a6' },
                { id: 'altro', name: 'Altro', color: '#94a3b8' }
            ],
            pinnedLevels: [{id: 'pl_default', name: 'In Evidenza'}],
            features: {
                dashboardAgenda: true,
                eisenhowerMatrix: true,
                habitsTracker: true,
                contacts: true,
                timeBlocks: true,
                projectTimeline: true
            }
        };
        
        this.data = JSON.parse(JSON.stringify(this.defaultData));
    }

    isConfigured() { return this.supabaseUrl.length > 0 && this.anonKey.length > 0; }

    async initialize() {
        if (!this.isConfigured()) {
            this.loadLocal();
            return;
        }
        const btn = document.getElementById('syncBtn');
        if(btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin text-base"></i>';
        
        try {
            const res = await fetch(`${this.supabaseUrl}/rest/v1/app_states?app_name=eq.life_hub&select=data`, {
                headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${this.anonKey}` },
                cache: 'no-store'
            });
            if (!res.ok) throw new Error("Errore API Supabase");
            
            const rows = await res.json();
            if (rows && rows.length > 0) {
                this.data = this.migrateData(rows[0].data);
                this.saveLocal();
            } else {
                this.pushToCloud();
            }
            if(btn) btn.innerHTML = '<i class="fas fa-check text-green-500 text-base"></i>';
        } catch (error) {
            console.error("Supabase Load Error:", error);
            this.loadLocal(); 
            if(btn) btn.innerHTML = '<i class="fas fa-exclamation-triangle text-amber-500 text-base"></i>';
        }
        
        // Se Google Calendar è configurato, carica gli eventi all'avvio
        if(this.gcalApiKey && this.gcalId) {
            try {
                await this.fetchGCalEvents();
            } catch(e) { console.error("Error fetching GCal on init:", e); }
        }
        
        if(btn) setTimeout(() => btn.innerHTML = '<i class="fas fa-cloud-sync text-base"></i>', 2000);
        render();
    }

    // Funzione asincrona nativa per recuperare gli eventi di Google Calendar
    async fetchGCalEvents() {
        if(!this.gcalApiKey || !this.gcalId) return;
        const cals = this.gcalId.split(',').map(s=>s.trim()).filter(Boolean);
        if(cals.length === 0) return;
        
        let minD = new Date(); minD.setDate(minD.getDate() - 2); minD.setHours(0,0,0,0);
        let maxD = new Date(); maxD.setDate(maxD.getDate() + 7); maxD.setHours(23,59,59,999);
        
        let allEvents = [];
        this.lastGCalError = null;
        const gcalColors = { '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73', '5': '#f6c026', '6': '#f09300', '7': '#039be5', '8': '#616161', '9': '#3f51b5', '10': '#0b8043', '11': '#d60000' };
        
        for(let calEntry of cals) {
            let [calId, calColor] = calEntry.split('|');
            calId = calId.trim();
            calColor = calColor ? calColor.trim() : '#3b82f6';
            
            const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?key=${this.gcalApiKey}&timeMin=${minD.toISOString()}&timeMax=${maxD.toISOString()}&singleEvents=true&orderBy=startTime`;
            try {
                const res = await fetch(url);
                if(!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    const errMsg = errData.error?.message || `Errore HTTP ${res.status}`;
                    console.warn(`[GCal] Errore sincronizzazione calendario "${calId}":`, res.status, errMsg);
                    this.lastGCalError = { calId, status: res.status, message: errMsg };
                    continue;
                }
                const data = await res.json();
                if(data.items) {
                    data.items.forEach(item => {
                        let isAllDay = !item.start.dateTime || (item.start.date && !item.start.dateTime);
                        let eventTitle = item.summary;
                        let noteStr = item.description ? item.description.replace(/<[^>]*>?/gm, '').substring(0,250) + (item.description.length > 250 ? '...' : '') : '';
                        
                        if (!eventTitle) {
                            eventTitle = '🔒 Evento Privato';
                            noteStr = 'I dettagli sono nascosti da Google. Vai su Google Calendar > Impostazioni > Clicca il calendario > "Autorizzazioni all\'accesso" e imposta il menu a tendina pubblico su "Vedere tutti i dettagli dell\'evento".';
                        }

                        if (isAllDay) {
                            let curr = new Date(item.start.date);
                            const endLimit = item.end && item.end.date ? new Date(item.end.date) : new Date(curr.getTime() + 86400000);
                            if (endLimit <= curr) endLimit.setDate(curr.getDate() + 1);
                            
                            while (curr < endLimit) {
                                const dStr = getISODate(curr);
                                allEvents.push({
                                    id: 'gcal_' + item.id + '_' + dStr,
                                    origId: item.id,
                                    isGcal: true,
                                    title: eventTitle,
                                    date: dStr,
                                    startTime: "Tutto il giorno",
                                    endTime: "",
                                    category: 'gcal',
                                    isAllDay: true,
                                    link: item.htmlLink,
                                    notes: noteStr,
                                    color: item.colorId ? gcalColors[item.colorId] : calColor
                                });
                                curr.setDate(curr.getDate() + 1);
                            }
                        } else {
                            let start = item.start.dateTime;
                            let end = item.end.dateTime || start;
                            let startDateStr = start.split('T')[0];
                            let startTime = start.split('T')[1].substring(0,5);
                            let endTime = end.split('T')[1].substring(0,5);
                            const isFullDayTimed = (startTime === "00:00" && (endTime === "00:00" || endTime === "23:59" || !endTime));

                            allEvents.push({
                                id: 'gcal_' + item.id,
                                isGcal: true,
                                title: eventTitle,
                                date: startDateStr,
                                startTime: isFullDayTimed ? "Tutto il giorno" : startTime,
                                endTime: isFullDayTimed ? "" : endTime,
                                category: 'gcal',
                                isAllDay: isFullDayTimed,
                                link: item.htmlLink,
                                notes: noteStr,
                                color: item.colorId ? gcalColors[item.colorId] : calColor
                            });
                        }
                    });
                }
            } catch(e) {
                console.error("Gcal sync error for cal:", calId, e);
                this.lastGCalError = { calId, status: 0, message: e.message };
            }
        }
        this.gcalCache = allEvents;
    }

    // Metodo diagnostico per testare la connessione a Google Calendar con report dettagliato
    async testGCalConnection(calIdsParam = null, apiKeyParam = null) {
        const apiKey = (apiKeyParam !== null ? apiKeyParam : this.gcalApiKey).trim();
        const calIdStr = (calIdsParam !== null ? calIdsParam : this.gcalId).trim();
        
        if(!apiKey) return [{ ok: false, calId: 'Generale', error: "Chiave API mancante", hint: "Inserisci la tua API Key di Google Cloud Console." }];
        if(!calIdStr) return [{ ok: false, calId: 'Generale', error: "ID Calendario mancante", hint: "Inserisci l'ID del calendario (es. la tua email gmail)." }];
        
        const cals = calIdStr.split(',').map(s=>s.trim()).filter(Boolean);
        if(cals.length === 0) return [{ ok: false, calId: 'Generale', error: "Nessun calendario valido specificato", hint: "" }];

        let results = [];
        for(let calEntry of cals) {
            let [calId] = calEntry.split('|');
            calId = calId.trim();
            const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?key=${apiKey}&maxResults=1`;
            try {
                const res = await fetch(url);
                if(res.ok) {
                    const data = await res.json();
                    results.push({ calId, ok: true, count: data.items ? data.items.length : 0 });
                } else {
                    const errData = await res.json().catch(() => ({}));
                    let detail = errData.error?.message || `HTTP ${res.status}`;
                    let hint = "";
                    if(res.status === 403) {
                        hint = "1) Assicurati che 'Google Calendar API' sia ABILITATA nella Google Cloud Console (Libreria API). 2) Se la chiave API ha restrizioni 'Referrer HTTP', rimuovile temporaneamente o consenti tutte le origini.";
                    } else if(res.status === 404) {
                        hint = "Calendario non trovato o NON pubblico! Su calendar.google.com vai su Impostazioni > [Tuo Calendario] > 'Autorizzazioni all\\'accesso' e spunta 'Rendi disponibile pubblicamente' (Vedere tutti i dettagli).";
                    } else if(res.status === 400) {
                        hint = "Richiesta non valida. Controlla il formato dell'ID calendario o della chiave API.";
                    }
                    results.push({ calId, ok: false, error: detail, hint });
                }
            } catch(e) {
                results.push({ calId, ok: false, error: e.message, hint: "Impossibile contattare i server Google. Verifica la connessione di rete." });
            }
        }
        return results;
    }

    triggerSave() {
        this.saveLocal();
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => { this.pushToCloud(); }, 2500);
    }

    async pushToCloud() {
        if (!this.isConfigured() || this.isSyncing) return;
        this.isSyncing = true;
        const btn = document.getElementById('syncBtn');
        if(btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin text-base"></i>';

        try {
            const res = await fetch(`${this.supabaseUrl}/rest/v1/app_states`, {
                method: 'POST',
                headers: { 
                    'apikey': this.anonKey, 
                    'Authorization': `Bearer ${this.anonKey}`, 
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({ app_name: 'life_hub', data: this.data })
            });
            if (!res.ok) throw new Error("Supabase Push failed");
            if(btn) btn.innerHTML = '<i class="fas fa-check text-green-500 text-base"></i>';
        } catch (error) {
            console.error("Supabase Save Error:", error);
            if(btn) btn.innerHTML = '<i class="fas fa-times text-red-500 text-base"></i>';
        } finally {
            this.isSyncing = false;
            if(btn) setTimeout(() => btn.innerHTML = '<i class="fas fa-cloud-sync text-base"></i>', 2000);
        }
    }

    loadLocal() {
        const local = localStorage.getItem('hub_local_data');
        if (local) this.data = this.migrateData(JSON.parse(local));
        else this.data = JSON.parse(JSON.stringify(this.defaultData));
        render();
    }

    saveLocal() { localStorage.setItem('hub_local_data', JSON.stringify(this.data)); }

    migrateData(d) {
        if (!d || Object.keys(d).length === 0) return JSON.parse(JSON.stringify(this.defaultData));
        let n = { 
            version: "5.1", 
            spheres: [], 
            projects: [], 
            subprojects: [], 
            tasks: d.tasks || [], 
            contacts: d.contacts || [], 
            calendarBlocks: (d.calendarBlocks || []).map(b => ({ ...b, excludedDates: b.excludedDates || [] })) 
        };
        n.pinnedLevels = d.pinnedLevels || [{id: 'pl_default', name: 'In Evidenza'}];
        n.gcalCompleted = d.gcalCompleted || [];
        n.trash = d.trash || [];
        
        let savedFeatures = null;
        try {
            const raw = localStorage.getItem('hub_features');
            if (raw) savedFeatures = JSON.parse(raw);
        } catch(e) {}
        let savedDocTypes = null;
        try { const rawT = localStorage.getItem('hub_document_types'); if(rawT) savedDocTypes = JSON.parse(rawT); } catch(e){}
        n.documentTypes = (Array.isArray(d.documentTypes) && d.documentTypes.length > 0) ? d.documentTypes : ((Array.isArray(savedDocTypes) && savedDocTypes.length > 0) ? savedDocTypes : [
                { id: 'riunione', name: 'Riunione', color: '#64748b' },
                { id: 'colloquio', name: 'Colloquio', color: '#10b981' },
                { id: 'call', name: 'Call', color: '#0ea5e9' },
                { id: 'appunti', name: 'Appunti', color: '#f59e0b' },
                { id: 'brief', name: 'Brief', color: '#8b5cf6' },
                { id: 'verbale', name: 'Verbale', color: '#14b8a6' },
                { id: 'altro', name: 'Altro', color: '#94a3b8' }
            ]);
        n.features = Object.assign({
            dashboardAgenda: true,
            eisenhowerMatrix: true,
            habitsTracker: true,
            contacts: true,
            timeBlocks: true,
            projectTimeline: true
        }, d.features || {}, savedFeatures || {});

        const todayIso = new Date().toISOString().split('T')[0];
        n.pages = (d.pages || []).map(p => {
            let sphereId = p.sphereId || null;
            if (!sphereId && p.contextId) {
                const proj = (d.projects || []).find(x => x.id === p.contextId);
                if (proj) sphereId = proj.sphereId;
                else {
                    const sp = (d.subprojects || []).find(x => x.id === p.contextId);
                    if (sp) {
                        const parent = (d.projects || []).find(x => x.id === sp.projectId);
                        if (parent) sphereId = parent.sphereId;
                    }
                }
            }
            return {
                ...p,
                date: p.date || (p.createdAt ? p.createdAt.split('T')[0] : todayIso),
                tipologia: p.tipologia || 'Riunione',
                sphereId: sphereId,
                tags: Array.isArray(p.tags) ? p.tags : []
            };
        });

        // Migra eventuali vecchi aggiornamenti/archivio o note fisse a pagine dedicate se non già presenti
        const migrateUpdatesToPages = (items) => {
            (items || []).forEach(item => {
                if (item.updates && Array.isArray(item.updates)) {
                    item.updates.forEach(u => {
                        if (u.content && !n.pages.some(pg => pg.id === u.id)) {
                            n.pages.push({
                                id: u.id,
                                contextId: item.id,
                                title: `Archivio (${u.date || 'Storico'})`,
                                content: u.content,
                                tags: ['archivio'],
                                createdAt: u.date || '2025-01-01',
                                updatedAt: u.date || '2025-01-01'
                            });
                        }
                    });
                }
                // Migra permanentNotes (vecchie note fisse ridondanti) in una pagina dedicata
                if (item.permanentNotes && item.permanentNotes.trim() && item.permanentNotes !== '<p><br></p>') {
                    const permId = 'page_perm_' + item.id;
                    if (!n.pages.some(pg => pg.id === permId)) {
                        n.pages.push({
                            id: permId,
                            contextId: item.id,
                            title: 'Note Fisse & Riferimenti',
                            content: item.permanentNotes,
                            tags: ['riferimenti'],
                            createdAt: '2025-01-01',
                            updatedAt: '2025-01-01'
                        });
                    }
                }
            });
        };
        
        if (d.version !== "4.5" && d.version !== "5.0" && d.version !== "5.1" && d.spheres && d.spheres.length > 0 && d.spheres[0].projects !== undefined) {
            d.spheres.forEach((s, sIdx) => {
                n.spheres.push({ id: s.id, name: s.name, icon: s.icon || 'fa-folder', color: mapColor(s.color), order: s.order||sIdx, notes: s.notes||'', permanentNotes: s.permanentNotes||'', updates: s.updates||[] });
                if (s.projects) {
                    s.projects.forEach((p, pIdx) => {
                        n.projects.push({ id: p.id, sphereId: s.id, name: p.name, icon: p.icon || 'fa-folder', color: p.color, type: p.type, status: p.status, pinned: p.pinned, pinnedLevelId: p.pinnedLevelId||null, archived: p.archived||false, notes: p.notes, permanentNotes: p.permanentNotes||'', updates: p.updates||[], startDate: p.startDate||'', endDate: p.endDate||'', order: p.order||pIdx, pinnedOrder: p.pinnedOrder||pIdx });
                        if (p.subprojects) {
                            p.subprojects.forEach((sp, spIdx) => {
                                n.subprojects.push({ id: sp.id, projectId: p.id, name: sp.name, icon: sp.icon || 'fa-file-alt', color: sp.color, type: sp.type||'A termine', status: sp.status||'Attivo', pinned: sp.pinned||false, pinnedLevelId: sp.pinnedLevelId||null, archived: sp.archived||false, notes: sp.notes, permanentNotes: sp.permanentNotes||'', updates: sp.updates||[], startDate: sp.startDate||'', endDate: sp.endDate||'', order: sp.order||spIdx, pinnedOrder: sp.pinnedOrder||spIdx });
                            });
                        }
                    });
                }
            });
        } else {
            n.spheres = (d.spheres || []).map(s => ({...s, color: mapColor(s.color)}));
            n.projects = (d.projects || []);
            n.subprojects = (d.subprojects || []);
        }
        migrateUpdatesToPages(n.projects);
        migrateUpdatesToPages(n.subprojects);
        return n;
    }
    
    exportJSON() {
        try {
            const dataStr = JSON.stringify(this.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            const a = document.createElement('a');
            a.href = url;
            a.download = `life_hub_backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if (typeof showToast === 'function') {
                showToast('Backup JSON scaricato con successo!', 'success');
            }
        } catch (e) {
            console.error('Errore exportJSON:', e);
            alert("Errore durante l'esportazione del backup: " + e.message);
        }
    }

    importJSON(jsonText, overwrite = false) {
        const parsed = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
        if (!parsed || typeof parsed !== 'object') throw new Error("Formato JSON non valido");

        if (overwrite) {
            this.data = this.migrateData(parsed);
        } else {
            const mergeArray = (targetArr, sourceArr) => {
                if (!Array.isArray(sourceArr)) return;
                sourceArr.forEach(item => {
                    if (!item) return;
                    const idx = item.id ? targetArr.findIndex(x => x && x.id === item.id) : -1;
                    if (idx >= 0) {
                        targetArr[idx] = { ...targetArr[idx], ...item };
                    } else {
                        targetArr.push(item);
                    }
                });
            };

            mergeArray(this.data.spheres, parsed.spheres);
            mergeArray(this.data.projects, parsed.projects);
            mergeArray(this.data.subprojects, parsed.subprojects);
            mergeArray(this.data.tasks, parsed.tasks);
            mergeArray(this.data.contacts, parsed.contacts);
            mergeArray(this.data.calendarBlocks, parsed.calendarBlocks);

            if (Array.isArray(parsed.gcalCompleted)) {
                parsed.gcalCompleted.forEach(id => {
                    if (!this.data.gcalCompleted.includes(id)) {
                        this.data.gcalCompleted.push(id);
                    }
                });
            }
            if (Array.isArray(parsed.pinnedLevels) && parsed.pinnedLevels.length > 0) {
                mergeArray(this.data.pinnedLevels, parsed.pinnedLevels);
            }
        }
        this.triggerSave();
        if (typeof render === 'function') render();
    }
    
    reset() {
        this.data = JSON.parse(JSON.stringify(this.defaultData));
        this.triggerSave();
    }
}

const AppData = new LifeHubDataManager();

async function forceSync() { 
    if(confirm("Vuoi SCARICARE i dati dal cloud (OK) o FORZARE il caricamento dei dati locali sul cloud (Annulla)?")) {
        await AppData.initialize(); 
        if (state.view === 'global_calendar' && AppData.gcalApiKey && AppData.gcalId) {
            await AppData.fetchGCalEvents();
            render();
        }
    } else {
        AppData.pushToCloud(); 
    }
}
