if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

import './style.css';

import 'bootstrap/js/dist/offcanvas.js';
import 'bootstrap/js/dist/collapse.js';
import { MapManager } from './classes/MapManager.js';
import { GPXManager } from './classes/GPXManager.js';
import { NavigationManager } from './classes/NavigationManager.js';
import { DeviceManager } from './classes/DeviceManager.js';
import { SpeechManager } from './classes/SpeechManager.js';
import { UIManager } from './classes/UIManager.js';
import { map } from 'leaflet';

// Initialize all managers
const mapManager = new MapManager('map');
const deviceManager = new DeviceManager();
const speechManager = new SpeechManager();
const gpxManager = new GPXManager(mapManager, deviceManager);
const navigationManager = new NavigationManager(mapManager, gpxManager, speechManager, deviceManager);
const uiManager = new UIManager(mapManager, gpxManager, navigationManager, deviceManager);

// Pass managers to mapManager as mapManager is initialized first
mapManager.setManagers([gpxManager, navigationManager]);

// Start location tracking
navigationManager.startLocationTracking();
deviceManager.startOrientationTracking();