// Comprehensive Diagnostic Script for PTCG Simulator

class DiagnosticLogger {
    static init() {
        // Global error handling
        window.addEventListener('error', (event) => {
            console.error('Global Error:', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                error: event.error
            });
        });

        // Unhandled promise rejection tracking
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled Promise Rejection:', event.reason);
        });

        // Detailed system information
        this.logSystemInfo();
        this.monitorResourceLoading();
        this.trackEventListenerAttachment();
    }

    static logSystemInfo() {
        console.group('System Diagnostic Information');
        console.log('User Agent:', navigator.userAgent);
        console.log('Platform:', navigator.platform);
        console.log('Browser:', navigator.appName);
        console.log('Browser Version:', navigator.appVersion);
        console.log('Language:', navigator.language);
        console.log('Cookies Enabled:', navigator.cookieEnabled);
        console.log('Online Status:', navigator.onLine);
        console.log('Current URL:', window.location.href);
        console.groupEnd();
    }

    static monitorResourceLoading() {
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
            const element = originalCreateElement.call(document, tagName);
            
            if (tagName.toLowerCase() === 'script' || tagName.toLowerCase() === 'link') {
                element.addEventListener('load', () => {
                    console.log(`Resource loaded successfully: ${element.src || element.href}`);
                });
                element.addEventListener('error', (e) => {
                    console.error(`Resource loading failed: ${element.src || element.href}`, e);
                });
            }
            
            return element;
        };
    }

    static trackEventListenerAttachment() {
        const criticalElements = [
            'attackButton', 'passButton', 'messageInput', 
            'undoButton', 'turnButton', 'setupButton'
        ];

        criticalElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const originalAddEventListener = element.addEventListener;
                element.addEventListener = function(type, listener, options) {
                    console.log(`Event listener added to ${id} for ${type}`);
                    return originalAddEventListener.call(this, type, listener, options);
                };
            } else {
                console.warn(`Element with id ${id} not found for event listener tracking`);
            }
        });
    }

    static checkAssetAvailability() {
        const assetsToCheck = [
            '/src/assets/cardback.png',
            '/src/css/index.css',
            '/src/front-end.js'
        ];

        assetsToCheck.forEach(path => {
            fetch(path, { method: 'HEAD' })
                .then(response => {
                    console.log(`Asset availability for ${path}:`, 
                        response.ok ? 'Accessible ✅' : 'Not Accessible ❌'
                    );
                })
                .catch(error => {
                    console.error(`Error checking asset path ${path}:`, error);
                });
        });
    }
}

// Initialize diagnostics
document.addEventListener('DOMContentLoaded', () => {
    DiagnosticLogger.init();
    DiagnosticLogger.checkAssetAvailability();
});

// Optional: Enhanced Socket.IO Connection Logging
if (window.io) {
    const originalIO = window.io;
    window.io = function(...args) {
        console.log('Socket.IO Connection Attempt:', args);
        const socket = originalIO(...args);
        
        socket.on('connect', () => {
            console.log('Socket.IO Connected Successfully');
        });
        
        socket.on('connect_error', (error) => {
            console.error('Socket.IO Connection Error:', error);
        });
        
        return socket;
    };
}