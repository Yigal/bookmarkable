import SwiftUI
import UniformTypeIdentifiers

struct AddBookmarkView: View {
    @EnvironmentObject var bookmarkStore: BookmarkStore
    @EnvironmentObject var syncService: SyncService
    @Environment(\.dismiss) private var dismiss
    
    @State private var title = ""
    @State private var url = ""
    @State private var description = ""
    @State private var tags: [String] = []
    @State private var isValidURL = true
    @State private var isLoading = false
    @State private var showingURLPicker = false
    
    // For URL picker from clipboard
    @State private var clipboardURL: String?
    
    var body: some View {
        NavigationView {
            Form {
                Section {
                    // URL input
                    HStack {
                        TextField("https://example.com", text: $url)
                            .keyboardType(.URL)
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                            .onChange(of: url) { newValue in
                                validateURL(newValue)
                                if isValidURL && !newValue.isEmpty {
                                    fetchMetadata()
                                }
                            }
                        
                        if !url.isEmpty {
                            Button(action: {
                                url = ""
                                title = ""
                                description = ""
                            }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    
                    if !isValidURL {
                        Text("Please enter a valid URL")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                    
                    // URL suggestions
                    if let clipboardURL = clipboardURL {
                        Button(action: {
                            url = clipboardURL
                        }) {
                            HStack {
                                Image(systemName: "doc.on.clipboard")
                                VStack(alignment: .leading) {
                                    Text("Use URL from clipboard")
                                        .font(.subheadline)
                                    Text(clipboardURL)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                        .lineLimit(1)
                                }
                                Spacer()
                            }
                        }
                    }
                } header: {
                    Text("URL")
                } footer: {
                    Text("Enter the web address you want to bookmark")
                }
                
                Section {
                    TextField("Enter title", text: $title)
                        .autocapitalization(.words)
                    
                    TextField("Enter description (optional)", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                        .autocapitalization(.sentences)
                } header: {
                    Text("Details")
                }
                
                Section {
                    TagEditor(tags: $tags)
                } header: {
                    Text("Tags")
                } footer: {
                    Text("Add tags to organize your bookmarks")
                }
                
                // Quick tag suggestions
                if !suggestedTags.isEmpty {
                    Section("Suggested Tags") {
                        LazyVGrid(columns: [
                            GridItem(.adaptive(minimum: 80), spacing: 8)
                        ], spacing: 8) {
                            ForEach(suggestedTags, id: \.self) { tag in
                                Button(action: {
                                    if !tags.contains(tag) {
                                        tags.append(tag)
                                    }
                                }) {
                                    Text(tag)
                                        .font(.caption)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 6)
                                        .background(tags.contains(tag) ? Color.accentColor : Color(.systemGray5))
                                        .foregroundColor(tags.contains(tag) ? .white : .primary)
                                        .cornerRadius(12)
                                }
                                .disabled(tags.contains(tag))
                            }
                        }
                        .padding(.vertical, 8)
                    }
                }
            }
            .navigationTitle("Add Bookmark")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        Task {
                            await saveBookmark()
                        }
                    }
                    .disabled(!canSave || isLoading)
                }
            }
            .onAppear {
                checkClipboard()
            }
            .alert("Error", isPresented: .constant(false)) {
                Button("OK") { }
            } message: {
                Text("Failed to save bookmark. Please try again.")
            }
        }
    }
    
    // MARK: - Computed Properties
    
    private var canSave: Bool {
        !title.isEmpty && !url.isEmpty && isValidURL
    }
    
    private var suggestedTags: [String] {
        guard let urlObj = URL(string: url), let host = urlObj.host else {
            return []
        }
        
        var suggestions: [String] = []
        
        // Domain-based suggestions
        if host.contains("github") {
            suggestions.append("code")
        } else if host.contains("stackoverflow") {
            suggestions.append("programming")
        } else if host.contains("apple") || host.contains("developer") {
            suggestions.append("development")
        } else if host.contains("news") || host.contains("cnn") || host.contains("bbc") {
            suggestions.append("news")
        } else if host.contains("youtube") || host.contains("vimeo") {
            suggestions.append("video")
        } else if host.contains("medium") || host.contains("blog") {
            suggestions.append("article")
        }
        
        // Common tags from existing bookmarks
        let commonTags = bookmarkStore.tags
            .sorted { $0.bookmarkCount ?? 0 > $1.bookmarkCount ?? 0 }
            .prefix(5)
            .map { $0.name }
        
        suggestions.append(contentsOf: commonTags)
        
        return Array(Set(suggestions)).filter { !tags.contains($0) }
    }
    
    // MARK: - Methods
    
    private func validateURL(_ urlString: String) {
        if urlString.isEmpty {
            isValidURL = true
            return
        }
        
        var urlToValidate = urlString
        if !urlString.hasPrefix("http://") && !urlString.hasPrefix("https://") {
            urlToValidate = "https://" + urlString
        }
        
        isValidURL = URL(string: urlToValidate) != nil
    }
    
    private func fetchMetadata() {
        guard !url.isEmpty, isValidURL else { return }
        
        // Normalize URL
        var urlToFetch = url
        if !url.hasPrefix("http://") && !url.hasPrefix("https://") {
            urlToFetch = "https://" + url
            url = urlToFetch
        }
        
        guard let urlObj = URL(string: urlToFetch) else { return }
        
        isLoading = true
        
        Task {
            do {
                let metadata = try await URLMetadataFetcher.fetchMetadata(for: urlObj)
                
                await MainActor.run {
                    if title.isEmpty {
                        title = metadata.title ?? urlObj.host ?? "Untitled"
                    }
                    if description.isEmpty {
                        description = metadata.description ?? ""
                    }
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    // If metadata fetch fails, use URL as title if title is empty
                    if title.isEmpty {
                        title = urlObj.host ?? "Untitled"
                    }
                    isLoading = false
                }
            }
        }
    }
    
    private func checkClipboard() {
        if UIPasteboard.general.hasURLs,
           let clipboardString = UIPasteboard.general.string,
           let _ = URL(string: clipboardString) {
            clipboardURL = clipboardString
        }
    }
    
    private func saveBookmark() async {
        guard canSave else { return }
        
        isLoading = true
        
        do {
            if syncService.networkStatus == .online {
                // Save to server
                await bookmarkStore.createBookmark(
                    title: title,
                    url: url,
                    description: description.isEmpty ? nil : description,
                    tags: tags
                )
            } else {
                // Save offline
                syncService.createBookmarkOffline(
                    title: title,
                    url: url,
                    description: description.isEmpty ? nil : description,
                    tags: tags
                )
            }
            
            dismiss()
        } catch {
            print("Error saving bookmark: \(error)")
            // Handle error - could show an alert
        }
        
        isLoading = false
    }
}

// MARK: - URL Metadata Fetcher
struct URLMetadata {
    let title: String?
    let description: String?
    let favicon: String?
}

class URLMetadataFetcher {
    static func fetchMetadata(for url: URL) async throws -> URLMetadata {
        let (data, _) = try await URLSession.shared.data(from: url)
        
        guard let html = String(data: data, encoding: .utf8) else {
            throw URLError(.cannotParseResponse)
        }
        
        let title = extractMetaContent(from: html, property: "og:title") ??
                   extractTitle(from: html)
        
        let description = extractMetaContent(from: html, property: "og:description") ??
                         extractMetaContent(from: html, name: "description")
        
        let favicon = extractFaviconURL(from: html, baseURL: url)
        
        return URLMetadata(title: title, description: description, favicon: favicon)
    }
    
    private static func extractTitle(from html: String) -> String? {
        let titlePattern = "<title[^>]*>([^<]+)</title>"
        let regex = try? NSRegularExpression(pattern: titlePattern, options: [.caseInsensitive])
        let range = NSRange(location: 0, length: html.utf16.count)
        
        if let match = regex?.firstMatch(in: html, options: [], range: range),
           let titleRange = Range(match.range(at: 1), in: html) {
            return String(html[titleRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        
        return nil
    }
    
    private static func extractMetaContent(from html: String, property: String? = nil, name: String? = nil) -> String? {
        let attribute = property != nil ? "property" : "name"
        let value = property ?? name ?? ""
        
        let pattern = "<meta[^>]*\(attribute)=['\"]?\(value)['\"]?[^>]*content=['\"]?([^'\"]+)['\"]?[^>]*>"
        let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
        let range = NSRange(location: 0, length: html.utf16.count)
        
        if let match = regex?.firstMatch(in: html, options: [], range: range),
           let contentRange = Range(match.range(at: 1), in: html) {
            return String(html[contentRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        
        return nil
    }
    
    private static func extractFaviconURL(from html: String, baseURL: URL) -> String? {
        let patterns = [
            "<link[^>]*rel=['\"]?icon['\"]?[^>]*href=['\"]?([^'\"\\s>]+)['\"]?[^>]*>",
            "<link[^>]*href=['\"]?([^'\"\\s>]+)['\"]?[^>]*rel=['\"]?icon['\"]?[^>]*>"
        ]
        
        for pattern in patterns {
            let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
            let range = NSRange(location: 0, length: html.utf16.count)
            
            if let match = regex?.firstMatch(in: html, options: [], range: range),
               let hrefRange = Range(match.range(at: 1), in: html) {
                let href = String(html[hrefRange])
                
                if href.hasPrefix("http") {
                    return href
                } else if href.hasPrefix("/") {
                    return "\(baseURL.scheme!)://\(baseURL.host!)\(href)"
                } else {
                    return "\(baseURL.scheme!)://\(baseURL.host!)/\(href)"
                }
            }
        }
        
        // Fallback to standard favicon location
        return "\(baseURL.scheme!)://\(baseURL.host!)/favicon.ico"
    }
}

struct AddBookmarkView_Previews: PreviewProvider {
    static var previews: some View {
        AddBookmarkView()
            .environmentObject(BookmarkStore())
            .environmentObject(SyncService())
    }
}