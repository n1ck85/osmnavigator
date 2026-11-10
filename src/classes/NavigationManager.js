import { DEBUG } from '../config.js';

export class NavigationManager {
    constructor(mapManager, gpxManager, speechManager, deviceManager) {
        this.mapManager = mapManager;
        this.gpxManager = gpxManager;
        this.speechManager = speechManager;
        this.deviceManager = deviceManager;
        this.isNavigating = false;
        this.followUser = true;
        this.lastKnownLocation = null;
        this.lastKnownAccuracy = null;
        this.trackThreshold = 50;
        // this.updateThrottle = 1000; // Minimum gap between navigation updates in milliseconds
        //this.lastUpdateTime = 0;
        this.offRoute = false;
        this.segmentBearings = null;
        this.minTurnSpacing = 20; // Minimum distance in meters between consecutive turns to be ignored
        this.maxShortUTurnDistance = 100; // Maximum distance in meters to consider a U-turn as a short loop to be ignored
        this.cumulativeDistances = null;
        this.turns = null;
        this.turnStateEarlyDistance = 80; // Distance in meters to give early turn alert
        this.turnStateNearDistance = 40; // Distance in meters to give near turn alert
        this.turnStateNowDistance = 10; // Distance in meters to give now turn alert
        this.turnDistanceBuffer = 0; // Buffer distance in meters to offset turn alerts for different speeds or travel
        this.turnState = {
            early: false,
            near: false,
            now: false,
            lastTurnIndex: -1
        };

        this.setupLocationHandlers();
    }

    setupLocationHandlers() {
        this.mapManager.map.on('locationfound', (e) => this.onLocationFound(e));
        this.mapManager.map.on('locationerror', (e) => this.onLocationError(e));
    }

    startLocationTracking() {
        this.mapManager.map.locate({ 
            watch: true, 
            enableHighAccuracy: true,
            // minimumAge: 3000,
            setView: false, 
            maxZoom: 16 
        });
    }

    onLocationFound(e) { 
        if (!this.lastKnownLocation) {
            this.mapManager.createUserMarker(e.latlng);
            this.mapManager.createAccuracyCircle(e.latlng, e.accuracy);
        } else {
            this.mapManager.updateUserMarker(e.latlng, e.accuracy);
        }

        if (this.followUser) {
            this.mapManager.map.panTo(e.latlng);
        }

        this.lastKnownLocation = e.latlng; 
        this.lastKnownAccuracy = e.accuracy || 0;
        document.getElementById("accuracy-value").textContent = `${Math.round(e.accuracy)} meters`;

        if (this.deviceManager.rotateMap) {
            const pane = document.querySelector('.leaflet-map-pane');
            // set transform-origin to map center if map rotation is on
            this.mapManager.centerTransformOriginToMarker(pane);
            console.log("centering to marker");
        }

        if (this.isNavigating) {
            this.updateNavigation();
        }
    }

    onLocationError(e) {
        //alert("Error obtaining location: \r\n" + e.message);
        console.error(e.message);
    }

    startNavigation() {
        if (this.isNavigating) {
            this.mapManager.createInfoBox('navigation-update', 'topright', '<div><i class="bi bi-x-octagon"></i></div><div><span>Navigation stopped</span></div>', 5000);
            this.speechManager.speak("Navigation stopped");
            this.isNavigating = false;
            this.offRoute = false;
            this.segmentBearings = null;
            this.turns = null;
            this.cumulativeDistances = null;
            this.turnState = {
                early: false,
                near: false,
                now: false,
                lastTurnIndex: -1
            };

            const navigateBtnIcon = document.querySelector("#navigate i");
            if (navigateBtnIcon) {
                navigateBtnIcon.classList.remove("bi-signpost-split-fill");
                navigateBtnIcon.classList.add("bi-signpost-split");
            }
            return;
        }

        const trkpts = this.gpxManager.trackPoints;
        if (trkpts.length < 1) {
            this.speechManager.speak("Route not found.");
            return;
        }

        //this.trackThreshold = this.trackThreshold + (this.lastKnownAccuracy / 2);

        const { latlng, distanceMeters } = this.mapManager.getClosestPointOnPolyline(this.lastKnownLocation);
        if (distanceMeters > this.trackThreshold) {
            this.isNavigating = false;
            console.log("Too far from route", `You are ${Math.round(distanceMeters)} meters from the route.`);
            this.mapManager.createInfoBox('navigation-update', 'topright', `<div><i class="bi bi-emoji-frown"></i></div><div><span>Navigation stopped. You are ${Math.round(distanceMeters)} meters away from the route.</span></div>`, 5000);
            this.speechManager.speak(`Navigation stopped. You are too far from the route.`);
            return;
        }

        const routePoints = this.mapManager.getCurrentPolyline();
        //console.log("current Polyline:", routePoints);

        this.isNavigating = true;

        this.mapManager.createInfoBox('navigation-update', 'topright', '<div><i class="bi bi-emoji-sunglasses"></i></div><div><span>Navigation started</span></div>', 5000);
        this.speechManager.speak("Navigation started");
        this.cumulativeDistances = this.computeCumulativeDistances(routePoints);
        this.segmentBearings = this.computeBearings(routePoints);
        this.turns = this.detectTurns(routePoints, this.segmentBearings, this.cumulativeDistances);
        this.mapManager.map.setView(latlng, 16);

        console.log("Turns detected:", this.turns);


        const navigateBtnIcon = document.querySelector("#navigate i");
        if (navigateBtnIcon) {
            navigateBtnIcon.classList.remove("bi-signpost-split");
            navigateBtnIcon.classList.add("bi-signpost-split-fill");
        }

        setTimeout(() => {
            this.updateNavigation();
        }, 5000);
    }

    updateNavigation() {
        if (!this.isNavigating) return;

        // const now = performance.now();
        // if (now - this.lastUpdateTime < this.updateThrottle) return;
        // this.lastUpdateTime = now;
        
        const distanceOffRoute = this.offRouteDetection();
        if (distanceOffRoute > 0) {
            if (!this.offRoute) {
                this.offRoute = true;
                console.log("Off route", `You are ${Math.round(distanceOffRoute)} meters away.`);
                this.mapManager.createInfoBox('navigation-update', 'topright', `<div><i class="bi bi-emoji-frown"></i></div><div><span>Off route, You are ${Math.round(distanceOffRoute)} meters away from the route.</span></div>`, 5000); 
                this.speechManager.speak(`Off route. You are ${Math.round(distanceOffRoute)} meters from the route.`);
            }
            return;
        } else {
            if (this.offRoute) { 
                this.offRoute = false;
                console.log("On route", `You are back on route.`);
                this.mapManager.createInfoBox('navigation-update', 'topright', `<div><i class="bi bi-emoji-sunglasses"></i></div><div><span>You are back on route.</span></div>`, 5000);
                this.speechManager.speak(`You are back on route.`);
            }
        }

        const { index, fraction } = this.mapManager.getClosestPointOnPolyline(this.lastKnownLocation);
        const distanceAlongRoute =
            this.cumulativeDistances[index] +
            fraction * (this.cumulativeDistances[index + 1] - this.cumulativeDistances[index]);
            
        const progress = {
            index,
            fraction,
            distance: distanceAlongRoute
        };

        this.handleTurnLogic(progress);
    }

    computeCumulativeDistances(points) {
        const c = [0];
        for (let i = 1; i < points.length; i++) {
            c[i] = c[i - 1] + this.distance(points[i - 1], points[i]);
        }
        return c;
    }

    getNextTurn(distanceAlongRoute) {
        return this.turns?.find(t => t.distanceFromStart > distanceAlongRoute) || null;
    }

    distance(a, b) {
        const R = 6371000;
        const toRad = d => d * Math.PI / 180;

        const dLat = toRad(b.lat - a.lat);
        const dLon = toRad(b.lng - a.lng);

        const lat1 = toRad(a.lat);
        const lat2 = toRad(b.lat);

        const h = Math.sin(dLat / 2) ** 2 +
                  Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

        return 2 * R * Math.asin(Math.sqrt(h));
    }

    detectShortUTurnIndices(points, bearings, cumulativeDistances) {
        const shortUTurnIndices = new Set();
        const loopClosureTolerance = this.minTurnSpacing;

        for (let i = 1; i < bearings.length; i++) {
            if (Math.abs(this.angleDelta(bearings[i - 1], bearings[i])) < 170) continue;

            let shortestLoop = null;
            for (let startIndex = i - 1;
                startIndex >= 0 && cumulativeDistances[i] - cumulativeDistances[startIndex] <= this.maxShortUTurnDistance;
                startIndex--) {
                for (let endIndex = i + 1;
                    endIndex < points.length &&
                    cumulativeDistances[endIndex] - cumulativeDistances[startIndex] <= this.maxShortUTurnDistance;
                    endIndex++) {
                    const loopDistance = cumulativeDistances[endIndex] - cumulativeDistances[startIndex];
                    if (loopDistance >= (shortestLoop?.loopDistance ?? Infinity)) continue;
                    if (this.distance(points[startIndex], points[endIndex]) <= loopClosureTolerance) {
                        shortestLoop = { startIndex, endIndex, loopDistance };
                    }
                }
            }

            if (shortestLoop) {
                for (let turnIndex = shortestLoop.startIndex; turnIndex <= shortestLoop.endIndex; turnIndex++) {
                    shortUTurnIndices.add(turnIndex);
                }
            }
        }

        return shortUTurnIndices;
    }

    detectTurns(points, bearings, cumulativeDistances) {
        const turns = [];
        const shortUTurnIndices = this.detectShortUTurnIndices(points, bearings, cumulativeDistances);

        // i is the vertex index; we need bearings[i-1] and bearings[i]
        for (let i = 1; i < bearings.length; i++) {
            const angle = this.angleDelta(bearings[i - 1], bearings[i]);
            const type = this.classifyTurn(angle);
            if (!type) continue;

            if (shortUTurnIndices.has(i)) {
                console.log("Skipping turn at route index", i, "because it is part of a short U-turn loop");

                //###DEBUG####
                if(DEBUG) {
                    // Mark the candidate being skipped, not the previously accepted turn.
                    const skippedTurn = points[i];
                    L.circleMarker([skippedTurn.lat, skippedTurn.lng], {
                        color: 'red',
                        radius: 6,
                        fillOpacity: 0.5,
                    }).bindTooltip(`Turn at index ${i} skipped (short U-turn loop)`, {
                        permanent: true,
                        direction: 'top',
                        className: 'removed-turn-tooltip'
                    }).addTo(this.mapManager.map);
                }
                //###END DEBUG####
                continue;
            }

            //dissard turns that are too close to the previous turn to avoid clutter
            if (cumulativeDistances[i] - (turns.at(-1)?.distanceFromStart || 0) < this.minTurnSpacing) {
                if (turns.length > 0) {
                    const previousTurn = turns.at(-1);
                    console.log("Skipping turn at route index", i, "due to proximity to previous turn at route index", previousTurn.index);
                    
                    //###DEBUG####
                    if(DEBUG) {
                    // Mark the candidate being skipped, not the previously accepted turn.
                    const skippedTurn = points[i];
                    L.circleMarker([skippedTurn.lat, skippedTurn.lng], {
                        color: 'red',
                        radius: 6,
                        fillOpacity: 0.5,
                    }).bindTooltip(`Turn skipped`, {permanent: true, direction: 'top', className: 'removed-turn-tooltip'
                    }).addTo(this.mapManager.map);
                    }
                      //###END DEBUG####  

                    continue;
                }
            }

            // if a turn is exactly 180 degrees, its a mistake in the data so warn the user
            if (Math.abs(angle) === 180) {
                console.warn(`Turn at index ${i} is exactly 180 degrees, which is likely an error in the data.`);
                // this.speechManager.speak(`Warning: 180 degree turn detected, check map.`);
            }

            turns.push({
                index: i,
                lat: points[i].lat,
                lng: points[i].lng,
                angle,
                type,
                distanceFromStart: cumulativeDistances[i]
            });
        }

        return turns;
    }

    computeBearings(points) {
        const bearings = [];
        for (let i = 0; i < points.length - 1; i++) {
            bearings.push(this.bearing(points[i], points[i + 1]));
        }
        return bearings;
    }

    bearing(a, b) {
        const toRad = d => d * Math.PI / 180;
        const toDeg = r => r * 180 / Math.PI;

        const lat1 = toRad(a.lat);
        const lat2 = toRad(b.lat);
        const dLon = toRad(b.lng - a.lng);

        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
                  Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

        return (toDeg(Math.atan2(y, x)) + 360) % 360;
    }

    angleDelta(b1, b2) {
        let d = b2 - b1;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        return d;
    }

    classifyTurn(angle) {
        const abs = Math.abs(angle);

        if (abs < 40) return null;
        if (abs < 60) return angle > 0 ? "slight right" : "slight left";
        if (abs < 120) return angle > 0 ? "right" : "left";
        if (abs < 179) return angle > 0 ? "sharp right" : "sharp left";
        return "Warning: 180 degree turn detected, check map";
    }

    handleTurnLogic(progress) {
        const nextTurn = this.getNextTurn(progress.distance);
        console.log("Progress:", progress);
        console.log("Next turn:", nextTurn);
        if (!nextTurn) return;

        const distToTurn = (nextTurn.distanceFromStart - progress.distance);// + (this.lastKnownAccuracy / 2);
        console.log(`Distance to next turn: ${Math.round(distToTurn)} meters`);

        if (nextTurn.index !== this.turnState.lastTurnIndex) {

            this.turnState = {
                early: false,
                near: false,
                now: false,
                lastTurnIndex: nextTurn.index
            };
        }

        const nextTurnIcon = nextTurn.type.replace(" ", "-").replace("slight", "up-").replace("sharp", "down-");

        if (distToTurn < (this.turnDistanceBuffer + this.turnStateEarlyDistance) && !this.turnState.early) {
            this.mapManager.createInfoBox('navigation-update', 'topright', `<div><i class="bi bi-arrow-${nextTurnIcon}-square"></i></div><div><span>In ${Math.round(distToTurn)} meters, ${nextTurn.type}</span></div>`, 5000);
            this.speechManager.speak(`In ${Math.round(distToTurn)} meters, ${nextTurn.type}`);
            this.turnState.early = true;
        }

        if (distToTurn < (this.turnDistanceBuffer + this.turnStateNearDistance) && !this.turnState.near) {
            this.mapManager.createInfoBox('navigation-update', 'topright', `<div><i class="bi bi-arrow-${nextTurnIcon}-square"></i></div><div><span>In ${Math.round(distToTurn)} meters, ${nextTurn.type}</span></div>`, 5000);
            this.speechManager.speak(`In ${Math.round(distToTurn)} meters, ${nextTurn.type}`);
            this.turnState.near = true;
        }

        if (distToTurn < (this.turnDistanceBuffer + this.turnStateNowDistance) && !this.turnState.now) {
            this.mapManager.createInfoBox('navigation-update', 'topright', `<div><i class="bi bi-arrow-${nextTurnIcon}-square"></i></div><div><span>Now ${nextTurn.type}</span></div>`, 5000);
            this.speechManager.speak(`Now ${nextTurn.type}`);
            this.turnState.now = true;
        }
    }

    offRouteDetection() {
        const { distanceMeters } = this.mapManager.getClosestPointOnPolyline(this.lastKnownLocation);
        const threshold = this.trackThreshold + (this.lastKnownAccuracy / 2);

        if (distanceMeters > threshold)
            return distanceMeters;
        else
            return 0;
    }

    toggleFollowUser(e) {
        this.followUser = !this.followUser;
        const icon = e.currentTarget.querySelector("i");
        icon.classList.toggle("bi-crosshair", !this.followUser);
        icon.classList.toggle("bi-crosshair2", this.followUser);
    }

    stopFollowingUser() {
        this.followUser = false;
        const icon = document.querySelector("#follow-user i");
        if (icon) {
            icon.classList.remove("bi-crosshair2");
            icon.classList.add("bi-crosshair");
        }
    }
}
