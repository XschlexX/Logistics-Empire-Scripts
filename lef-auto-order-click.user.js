// ==UserScript==
// @name         LEF Auto Assistant Click
// @namespace    le-tools
// @version      1.2.4
// @match        https://game.logistics-empire.com/*
// @description  Automatischer Assistent. Mit Pause-Button und Lieferzeit-Warnung (> 3 Min).
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/XschlexX/Logistics-Empire-Scripts/main/lef-auto-order-click.user.js
// @downloadURL  https://raw.githubusercontent.com/XschlexX/Logistics-Empire-Scripts/main/lef-auto-order-click.user.js
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================================
    // KONFIGURATION
    // =========================================================================

    // =========================================================================
    // SELEKTOREN & KONSTANTEN
    // =========================================================================
    const ASSISTANT_BTN_SELECTOR = 'button[data-tutorial-id="transport-assistant"]';
    const ALL_REWARDS_BTN_SELECTOR = 'button.variant--normal img[src*="collect_order"]';
    const HANDELSZENTRUM_HEADER_SRC = 'img[src*="page_header_orders-"]';
    const FILTER_BAR_SELECTOR = '.bb-filter-and-sort-bar';
    const REQUEST_BTN_SELECTOR = 'button[data-tutorial-id="tutorial.view.tradecenter.requests"]';

    /** Verzögerung in Sekunden, bevor der Auto-Modus nach Schließen des Handelszentrums deaktiviert wird */
    const DEACTIVATE_DELAY_S = 10;

    /** Mindestpause in ms zwischen zwei automatischen Auftrags-Klicks */
    const REQUEST_CLICK_COOLDOWN_MS = 2000;

    /** Mindestpause in ms zwischen zwei automatischen Belohnungs-Klicks */
    const REWARD_COLLECT_COOLDOWN_MS = 2000;


    // =========================================================================
    // ZUSTANDSVARIABLEN
    // =========================================================================

    let isAutoEnabled = false; // Haupt-Schalter: Auto-Klicker aktiv?
    let isAutoRequesting = false; // Feature-Schalter: Auto-Anfragen aktiv?
    let isAutoAssistantEnabled = true; // Feature-Schalter: Assistent Klicks aktiv?
    let isAutoRewardsEnabled = true; // Feature-Schalter: Belohnungen sammeln aktiv?
    let maxDeliveryTimeMinutes = 15; // Variable für maximale Lieferzeit in Minuten
    let deactivateTimeout = null;  // Timer-Handle für die verzögerte Deaktivierung
    let lastRewardCollect = 0;     // Timestamp des letzten Belohnungs-Klicks
    let lastRequestClickTime = 0;     // Timestamp des letzten Anfrage-Klicks

    /** Referenz auf den Toggle-Button im DOM */
    let toggleBtn = null;

    /** Referenz auf den Settings-Dialog im DOM */
    let settingsDialog = null;

    /** Referenz auf das Warn-Popup im DOM */
    let warningDiv = null;


    // =========================================================================
    // ABSCHNITT 1: UI – TOGGLE-BUTTON & WARN-POPUP
    // =========================================================================

    /**
     * Aktualisiert Farbe und Beschriftung des Haupt-Toggle-Buttons
     * entsprechend dem aktuellen `isAutoEnabled`-Status.
     */
    function updateToggleButton() {
        if (!toggleBtn) return;
        toggleBtn.style.backgroundColor = isAutoEnabled ? '#4CAF50' : '#F44336';
        toggleBtn.innerHTML = (isAutoEnabled ? '🤖 Auto: AN' : '🛑 Auto: AUS') + ' ⚙️';
        if (settingsDialog && settingsDialog.updateCheckboxes) {
            settingsDialog.updateCheckboxes();
        }
    }

    /**
     * Aktualisiert Farbe und Beschriftung des Auto-Anfragen-Buttons
     * entsprechend dem aktuellen `isAutoRequesting`-Status.
     */
    function updateAutoRequestButton() {
        const btn = document.getElementById('lef-anfragen-custom-btn');
        if (!btn) return;
        btn.innerHTML = isAutoRequesting ? '🚀 Auto-Start: AN' : '⏸️ Auto-Start: AUS';
        btn.style.backgroundColor = isAutoRequesting ? '#4CAF50' : '#9C27B0';
    }

    /**
     * Erstellt den fest positionierten Ein/Aus-Toggle-Button oben rechts im Fenster
     * und fügt ihn dem DOM hinzu. Klicks schalten `isAutoEnabled` um und
     * brechen einen laufenden Deaktivierungs-Timer ab.
     */
    function createToggleButton() {
        toggleBtn = document.createElement('button');
        toggleBtn.id = 'lef-toggle-btn';
        Object.assign(toggleBtn.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: '999999',
            padding: '8px 15px',
            color: 'white',
            border: '2px solid white',
            borderRadius: '5px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
        });
        updateToggleButton();

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = settingsDialog.style.display === 'none';
            settingsDialog.style.display = isHidden ? 'flex' : 'none';
            if (isHidden) {
                settingsDialog.updateCheckboxes();
            }
        });

        document.body.appendChild(toggleBtn);
        createSettingsDialog();
    }

    /**
     * Erstellt den Einstellungs-Dialog, um einzelne Funktionen zu aktivieren/deaktivieren.
     */
    function createSettingsDialog() {
        settingsDialog = document.createElement('div');
        Object.assign(settingsDialog.style, {
            position: 'fixed',
            top: '55px',
            right: '10px',
            backgroundColor: 'rgba(30, 30, 30, 0.95)',
            color: 'white',
            padding: '15px',
            border: '2px solid white',
            borderRadius: '5px',
            zIndex: '999999',
            boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
            display: 'none',
            flexDirection: 'column',
            gap: '12px',
            minWidth: '220px',
            fontFamily: 'sans-serif'
        });

        const title = document.createElement('h3');
        title.innerHTML = '⚙️ Auto-Einstellungen';
        Object.assign(title.style, {
            margin: '0 0 5px 0',
            fontSize: '16px',
            borderBottom: '1px solid #555',
            paddingBottom: '8px'
        });
        settingsDialog.appendChild(title);

        const createCheckbox = (label, initialState, onChange) => {
            const container = document.createElement('label');
            Object.assign(container.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '14px'
            });
            const text = document.createElement('span');
            text.textContent = label;
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = initialState;
            input.style.cursor = 'pointer';
            input.addEventListener('change', (e) => onChange(e.target.checked));

            container.appendChild(text);
            container.appendChild(input);
            return { container, input };
        };

        const createNumberInput = (label, initialState, onChange) => {
            const container = document.createElement('label');
            Object.assign(container.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '14px', marginTop: '5px'
            });
            const text = document.createElement('span');
            text.textContent = label;
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '1';
            input.value = initialState;
            Object.assign(input.style, {
                width: '50px', backgroundColor: '#333', color: 'white', border: '1px solid #777', borderRadius: '3px', padding: '2px 5px', textAlign: 'right'
            });
            input.addEventListener('change', (e) => {
                let val = parseInt(e.target.value, 10);
                if (isNaN(val) || val < 1) val = 1; // Fallback für ungültige Eingaben
                e.target.value = val;
                onChange(val);
            });
            container.appendChild(text);
            container.appendChild(input);
            return { container, input };
        };

        const masterToggle = createCheckbox('1️⃣ Hauptschalter', isAutoEnabled, (val) => {
            isAutoEnabled = val;
            saveSettings();
            if (deactivateTimeout) {
                clearTimeout(deactivateTimeout);
                deactivateTimeout = null;
            }
            updateToggleButton();
        });

        const assistantToggle = createCheckbox('2️⃣ Auto-Assistent', isAutoAssistantEnabled, (val) => {
            isAutoAssistantEnabled = val;
            saveSettings();
        });

        const rewardsToggle = createCheckbox('3️⃣ Auto-Belohnungen', isAutoRewardsEnabled, (val) => {
            isAutoRewardsEnabled = val;
            saveSettings();
        });

        const requestToggle = createCheckbox('4️⃣ Auto-Anfragen', isAutoRequesting, (val) => {
            isAutoRequesting = val;
            saveSettings();
            updateAutoRequestButton();
        });

        const maxTimeInput = createNumberInput('⏳ Max. Lieferzeit (Min)', maxDeliveryTimeMinutes, (val) => {
            maxDeliveryTimeMinutes = val;
            saveSettings();
        });

        settingsDialog.updateCheckboxes = () => {
            masterToggle.input.checked = isAutoEnabled;
            assistantToggle.input.checked = isAutoAssistantEnabled;
            rewardsToggle.input.checked = isAutoRewardsEnabled;
            requestToggle.input.checked = isAutoRequesting;
            maxTimeInput.input.value = maxDeliveryTimeMinutes;
        };

        settingsDialog.appendChild(masterToggle.container);
        settingsDialog.appendChild(assistantToggle.container);
        settingsDialog.appendChild(rewardsToggle.container);
        settingsDialog.appendChild(requestToggle.container);
        settingsDialog.appendChild(maxTimeInput.container);

        document.body.appendChild(settingsDialog);
    }

    /**
     * Zeigt oder versteckt das orangefarbene Warn-Popup in der Mitte oben.
     * Das Popup-Element wird beim ersten Aufruf lazy erstellt.
     *
     * @param {boolean} show - true = anzeigen, false = verstecken
     * @param {string}  msg  - Nachrichtentext (wird nur bei show=true verwendet)
     */
    function showTimeWarning(show, msg = '') {
        if (!warningDiv) {
            warningDiv = document.createElement('div');
            Object.assign(warningDiv.style, {
                position: 'fixed',
                top: '100px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: '999999',
                padding: '10px 20px',
                backgroundColor: '#FF9800',
                color: 'white',
                border: '2px solid white',
                borderRadius: '5px',
                fontWeight: 'bold',
                boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
                display: 'none',
            });
            document.body.appendChild(warningDiv);
        }

        if (show) {
            warningDiv.innerHTML = '⚠️ ACHTUNG: ' + msg;
            warningDiv.style.display = 'block';
        } else {
            warningDiv.style.display = 'none';
        }
    }


    // =========================================================================
    // ABSCHNITT 2: HILFSFUNKTIONEN – ZEIT & ERKENNUNG
    // =========================================================================

    /**
     * Wandelt einen Zeitstring (z.B. "5m 54s", "3h", "1h 30m") in Sekunden um.
     *
     * @param   {string} timeStr - Zeitstring aus dem Spielinterface
     * @returns {number}           Gesamtzeit in Sekunden
     */
    function parseTimeToSeconds(timeStr) {
        let totalSeconds = 0;
        timeStr.trim().split(' ').forEach(part => {
            const value = parseInt(part);
            if (isNaN(value)) return;
            if (part.includes('h')) totalSeconds += value * 3600;
            else if (part.includes('m')) totalSeconds += value * 60;
            else if (part.includes('s')) totalSeconds += value;
        });
        return totalSeconds;
    }

    /**
     * Liest den aktuellen "Zeit benötigt"-Wert aus dem Seitentext und
     * gibt ihn als Objekt zurück.
     *
     * @returns {{ seconds: number, timeString: string } | null}
     *   Sekunden und originaler Zeitstring, oder null wenn kein Fenster offen ist.
     */
    function getDeliveryTimeSeconds() {
        // textContent ist extrem viel schneller als innerText und verhindert Reflow-Spikes!
        const match = (document.body.textContent || '').match(/Zeit ben[öo]tigt\s+((?:\d+\s*[hms]\s*){1,3})/i);
        if (match && match[1]) {
            return { seconds: parseTimeToSeconds(match[1]), timeString: match[1].trim() };
        }
        return null;
    }

    /**
     * Liest die aktuelle Lieferzeit und zeigt das Warn-Popup an,
     * falls der Wert `maxDeliveryTimeMinutes` überschreitet.
     * Versteckt die Warnung wenn kein Fenster offen oder Zeit in Ordnung ist.
     */
    function checkDeliveryTime() {
        const result = getDeliveryTimeSeconds();
        if (result && result.seconds > maxDeliveryTimeMinutes * 60) {
            showTimeWarning(true, `Lieferzeit zu hoch! (${result.timeString})`);
        } else {
            showTimeWarning(false);
        }
    }

    /**
     * Prüft anhand eines charakteristischen Bild-Selektors,
     * ob das Handelszentrum-Fenster aktuell geöffnet ist.
     *
     * @returns {boolean}
     */
    function isHandelszentrumOpen() {
        return !!document.querySelector(HANDELSZENTRUM_HEADER_SRC);
    }

    /**
     * Prüft ob ein relevantes Bestell-Fenster geöffnet ist, in dem der
     * Auto-Klicker aktiv sein soll (Lieferanten-Auswahl oder Fahrzeug-Auswahl).
     *
     * @returns {boolean}
     */
    function isOrderWindow() {
        const pageText = document.body.textContent || '';
        return pageText.includes('Angeforderte Waren') || pageText.includes('Deadline');
    }


    // =========================================================================
    // ABSCHNITT 3: AUTO-MODUS – ERKENNUNG & STEUERUNG
    // =========================================================================

    /**
     * Überwacht den Handelszentrum-Status und schaltet den Auto-Modus
     * automatisch ein oder aus:
     * - Fenster offen  → Auto-Modus sofort AN (laufender Timer wird abgebrochen)
     * - Fenster zu     → nach `DEACTIVATE_DELAY_S` Sekunden AUS schalten
     *                    (auch `isAutoRequesting` wird dann zurückgesetzt)
     */
    function watchHandelszentrum() {
        if (isHandelszentrumOpen()) {
            // Deaktivierungs-Timer abbrechen, falls das Fenster wieder offen ist
            if (deactivateTimeout) {
                clearTimeout(deactivateTimeout);
                deactivateTimeout = null;
                console.log('[LEF Auto Assistant] Deaktivierungs-Timer abgebrochen (Handelszentrum wieder offen)');
            }
            if (!isAutoEnabled) {
                isAutoEnabled = true;
                updateToggleButton();
                console.log('[LEF Auto Assistant] Auto-Modus AN (Handelszentrum erkannt)');
            }
        } else {
            // Fenster zu: verzögert deaktivieren (sofern noch kein Timer läuft)
            if (isAutoEnabled && !deactivateTimeout) {
                console.log(`[LEF Auto Assistant] Handelszentrum verlassen. Warte ${DEACTIVATE_DELAY_S}s vor Deaktivierung...`);
                deactivateTimeout = setTimeout(() => {
                    isAutoEnabled = false;
                    updateToggleButton();
                    if (isAutoRequesting) {
                        isAutoRequesting = false;
                        updateAutoRequestButton();
                        console.log('[LEF Auto Assistant] Auto-Anfragen ebenfalls deaktiviert (Timeout).');
                    }
                    console.log('[LEF Auto Assistant] Auto-Modus AUS (Delay abgelaufen)');
                    deactivateTimeout = null;
                }, DEACTIVATE_DELAY_S * 1000);
            }
        }
    }


    // =========================================================================
    // ABSCHNITT 4: KERN-LOGIK – ASSISTENT-BUTTON & BELOHNUNGEN
    // =========================================================================

    /**
     * Haupt-Scan-Funktion: Wird im kurzen Intervall aufgerufen.
     * - Prüft die Lieferzeit (immer, unabhängig vom Auto-Modus)
     * - Klickt den Assistenten-Button wenn ein Bestell-Fenster aktiv ist:
     *     Status "auto_select" (Frau mit Helm) → Fahrzeugauswahl starten
     *     Status "in_progress" / "button-continue" (blaue Pfeile) → Auftrag bestätigen
     *       (Im Fahrzeugfenster wird erst die Lieferzeit geprüft – zu lang → STOPP)
     */
    function scanForAssistantButton() {
        checkDeliveryTime();
        if (!isAutoEnabled || !isAutoAssistantEnabled || !isOrderWindow()) return;

        const assistantBtn = document.querySelector(ASSISTANT_BTN_SELECTOR);
        if (!assistantBtn) return;

        const src = assistantBtn.querySelector('img')?.getAttribute('src') || '';

        if (src.includes('auto_select') && assistantBtn.getAttribute('data-state') !== 'auto_select') {
            // Frau mit Helm: Fahrzeugauswahl durch Assistenten anstoßen
            assistantBtn.setAttribute('data-state', 'auto_select');
            assistantBtn.click();

        } else if ((src.includes('in_progress') || src.includes('button-continue'))
            && assistantBtn.getAttribute('data-state') !== 'in_progress') {

            // Blaue Pfeile: im Fahrzeugfenster erst Lieferzeit prüfen
            const isVehicleWindow = (document.body.textContent || '')
                .match(/Transportkosten|Ausgewählte Kapazität/);

            if (isVehicleWindow) {
                const result = getDeliveryTimeSeconds();
                if (!result) return; // Zeit noch nicht bekannt → warten
                if (result.seconds > maxDeliveryTimeMinutes * 60) {
                    assistantBtn.setAttribute('data-state', 'stopped_time_exceeded');
                    return; // Warnung ist bereits sichtbar → STOPP
                }
            }

            // Zeit OK (oder Lieferanten-Fenster) → Auftrag starten
            assistantBtn.setAttribute('data-state', 'in_progress');
            assistantBtn.click();
        }
    }

    /**
     * Prüft ob im Handelszentrum abgeschlossene Aufträge eingesammelt werden können
     * und klickt den entsprechenden Button (Cooldown beachten):
     * - Vorrang: "Alle einsammeln" (shape--custom, mehrere Aufträge)
     */
    function scanForRewards() {
        if (!isAutoEnabled || !isAutoRewardsEnabled || !isHandelszentrumOpen()) return;
        if (Date.now() - lastRewardCollect < REWARD_COLLECT_COOLDOWN_MS) return;

        // Alle einsammeln (mehrere Aufträge)
        const allCollectBtn = document.querySelector(ALL_REWARDS_BTN_SELECTOR)?.closest('button');
        if (allCollectBtn && allCollectBtn.offsetParent !== null) {
            console.log('[LEF Auto Assistant] Alle einsammeln geklickt');
            allCollectBtn.click();
            lastRewardCollect = Date.now();
        }
    }


    // =========================================================================
    // ABSCHNITT 5: UI – AUTO-ANFRAGEN-BUTTON (HANDELSZENTRUM)
    // =========================================================================

    /**
     * Fügt im Handelszentrum beim "Anfragen"-Reiter einen Toggle-Button ein,
     * der die Auto-Anfragen-Funktion steuert. Ist ein anderer Reiter aktiv,
     * wird der Button ausgeblendet. Ist der Button bereits vorhanden, wird er
     * nur ein- oder ausgeblendet, aber nicht neu erstellt.
     */
    function injectAnfragenButton() {
        if (!isHandelszentrumOpen()) return;

        const activeFilterBtn = document.querySelector(`${FILTER_BAR_SELECTOR} button[active="true"]`);
        const isAnfragenTab = activeFilterBtn?.getAttribute('aria-label') === 'Anfragen';
        const btn = document.getElementById('lef-anfragen-custom-btn');

        if (!isAnfragenTab) {
            if (btn) btn.style.display = 'none';
            return;
        }

        // Button bereits vorhanden → nur einblenden
        if (btn) {
            btn.style.display = 'inline-block';
            return;
        }

        // Button noch nicht vorhanden → in Filterleiste einfügen
        const filterBar = document.querySelector(FILTER_BAR_SELECTOR);
        if (!filterBar) return;

        // "Anfragen"-Label in der Filterleiste suchen
        const targetDiv = [...filterBar.querySelectorAll('.px-md.text-sm')]
            .find(div => div.textContent.trim() === 'Anfragen');
        if (!targetDiv) return;

        const newBtn = document.createElement('button');
        newBtn.id = 'lef-anfragen-custom-btn';
        Object.assign(newBtn.style, {
            marginLeft: '15px',
            padding: '2px 8px',
            border: '1px solid white',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            verticalAlign: 'middle',
            color: 'white',
        });

        // Container auf Flex umstellen, damit Button und Label nebeneinander liegen
        Object.assign(targetDiv.style, { display: 'flex', alignItems: 'center' });

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Verhindert ungewolltes Accordion-Toggle
            isAutoRequesting = !isAutoRequesting;
            saveSettings();
            updateAutoRequestButton();
            if (settingsDialog && settingsDialog.updateCheckboxes) {
                settingsDialog.updateCheckboxes();
            }
            console.log(`[LEF Auto Assistant] Auto-Anfragen ist jetzt: ${isAutoRequesting ? 'AN' : 'AUS'}`);
        });

        targetDiv.appendChild(newBtn);
        updateAutoRequestButton();
    }

    /**
     * Klickt automatisch auf den ersten sichtbaren Anfrage-Button im Handelszentrum,
     * sofern beide Schalter (Haupt + Feature) aktiv sind und der Cooldown abgelaufen ist.
     */
    function processAutoRequests() {
        if (!isAutoEnabled || !isAutoRequesting || !isHandelszentrumOpen()) return;
        if (Date.now() - lastRequestClickTime < REQUEST_CLICK_COOLDOWN_MS) return;

        const requestBtn = document.querySelector(REQUEST_BTN_SELECTOR);
        if (requestBtn && requestBtn.offsetParent !== null) {
            console.log('[LEF Auto Assistant] Auto-Anfragen: Klicke auf Schreibbrett...');
            requestBtn.click();
            lastRequestClickTime = Date.now();
        }
    }


    // =========================================================================
    // ABSCHNITT 6: INITIALISIERUNG
    // =========================================================================

    const SETTINGS_KEY = 'lef_auto_settings';

    /**
     * Lädt die gespeicherten Einstellungen aus dem LocalStorage.
     */
    function loadSettings() {
        try {
            const saved = localStorage.getItem(SETTINGS_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (typeof parsed.isAutoEnabled === 'boolean') isAutoEnabled = parsed.isAutoEnabled;
                if (typeof parsed.isAutoAssistantEnabled === 'boolean') isAutoAssistantEnabled = parsed.isAutoAssistantEnabled;
                if (typeof parsed.isAutoRewardsEnabled === 'boolean') isAutoRewardsEnabled = parsed.isAutoRewardsEnabled;
                if (typeof parsed.isAutoRequesting === 'boolean') isAutoRequesting = parsed.isAutoRequesting;
                if (typeof parsed.maxDeliveryTimeMinutes === 'number') maxDeliveryTimeMinutes = parsed.maxDeliveryTimeMinutes;
            }
        } catch (e) {
            console.error('[LEF Auto Assistant] Fehler beim Laden der Einstellungen', e);
        }
    }

    /**
     * Speichert die aktuellen Einstellungen im LocalStorage.
     */
    function saveSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            isAutoEnabled, isAutoAssistantEnabled, isAutoRewardsEnabled, isAutoRequesting, maxDeliveryTimeMinutes
        }));
    }

    /**
     * Initialisiert alle UI-Elemente und startet den MutationObserver.
     */
    function init() {
        loadSettings();
        console.log('[LEF Auto Assistant] Initialisiert (mit MutationObserver)');
        createToggleButton();

        let isHandlingMutations = false;
        const observer = new MutationObserver(() => {
            if (!isHandlingMutations) {
                isHandlingMutations = true;
                // requestAnimationFrame bündelt DOM-Änderungen auf 1x pro Frame und verhindert CPU-Spitzen
                requestAnimationFrame(() => {
                    watchHandelszentrum();
                    scanForAssistantButton();
                    scanForRewards();
                    injectAnfragenButton();
                    processAutoRequests();
                    isHandlingMutations = false;
                });
            }
        });

        // attributes überwacht Elemente, die vom Spiel nur über CSS unsichtbar/sichtbar gemacht werden
        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
    }

    // Starten sobald das DOM bereit ist
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();