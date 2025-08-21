import Foundation
import CoreData
import SwiftUI

// MARK: - Bookmark Store
@MainActor
class BookmarkStore: ObservableObject {
    @Published var bookmarks: [BookmarkItem] = []
    @Published var tags: [TagData] = []
    @Published var isLoading = false
    @Published var searchText = ""
    @Published var selectedTags: [String] = []
    @Published var syncStatus: SyncStatus = .idle
    @Published var lastSyncDate: Date?
    
    private let apiService = APIService.shared
    private let persistenceController = PersistenceController.shared
    
    private var cancellables = Set<NSCancellable>()
    
    init() {
        loadLocalBookmarks()
        loadLocalTags()
    }
    
    // MARK: - Local Data Loading
    
    func loadLocalBookmarks() {
        let context = persistenceController.container.viewContext
        let request = persistenceController.fetchBookmarks(searchText: searchText, selectedTags: selectedTags)
        
        do {
            let cdBookmarks = try context.fetch(request)
            self.bookmarks = cdBookmarks.map { BookmarkItem(data: $0.bookmarkData) }
        } catch {
            print("Error loading local bookmarks: \(error)")
        }
    }
    
    func loadLocalTags() {
        let context = persistenceController.container.viewContext
        let request = persistenceController.fetchTags()
        
        do {
            let cdTags = try context.fetch(request)
            self.tags = cdTags.map { $0.tagData }
        } catch {
            print("Error loading local tags: \(error)")
        }
    }
    
    // MARK: - Search and Filter
    
    func updateSearchText(_ text: String) {
        searchText = text
        loadLocalBookmarks()
    }
    
    func toggleTag(_ tagName: String) {
        if selectedTags.contains(tagName) {
            selectedTags.removeAll { $0 == tagName }
        } else {
            selectedTags.append(tagName)
        }
        loadLocalBookmarks()
    }
    
    func clearFilters() {
        searchText = ""
        selectedTags.removeAll()
        loadLocalBookmarks()
    }
    
    // MARK: - Remote Operations
    
    func syncFromRemote() async {
        guard !isLoading else { return }
        
        isLoading = true
        syncStatus = .syncing
        
        do {
            // Fetch bookmarks and tags from API
            async let bookmarkResponse = apiService.fetchBookmarks(limit: 1000)
            async let tagsResponse = apiService.fetchTags()
            
            let (bookmarks, tags) = try await (bookmarkResponse, tagsResponse)
            
            // Update local storage
            await updateLocalStorage(bookmarks: bookmarks.data, tags: tags.data)
            
            // Reload local data
            loadLocalBookmarks()
            loadLocalTags()
            
            syncStatus = .success
            lastSyncDate = Date()
            
        } catch {
            syncStatus = .failure(error.localizedDescription)
            print("Sync error: \(error)")
        }
        
        isLoading = false
    }
    
    private func updateLocalStorage(bookmarks: [BookmarkData], tags: [TagData]) async {
        let context = persistenceController.container.viewContext
        
        await context.perform {
            // Update bookmarks
            for bookmarkData in bookmarks {
                _ = self.persistenceController.createOrUpdateBookmark(from: bookmarkData)
            }
            
            // Update tags
            for tagData in tags {
                _ = self.persistenceController.createOrUpdateTag(from: tagData)
            }
            
            self.persistenceController.save()
        }
    }
    
    func createBookmark(title: String, url: String, description: String? = nil, tags: [String] = []) async {
        isLoading = true
        
        do {
            let request = CreateBookmarkRequest(
                title: title,
                url: url,
                description: description,
                tags: tags
            )
            
            let response = try await apiService.createBookmark(request)
            
            // Add to local storage
            let context = persistenceController.container.viewContext
            await context.perform {
                _ = self.persistenceController.createOrUpdateBookmark(from: response.data)
                self.persistenceController.save()
            }
            
            // Reload local data
            loadLocalBookmarks()
            loadLocalTags()
            
        } catch {
            print("Error creating bookmark: \(error)")
            throw error
        }
        
        isLoading = false
    }
    
    func updateBookmark(_ bookmarkItem: BookmarkItem, title: String, description: String? = nil, tags: [String] = []) async {
        isLoading = true
        
        do {
            let request = UpdateBookmarkRequest(
                title: title,
                description: description,
                tags: tags
            )
            
            let response = try await apiService.updateBookmark(id: bookmarkItem.id, request: request)
            
            // Update local storage
            let context = persistenceController.container.viewContext
            await context.perform {
                _ = self.persistenceController.createOrUpdateBookmark(from: response.data)
                self.persistenceController.save()
            }
            
            // Update local item
            bookmarkItem.updateData(response.data)
            
        } catch {
            print("Error updating bookmark: \(error)")
            throw error
        }
        
        isLoading = false
    }
    
    func deleteBookmark(_ bookmarkItem: BookmarkItem) async {
        isLoading = true
        
        do {
            try await apiService.deleteBookmark(id: bookmarkItem.id)
            
            // Remove from local storage
            let context = persistenceController.container.viewContext
            let request: NSFetchRequest<CDBookmark> = CDBookmark.fetchRequest()
            request.predicate = NSPredicate(format: "id == %d", bookmarkItem.id)
            
            await context.perform {
                do {
                    let results = try context.fetch(request)
                    if let bookmark = results.first {
                        self.persistenceController.deleteBookmark(bookmark)
                    }
                } catch {
                    print("Error deleting local bookmark: \(error)")
                }
            }
            
            // Remove from local array
            bookmarks.removeAll { $0.id == bookmarkItem.id }
            
        } catch {
            print("Error deleting bookmark: \(error)")
            throw error
        }
        
        isLoading = false
    }
    
    // MARK: - Offline Support
    
    func createOfflineBookmark(title: String, url: String, description: String? = nil, tags: [String] = []) {
        let context = persistenceController.container.viewContext
        
        context.perform {
            let bookmark = CDBookmark(context: context)
            bookmark.id = Int32.random(in: Int32.min..<0) // Negative ID for offline items
            bookmark.title = title
            bookmark.url = url
            bookmark.bookmarkDescription = description
            bookmark.createdAt = Date()
            bookmark.updatedAt = Date()
            bookmark.isArchived = false
            bookmark.visitCount = 0
            bookmark.needsSync = true
            
            // Add tags
            for tagName in tags {
                let tag = CDTag(context: context)
                tag.id = Int32.random(in: Int32.min..<0)
                tag.name = tagName
                tag.color = "#6b7280"
                bookmark.addToTags(tag)
            }
            
            self.persistenceController.save()
            
            DispatchQueue.main.async {
                self.loadLocalBookmarks()
                self.loadLocalTags()
            }
        }
    }
    
    func syncOfflineChanges() async {
        let bookmarksNeedingSync = persistenceController.fetchBookmarksNeedingSync()
        
        for cdBookmark in bookmarksNeedingSync {
            if cdBookmark.id < 0 {
                // This is an offline-created bookmark, create it remotely
                do {
                    let request = CreateBookmarkRequest(
                        title: cdBookmark.title ?? "",
                        url: cdBookmark.url ?? "",
                        description: cdBookmark.bookmarkDescription,
                        tags: cdBookmark.tagsArray.map { $0.name ?? "" }
                    )
                    
                    let response = try await apiService.createBookmark(request)
                    
                    // Update the local bookmark with the real ID from server
                    let context = persistenceController.container.viewContext
                    await context.perform {
                        cdBookmark.id = Int32(response.data.id)
                        cdBookmark.needsSync = false
                        self.persistenceController.save()
                    }
                    
                } catch {
                    print("Error syncing offline bookmark: \(error)")
                }
            }
        }
        
        // Reload after sync
        loadLocalBookmarks()
    }
    
    // MARK: - Utility Methods
    
    func bookmark(withId id: Int) -> BookmarkItem? {
        return bookmarks.first { $0.id == id }
    }
    
    func bookmarks(withTag tagName: String) -> [BookmarkItem] {
        return bookmarks.filter { $0.data.tagNames.contains(tagName) }
    }
    
    var recentBookmarks: [BookmarkItem] {
        return Array(bookmarks.prefix(10))
    }
    
    var bookmarkCount: Int {
        return bookmarks.count
    }
    
    var tagCount: Int {
        return tags.count
    }
}

// MARK: - Custom NSCancellable for async operations
class NSCancellable {
    private let cancel: () -> Void
    
    init(cancel: @escaping () -> Void) {
        self.cancel = cancel
    }
    
    func cancel() {
        self.cancel()
    }
}