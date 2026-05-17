export class DeviceManager {
    constructor() {
        this.wakeLockSentinel = null;
        this.wakeLockActive = false;
        this.rotateMap = false;
        this.getHeading = this.getHeading.bind(this);
        this.heading = 0;
        this.lastRotationAngle = 0; // Tracks the actual rotation angle applied
        this.headingUpdateThrottle = 50; // Minimum gap between heading updates in milliseconds
        this.lastHeadingUpdate = 0;
        this.pendingHeadingUpdate = null; // Track pending animation frame callback
        this.pendingHeading = null; // Store pending heading value
    }

    supportLogger(name,message) {
        const logEl = document.getElementById("device-support-log");
        if (logEl) {
            const entry = document.createElement("div");
            entry.textContent = `${name}: ${message}`;
            //log without duplicates
            if (!logEl.textContent.includes(entry.textContent)) {
                logEl.appendChild(entry);
            }
        }
    }

    savePreference(key, value) {
        if (typeof(Storage) !== "undefined") {
            localStorage.setItem(key, JSON.stringify(value));
        } else {
            alert("Sorry, your browser does not support Web Storage. Preferences cannot be saved.");
        }
    }

    getPreference(key) {
        if (typeof(Storage) !== "undefined") {
            const value = localStorage.getItem(key);
            if (value !== null) {
                return JSON.parse(value);
            }
            return null;
        }
    }


    startOrientationTracking() {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+ Safari requires this call
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        window.addEventListener('deviceorientation', this.getHeading);
                    }
                }).catch(console.error);
        } else if ('ondeviceorientationabsolute' in window) {
            // Non-iOS 13+ or desktop: events fire automatically
            window.addEventListener('deviceorientationabsolute', this.getHeading);
        }
    }

    getHeading(event) {
        const now = performance.now();

        // throttle heading
        if (now - this.lastHeadingUpdate < this.headingUpdateThrottle) return;
        this.lastHeadingUpdate = now;

        if (event.webkitCompassHeading) {
            // iOS gives true compass heading
            this.setHeading(event.webkitCompassHeading);
        } else {
            // Android: use absolute orientation to calculate heading
            if(event.alpha !== null) {
                //this.supportLogger("Magnetic Heading", `Device orientation absolute alpha: ${event.alpha.toFixed(2)}°`);
                this.setHeading((360 - event.alpha) % 360);
            }
            else {
                this.supportLogger("Magnetic Heading", "Device orientation not available");
            }
        }
    }

    setHeading(heading) {
        // Validate heading is a number
        if (typeof heading !== 'number' || isNaN(heading)) {
            console.warn('Invalid heading value:', heading);
            return;
        }

        // Normalize heading to 0-360 range
        const normalizedHeading = ((heading % 360) + 360) % 360;

        // Calculate delta from last rotation angle for shortest path
        let rotationAngle = this.lastRotationAngle;
        let delta = normalizedHeading - (this.lastRotationAngle % 360);
        
        if (delta > 180) {
            delta -= 360;
        } else if (delta < -180) {
            delta += 360;
        }

        // Filter out unrealistic jumps
        if (Math.abs(delta) > 60) {
            console.warn(`Heading jump filtered: ${this.lastRotationAngle}° -> ${normalizedHeading}°`);
            return;
        }

        // Update rotation angle
        rotationAngle += delta;
        this.lastRotationAngle = rotationAngle;
        this.heading = parseFloat(normalizedHeading.toFixed(2));

        // Store the pending rotation value
        this.pendingHeading = rotationAngle;

        // Cancel any pending update and schedule a new one
        if (this.pendingHeadingUpdate !== null) {
            cancelAnimationFrame(this.pendingHeadingUpdate);
        }

        // Use requestAnimationFrame to batch updates
        this.pendingHeadingUpdate = requestAnimationFrame(() => {
            if (this.pendingHeading !== null) {
                const marker = document.getElementById("heading-marker");
                
                if(!this.rotateMap) {
                    marker.style.transform = `rotate(${this.pendingHeading}deg)`;
                }
                else {
                    this.rotateLeafletMap(this.pendingHeading, marker);
                }
            }
            this.pendingHeadingUpdate = null;
        });
    }

    rotateLeafletMap(deg, marker) {
        const map = document.getElementById('map');
        const pane = document.querySelector('.leaflet-map-pane');

        if (!pane || !map) return;

        // Initialize transform-origin to map center on first rotation
        if (!pane.hasAttribute('data-rotation-initialized')) {
            pane.setAttribute('data-rotation-initialized', 'true');
            const centerX = map.offsetWidth / 2;
            const centerY = map.offsetHeight / 2;
            pane.style.transformOrigin = `${centerX}px ${centerY}px`;
        }

        // Apply rotation
        pane.style.transform = `rotateZ(${-deg}deg)`;

        // Marker rotates opposite direction
        if (marker) {
            marker.style.transform = `rotate(${deg}deg)`;
        }

        /** Copy this into the console to test heading with a slider **
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = 0;
        slider.max = 359;
        slider.value = 0;
        slider.style.position = "fixed";
        slider.style.bottom = "20px";
        slider.style.left = "20px";
        slider.style.zIndex = 999999;
        slider.style.width = "300px";

        slider.oninput = () => {
        const deg = Number(slider.value);
        window.dispatchEvent(new DeviceOrientationEvent("deviceorientationabsolute", {
            alpha: deg,
            beta: 0,
            gamma: 0,
            absolute: true
        }));
        };

        document.body.appendChild(slider);
        */
    }

    toggleWakeLock(e) {console.log("Toggling Wake Lock...");
        const icon = e.currentTarget.querySelector("i");

        if ('wakeLock' in navigator) {
            if (!this.wakeLockActive) {
                this.wakeLockActive = true;
                this.keepAwake(icon);
            }
            else {//user has requested to release wake lock
                this.wakeLockActive = false;
                this.wakeLockSentinel.release().then(() => {
                    this.wakeLockActive = false;
                    if (icon) {
                        icon.classList.remove("bi-eye-fill");
                        icon.classList.add("bi-eye");
                    }
                }); 
                console.log("Wake Lock released by user."); 
            }
        } else {
            console.log("Wake Lock", "Wake Lock API not supported on this device.");
        }
    }

    keepAwake(icon) {
        navigator.wakeLock.request('screen').then(sentinel => {
            this.wakeLockSentinel = sentinel;
            if (icon) {
                icon.classList.remove("bi-eye");
                icon.classList.add("bi-eye-fill");
            }
            //ensure wake lock is re-acquired if released unexpectedly by the system
            sentinel.addEventListener('release', () => {
                if( this.wakeLockActive ) {
                    console.log("Wake Lock", "Wake Lock was released unexpectedly. Attempting to re-acquire...");
                    this.keepAwake(icon);
                }
            });
            console.log("Wake Lock is active.");
        }).catch(err => {
            console.error('Wake Lock failed:', err);
            this.supportLogger("Wake Lock", "Failed to activate Wake Lock.");
            icon.classList.remove("bi-eye-fill");
            icon.classList.add("bi-eye");
            alert("Wake Lock Disabled");
            this.wakeLockActive = false;
        });
    }

    rotateMapToggle(e) {
        const icon = e.currentTarget.querySelector("i");
        this.rotateMap = !this.rotateMap;

        if (this.rotateMap) {
            icon.classList.remove("bi-compass");
            icon.classList.add("bi-compass-fill");
            // Initialize map rotation
            const marker = document.getElementById("heading-marker");
            this.rotateLeafletMap(this.lastRotationAngle, marker);
        }
        else {
            icon.classList.remove("bi-compass-fill");
            icon.classList.add("bi-compass");
            // Reset map
            const pane = document.querySelector('.leaflet-map-pane');
            pane.style.transform = 'none';
            pane.removeAttribute('data-rotation-initialized');
            const marker = document.getElementById("heading-marker");
            if (marker) {
                marker.style.transform = 'rotate(0deg)';
            }
        }
        console.log("Map rotation enabled: "+this.rotateMap);
    }
}