export class DeviceManager {
    constructor() {
        this.wakeLockSentinel = null;
        this.wakeLockActive = false;
    }

    startOrientationTracking() {
        if (!this.checkDeviceOrientationSupport()) {
            // return; DEBUG: Allow orientation tracking to be attempted even if permission is denied, for testing purposes
        }  

        window.addEventListener("deviceorientation", (event) => {
            let heading;

            if (event.webkitCompassHeading) {
                // iOS gives true compass heading
                heading = event.webkitCompassHeading;
            } else {
                // Android: alpha is relative to device orientation
                 heading = event.alpha;
            }

            const el = document.getElementById("heading-marker");
            if (el) {
                el.style.transform = `rotate(${heading}deg)`;
            }
        });
    }

    checkDeviceOrientationSupport() {
        if (typeof DeviceOrientationEvent === 'undefined' || typeof DeviceOrientationEvent.requestPermission === 'undefined') {
            alert("Device Orientation API not supported on this device.");
            return false;
        }   
        DeviceOrientationEvent.requestPermission().then(permissionState => {
            if (permissionState === 'granted') {
                console.log("Device orientation permission granted.");  
            } else {
                alert("Permission to access device orientation denied.");
            }
        })
        .catch(err => {
            console.error("Error requesting device orientation permission:", err);
            alert("Error requesting device orientation permission.");
        });
        return true;
    }

    toggleWakeLock(e) {
        if ('wakeLock' in navigator && !this.wakeLockActive) {
            navigator.wakeLock.request('screen').then(sentinel => {
                this.wakeLockSentinel = sentinel;
                e.target.innerHTML = "Disable Keep Awake";
                this.wakeLockActive = true;
            }).catch(err => {
                console.error('Wake Lock failed:', err);
                alert("Failed to activate Wake Lock.");
            });
        } else if (this.wakeLockActive && this.wakeLockSentinel) {
            this.wakeLockSentinel.release().then(() => {
                e.target.innerHTML = "Keep Awake";
                this.wakeLockActive = false;
            });
        } else {
            alert("Wake Lock API not supported in this browser.");
        }
    }
}