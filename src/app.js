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
const navigationManager = new NavigationManager(mapManager, gpxManager, speechManager);

// Pass gpxManager to mapManager as mapManager is initialized first
mapManager.setGpxManager(gpxManager);

// Set up event listeners
document.getElementById('navigate').addEventListener('click', () => navigationManager.startNavigation());
document.getElementById('wake-lock').addEventListener('click', (e) => deviceManager.toggleWakeLock(e));
document.getElementById('gpx-upload').addEventListener('change', (e) => gpxManager.loadGPX(e));

// Start location tracking
navigationManager.startLocationTracking();
deviceManager.startOrientationTracking();