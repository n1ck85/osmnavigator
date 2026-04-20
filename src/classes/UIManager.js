export class UIManager {
    constructor(mapManager, gpxManager, navigationManager, deviceManager) {
        this.mapManager = mapManager;
        this.gpxManager = gpxManager;
        this.navigationManager = navigationManager;
        this.deviceManager = deviceManager;

        this.setupEventListeners();
        this.setSavedPreferences();
    }

    setupEventListeners() {
        document.getElementById('gpx-upload-input').addEventListener('change', (e) => this.gpxManager.loadGPX(e));
        document.getElementById('navigate').addEventListener('click', () => this.navigationManager.startNavigation());
        document.getElementById('follow-user').addEventListener('click', (e) => this.navigationManager.toggleFollowUser(e));
        document.getElementById('wake-lock').addEventListener('click', (e) => this.deviceManager.toggleWakeLock(e));

        document.getElementById('mapCachingSwitch').addEventListener('change', (e) => {
            this.deviceManager.savePreference('mapCachingEnabled', e.target.checked);
        });
    }

    setSavedPreferences() {
        const mapCachingEnabled = this.deviceManager.getPreference('mapCachingEnabled');
        if (mapCachingEnabled !== null) {
            document.getElementById('mapCachingSwitch').checked = mapCachingEnabled;
        }
    }
}