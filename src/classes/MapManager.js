import 'leaflet';
import 'leaflet-gpx';

export class MapManager {
    constructor(containerId) {
        this.map = L.map(containerId).setView([51.505, -0.09], 13);
        this.userMarker = null;
        this.accuracyCircle = null;
        this.navigationManager = null;
        this.currentGpxLayer = null;
        this.polyline = null;
        this.gpxManager = null;

        this.initializeTileLayer();

        this.map.addEventListener('dragstart', () => {
            this.navigationManager.stopFollowingUser();
        });

        this.createButtonControl('gpx-upload', 'topleft', '<i class="bi bi-file-earmark-arrow-up"></i>', 'file');
        this.createButtonControl('navigate', 'topleft', '<i class="bi bi-signpost-split-fill"></i>');
        this.createButtonControl('follow-user', 'topleft', '<i class="bi bi-crosshair2"></i>');
        this.createButtonControl('wake-lock', 'topleft', '<i class="bi bi-eye"></i></i>');

        this.createInfoBox('gps-accuracy', 'bottomleft', '<span>GPS Accuracy: <span id="accuracy-value"></span>');
    }

    setManagers(managers) {
        this.gpxManager = managers[0];
        this.navigationManager = managers[1];
    }

    initializeTileLayer() {
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }

    createPolyline(gpxData) {
        this.currentGpxLayer = new L.GPX(gpxData, {
            async: true,
            polyline_options: {
                color: 'red',
                weight: 4
            },
            marker_options: {
                startIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-start.png',
                endIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-end.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-shadow.png'
            }
        })
        .on('loaded', (e) => {
            const polylines = this.extractAllPolylines(e.target);

            // Pick the first polyline (usually the route)
            this.polyline = polylines[0];
            this.createVisibleMarkers(e);

        })
        .addTo(this.map);
        console.log(this.currentGpxLayer);
    }

    /**
     * Recursively extract all polylines from a layer (handles nested layers)
     * @param {L.Layer} layer - The layer to search for polylines
     * @returns {L.Polyline[]} - An array of polylines found in the layer
     */
    extractAllPolylines(layer) {
        let result = [];

        // If this layer IS a polyline, store it
        if (layer instanceof L.Polyline) {
            result.push(layer);
        }

        // If this layer contains sublayers, search inside them
        if (layer.getLayers) {
            layer.getLayers().forEach(sub => {
                result = result.concat(this.extractAllPolylines(sub));
            });
        }

        return result;
    }

    createVisibleMarkers(gpxData) {
        this.fitBounds(gpxData.target.getBounds());
        this.totalDistance = gpxData.target.get_distance();

        const trkpts = this.gpxManager.getTrackPoints();
        trkpts.forEach(pt => {
            L.circleMarker([pt.lat, pt.lon], {
                radius: 5,
                color: '#0044ff',
                fillColor: '#0044ff',
                fillOpacity: 0.7,
                weight: 2,
                className: 'track-point-marker'
            }).bindPopup(`Lat: ${pt.lat.toFixed(4)}<br>Lon: ${pt.lon.toFixed(4)}`).addTo(this.map);
        });
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
                    button.addEventListener('click', (e) => {console.log("Button clicked, opening file dialog...");
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
        const latlngs = this.polyline.getLatLngs();

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
}