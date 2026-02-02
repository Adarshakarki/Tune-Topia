# 🚀 Quick Start Guide

## The Fastest Way to Run Topia Tune

### Step 1: Choose Your Method

#### 🐍 **Method 1: Python (Recommended - Works on all platforms)**

1. Open terminal/command prompt in this folder
2. Run one of these commands:
   ```bash
   # Mac/Linux
   ./start-server.sh
   
   # Windows
   start-server.bat
   
   # Or manually:
   python -m http.server 8000
   ```
3. Open http://localhost:8000 in your browser
4. Done! 🎉

---

#### 💻 **Method 2: VS Code (Easiest for VS Code users)**

1. Install "Live Server" extension in VS Code
2. Right-click `index.html`
3. Click "Open with Live Server"
4. Done! 🎉

---

#### 🌐 **Method 3: Deploy Online (For sharing with others)**

**Netlify (Easiest)**
1. Go to [netlify.com/drop](https://app.netlify.com/drop)
2. Drag all files into the drop zone
3. Get instant HTTPS link
4. Share with anyone! 🎉

**Vercel**
1. Install: `npm i -g vercel`
2. Run: `vercel`
3. Follow prompts
4. Get instant HTTPS link 🎉

---

## Why Can't I Just Open the HTML File?

YouTube requires either:
- 🔒 **HTTPS** (secure connection), OR
- 🏠 **localhost** (local development server)

Opening the file directly uses the `file://` protocol, which YouTube blocks for security reasons.

---

## Troubleshooting

### "Player won't load" or "Black screen"
- ✅ Make sure you're using `http://localhost:8000` (or HTTPS)
- ✅ Check browser console (F12) for errors
- ✅ Try a different browser
- ✅ Disable ad-blockers temporarily

### "Python not found"
- Download from [python.org](https://www.python.org/downloads/)
- Or use VS Code Live Server instead

### "Video can't be embedded"
- Some videos have embedding disabled by the owner
- App will automatically open in YouTube instead

---

## 🎵 Using the App

Once it's running:

1. **Wait** for the loading screen to disappear
2. **Click** any song to start playing
3. **Use the controls**:
   - ▶️ Play/Pause
   - ⏮️ Previous track
   - ⏭️ Next track
   - 🔊 Volume control

---

## 📖 Need More Help?

- **Full README**: See `README.md`
- **HTTPS Issues**: See `HTTPS_TROUBLESHOOTING.md`
- **Browser Console**: Press F12 to see error messages

---

**Enjoy your music! 🎶**
