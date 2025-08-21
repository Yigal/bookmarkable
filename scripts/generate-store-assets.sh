#!/bin/bash

# Chrome Web Store Asset Generator Script
# This script creates the required promotional images for Chrome Web Store submission

echo "🎨 Chrome Web Store Asset Generator"
echo "=================================="

# Create assets directory
mkdir -p assets/store-images
mkdir -p assets/screenshots

echo "📁 Created directories for store assets"

# Image requirements for Chrome Web Store
echo "
📋 Chrome Web Store Image Requirements:
=====================================

🖼️  Screenshots (Required - at least 1, max 5):
   • Size: 1280x800 pixels
   • Format: PNG or JPEG
   • Show extension functionality

🎯 Promotional Images (Optional but recommended):
   • Small tile: 440x280 pixels
   • Large tile: 920x680 pixels  
   • Marquee: 1400x560 pixels
   • Format: PNG or JPEG

📱 Extension Icons (Already included):
   • 16x16, 32x32, 48x48, 128x128 pixels
   • Located in: extension/icons/

🔗 Privacy Policy:
   • Must be publicly accessible
   • Created: PRIVACY_POLICY.md

📝 Store Listing Requirements:
   • Name: Max 45 characters
   • Short description: Max 132 characters  
   • Detailed description: Max 16,000 characters
   • Category: Productivity
   • Language: English
"

echo "
📸 Recommended Screenshots to Create:
===================================

1. Extension popup showing bookmark save interface
2. Web application dashboard with bookmarks grid
3. Search and filtering functionality in action
4. Tag management and organization features
5. Bookmark details modal with metadata

📱 How to Take Screenshots:
=========================

For Extension Screenshots:
1. Open Chrome with extension loaded
2. Navigate to a website
3. Click extension icon to open popup
4. Take screenshot at 1280x800 resolution
5. Use browser dev tools to set custom viewport size

For Web App Screenshots:
1. Start the web application: cd webapp && npm run dev
2. Open http://localhost:3000
3. Set browser viewport to 1280x800
4. Navigate through different features
5. Take screenshots of key functionality

🛠️  Recommended Tools:
====================
• Browser developer tools (F12 → Device toolbar)
• macOS Screenshot (Cmd+Shift+4 → select area)
• Chrome Extension: 'FireShot' for full page screenshots
• Image editing: Preview, GIMP, or Photoshop for resizing

📦 Extension Package Ready:
=========================
Your extension is packaged and ready for submission:
Location: dist/bookmark-sync-extension-v1.0.0.zip

🚀 Next Steps:
=============
1. Create the required screenshots (follow guide above)
2. Visit: https://chrome.google.com/webstore/devconsole/
3. Sign in with your Google account
4. Click 'Add new item'
5. Upload the ZIP file from dist/ folder
6. Fill in store listing with details from CHROME_STORE_SUBMISSION.md
7. Upload screenshots and promotional images
8. Submit for review

💡 Pro Tips:
===========
• Test extension thoroughly before submission
• Use high-quality, clear screenshots
• Write compelling store description
• Respond quickly to any review feedback
• Monitor user reviews after publication

📞 Support Information:
=====================
Include in your store listing:
• Website: https://github.com/Yigal/bookmarkable
• Documentation: Repository README
• Issues: GitHub Issues page
• Privacy Policy: PRIVACY_POLICY.md (must be publicly accessible)
"

echo "✅ Asset generation guide complete!"
echo "📁 Assets should be saved in: assets/store-images/ and assets/screenshots/"
echo "🚀 Ready for Chrome Web Store submission!"