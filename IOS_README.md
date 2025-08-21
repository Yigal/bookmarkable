# Bookmarkable iOS App

A native iOS application for managing and syncing bookmarks with your Bookmarkable server. Built with SwiftUI and modern iOS development practices.

## 📱 Features

### Core Functionality
- **Smart Bookmark Management**: Save, organize, and search bookmarks with intelligent metadata extraction
- **Offline Support**: Full offline functionality with automatic sync when online
- **Safari Integration**: Share Extension allows saving bookmarks directly from Safari
- **Tag System**: Organize bookmarks with custom tags and colors
- **Full-Text Search**: Search across titles, URLs, descriptions, and tags
- **Cross-Device Sync**: Sync with your existing Bookmarkable server

### iOS-Specific Features
- **Native SwiftUI Interface**: Modern, responsive design following iOS Human Interface Guidelines
- **Core Data Integration**: Local storage with CloudKit sync capability
- **Share Extension**: Save bookmarks from Safari and other apps
- **Background Sync**: Automatic synchronization in the background
- **Adaptive UI**: Optimized for both iPhone and iPad
- **Dark Mode Support**: Full support for iOS Dark Mode

## 🏗️ Architecture

### Technology Stack
- **Framework**: SwiftUI + Combine
- **Language**: Swift 5.0+
- **Local Storage**: Core Data with CloudKit
- **Networking**: URLSession with async/await
- **Minimum iOS Version**: iOS 15.0+

### Project Structure
```
BookmarkableApp/
├── BookmarkableApp.swift          # Main app entry point
├── ContentView.swift              # Main tab view
├── Models/
│   └── BookmarkModels.swift       # Data models and API types
├── Services/
│   ├── APIService.swift           # Network layer
│   ├── PersistenceController.swift # Core Data management
│   ├── BookmarkStore.swift        # State management
│   └── SyncService.swift          # Sync coordination
├── Views/
│   ├── BookmarksListView.swift    # Main bookmarks list
│   ├── BookmarkDetailView.swift   # Bookmark details and editing
│   ├── AddBookmarkView.swift      # Add new bookmark
│   ├── SearchView.swift           # Search and filtering
│   └── TagsView.swift             # Tag management
├── BookmarkModel.xcdatamodeld/    # Core Data model
└── Info.plist                    # App configuration

BookmarkShareExtension/
├── ShareViewController.swift      # Share extension logic
└── Info.plist                   # Extension configuration
```

## 🚀 Setup Instructions

### Prerequisites
- Xcode 14.0+ 
- iOS 15.0+ target device or simulator
- Active Bookmarkable server (see main project README)
- Apple Developer Account (for device testing and App Store)

### 1. Xcode Project Creation

1. **Create New Project**:
   ```bash
   # Open Xcode and create new project
   # Choose "iOS" → "App"
   # Product Name: BookmarkableApp
   # Interface: SwiftUI
   # Language: Swift
   # Use Core Data: Yes
   # Include Tests: Yes
   ```

2. **Project Settings**:
   - Bundle Identifier: `com.yourcompany.bookmarkable`
   - Deployment Target: iOS 15.0
   - Supported Devices: iPhone & iPad

3. **Add Files to Project**:
   ```bash
   # Copy all Swift files from ios-app/BookmarkableApp/ to your Xcode project
   # Add files to appropriate groups (Models, Services, Views)
   # Replace the default Core Data model with BookmarkModel.xcdatamodeld
   ```

### 2. Share Extension Setup

1. **Add Share Extension Target**:
   ```bash
   # In Xcode: File → New → Target
   # Choose "Share Extension"
   # Product Name: BookmarkShareExtension
   # Embed in Application: BookmarkableApp
   ```

2. **Configure Extension**:
   - Replace default files with provided ShareViewController.swift
   - Update Info.plist with provided configuration
   - Set Bundle Identifier: `com.yourcompany.bookmarkable.share`

### 3. App Groups Configuration

1. **Enable App Groups**:
   ```bash
   # In Xcode project settings → Capabilities
   # Enable "App Groups" for both targets
   # Add group: group.bookmarkable.shared
   ```

2. **Update Code**:
   ```swift
   // Ensure shared container identifier matches in both targets
   let containerURL = FileManager.default.containerURL(
       forSecurityApplicationGroupIdentifier: "group.bookmarkable.shared"
   )
   ```

### 4. Dependencies and Permissions

1. **Required Frameworks**:
   - SwiftUI
   - Combine
   - CoreData
   - CloudKit (optional)
   - SafariServices
   - Network

2. **Info.plist Permissions**:
   ```xml
   <key>NSAppTransportSecurity</key>
   <dict>
       <key>NSAllowsArbitraryLoads</key>
       <true/>
       <key>NSExceptionDomains</key>
       <dict>
           <key>localhost</key>
           <dict>
               <key>NSExceptionAllowsInsecureHTTPLoads</key>
               <true/>
           </dict>
       </dict>
   </dict>
   <key>NSInternetUsage</key>
   <string>This app needs internet access to sync bookmarks with your server.</string>
   ```

### 5. Build and Run

1. **Configure Server URL**:
   ```swift
   // In first run, app will prompt for server URL
   // Default: http://localhost:3000
   // Change in Settings → Server Settings
   ```

2. **Test on Device**:
   ```bash
   # Connect iOS device
   # Select device as run destination
   # Build and run (⌘R)
   ```

## ⚙️ Configuration

### Server Connection
- **Development**: Default to `http://localhost:3000`
- **Production**: Configure your server URL in Settings
- **Network Requirements**: HTTP/HTTPS access to your server

### Sync Settings
- **Auto Sync**: Enabled by default (every 5 minutes)
- **Background Sync**: Automatic when app enters background
- **Offline Mode**: Full functionality with local storage
- **Conflict Resolution**: Server data takes precedence

### Data Storage
- **Local**: Core Data SQLite database
- **Sync**: RESTful API with your Node.js server
- **Backup**: Export/Import via JSON files
- **Privacy**: All data stored locally or on your server

## 📱 Usage Guide

### Adding Bookmarks

1. **From App**:
   - Tap "+" button on main screen
   - Enter URL, title, description, and tags
   - Save bookmark

2. **From Safari**:
   - On any webpage, tap Share button
   - Select "Save to Bookmarkable"
   - Edit details and save

3. **From Other Apps**:
   - Share URLs from any app
   - Use "Save to Bookmarkable" option

### Managing Bookmarks

1. **Viewing**:
   - Browse all bookmarks on main tab
   - Tap bookmark to view details
   - Swipe for quick actions (delete, share)

2. **Searching**:
   - Use search tab for advanced filtering
   - Search by title, URL, description, or tags
   - Filter by specific tags

3. **Organizing**:
   - Add custom tags to bookmarks
   - Browse by tag in Tags tab
   - View tag statistics and usage

### Sync Management

1. **Manual Sync**:
   - Pull to refresh on main screen
   - Tap sync button in toolbar
   - Use "Sync Now" in Settings

2. **Auto Sync**:
   - Configure in Settings
   - Background sync when available
   - Network status monitoring

## 🧪 Testing

### Unit Tests
```bash
# Run unit tests in Xcode
⌘U

# Test files included:
# - BookmarkModelTests.swift
# - APIServiceTests.swift
# - SyncServiceTests.swift
```

### UI Tests
```bash
# Run UI tests
⌘U (select UI test scheme)

# Test scenarios:
# - Adding bookmarks
# - Search functionality
# - Tag management
# - Share extension
```

### Manual Testing Checklist
- [ ] Add bookmark manually
- [ ] Save bookmark from Safari
- [ ] Search and filter bookmarks
- [ ] Edit bookmark details
- [ ] Sync with server
- [ ] Offline functionality
- [ ] Share extension works
- [ ] Settings configuration

## 📦 App Store Preparation

### App Store Connect Setup

1. **Create App Record**:
   - App Name: Bookmarkable
   - Bundle ID: com.yourcompany.bookmarkable
   - SKU: bookmarkable-ios
   - Category: Productivity

2. **App Information**:
   - **Description**: "Smart bookmark manager with sync capabilities"
   - **Keywords**: bookmark, organize, sync, tags, search
   - **Support URL**: Your GitHub repository
   - **Privacy Policy URL**: Link to privacy policy

3. **Screenshots Required**:
   - iPhone (6.5", 5.5")
   - iPad (12.9", 11")
   - iPad (10.5", 9.7")

### Build Preparation

1. **Archive Build**:
   ```bash
   # In Xcode: Product → Archive
   # Ensure Release configuration
   # Upload to App Store Connect
   ```

2. **Required Assets**:
   - App Icon (all sizes)
   - Launch Screen
   - Screenshots (all devices)
   - App Preview videos (optional)

3. **Metadata**:
   - App description and keywords
   - Age rating and content descriptions
   - Privacy policy and support information

### Privacy and Compliance

1. **Data Collection**:
   - No data collected by Apple
   - All data stored locally or on user's server
   - No third-party analytics or tracking

2. **Export Compliance**:
   - Uses standard encryption
   - No custom encryption algorithms
   - ITSAppUsesNonExemptEncryption: false

## 🔧 Troubleshooting

### Common Issues

1. **Build Errors**:
   ```bash
   # Clean build folder: ⌘⇧K
   # Delete derived data: ~/Library/Developer/Xcode/DerivedData
   # Restart Xcode
   ```

2. **Core Data Issues**:
   ```bash
   # Reset simulator: Device → Erase All Content and Settings
   # Clear app data on device: Settings → General → iPhone Storage
   ```

3. **Network Issues**:
   ```bash
   # Check server URL in Settings
   # Verify server is running
   # Check network permissions in Info.plist
   ```

4. **Share Extension Not Appearing**:
   ```bash
   # Rebuild and reinstall app
   # Check extension target bundle ID
   # Verify App Groups configuration
   ```

### Debug Mode

1. **Enable Logging**:
   ```swift
   // In debug builds, verbose logging is enabled
   // Check Xcode console for detailed logs
   ```

2. **Network Debugging**:
   ```swift
   // API calls logged in debug mode
   // Check request/response in console
   ```

## 🤝 Contributing

### Development Workflow

1. **Setup Development Environment**:
   ```bash
   git clone https://github.com/Yigal/bookmarkable.git
   cd bookmarkable/ios-app
   open BookmarkableApp.xcodeproj
   ```

2. **Code Style**:
   - Follow Swift API Design Guidelines
   - Use SwiftLint for code formatting
   - Write comprehensive tests

3. **Pull Request Process**:
   - Create feature branch
   - Add tests for new functionality
   - Update documentation
   - Submit pull request

### Architecture Decisions

1. **SwiftUI + Combine**: Modern reactive UI framework
2. **Core Data**: Mature local storage with sync capabilities  
3. **Async/Await**: Modern concurrency for network operations
4. **MVVM Pattern**: Clear separation of concerns
5. **Repository Pattern**: Abstracted data access layer

## 📄 License

This project is licensed under the MIT License - see the main project LICENSE file for details.

## 🆘 Support

- **Documentation**: [GitHub Repository](https://github.com/Yigal/bookmarkable)
- **Issues**: [GitHub Issues](https://github.com/Yigal/bookmarkable/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Yigal/bookmarkable/discussions)

---

## 📋 Development Checklist

### Pre-Release
- [ ] All unit tests passing
- [ ] UI tests covering main workflows
- [ ] Performance testing completed
- [ ] Memory leak testing
- [ ] Network error handling tested
- [ ] Offline functionality verified
- [ ] Share extension tested
- [ ] App Store guidelines compliance

### App Store Submission
- [ ] App Store Connect configured
- [ ] Screenshots and metadata ready
- [ ] Privacy policy accessible
- [ ] Export compliance completed
- [ ] TestFlight beta testing
- [ ] Final review and submission

### Post-Release
- [ ] Monitor crash reports
- [ ] Track user feedback
- [ ] Plan feature updates
- [ ] Maintain server compatibility