const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting build process...');

// Create necessary directories
const dirs = ['src', 'assets', 'css'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
});

try {
  // Copy files using rsync, excluding node_modules and other unwanted directories
  console.log('Copying files from client directory...');
  execSync(
    'rsync -av --exclude="node_modules" --exclude=".git" --exclude=".github" client/ ./',
    { stdio: 'inherit' }
  );
  
  // Ensure the index.html has the WebSocket blocker script at the top
  console.log('Checking index.html for WebSocket blocker...');
  const indexPath = path.join(__dirname, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Check if the blocker script is already there
    if (!indexContent.includes('Block connections to Render.com servers')) {
      console.log('Adding WebSocket/XHR blocker to index.html...');
      
      // WebSocket blocker script
      const blockerScript = `<script>
  // Block connections to Render.com servers
  (function() {
    // Store original XMLHttpRequest
    var originalXHR = window.XMLHttpRequest;
    
    // Override XMLHttpRequest to block requests to render.com
    window.XMLHttpRequest = function() {
      var xhr = new originalXHR();
      var originalOpen = xhr.open;
      
      xhr.open = function(method, url, async, user, password) {
        // Block requests to render.com
        if (url && typeof url === 'string' && url.includes('onrender.com')) {
          console.warn('[BLOCKED] Request to:', url);
          // Create a fake successful response
          Object.defineProperty(this, 'readyState', { value: 4, writable: false });
          Object.defineProperty(this, 'status', { value: 200, writable: false });
          Object.defineProperty(this, 'responseText', { value: '{}', writable: false });
          
          // Schedule fake load event
          setTimeout(() => {
            if (this.onload) this.onload();
            if (this.onreadystatechange) this.onreadystatechange();
          }, 0);
          
          return;
        }
        
        // Allow all other requests
        return originalOpen.apply(this, arguments);
      };
      
      return xhr;
    };
    
    // Mock Socket.IO before it loads
    window.io = function() {
      console.warn('[BLOCKED] Socket.IO connection attempt');
      return {
        on: function(event, callback) {
          console.log('Mock Socket.IO event registered:', event);
          // Store event handlers to transfer to real WebSocket later
          if (!window._socketEvents) window._socketEvents = [];
          window._socketEvents.push({event, callback});
        },
        emit: function() {},
        connect: function() {},
        disconnect: function() {}
      };
    };
  })();
</script>`;
      
      // Insert the blocker script after the opening <head> tag
      indexContent = indexContent.replace('<head>', '<head>\n' + blockerScript);
      
      // Write the modified content back
      fs.writeFileSync(indexPath, indexContent, 'utf8');
    }
  }
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}