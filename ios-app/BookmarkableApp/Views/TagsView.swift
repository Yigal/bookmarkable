import SwiftUI

struct TagsView: View {
    @EnvironmentObject var bookmarkStore: BookmarkStore
    @State private var selectedTag: TagData?
    @State private var showingBookmarksForTag = false
    @State private var searchText = ""
    
    var filteredTags: [TagData] {
        if searchText.isEmpty {
            return bookmarkStore.tags.sorted { ($0.bookmarkCount ?? 0) > ($1.bookmarkCount ?? 0) }
        } else {
            return bookmarkStore.tags
                .filter { $0.name.localizedCaseInsensitiveContains(searchText) }
                .sorted { ($0.bookmarkCount ?? 0) > ($1.bookmarkCount ?? 0) }
        }
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Stats header
                if searchText.isEmpty {
                    tagStatsView
                }
                
                // Tags content
                if filteredTags.isEmpty {
                    emptyStateView
                } else {
                    tagsList
                }
            }
            .navigationTitle("Tags")
            .navigationBarTitleDisplayMode(.large)
            .searchable(text: $searchText, prompt: "Search tags...")
            .sheet(isPresented: $showingBookmarksForTag) {
                if let tag = selectedTag {
                    TagBookmarksView(tag: tag)
                }
            }
        }
    }
    
    // MARK: - Subviews
    
    private var tagStatsView: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(bookmarkStore.tagCount)")
                        .font(.title)
                        .fontWeight(.bold)
                    Text("Total Tags")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(bookmarkStore.bookmarkCount)")
                        .font(.title)
                        .fontWeight(.bold)
                    Text("Bookmarks")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            // Tag cloud preview
            TagCloudView(tags: Array(filteredTags.prefix(15))) { tag in
                selectedTag = tag
                showingBookmarksForTag = true
            }
        }
        .padding()
        .background(Color(.systemGray6))
    }
    
    private var tagsList: some View {
        List(filteredTags, id: \.id) { tag in
            TagRowView(tag: tag)
                .onTapGesture {
                    selectedTag = tag
                    showingBookmarksForTag = true
                }
        }
        .listStyle(PlainListStyle())
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "tag")
                .font(.system(size: 60))
                .foregroundColor(.secondary)
            
            VStack(spacing: 8) {
                Text("No Tags Found")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                if searchText.isEmpty {
                    Text("Tags will appear here as you add them to your bookmarks")
                        .multilineTextAlignment(.center)
                        .foregroundColor(.secondary)
                } else {
                    Text("No tags match your search")
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Tag Row View
struct TagRowView: View {
    let tag: TagData
    
    var body: some View {
        HStack(spacing: 12) {
            // Color indicator
            Circle()
                .fill(Color(hex: tag.displayColor) ?? .accentColor)
                .frame(width: 16, height: 16)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(tag.name)
                    .font(.headline)
                
                Text("\(tag.bookmarkCount ?? 0) bookmark\(tag.bookmarkCount == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Tag Cloud View
struct TagCloudView: View {
    let tags: [TagData]
    let onTagTapped: (TagData) -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Popular Tags")
                    .font(.headline)
                Spacer()
            }
            
            LazyVGrid(columns: [
                GridItem(.adaptive(minimum: 60), spacing: 8)
            ], spacing: 8) {
                ForEach(tags, id: \.id) { tag in
                    Button(action: {
                        onTagTapped(tag)
                    }) {
                        VStack(spacing: 4) {
                            Text(tag.name)
                                .font(.caption)
                                .fontWeight(.medium)
                                .lineLimit(1)
                            
                            Text("\(tag.bookmarkCount ?? 0)")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color(hex: tag.displayColor)?.opacity(0.2) ?? Color.accentColor.opacity(0.2))
                        .foregroundColor(Color(hex: tag.displayColor) ?? .accentColor)
                        .cornerRadius(12)
                    }
                }
            }
        }
    }
}

// MARK: - Tag Bookmarks View
struct TagBookmarksView: View {
    let tag: TagData
    @EnvironmentObject var bookmarkStore: BookmarkStore
    @Environment(\.dismiss) private var dismiss
    @State private var selectedBookmark: BookmarkItem?
    
    var tagBookmarks: [BookmarkItem] {
        return bookmarkStore.bookmarks.filter { bookmark in
            bookmark.data.tagNames.contains(tag.name)
        }
    }
    
    var body: some View {
        NavigationView {
            Group {
                if tagBookmarks.isEmpty {
                    emptyStateView
                } else {
                    List(tagBookmarks) { bookmark in
                        BookmarkRowView(bookmark: bookmark)
                            .onTapGesture {
                                selectedBookmark = bookmark
                            }
                    }
                    .listStyle(PlainListStyle())
                }
            }
            .navigationTitle(tag.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button(action: {
                            // Filter main view by this tag
                            dismiss()
                            bookmarkStore.selectedTags = [tag.name]
                        }) {
                            Label("Filter by Tag", systemImage: "line.3.horizontal.decrease")
                        }
                        
                        Button(action: {
                            shareTag()
                        }) {
                            Label("Share Tag", systemImage: "square.and.arrow.up")
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                    }
                }
            }
            .sheet(item: $selectedBookmark) { bookmark in
                BookmarkDetailView(bookmark: bookmark)
            }
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "bookmark")
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            
            Text("No Bookmarks")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("No bookmarks found with the tag '\(tag.name)'")
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
        }
        .padding()
    }
    
    private func shareTag() {
        let text = "Check out these bookmarks tagged with '\(tag.name)'"
        let urls = tagBookmarks.map { $0.data.url }.joined(separator: "\n")
        let shareText = "\(text)\n\n\(urls)"
        
        let activityVC = UIActivityViewController(
            activityItems: [shareText],
            applicationActivities: nil
        )
        
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            window.rootViewController?.present(activityVC, animated: true)
        }
    }
}

// MARK: - Settings View
struct SettingsView: View {
    @EnvironmentObject var syncService: SyncService
    @State private var showingServerSettings = false
    @State private var showingAbout = false
    @State private var showingExport = false
    
    var body: some View {
        NavigationView {
            List {
                // Sync section
                Section {
                    // Sync status
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Sync Status")
                                .font(.headline)
                            Text(syncService.syncStatusText)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                        
                        if syncService.syncStatus.isLoading {
                            ProgressView()
                                .scaleEffect(0.8)
                        } else {
                            Button("Sync Now") {
                                Task {
                                    await syncService.performSync()
                                }
                            }
                            .disabled(!syncService.canSync)
                        }
                    }
                    
                    // Auto sync toggle
                    Toggle("Auto Sync", isOn: Binding(
                        get: { syncService.isAutoSyncEnabled },
                        set: { enabled in
                            if enabled {
                                syncService.enableAutoSync()
                            } else {
                                syncService.disableAutoSync()
                            }
                        }
                    ))
                    
                    // Network status
                    HStack {
                        Text("Network")
                        Spacer()
                        Text(syncService.networkStatusText)
                            .foregroundColor(.secondary)
                    }
                    
                    // Pending changes
                    if syncService.pendingChanges > 0 {
                        HStack {
                            Text("Pending Changes")
                            Spacer()
                            Text("\(syncService.pendingChanges)")
                                .foregroundColor(.orange)
                        }
                    }
                } header: {
                    Text("Synchronization")
                }
                
                // Server section
                Section {
                    Button(action: {
                        showingServerSettings = true
                    }) {
                        HStack {
                            Text("Server Settings")
                            Spacer()
                            Text(syncService.apiService.currentServerURL)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .foregroundColor(.primary)
                } header: {
                    Text("Configuration")
                }
                
                // Data section
                Section {
                    Button(action: {
                        showingExport = true
                    }) {
                        Label("Export Bookmarks", systemImage: "square.and.arrow.up")
                    }
                    
                    Button(action: {
                        Task {
                            await syncService.forceSyncFromServer()
                        }
                    }) {
                        Label("Refresh from Server", systemImage: "arrow.clockwise")
                    }
                    .disabled(!syncService.canSync)
                } header: {
                    Text("Data Management")
                }
                
                // App section
                Section {
                    Button(action: {
                        showingAbout = true
                    }) {
                        Label("About", systemImage: "info.circle")
                    }
                    
                    if let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String {
                        HStack {
                            Text("Version")
                            Spacer()
                            Text(appVersion)
                                .foregroundColor(.secondary)
                        }
                    }
                } header: {
                    Text("App Information")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
            .sheet(isPresented: $showingServerSettings) {
                ServerSettingsView()
            }
            .sheet(isPresented: $showingAbout) {
                AboutView()
            }
            .sheet(isPresented: $showingExport) {
                ExportView()
            }
        }
    }
}

// MARK: - Server Settings View
struct ServerSettingsView: View {
    @EnvironmentObject var syncService: SyncService
    @Environment(\.dismiss) private var dismiss
    @State private var serverURL = ""
    @State private var isTestingConnection = false
    @State private var connectionTestResult: Bool?
    
    var body: some View {
        NavigationView {
            Form {
                Section {
                    TextField("Server URL", text: $serverURL)
                        .keyboardType(.URL)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                } header: {
                    Text("Server Configuration")
                } footer: {
                    Text("Enter the URL of your bookmark server (e.g., http://localhost:3000)")
                }
                
                Section {
                    Button(action: testConnection) {
                        HStack {
                            if isTestingConnection {
                                ProgressView()
                                    .scaleEffect(0.8)
                                Text("Testing...")
                            } else {
                                Text("Test Connection")
                            }
                        }
                    }
                    .disabled(serverURL.isEmpty || isTestingConnection)
                    
                    if let result = connectionTestResult {
                        HStack {
                            Image(systemName: result ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .foregroundColor(result ? .green : .red)
                            Text(result ? "Connection successful" : "Connection failed")
                                .foregroundColor(result ? .green : .red)
                        }
                    }
                } header: {
                    Text("Connection Test")
                }
            }
            .navigationTitle("Server Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveSettings()
                    }
                    .disabled(serverURL.isEmpty)
                }
            }
            .onAppear {
                serverURL = syncService.apiService.currentServerURL
            }
        }
    }
    
    private func testConnection() {
        isTestingConnection = true
        connectionTestResult = nil
        
        Task {
            // Temporarily update API configuration
            let originalURL = syncService.apiService.currentServerURL
            syncService.apiService.updateServerURL(serverURL)
            
            let success = await syncService.checkServerHealth()
            
            await MainActor.run {
                connectionTestResult = success
                isTestingConnection = false
                
                // Restore original URL if test failed
                if !success {
                    syncService.apiService.updateServerURL(originalURL)
                }
            }
        }
    }
    
    private func saveSettings() {
        syncService.apiService.updateServerURL(serverURL)
        dismiss()
    }
}

// MARK: - About View
struct AboutView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // App icon and info
                    VStack(spacing: 16) {
                        Image(systemName: "bookmark.fill")
                            .font(.system(size: 80))
                            .foregroundColor(.accentColor)
                        
                        VStack(spacing: 8) {
                            Text("Bookmarkable")
                                .font(.title)
                                .fontWeight(.bold)
                            
                            if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String {
                                Text("Version \(version)")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    
                    // Description
                    VStack(alignment: .leading, spacing: 16) {
                        Text("About Bookmarkable")
                            .font(.headline)
                        
                        Text("Bookmarkable is a smart bookmark manager that helps you save, organize, and sync your favorite websites across all your devices. With intelligent tagging, full-text search, and offline support, managing your bookmarks has never been easier.")
                            .foregroundColor(.secondary)
                    }
                    
                    // Features
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Features")
                            .font(.headline)
                        
                        VStack(alignment: .leading, spacing: 12) {
                            FeatureRow(icon: "bookmark.fill", title: "Smart Bookmarking", description: "Save any webpage with intelligent metadata extraction")
                            FeatureRow(icon: "tag.fill", title: "Tagging System", description: "Organize bookmarks with custom tags")
                            FeatureRow(icon: "magnifyingglass", title: "Full-Text Search", description: "Find bookmarks quickly across titles, URLs, and descriptions")
                            FeatureRow(icon: "arrow.clockwise", title: "Sync & Backup", description: "Sync across devices with your own server")
                            FeatureRow(icon: "wifi.slash", title: "Offline Support", description: "Save bookmarks even when offline")
                        }
                    }
                    
                    // Links
                    VStack(spacing: 12) {
                        Link(destination: URL(string: "https://github.com/Yigal/bookmarkable")!) {
                            HStack {
                                Image(systemName: "link")
                                Text("GitHub Repository")
                            }
                            .foregroundColor(.accentColor)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("About")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.accentColor)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - Export View
struct ExportView: View {
    @EnvironmentObject var bookmarkStore: BookmarkStore
    @Environment(\.dismiss) private var dismiss
    @State private var isExporting = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 60))
                    .foregroundColor(.accentColor)
                
                VStack(spacing: 12) {
                    Text("Export Bookmarks")
                        .font(.title2)
                        .fontWeight(.semibold)
                    
                    Text("Export all your bookmarks to a JSON file that you can save or share.")
                        .multilineTextAlignment(.center)
                        .foregroundColor(.secondary)
                }
                
                VStack(spacing: 16) {
                    Text("Export includes:")
                        .font(.headline)
                    
                    VStack(alignment: .leading, spacing: 8) {
                        ExportItemRow(text: "\(bookmarkStore.bookmarkCount) bookmarks")
                        ExportItemRow(text: "All tags and descriptions")
                        ExportItemRow(text: "Creation dates and metadata")
                        ExportItemRow(text: "JSON format for easy import")
                    }
                }
                
                Spacer()
                
                Button(action: exportBookmarks) {
                    HStack {
                        if isExporting {
                            ProgressView()
                                .scaleEffect(0.8)
                            Text("Exporting...")
                        } else {
                            Image(systemName: "square.and.arrow.up")
                            Text("Export Bookmarks")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.accentColor)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .disabled(isExporting || bookmarkStore.bookmarks.isEmpty)
            }
            .padding()
            .navigationTitle("Export")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private func exportBookmarks() {
        isExporting = true
        
        Task {
            let exportData = createExportData()
            
            do {
                let jsonData = try JSONEncoder().encode(exportData)
                let tempURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent("bookmarks-export-\(Date().formatted(date: .abbreviated, time: .omitted)).json")
                
                try jsonData.write(to: tempURL)
                
                await MainActor.run {
                    presentShareSheet(url: tempURL)
                    isExporting = false
                }
            } catch {
                await MainActor.run {
                    print("Export error: \(error)")
                    isExporting = false
                }
            }
        }
    }
    
    private func createExportData() -> ExportData {
        return ExportData(
            exportDate: Date().ISO8601String(),
            bookmarks: bookmarkStore.bookmarks.map { $0.data }
        )
    }
    
    private func presentShareSheet(url: URL) {
        let activityVC = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            window.rootViewController?.present(activityVC, animated: true)
        }
    }
}

struct ExportItemRow: View {
    let text: String
    
    var body: some View {
        HStack {
            Image(systemName: "checkmark")
                .foregroundColor(.green)
                .font(.caption)
            Text(text)
                .font(.subheadline)
            Spacer()
        }
    }
}

struct ExportData: Codable {
    let exportDate: String
    let bookmarks: [BookmarkData]
}

struct TagsView_Previews: PreviewProvider {
    static var previews: some View {
        TagsView()
            .environmentObject(BookmarkStore())
    }
}