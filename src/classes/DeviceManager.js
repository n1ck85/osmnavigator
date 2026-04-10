export class DeviceManager {
    constructor() {
        this.wakeLockSentinel = null;
        this.wakeLockActive = false;
        this.getHeading = this.getHeading.bind(this);
        this.heading = 0;
        this.lastHeadingUpdate = 0;
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
        this.lastHeadingUpdate = performance.now();
        if (performance.now() - this.lastHeadingUpdate < 100) return; // throttle to 10Hz
        this.lastHeadingUpdate = performance.now();

        if (event.webkitCompassHeading) {
            // iOS gives true compass heading
            this.setHeading(event.webkitCompassHeading);
        } else {
            // Android: use absolute orientation to calculate heading
            if(event.alpha !== null) {
                this.supportLogger("Magnetic Heading", `Device orientation absolute alpha: ${e.alpha.toFixed(2)}°`);
                this.setHeading((360 - event.alpha) % 360);
            }
            else {
                this.supportLogger("Magnetic Heading", "Device orientation not available");
            }
        }
    }

    setHeading(heading) {
        this.heading = heading;
        const el = document.getElementById("heading-marker");

        if (el) {
            el.style.transform = `rotate(${heading}deg)`;
        }
    }

    toggleWakeLock(e) {
        if ('wakeLock' in navigator && !this.wakeLockActive) {
            navigator.wakeLock.request('screen').then(sentinel => {
                this.wakeLockSentinel = sentinel;
                e.target.parentElement.innerHTML = "<i class='bi bi-eye-slash'></i>";
                this.wakeLockActive = true;
            }).catch(err => {
                console.error('Wake Lock failed:', err);
                this.supportLogger("Wake Lock", "Failed to activate Wake Lock.");
            });
        } else if (this.wakeLockActive && this.wakeLockSentinel) {
            this.wakeLockSentinel.release().then(() => {
                e.target.parentElement.innerHTML = "<i class='bi bi-eye'></i>";
                this.wakeLockActive = false;
            });
        } else {
            this.supportLogger("Wake Lock", "Wake Lock API not supported in this browser.");
        }
    }
}