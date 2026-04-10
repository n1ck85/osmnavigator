import 'bootstrap/js/dist/offcanvas.js';
import { MapManager } from './classes/MapManager.js';
import { GPXManager } from './classes/GPXManager.js';
import { NavigationManager } from './classes/NavigationManager.js';
import { DeviceManager } from './classes/DeviceManager.js';
import { SpeechManager } from './classes/SpeechManager.js';

// Initialize all managers
const mapManager = new MapManager('map');
const speechManager = new SpeechManager();
const gpxManager = new GPXManager(mapManager);
const deviceManager = new DeviceManager();
const navigationManager = new NavigationManager(mapManager, gpxManager, speechManager, deviceManager);

// Pass managers to mapManager as mapManager is initialized first
mapManager.setManagers([gpxManager, navigationManager]);

// Set up event listeners
document.getElementById('gpx-upload-input').addEventListener('change', (e) => gpxManager.loadGPX(e));
document.getElementById('navigate').addEventListener('click', () => navigationManager.startNavigation());
document.getElementById('follow-user').addEventListener('click', (e) => navigationManager.toggleFollowUser(e));
document.getElementById('wake-lock').addEventListener('click', (e) => deviceManager.toggleWakeLock(e));

// Start location tracking
navigationManager.startLocationTracking();
deviceManager.startOrientationTracking();