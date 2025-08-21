import Foundation
import Network
import SwiftUI

// MARK: - Sync Service
@MainActor
class SyncService: ObservableObject {
    @Published var syncStatus: SyncStatus = .idle
    @Published var lastSyncDate: Date?
    @Published var isAutoSyncEnabled = true
    @Published var networkStatus: NetworkStatus = .unknown
    
    private let apiService = APIService.shared
    private let persistenceController = PersistenceController.shared
    private let networkMonitor = NWPathMonitor()
    private let networkQueue = DispatchQueue(label: "NetworkMonitor")
    
    private var syncTimer: Timer?
    private let autoSyncInterval: TimeInterval = 300 // 5 minutes
    
    enum NetworkStatus {
        case unknown
        case offline
        case online
        case poor
    }
    
    init() {
        setupNetworkMonitoring()
        loadSyncPreferences()
        
        if isAutoSyncEnabled {
            scheduleAutoSync()
        }
    }
    
    deinit {
        networkMonitor.cancel()
        syncTimer?.invalidate()
    }
    
    // MARK: - Network Monitoring
    
    private func setupNetworkMonitoring() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                guard let self = self else { return }
                
                if path.status == .satisfied {
                    if path.isExpensive {
                        self.networkStatus = .poor
                    } else {
                        self.networkStatus = .online
                    }
                    
                    // Auto-sync when network becomes available
                    if self.isAutoSyncEnabled {
                        Task {
                            await self.performSync()
                        }
                    }
                } else {
                    self.networkStatus = .offline
                }
            }
        }
        
        networkMonitor.start(queue: networkQueue)
    }
    
    // MARK: - Sync Operations
    
    func performSync() async {
        guard networkStatus == .online, !syncStatus.isLoading else {
            return
        }
        
        syncStatus = .syncing
        
        do {
            // First, sync any offline changes up to the server
            await syncOfflineChanges()
            
            // Then, pull latest data from server
            await syncFromServer()
            
            syncStatus = .success
            lastSyncDate = Date()
            saveSyncPreferences()
            
        } catch {
            syncStatus = .failure(error.localizedDescription)
            print("Sync failed: \(error)")
        }
    }
    
    private func syncOfflineChanges() async {
        let bookmarksNeedingSync = persistenceController.fetchBookmarksNeedingSync()
        
        for cdBookmark in bookmarksNeedingSync {
            do {
                if cdBookmark.id < 0 {
                    // This is an offline-created bookmark
                    let request = CreateBookmarkRequest(
                        title: cdBookmark.title ?? "",
                        url: cdBookmark.url ?? "",
                        description: cdBookmark.bookmarkDescription,
                        tags: cdBookmark.tagsArray.map { $0.name ?? "" }
                    )
                    
                    let response = try await apiService.createBookmark(request)
                    
                    // Update local bookmark with server ID
                    let context = persistenceController.container.viewContext
                    await context.perform {
                        cdBookmark.id = Int32(response.data.id)
                        cdBookmark.needsSync = false
                        self.persistenceController.save()
                    }
                } else {
                    // This is an updated bookmark
                    let request = UpdateBookmarkRequest(
                        title: cdBookmark.title ?? "",
                        description: cdBookmark.bookmarkDescription,
                        tags: cdBookmark.tagsArray.map { $0.name ?? "" }
                    )
                    
                    let _ = try await apiService.updateBookmark(id: Int(cdBookmark.id), request: request)
                    
                    // Mark as synced
                    let context = persistenceController.container.viewContext
                    await context.perform {
                        cdBookmark.needsSync = false
                        self.persistenceController.save()
                    }
                }
            } catch {
                print("Error syncing bookmark \(cdBookmark.id): \(error)")
                // Continue with other bookmarks even if one fails
            }
        }
    }
    
    private func syncFromServer() async throws {
        // Fetch all bookmarks and tags from server
        async let bookmarksResponse = apiService.fetchBookmarks(limit: 10000)
        async let tagsResponse = apiService.fetchTags()
        
        let (bookmarks, tags) = try await (bookmarksResponse, tagsResponse)
        
        // Update local storage
        let context = persistenceController.container.viewContext
        await context.perform {
            // Update bookmarks
            for bookmarkData in bookmarks.data {
                _ = self.persistenceController.createOrUpdateBookmark(from: bookmarkData)
            }
            
            // Update tags
            for tagData in tags.data {
                _ = self.persistenceController.createOrUpdateTag(from: tagData)
            }
            
            self.persistenceController.save()
        }
    }
    
    func forceSyncFromServer() async {
        guard networkStatus == .online else {
            syncStatus = .failure("No internet connection")
            return
        }
        
        syncStatus = .syncing
        
        do {
            await syncFromServer()
            syncStatus = .success
            lastSyncDate = Date()
            saveSyncPreferences()
        } catch {
            syncStatus = .failure(error.localizedDescription)
        }
    }
    
    // MARK: - Auto Sync
    
    func enableAutoSync() {
        isAutoSyncEnabled = true
        scheduleAutoSync()
        saveSyncPreferences()
    }
    
    func disableAutoSync() {
        isAutoSyncEnabled = false
        syncTimer?.invalidate()
        syncTimer = nil
        saveSyncPreferences()
    }
    
    private func scheduleAutoSync() {
        syncTimer?.invalidate()
        
        syncTimer = Timer.scheduledTimer(withTimeInterval: autoSyncInterval, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            
            if self.networkStatus == .online && self.isAutoSyncEnabled {
                Task {
                    await self.performSync()
                }
            }
        }
    }
    
    // MARK: - Manual Operations
    
    func createBookmarkOffline(title: String, url: String, description: String? = nil, tags: [String] = []) {
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
                // Check if tag exists locally
                let tagRequest: NSFetchRequest<CDTag> = CDTag.fetchRequest()
                tagRequest.predicate = NSPredicate(format: "name == %@", tagName)
                
                let existingTag: CDTag
                do {
                    let results = try context.fetch(tagRequest)
                    if let tag = results.first {
                        existingTag = tag
                    } else {
                        existingTag = CDTag(context: context)
                        existingTag.id = Int32.random(in: Int32.min..<0)
                        existingTag.name = tagName
                        existingTag.color = "#6b7280"
                    }
                } catch {
                    existingTag = CDTag(context: context)
                    existingTag.id = Int32.random(in: Int32.min..<0)
                    existingTag.name = tagName
                    existingTag.color = "#6b7280"
                }
                
                bookmark.addToTags(existingTag)
            }
            
            self.persistenceController.save()
        }
        
        // Try to sync immediately if online
        if networkStatus == .online {
            Task {
                await performSync()
            }
        }
    }
    
    // MARK: - Health Check
    
    func checkServerHealth() async -> Bool {
        do {
            return try await apiService.checkHealth()
        } catch {
            return false
        }
    }
    
    // MARK: - Preferences
    
    private func loadSyncPreferences() {
        isAutoSyncEnabled = UserDefaults.standard.bool(forKey: "autoSyncEnabled")
        
        if let lastSync = UserDefaults.standard.object(forKey: "lastSyncDate") as? Date {
            lastSyncDate = lastSync
        }
    }
    
    private func saveSyncPreferences() {
        UserDefaults.standard.set(isAutoSyncEnabled, forKey: "autoSyncEnabled")
        
        if let lastSync = lastSyncDate {
            UserDefaults.standard.set(lastSync, forKey: "lastSyncDate")
        }
    }
    
    // MARK: - Computed Properties
    
    var syncStatusText: String {
        switch syncStatus {
        case .idle:
            if let lastSync = lastSyncDate {
                let formatter = RelativeDateTimeFormatter()
                return "Last synced \(formatter.localizedString(for: lastSync, relativeTo: Date()))"
            } else {
                return "Not synced yet"
            }
        case .syncing:
            return "Syncing..."
        case .success:
            return "Sync completed"
        case .failure(let message):
            return "Sync failed: \(message)"
        }
    }
    
    var networkStatusText: String {
        switch networkStatus {
        case .unknown:
            return "Network status unknown"
        case .offline:
            return "No internet connection"
        case .online:
            return "Connected"
        case .poor:
            return "Poor connection"
        }
    }
    
    var canSync: Bool {
        return networkStatus == .online && !syncStatus.isLoading
    }
    
    var pendingChanges: Int {
        return persistenceController.fetchBookmarksNeedingSync().count
    }
}