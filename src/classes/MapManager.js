import 'leaflet';
import 'leaflet-gpx';
import TileUtil from './utils/TileUtil.js';

export class MapManager {
    constructor(containerId) {
        this.tileLayerUrl = 'https://api.maptiler.com/maps/openstreetmap/{z}/{x}/{y}.jpg?key=MCXdEISVVJdUnViMkSeS';
        this.map = null;
        this.containerId = 'map';
        this.userMarker = null;
        this.accuracyCircle = null;
        this.navigationManager = null;
        this.polyline = null;
        this.gpxManager = null;

       this.initializeMap();

        this.map.addEventListener('dragstart', () => {
            this.navigationManager.stopFollowingUser();
        });

        this.createButtonControl('gpx-upload', 'topleft', '<i class="bi bi-file-earmark-arrow-up"></i>', 'file');
        this.createButtonControl('navigate', 'topleft', '<i class="bi bi-signpost-split"></i>');
        this.createButtonControl('follow-user', 'topleft', '<i class="bi bi-crosshair2"></i>');
        this.createButtonControl('wake-lock', 'topleft', '<i class="bi bi-eye"></i></i>');

        this.createInfoBox('gps-accuracy', 'bottomleft', '<span>GPS Accuracy: <span id="accuracy-value"></span>');
    }

    setManagers(managers) {
        this.gpxManager = managers[0];
        this.navigationManager = managers[1];
    }

    initializeMap() {
        this.map = L.map(this.containerId).setView([0, 0], 17);

        L.tileLayer(this.tileLayerUrl, {
            maxZoom: 17,
            minZoom: 10,
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }

    createUserMarker(latlng) {
        const headingIcon = L.divIcon({
            className: "",
            html: `<div id="heading-marker" class="my-location"></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        this.userMarker = L.marker(latlng, { icon: headingIcon }).addTo(this.map);
    }

    createAccuracyCircle(latlng, radius) {
        this.accuracyCircle = L.circle(latlng, {
            radius: radius,
            color: 'blue',
            fillOpacity: 0.1
        }).addTo(this.map);
    }

    createButtonControl(id, position, html, type) {
        const ButtonControl = L.Control.extend({
            options: {
                position: position
            },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                container.style.overflow = 'hidden';
                const button = L.DomUtil.create('span', '', container);
                button.id = id;
                button.innerHTML = html;
                button.style.cursor = 'pointer';
                button.style.backgroundColor = 'white';
                button.style.padding = '6px';
                button.style.fontSize = '18px';
                button.style.lineHeight = '30px';

                if (type === 'file') {
                    button.type = 'file';
                    button.addEventListener('click', (e) => {
                        const fileInput = document.getElementById(`${id}-input`);
                        fileInput.click();
                    });
                }
                else {
                    button.href = '#';
                }
                return container;
            }
        });

        this.map.addControl(new ButtonControl());
    }

    createInfoBox(id, position, content) {
        const InfoControl = L.Control.extend({
            options: {
                position: position
            },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                const info = L.DomUtil.create('div', '', container);
                info.innerHTML = content;
                info.style.backgroundColor = 'white';
                info.style.padding = '1px 2px';
                info.style.borderRadius = '4px';
                info.id = id;
                return container;
            }
        });

        this.map.addControl(new InfoControl());
    }

    updateUserMarker(latlng, accuracy) {
        this.userMarker.setLatLng(latlng);
        this.accuracyCircle.setLatLng(latlng).setRadius(accuracy);
    }

    distance(latlng1, latlng2) {
        return this.map.distance(latlng1, latlng2);
    }

    fitBounds(bounds) {
        this.map.fitBounds(bounds);
    }

    panTo(latlng) {
        this.map.panTo(latlng);
    }

    clearLayer(layer){
        this.map.removeLayer(layer);
    }

    getClosestTrackPoint(currentPos, trkpts) {
        let closest = null;
        let minDist = Infinity;

        trkpts.forEach(trkpt => {
            const dist = this.distance(
                L.latLng(currentPos.lat, currentPos.lng),
                L.latLng(trkpt.lat, trkpt.lon)
            );

            if (dist < minDist) {
                minDist = dist;
                closest = trkpt;
            }
        });

        return { closestTrkpt: closest, dist: minDist };
    }

    getClosestPointOnPolyline(latlng) {
        const targetPoint = this.map.latLngToLayerPoint(latlng);
        const latlngs = this.gpxManager.trackPoints;

        let closest = null;
        let minDist = Infinity;

        for (let i = 0; i < latlngs.length - 1; i++) {
            const p1 = this.map.latLngToLayerPoint(latlngs[i]);
            const p2 = this.map.latLngToLayerPoint(latlngs[i + 1]);

            const candidate = L.LineUtil.closestPointOnSegment(targetPoint, p1, p2);
            const dist = targetPoint.distanceTo(candidate);

            if (dist < minDist) {
                minDist = dist;
                closest = candidate;
            }
        }

        return {
            latlng: this.map.layerPointToLatLng(closest),
            // distancePixels: minDist,
            distanceMeters: latlng.distanceTo(this.map.layerPointToLatLng(closest))
        };
    }

    cacheTilesForBounds(bounds) { 
        const minZoom = this.map.getMinZoom();
        const maxZoom = this.map.getMaxZoom();
        console.log(minZoom,maxZoom);
        const template = this.tileLayerUrl; 

        const urls = TileUtil.generateForAllZooms(bounds, minZoom, maxZoom, template);
        
        console.log('caching urls');
        TileUtil.sendToServiceWorker(urls);
    }

}