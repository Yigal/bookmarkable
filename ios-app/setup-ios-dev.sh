#!/bin/bash

# iOS App Setup Script for Bookmarkable
echo "🍎 Bookmarkable iOS App Setup"
echo "============================"

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script requires macOS for iOS development"
    exit 1
fi

echo "✅ Checking iOS development prerequisites..."

# Check for Xcode
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode is not installed. Please install Xcode from the App Store."
    exit 1
else
    echo "✅ Xcode found"
fi

# Create iOS project directory structure
echo "📁 Setting up iOS project structure..."
mkdir -p ios-app/BookmarkableApp/{Models,Services,Views}
mkdir -p ios-app/BookmarkShareExtension
mkdir -p ios-app/BookmarkableAppTests

echo "✅ iOS project structure created"

# Create .gitignore for iOS
cat > ios-app/.gitignore << 'EOF'
# Xcode
xcuserdata/
build/
DerivedData/
*.pbxuser
*.mode1v3
*.mode2v3
*.perspectivev3
*.ipa
*.dSYM.zip
*.dSYM
.build/
fastlane/report.xml
fastlane/Preview.html
fastlane/screenshots/**/*.png
fastlane/test_output
EOF

echo "✅ Created iOS .gitignore"

echo "📱 Next Steps:"
echo "1. Open Xcode and create new iOS project"
echo "2. Add Swift files to your Xcode project"  
echo "3. Configure Share Extension target"
echo "4. See IOS_README.md for detailed instructions"
echo ""
echo "🚀 iOS development environment ready!"