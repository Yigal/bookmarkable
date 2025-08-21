import SwiftUI

struct SearchView: View {
    @EnvironmentObject var bookmarkStore: BookmarkStore
    @State private var searchParameters = SearchParameters()
    @State private var showingFilters = false
    @State private var selectedBookmark: BookmarkItem?
    
    var filteredBookmarks: [BookmarkItem] {
        return bookmarkStore.bookmarks.filter { bookmark in
            let matchesQuery = searchParameters.query.isEmpty ||
                bookmark.data.title.localizedCaseInsensitiveContains(searchParameters.query) ||
                bookmark.data.url.localizedCaseInsensitiveContains(searchParameters.query) ||
                (bookmark.data.description?.localizedCaseInsensitiveContains(searchParameters.query) ?? false)
            
            let matchesTags = searchParameters.selectedTags.isEmpty ||
                !Set(searchParameters.selectedTags).isDisjoint(with: Set(bookmark.data.tagNames))
            
            return matchesQuery && matchesTags
        }
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search header
                searchHeader
                
                // Results
                if searchParameters.hasFilters {
                    searchResults
                } else {
                    searchSuggestions
                }
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showingFilters = true }) {
                        Image(systemName: "slider.horizontal.3")
                            .foregroundColor(searchParameters.selectedTags.isEmpty ? .primary : .accentColor)
                    }
                }
            }
            .sheet(isPresented: $showingFilters) {
                SearchFiltersView(searchParameters: $searchParameters)
            }
            .sheet(item: $selectedBookmark) { bookmark in
                BookmarkDetailView(bookmark: bookmark)
            }
        }
    }
    
    // MARK: - Subviews
    
    private var searchHeader: some View {
        VStack(spacing: 12) {
            // Search bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                
                TextField("Search bookmarks...", text: $searchParameters.query)
                    .textFieldStyle(PlainTextFieldStyle())
                
                if !searchParameters.query.isEmpty {
                    Button(action: {
                        searchParameters.query = ""
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(12)
            .background(Color(.systemGray6))
            .cornerRadius(12)
            .padding(.horizontal)
            
            // Active filters
            if !searchParameters.selectedTags.isEmpty {
                activeFiltersView
            }
            
            // Results count
            if searchParameters.hasFilters {
                HStack {
                    Text("\(filteredBookmarks.count) result\(filteredBookmarks.count == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .padding(.horizontal)
            }
        }
        .padding(.vertical)
        .background(Color(.systemBackground))
    }
    
    private var activeFiltersView: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(searchParameters.selectedTags, id: \.self) { tag in
                    HStack(spacing: 4) {
                        Text(tag)
                            .font(.caption)
                        
                        Button(action: {
                            searchParameters.selectedTags.removeAll { $0 == tag }
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
    
    private var searchResults: some View {
        Group {
            if filteredBookmarks.isEmpty {
                emptyResultsView
            } else {
                List(filteredBookmarks) { bookmark in
                    SearchResultRow(bookmark: bookmark)
                        .onTapGesture {
                            selectedBookmark = bookmark
                        }
                }
                .listStyle(PlainListStyle())
            }
        }
    }
    
    private var emptyResultsView: some View {
        VStack(spacing: 16) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            
            Text("No Results Found")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Try adjusting your search terms or filters")
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
            
            Button("Clear Filters") {
                searchParameters = SearchParameters()
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var searchSuggestions: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // Recent searches (placeholder)
                if !bookmarkStore.recentBookmarks.isEmpty {
                    recentBookmarksSection
                }
                
                // Popular tags
                if !bookmarkStore.tags.isEmpty {
                    popularTagsSection
                }
                
                // Quick suggestions
                quickSuggestionsSection
            }
            .padding()
        }
    }
    
    private var recentBookmarksSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Bookmarks")
                    .font(.headline)
                Spacer()
            }
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ForEach(Array(bookmarkStore.recentBookmarks.prefix(4))) { bookmark in
                    RecentBookmarkCard(bookmark: bookmark)
                        .onTapGesture {
                            selectedBookmark = bookmark
                        }
                }
            }
        }
    }
    
    private var popularTagsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Popular Tags")
                    .font(.headline)
                Spacer()
            }
            
            LazyVGrid(columns: [
                GridItem(.adaptive(minimum: 80), spacing: 8)
            ], spacing: 8) {
                ForEach(Array(bookmarkStore.tags.prefix(10)), id: \.id) { tag in
                    Button(action: {
                        if !searchParameters.selectedTags.contains(tag.name) {
                            searchParameters.selectedTags.append(tag.name)
                        }
                    }) {
                        HStack {
                            Text(tag.name)
                                .font(.caption)
                            Text("\(tag.bookmarkCount ?? 0)")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color(.systemGray5))
                        .foregroundColor(.primary)
                        .cornerRadius(12)
                    }
                }
            }
        }
    }
    
    private var quickSuggestionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Quick Suggestions")
                    .font(.headline)
                Spacer()
            }
            
            VStack(spacing: 8) {
                QuickSuggestionRow(
                    icon: "calendar",
                    title: "Today's Bookmarks",
                    action: {
                        // Filter by today
                    }
                )
                
                QuickSuggestionRow(
                    icon: "star",
                    title: "Most Visited",
                    action: {
                        // Filter by visit count
                    }
                )
                
                QuickSuggestionRow(
                    icon: "clock",
                    title: "Recently Added",
                    action: {
                        // Sort by recent
                    }
                )
            }
        }
    }
}

// MARK: - Supporting Views

struct SearchResultRow: View {
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
                Text(bookmark.data.title)
                    .font(.headline)
                    .lineLimit(2)
                
                Text(bookmark.data.domain)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                if let description = bookmark.data.description, !description.isEmpty {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                if !bookmark.data.tags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 4) {
                            ForEach(bookmark.data.tags.prefix(3), id: \.id) { tag in
                                Text(tag.name)
                                    .font(.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.accentColor.opacity(0.2))
                                    .foregroundColor(.accentColor)
                                    .cornerRadius(4)
                            }
                        }
                    }
                }
            }
            
            Spacer()
        }
        .padding(.vertical, 8)
    }
}

struct RecentBookmarkCard: View {
    let bookmark: BookmarkItem
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            AsyncImage(url: URL(string: bookmark.data.favicon ?? "")) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fit)
            } placeholder: {
                Image(systemName: "globe")
                    .foregroundColor(.secondary)
            }
            .frame(width: 24, height: 24)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(bookmark.data.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(2)
                
                Text(bookmark.data.domain)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            
            Spacer()
        }
        .padding(12)
        .frame(height: 100)
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct QuickSuggestionRow: View {
    let icon: String
    let title: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(.accentColor)
                    .frame(width: 20)
                
                Text(title)
                    .foregroundColor(.primary)
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)
        }
    }
}

// MARK: - Search Filters View

struct SearchFiltersView: View {
    @Binding var searchParameters: SearchParameters
    @EnvironmentObject var bookmarkStore: BookmarkStore
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            List {
                Section("Sort By") {
                    ForEach(SortOption.allCases, id: \.self) { option in
                        HStack {
                            Text(option.displayName)
                            Spacer()
                            if searchParameters.sortBy == option {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.accentColor)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            searchParameters.sortBy = option
                        }
                    }
                }
                
                Section("Tags") {
                    ForEach(bookmarkStore.tags, id: \.id) { tag in
                        HStack {
                            Text(tag.name)
                            Spacer()
                            Text("\(tag.bookmarkCount ?? 0)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            if searchParameters.selectedTags.contains(tag.name) {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.accentColor)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            if searchParameters.selectedTags.contains(tag.name) {
                                searchParameters.selectedTags.removeAll { $0 == tag.name }
                            } else {
                                searchParameters.selectedTags.append(tag.name)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Search Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Reset") {
                        searchParameters = SearchParameters()
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

struct SearchView_Previews: PreviewProvider {
    static var previews: some View {
        SearchView()
            .environmentObject(BookmarkStore())
    }
}