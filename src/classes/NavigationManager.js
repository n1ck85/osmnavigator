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
        this.turns = null;
        this.minTurnSpacing = 5; // Minimum distance in meters between consecutive turns to avoid clutter
        this.cumulativeDistances = null;
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
            // setTimeout: 8000,
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

        if (this.isNavigating) {
            this.updateNavigation();
        }
    }

    onLocationError(e) {
        console.error(e.message);
    }

    startNavigation() {
        if (this.isNavigating) {
            this.speechManager.speak("Navigation stopped");
            this.isNavigating = false;

            const navigateBtnIcon = document.querySelector("#navigate i");
            if (navigateBtnIcon) {
                navigateBtnIcon.classList.remove("bi-signpost-split-fill");
                navigateBtnIcon.classList.add("bi-signpost-split");
            }
            return;
        }

        const trkpts = this.gpxManager.trackPoints;
        if (trkpts.length < 1) {
            this.speechManager.speak("Route not found in the GPX file.");
            return;
        }

        this.trackThreshold = this.trackThreshold + (this.lastKnownAccuracy / 2);

        const { latlng, distanceMeters } = this.mapManager.getClosestPointOnPolyline(this.lastKnownLocation);
        if (distanceMeters > this.trackThreshold) {
            this.isNavigating = false;
            console.log("Too far from route", `You are ${Math.round(distanceMeters)} meters from the route.`);
            this.speechManager.speak(`Navigation stopped. You are too far from the route.`);
            return;
        }

        const routePoints = this.mapManager.getCurrentPolyline();
        //console.log("current Polyline:", routePoints);

        this.isNavigating = true;

        this.cumulativeDistances = this.computeCumulativeDistances(routePoints);
        this.segmentBearings = this.computeBearings(routePoints);
        this.turns = this.detectTurns(routePoints, this.segmentBearings, this.cumulativeDistances);

        console.log("Turns detected:", this.turns);

        this.speechManager.speak("Navigation started");

        const navigateBtnIcon = document.querySelector("#navigate i");
        if (navigateBtnIcon) {
            navigateBtnIcon.classList.remove("bi-signpost-split");
            navigateBtnIcon.classList.add("bi-signpost-split-fill");
        }

        this.updateNavigation();
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
                this.speechManager.speak(`Off route. You are ${Math.round(distanceOffRoute)} meters from the route.`);
            }
            return;
        } else {
            if (this.offRoute) { 
                this.offRoute = false;
                console.log("On route", `You are back on route.`);
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

    detectTurns(points, bearings, cumulativeDistances) {
        const turns = [];

        // i is the vertex index; we need bearings[i-1] and bearings[i]
        for (let i = 1; i < bearings.length; i++) {
            const angle = this.angleDelta(bearings[i - 1], bearings[i]);
            const type = this.classifyTurn(angle);
            if (!type) continue;


            if (cumulativeDistances[i] - (turns.at(-1)?.distanceFromStart || 0) < this.minTurnSpacing)
            continue;

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

        if (abs < 35) return null;
        if (abs < 60) return angle > 0 ? "slight right" : "slight left";
        if (abs < 120) return angle > 0 ? "right" : "left";
        if (abs < 170) return angle > 0 ? "sharp right" : "sharp left";
        return "u-turn";
    }

    handleTurnLogic(progress) {
        const nextTurn = this.getNextTurn(progress.distance);
        console.log("Progress:", progress);
        console.log("Next turn:", nextTurn);
        if (!nextTurn) return;

        const distToTurn = (nextTurn.distanceFromStart - progress.distance) + (this.lastKnownAccuracy / 2);
        console.log(`Distance to next turn: ${Math.round(distToTurn)} meters`);

        if (nextTurn.index !== this.turnState.lastTurnIndex) {

            this.turnState = {
                early: false,
                near: false,
                now: false,
                lastTurnIndex: nextTurn.index
            };
        }

        if (distToTurn < 80 && !this.turnState.early) {
            this.speechManager.speak(`In ${Math.round(distToTurn)} meters, ${nextTurn.type}`);
            this.turnState.early = true;
        }

        if (distToTurn < 40 && !this.turnState.near) {
            this.speechManager.speak(`In ${Math.round(distToTurn)} meters, ${nextTurn.type}`);
            this.turnState.near = true;
        }

        if (distToTurn < 10 && !this.turnState.now) {
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
