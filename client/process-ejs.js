const fs = require('fs');
const ejs = require('ejs');
const path = require('path');

try {
  // Read the EJS file
  const template = fs.readFileSync('index.ejs', 'utf8');

  // Render it with empty data
  const html = ejs.render(template, {
    importDataJSON: null,
  });

  // Write to dist/index.html
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/index.html', html);

  // Copy other assets
  fs.cpSync('src', 'dist/src', { recursive: true });

  console.log('Successfully processed EJS template and copied assets');
} catch (error) {
  console.error('Error processing EJS template:', error);
  process.exit(1);
}
