// ==UserScript==
// @name         LEF Auto Assistant Click
// @namespace    le-tools
// @version      1.2.0
// @match        https://game.logistics-empire.com/*
// @description  Automatischer Assistent. Mit Pause-Button und Lieferzeit-Warnung (>3 Min).
// @run-at       document-idle
// @grant        none
// @updateURL    https://gist.github.com/XschlexX/2e949c82964837ede6e5d5ed6109ef99/raw/lef-auto-order-click.user.js
// @downloadURL  https://gist.github.com/XschlexX/2e949c82964837ede6e5d5ed6109ef99/raw/lef-auto-order-click.user.js
// ==/UserScript==

(function () {
    'use strict';

    // --- EINSTELLUNGEN ---
    // Maximale Lieferzeit in Minuten, bevor die Warnung aufploppt (z.B. 1200 = 20 Minuten)
    const MAX_DELIVERY_TIME_MINUTES = 15;

    let isAutoEnabled = false; // Startet immer AUS, wird automatisch aktiviert
    let warningDiv = null;
    let toggleBtn = null;
    let deactivateTimeout = null;
    const DEACTIVATE_DELAY_S = 10; // 10 Sekunden Verzögerung vor Deaktivierung

    let isAutoRequesting = false; // Status für automatisches Anklicken der Anfragen
    let lastRequestClickTime = 0;
    const REQUEST_CLICK_COOLDOWN_MS = 2000; // Pause zwischen den Auftrags-Klicks

    // Aktualisiert den Toggle-Button anhand des aktuellen isAutoEnabled-Status
    function updateToggleButton() {
        if (!toggleBtn) return;
        if (isAutoEnabled) {
            toggleBtn.style.backgroundColor = '#4CAF50';
            toggleBtn.innerHTML = '🤖 Auto: AN';
        } else {
            toggleBtn.style.backgroundColor = '#F44336';
            toggleBtn.innerHTML = '🛑 Auto: AUS';
        }
    }

    // Aktualisiert den Auto-Anfragen-Button
    function updateAutoRequestButton() {
        const btn = document.getElementById('lef-anfragen-custom-btn');
        if (!btn) return;
        if (isAutoRequesting) {
            btn.innerHTML = '🚀 Auto-Start: AN';
            btn.style.backgroundColor = '#4CAF50'; // Grün
        } else {
            btn.innerHTML = '⏸️ Auto-Start: AUS';
            btn.style.backgroundColor = '#9C27B0'; // Lila
        }
    }

    // Erstellt den Ein/Aus Schalter oben rechts
    function createToggleButton() {
        toggleBtn = document.createElement('button');
        toggleBtn.id = 'lef-toggle-btn';
        toggleBtn.style.position = 'fixed';
        toggleBtn.style.top = '10px';
        toggleBtn.style.right = '10px';
        toggleBtn.style.zIndex = '999999';
        toggleBtn.style.padding = '8px 15px';
        toggleBtn.style.color = 'white';
        toggleBtn.style.border = '2px solid white';
        toggleBtn.style.borderRadius = '5px';
        toggleBtn.style.fontWeight = 'bold';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5)';
        updateToggleButton();

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            isAutoEnabled = !isAutoEnabled;
            // Bei manuellem Eingreifen den Timer sicherheitshalber löschen
            if (deactivateTimeout) {
                clearTimeout(deactivateTimeout);
                deactivateTimeout = null;
            }
            updateToggleButton();
        });

        document.body.appendChild(toggleBtn);
    }

    // Zeigt oder versteckt das Warn-Popup oben in der Mitte
    function showTimeWarning(show, msg = '') {
        if (!warningDiv) {
            warningDiv = document.createElement('div');
            warningDiv.style.position = 'fixed';
            warningDiv.style.top = '100px';
            warningDiv.style.left = '50%';
            warningDiv.style.transform = 'translateX(-50%)';
            warningDiv.style.zIndex = '999999';
            warningDiv.style.padding = '10px 20px';
            warningDiv.style.backgroundColor = '#FF9800'; // Orange
            warningDiv.style.color = 'white';
            warningDiv.style.border = '2px solid white';
            warningDiv.style.borderRadius = '5px';
            warningDiv.style.fontWeight = 'bold';
            warningDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.5)';
            warningDiv.style.display = 'none';
            document.body.appendChild(warningDiv);
        }

        if (show) {
            warningDiv.innerHTML = '⚠️ ACHTUNG: ' + msg;
            warningDiv.style.display = 'block';
        } else {
            warningDiv.style.display = 'none';
        }
    }

    // Wandelt den Text (z.B. "5m 54s", "3h") in Sekunden um
    function parseTimeToSeconds(timeStr) {
        let totalSeconds = 0;
        // Zerstückelt den String, z.B. ["5m", "54s"]
        const parts = timeStr.trim().split(' ');

        parts.forEach(part => {
            const value = parseInt(part); // Holt nur die Zahl, z.B. 5
            if (isNaN(value)) return;

            if (part.includes('h')) totalSeconds += value * 3600;
            else if (part.includes('m')) totalSeconds += value * 60;
            else if (part.includes('s')) totalSeconds += value;
        });

        return totalSeconds;
    }

    // Liest die aktuelle "Zeit benötigt" vom Bildschirm und gibt Sekunden zurück (oder null wenn nicht gefunden)
    function getDeliveryTimeSeconds() {
        const pageText = document.body.innerText || '';
        const match = pageText.match(/Zeit ben[öo]tigt\s+((?:\d+\s*[hms]\s*){1,3})/i);
        if (match && match[1]) {
            return { seconds: parseTimeToSeconds(match[1]), timeString: match[1].trim() };
        }
        return null;
    }

    // Überprüft die Lieferzeit und zeigt ggf. die Warnung
    function checkDeliveryTime() {
        const result = getDeliveryTimeSeconds();
        if (result) {
            if (result.seconds > MAX_DELIVERY_TIME_MINUTES * 60) {
                showTimeWarning(true, `Lieferzeit zu hoch! (${result.timeString})`);
            } else {
                showTimeWarning(false);
            }
        } else {
            showTimeWarning(false); // Kein Zeit-Fenster offen: Warnung verstecken
        }
    }

    // Erkennt ob das Handelszentrum-Fenster offen ist (anhand des Icons oben links)
    function isHandelszentrumOpen() {
        return !!document.querySelector('img[src*="page_header_orders-"]');
    }

    // Automatische Aktivierung/Deaktivierung des Auto-Modus je nach Handelszentrum-Status
    function watchHandelszentrum() {
        const isHandelszentrumNowOpen = isHandelszentrumOpen();

        if (isHandelszentrumNowOpen) {
            // Wenn das Fenster offen ist: Timer abbrechen und Modus sofort AN
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
            // Wenn das Fenster geschlossen ist, der Auto-Modus aber noch an ist: Timer starten
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
                }, DEACTIVATE_DELAY_S * 1000); // <-- WICHTIG: * 1000 um Sekunden in Millisekunden umzurechnen
            }
        }
    }

    // Prüft ob ein Fenster offen ist, in dem der Assistent aktiv sein soll:
    // Fenster 1: Lieferanten-Auswahl ("Angeforderte Waren")
    // Fenster 2: Fahrzeug-Auswahl ("Deadline")
    function isOrderWindow() {
        const pageText = document.body.textContent || '';
        const isSupplierWindow = pageText.includes('Angeforderte Waren');
        const isVehicleWindow = pageText.includes('Deadline');
        return isSupplierWindow || isVehicleWindow;
    }

    // Die eigentliche Klick-Logik
    function scanForAssistantButton() {
        // Zeitprüfung läuft IMMER, egal ob Auto-Klicker an oder aus ist
        checkDeliveryTime();

        // Wenn Auto-Klicker aus ist, brich hier ab (keine Klicks ausführen)
        if (!isAutoEnabled) return;

        // Nur klicken wenn ein relevantes Fenster offen ist
        if (!isOrderWindow()) return;

        const assistantBtn = document.querySelector('button[data-tutorial-id="transport-assistant"]');
        if (!assistantBtn) return;

        const img = assistantBtn.querySelector('img');
        if (!img) return;

        const src = img.getAttribute('src') || '';

        const pageText = document.body.textContent || '';
        const isVehicleWindow = pageText.includes('Transportkosten') || pageText.includes('Ausgewählte Kapazität');

        // Status 1: Frau mit Helm (auto_select) → immer klicken (Fahrzeugauswahl durch Assistent)
        if (src.includes('auto_select') && assistantBtn.getAttribute('data-state') !== 'auto_select') {
            assistantBtn.setAttribute('data-state', 'auto_select');
            assistantBtn.click();
        }
        // Status 2: Blaue Pfeile (in_progress oder button-continue) → Auftrag starten
        else if ((src.includes('in_progress') || src.includes('button-continue')) && assistantBtn.getAttribute('data-state') !== 'in_progress') {
            if (isVehicleWindow) {
                // Im Fahrzeugfenster: Lieferzeit prüfen BEVOR der Auftrag gestartet wird
                const result = getDeliveryTimeSeconds();
                if (!result) return; // Zeit noch nicht bekannt → warten
                if (result.seconds > MAX_DELIVERY_TIME_MINUTES * 60) {
                    // Zeit zu hoch → STOPP, Warnung ist bereits sichtbar
                    assistantBtn.setAttribute('data-state', 'stopped_time_exceeded');
                    return;
                }
            }
            // Zeit OK (oder Lieferanten-Fenster) → Auftrag starten
            assistantBtn.setAttribute('data-state', 'in_progress');
            assistantBtn.click();
        }
    }

    // -----------------------------------------------------------------------
    // HANDELSZENTRUM: Automatisches Einsammeln abgeschlossener Aufträge
    // -----------------------------------------------------------------------
    let lastRewardCollect = 0;
    const REWARD_COLLECT_COOLDOWN_MS = 2000; // 2 Sekunden Pause nach jedem Klick

    function scanForRewards() {
        if (!isAutoEnabled) return;

        const pageText = document.body.textContent || '';

        // Nur aktiv wenn Handelszentrum geöffnet ist und es abgeschlossene Aufträge gibt
        if (!pageText.includes('Handelszentrum') || !pageText.includes('Abgeschlossen')) return;

        // Cooldown: nicht zu schnell klicken
        if (Date.now() - lastRewardCollect < REWARD_COLLECT_COOLDOWN_MS) return;

        // --- Versuch 1: "Alle einsammeln" Button (erkennbar an shape--custom) ---
        // Erscheint wenn mehrere Aufträge abgeschlossen sind
        const allCollectImg = document.querySelector('button[class*="shape--custom"] img[src*="collect_rewards"]');
        if (allCollectImg) {
            const btn = allCollectImg.closest('button');
            if (btn && btn.offsetParent !== null) {
                console.log('[LEF Auto Assistant] Alle einsammeln geklickt');
                btn.click();
                lastRewardCollect = Date.now();
                return;
            }
        }

        // --- Versuch 2: Einzelner Reward-Button (erkennbar an shape--square) ---
        // Erscheint wenn nur ein Auftrag abgeschlossen ist
        const singleCollectImg = document.querySelector('button[class*="shape--square"] img[src*="collect_rewards"]');
        if (singleCollectImg) {
            const btn = singleCollectImg.closest('button');
            if (btn && btn.offsetParent !== null) {
                console.log('[LEF Auto Assistant] Einzel-Belohnung eingesammelt');
                btn.click();
                lastRewardCollect = Date.now();
                return;
            }
        }
    }

    // -----------------------------------------------------------------------
    // UI: Zusätzlicher Button neben "Anfragen"
    // -----------------------------------------------------------------------
    function injectAnfragenButton() {
        if (!isHandelszentrumOpen()) return;

        // Prüfen, welcher Reiter aktuell aktiv ist
        const activeFilterBtn = document.querySelector('.bb-filter-and-sort-bar button[active="true"]');
        const isAnfragenTab = activeFilterBtn && activeFilterBtn.getAttribute('aria-label') === 'Anfragen';

        let btn = document.getElementById('lef-anfragen-custom-btn');

        // Wenn wir NICHT im "Anfragen"-Reiter sind, Button verstecken
        if (!isAnfragenTab) {
            if (btn) btn.style.display = 'none';
            return;
        }

        // Wir SIND im "Anfragen"-Reiter. Button anzeigen, falls er existiert.
        if (btn) {
            btn.style.display = 'inline-block';
            return;
        }

        // Suche das Text-Element "Anfragen" in der Filterleiste
        const filterBar = document.querySelector('.bb-filter-and-sort-bar');
        if (!filterBar) return;

        const textDivs = filterBar.querySelectorAll('.px-md.text-sm');
        let targetDiv = null;
        for (const div of textDivs) {
            if (div.textContent.trim() === 'Anfragen') {
                targetDiv = div;
                break;
            }
        }

        if (!targetDiv) return;

        // Button erstellen
        btn = document.createElement('button');
        btn.id = 'lef-anfragen-custom-btn';
        // Styling für den Button
        btn.style.marginLeft = '15px';
        btn.style.padding = '2px 8px';
        btn.style.border = '1px solid white';
        btn.style.borderRadius = '5px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '12px';
        btn.style.fontWeight = 'bold';
        btn.style.verticalAlign = 'middle';
        btn.style.color = 'white';
        // Wir machen den Container zum Flex-Layout, damit alles auf einer Zeile bleibt
        targetDiv.style.display = 'flex';
        targetDiv.style.alignItems = 'center';

        // Klick-Event
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Verhindert, dass das Accordion auf/zuklappt falls eins da ist
            isAutoRequesting = !isAutoRequesting;
            updateAutoRequestButton();
            console.log(`[LEF Auto Assistant] Auto-Anfragen ist jetzt: ${isAutoRequesting ? 'AN' : 'AUS'}`);
        });

        // Button direkt IN das Label-Div setzen, neben den Text
        targetDiv.appendChild(btn);

        // UI initialisieren
        updateAutoRequestButton();
    }

    // Führt das automatische Anklicken der Anfragen aus
    function processAutoRequests() {
        if (!isAutoEnabled) return; // Hauptschalter muss an sein
        if (!isAutoRequesting) return; // Feature-Schalter muss an sein
        if (!isHandelszentrumOpen()) return; // Nur wenn Handelszentrum offen ist

        // Cooldown prüfen
        if (Date.now() - lastRequestClickTime < REQUEST_CLICK_COOLDOWN_MS) return;

        // Finde den ersten Anfrage-Button
        const requestBtn = document.querySelector('button[data-tutorial-id="tutorial.view.tradecenter.requests"]');

        if (requestBtn && requestBtn.offsetParent !== null) {
            console.log('[LEF Auto Assistant] Auto-Anfragen: Klicke auf Schreibbrett...');
            requestBtn.click();
            lastRequestClickTime = Date.now();
        }
    }

    function init() {
        console.log('[LEF Auto Assistant] Initialisiert (Version 1.2.0)');
        createToggleButton();
        setInterval(watchHandelszentrum, 500);   // Auto-Modus an/aus je nach Handelszentrum
        setInterval(scanForAssistantButton, 100);
        setInterval(scanForRewards, 1000);          // Handelszentrum-Belohnungen prüfen
        setInterval(injectAnfragenButton, 1000); // Button bei Bedarf einfügen
        setInterval(processAutoRequests, 1000);  // Auto-Anfragen ausführen
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();