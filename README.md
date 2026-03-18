# Photolina

Photoshop-like image editor — **black & neon lime** UI. No login, free forever.

## Use in browser

1. Open `index.html` in your browser (double-click or drag into Chrome/Edge),  
   **or** run a local server, e.g.:
   ```bash
   npx serve .
   ```
2. Use the editor; all features work in the browser.

## Desktop app (same as the website)

- **Run without building:**  
  `cd app && npm install && npm start`
- **Build Windows .exe:**  
  `cd app && npm install && npm run build`  
  The portable executable will be in `app/dist/`.

See **app/README.md** for more details.

## Features

- **File:** New, Open image, Save as PNG, Export as JPEG  
- **Edit:** Undo, Redo, Clear layer  
- **Image:** Brightness/Contrast, Hue/Saturation, Invert, Grayscale, Blur, Flip H/V  
- **Layer:** New, Duplicate, Merge down, Delete, visibility toggle  
- **Tools:** Brush, Eraser, Fill, Eyedropper, Rectangle, Ellipse, Line, Text, Select, Crop  
- **Properties:** Brush size, opacity, color, text size  

No account required — everything runs locally.
