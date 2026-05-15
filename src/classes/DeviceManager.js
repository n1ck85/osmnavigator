export class DeviceManager {
    constructor() {
        this.wakeLockSentinel = null;
        this.wakeLockActive = false;
        this.rotateMap = false;
        this.getHeading = this.getHeading.bind(this);
        this.heading = 0;
        this.headingUpdateThrottle = 100; // Minimum gap between heading updates in milliseconds
        this.lastHeadingUpdate = 0;
        this.pendingHeadingUpdate = null; // Track pending RAF callback
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

        // throttle to 10Hz (100ms)
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

        // Filter out unrealistic jumps (likely sensor glitches)
        // Allow up to 45 degree change per update (at 100ms throttle = 450°/sec max)
        const headingDiff = Math.abs(normalizedHeading - this.heading);
        const wrappedDiff = Math.min(headingDiff, 360 - headingDiff);
        
        if (wrappedDiff > 45) {
            console.warn(`Heading jump filtered: ${this.heading}° -> ${normalizedHeading}° (diff: ${wrappedDiff}°)`);
            return;
        }

        // Store the pending heading value
        this.pendingHeading = normalizedHeading;

        // Cancel any pending update and schedule a new one
        if (this.pendingHeadingUpdate !== null) {
            cancelAnimationFrame(this.pendingHeadingUpdate);
        }

        // Use requestAnimationFrame to batch updates and prevent queuing
        this.pendingHeadingUpdate = requestAnimationFrame(() => {
            if (this.pendingHeading !== null) {
                this.heading = parseFloat(this.pendingHeading.toFixed(2));
                const marker = document.getElementById("heading-marker");
                
                if(!this.rotateMap) {
                    marker.style.transform = `rotate(${this.heading}deg)`;
                }
                else {
                    this.rotateLeafletMap(this.heading, marker);
                }
            }
            this.pendingHeadingUpdate = null;
        });
    }

    rotateLeafletMap(deg, marker) {
        const map = document.getElementById('map');
        const pane = document.querySelector('.leaflet-map-pane');

        // Initialize to current heading on first rotation
        if (!pane.hasAttribute('data-rotation-initialized')) {
            pane.setAttribute('data-rotation-initialized', 'true');
            deg = this.heading;
        }

        // Use map container center as fixed rotation point (prevents drift from panning)
        const w = map.offsetWidth;
        const h = map.offsetHeight;
        const cx = w / 2;
        const cy = h / 2;

        pane.style.transform =
            `translate3d(${cx}px, ${cy}px, 0)
            rotateZ(${-deg}deg)
            translate3d(${-cx}px, ${-cy}px, 0)`;

        // Marker must rotate the opposite direction to stay aligned with the real world
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
            // Initialize map rotation to current heading
            const marker = document.getElementById("heading-marker");
            this.rotateLeafletMap(this.heading, marker);
        }
        else {
            icon.classList.remove("bi-compass-fill");
            icon.classList.add("bi-compass");
            // Reset map and clear initialization flag
            const pane = document.querySelector('.leaflet-map-pane');
            pane.style.transform = 'translate3d(0, 0, 0)';
            pane.removeAttribute('data-rotation-initialized');
            const marker = document.getElementById("heading-marker");
            if (marker) {
                marker.style.transform = 'rotate(0deg)';
            }
        }
        console.log("Map rotation enabled: "+this.rotateMap);
    }
}