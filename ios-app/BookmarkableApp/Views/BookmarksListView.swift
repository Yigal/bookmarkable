import SwiftUI

struct BookmarksListView: View {
    @EnvironmentObject var bookmarkStore: BookmarkStore
    @EnvironmentObject var syncService: SyncService
    @State private var showingAddBookmark = false
    @State private var selectedBookmark: BookmarkItem?
    @State private var showingFilters = false
    @State private var refreshing = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search and filter bar
                if bookmarkStore.searchText.isEmpty && bookmarkStore.selectedTags.isEmpty {
                    quickStatsView
                }
                
                // Main content
                bookmarksList
            }
            .navigationTitle("Bookmarks")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    syncButton
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack {
                        filterButton
                        addButton
                    }
                }
            }
            .searchable(text: $bookmarkStore.searchText, prompt: "Search bookmarks...")
            .onChange(of: bookmarkStore.searchText) { newValue in
                bookmarkStore.updateSearchText(newValue)
            }
            .refreshable {
                await refreshData()
            }
            .sheet(isPresented: $showingAddBookmark) {
                AddBookmarkView()
            }
            .sheet(item: $selectedBookmark) { bookmark in
                BookmarkDetailView(bookmark: bookmark)
            }
            .sheet(isPresented: $showingFilters) {
                FilterView()
            }
            .alert("Sync Error", isPresented: .constant(syncService.syncStatus.errorMessage != nil)) {
                Button("OK") {
                    syncService.syncStatus = .idle
                }
            } message: {
                if let error = syncService.syncStatus.errorMessage {
                    Text(error)
                }
            }
        }
    }
    
    // MARK: - Subviews
    
    private var quickStatsView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(bookmarkStore.bookmarkCount)")
                    .font(.title2)
                    .fontWeight(.bold)
                Text("Bookmarks")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                Text("\(bookmarkStore.tagCount)")
                    .font(.title2)
                    .fontWeight(.bold)
                Text("Tags")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color(.systemGray6))
    }
    
    private var bookmarksList: some View {
        Group {
            if bookmarkStore.isLoading {
                loadingView
            } else if bookmarkStore.bookmarks.isEmpty {
                emptyStateView
            } else {
                List {
                    // Active filters
                    if !bookmarkStore.selectedTags.isEmpty {
                        activeFiltersView
                    }
                    
                    // Bookmarks
                    ForEach(bookmarkStore.bookmarks) { bookmarkItem in
                        BookmarkRowView(bookmark: bookmarkItem)
                            .onTapGesture {
                                selectedBookmark = bookmarkItem
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button("Delete", role: .destructive) {
                                    Task {
                                        await deleteBookmark(bookmarkItem)
                                    }
                                }
                                
                                Button("Share") {
                                    shareBookmark(bookmarkItem)
                                }
                                .tint(.blue)
                            }
                    }
                }
                .listStyle(PlainListStyle())
            }
        }
    }
    
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.2)
            Text("Loading bookmarks...")
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "bookmark")
                .font(.system(size: 60))
                .foregroundColor(.secondary)
            
            VStack(spacing: 8) {
                Text("No Bookmarks Yet")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Text("Start saving your favorite websites and they'll appear here")
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)
            }
            
            Button(action: { showingAddBookmark = true }) {
                HStack {
                    Image(systemName: "plus")
                    Text("Add Your First Bookmark")
                }
                .font(.headline)
                .foregroundColor(.white)
                .padding()
                .background(Color.accentColor)
                .cornerRadius(12)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var activeFiltersView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Active Filters")
                    .font(.headline)
                Spacer()
                Button("Clear All") {
                    bookmarkStore.clearFilters()
                }
                .font(.caption)
            }
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    ForEach(bookmarkStore.selectedTags, id: \.self) { tag in
                        HStack(spacing: 4) {
                            Text(tag)
                                .font(.caption)
                            Button(action: {
                                bookmarkStore.toggleTag(tag)
                            }) {
                                Image(systemName: "xmark")
                                    .font(.caption2)
                            }
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.accentColor.opacity(0.2))
                        .foregroundColor(.accentColor)
                        .cornerRadius(8)
                    }
                }
                .padding(.horizontal)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .listRowInsets(EdgeInsets())
    }
    
    private var syncButton: some View {
        Button(action: {
            Task {
                await syncService.performSync()
            }
        }) {
            if syncService.syncStatus.isLoading {
                ProgressView()
                    .scaleEffect(0.8)
            } else {
                Image(systemName: "arrow.clockwise")
            }
        }
        .disabled(syncService.syncStatus.isLoading || syncService.networkStatus == .offline)
    }
    
    private var filterButton: some View {
        Button(action: { showingFilters = true }) {
            Image(systemName: "line.3.horizontal.decrease.circle")
                .foregroundColor(bookmarkStore.selectedTags.isEmpty ? .primary : .accentColor)
        }
    }
    
    private var addButton: some View {
        Button(action: { showingAddBookmark = true }) {
            Image(systemName: "plus")
        }
    }
    
    // MARK: - Actions
    
    private func refreshData() async {
        refreshing = true
        await syncService.performSync()
        refreshing = false
    }
    
    private func deleteBookmark(_ bookmark: BookmarkItem) async {
        do {
            await bookmarkStore.deleteBookmark(bookmark)
        } catch {
            // Handle error - could show an alert
            print("Error deleting bookmark: \(error)")
        }
    }
    
    private func shareBookmark(_ bookmark: BookmarkItem) {
        let activityVC = UIActivityViewController(
            activityItems: [bookmark.data.url],
            applicationActivities: nil
        )
        
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            window.rootViewController?.present(activityVC, animated: true)
        }
    }
}

// MARK: - Bookmark Row View
struct BookmarkRowView: View {
    @ObservedObject var bookmark: BookmarkItem
    
    var body: some View {
        HStack(spacing: 12) {
            // Favicon
            AsyncImage(url: URL(string: bookmark.data.favicon ?? "")) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fit)
            } placeholder: {
                Image(systemName: "globe")
                    .foregroundColor(.secondary)
            }
            .frame(width: 20, height: 20)
            
            VStack(alignment: .leading, spacing: 4) {
                // Title
                Text(bookmark.data.title)
                    .font(.headline)
                    .lineLimit(2)
                
                // URL
                Text(bookmark.data.domain)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                
                // Description
                if let description = bookmark.data.description, !description.isEmpty {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                // Tags
                if !bookmark.data.tags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 4) {
                            ForEach(bookmark.data.tags, id: \.id) { tag in
                                Text(tag.name)
                                    .font(.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color(hex: tag.displayColor)?.opacity(0.2) ?? Color.accentColor.opacity(0.2))
                                    .foregroundColor(Color(hex: tag.displayColor) ?? .accentColor)
                                    .cornerRadius(4)
                            }
                        }
                    }
                }
                
                // Metadata
                HStack {
                    Text(bookmark.data.formattedCreatedDate, style: .relative)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    if bookmark.data.visitCount > 0 {
                        Spacer()
                        Text("Visited \(bookmark.data.visitCount) times")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            Spacer()
            
            // Sync indicator
            if bookmark.isSyncing {
                ProgressView()
                    .scaleEffect(0.8)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Filter View
struct FilterView: View {
    @EnvironmentObject var bookmarkStore: BookmarkStore
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            List {
                Section("Tags") {
                    ForEach(bookmarkStore.tags, id: \.id) { tag in
                        HStack {
                            Text(tag.name)
                            Spacer()
                            if bookmarkStore.selectedTags.contains(tag.name) {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.accentColor)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            bookmarkStore.toggleTag(tag.name)
                        }
                    }
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Clear") {
                        bookmarkStore.clearFilters()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Color Extension
extension Color {
    init?(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            return nil
        }
        
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

struct BookmarksListView_Previews: PreviewProvider {
    static var previews: some View {
        BookmarksListView()
            .environmentObject(BookmarkStore())
            .environmentObject(SyncService())
    }
}