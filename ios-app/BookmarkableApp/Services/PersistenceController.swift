import CoreData
import Foundation

// MARK: - Persistence Controller
class PersistenceController: ObservableObject {
    static let shared = PersistenceController()
    
    static var preview: PersistenceController = {
        let result = PersistenceController(inMemory: true)
        let viewContext = result.container.viewContext
        
        // Add sample data for previews
        let sampleBookmark = CDBookmark(context: viewContext)
        sampleBookmark.id = 1
        sampleBookmark.title = "Apple Developer Documentation"
        sampleBookmark.url = "https://developer.apple.com"
        sampleBookmark.bookmarkDescription = "Official Apple developer resources"
        sampleBookmark.createdAt = Date()
        sampleBookmark.updatedAt = Date()
        sampleBookmark.isArchived = false
        sampleBookmark.visitCount = 5
        
        let sampleTag = CDTag(context: viewContext)
        sampleTag.id = 1
        sampleTag.name = "development"
        sampleTag.color = "#3b82f6"
        
        sampleBookmark.addToTags(sampleTag)
        
        do {
            try viewContext.save()
        } catch {
            let nsError = error as NSError
            fatalError("Unresolved error \(nsError), \(nsError.userInfo)")
        }
        
        return result
    }()
    
    lazy var container: NSPersistentCloudKitContainer = {
        let container = NSPersistentCloudKitContainer(name: "BookmarkModel")
        
        if inMemory {
            container.persistentStoreDescriptions.first!.url = URL(fileURLWithPath: "/dev/null")
        } else {
            // Configure for CloudKit sync (optional)
            container.persistentStoreDescriptions.forEach { storeDescription in
                storeDescription.setOption(true as NSNumber, forKey: NSPersistentHistoryTrackingKey)
                storeDescription.setOption(true as NSNumber, forKey: NSPersistentStoreRemoteChangeNotificationPostOptionKey)
            }
        }
        
        container.loadPersistentStores(completionHandler: { (storeDescription, error) in
            if let error = error as NSError? {
                fatalError("Unresolved error \(error), \(error.userInfo)")
            }
        })
        
        container.viewContext.automaticallyMergesChangesFromParent = true
        
        return container
    }()
    
    private let inMemory: Bool
    
    private init(inMemory: Bool = false) {
        self.inMemory = inMemory
    }
    
    func save() {
        let context = container.viewContext
        
        if context.hasChanges {
            do {
                try context.save()
            } catch {
                let nsError = error as NSError
                fatalError("Unresolved error \(nsError), \(nsError.userInfo)")
            }
        }
    }
    
    // MARK: - Bookmark Operations
    
    func createOrUpdateBookmark(from bookmarkData: BookmarkData) -> CDBookmark {
        let context = container.viewContext
        
        // Check if bookmark already exists
        let request: NSFetchRequest<CDBookmark> = CDBookmark.fetchRequest()
        request.predicate = NSPredicate(format: "id == %d", bookmarkData.id)
        
        let existingBookmark: CDBookmark
        
        do {
            let results = try context.fetch(request)
            if let existing = results.first {
                existingBookmark = existing
            } else {
                existingBookmark = CDBookmark(context: context)
                existingBookmark.id = Int32(bookmarkData.id)
            }
        } catch {
            existingBookmark = CDBookmark(context: context)
            existingBookmark.id = Int32(bookmarkData.id)
        }
        
        // Update properties
        existingBookmark.title = bookmarkData.title
        existingBookmark.url = bookmarkData.url
        existingBookmark.bookmarkDescription = bookmarkData.description
        existingBookmark.favicon = bookmarkData.favicon
        existingBookmark.createdAt = bookmarkData.formattedCreatedDate
        existingBookmark.updatedAt = bookmarkData.formattedUpdatedDate
        existingBookmark.isArchived = bookmarkData.isArchived
        existingBookmark.visitCount = Int32(bookmarkData.visitCount)
        existingBookmark.lastVisited = bookmarkData.lastVisitedDate
        existingBookmark.needsSync = false
        
        // Update tags
        existingBookmark.removeFromTags(existingBookmark.tags ?? NSSet())
        
        for tagData in bookmarkData.tags {
            let tag = createOrUpdateTag(from: tagData)
            existingBookmark.addToTags(tag)
        }
        
        return existingBookmark
    }
    
    func createOrUpdateTag(from tagData: TagData) -> CDTag {
        let context = container.viewContext
        
        // Check if tag already exists
        let request: NSFetchRequest<CDTag> = CDTag.fetchRequest()
        request.predicate = NSPredicate(format: "id == %d", tagData.id)
        
        let existingTag: CDTag
        
        do {
            let results = try context.fetch(request)
            if let existing = results.first {
                existingTag = existing
            } else {
                existingTag = CDTag(context: context)
                existingTag.id = Int32(tagData.id)
            }
        } catch {
            existingTag = CDTag(context: context)
            existingTag.id = Int32(tagData.id)
        }
        
        // Update properties
        existingTag.name = tagData.name
        existingTag.color = tagData.color
        
        return existingTag
    }
    
    func markBookmarkForSync(_ bookmark: CDBookmark) {
        bookmark.needsSync = true
        save()
    }
    
    func deleteBookmark(_ bookmark: CDBookmark) {
        container.viewContext.delete(bookmark)
        save()
    }
    
    // MARK: - Fetch Operations
    
    func fetchBookmarks(searchText: String = "", selectedTags: [String] = []) -> NSFetchRequest<CDBookmark> {
        let request: NSFetchRequest<CDBookmark> = CDBookmark.fetchRequest()
        
        var predicates: [NSPredicate] = []
        
        // Filter out archived bookmarks
        predicates.append(NSPredicate(format: "isArchived == NO"))
        
        // Search text filter
        if !searchText.isEmpty {
            let searchPredicate = NSPredicate(format: "title CONTAINS[cd] %@ OR bookmarkDescription CONTAINS[cd] %@ OR url CONTAINS[cd] %@",
                                            searchText, searchText, searchText)
            predicates.append(searchPredicate)
        }
        
        // Tag filter
        if !selectedTags.isEmpty {
            let tagPredicate = NSPredicate(format: "ANY tags.name IN %@", selectedTags)
            predicates.append(tagPredicate)
        }
        
        if predicates.count > 1 {
            request.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)
        } else if let predicate = predicates.first {
            request.predicate = predicate
        }
        
        // Sort by creation date (newest first)
        request.sortDescriptors = [NSSortDescriptor(keyPath: \CDBookmark.createdAt, ascending: false)]
        
        return request
    }
    
    func fetchTags() -> NSFetchRequest<CDTag> {
        let request: NSFetchRequest<CDTag> = CDTag.fetchRequest()
        request.sortDescriptors = [NSSortDescriptor(keyPath: \CDTag.name, ascending: true)]
        return request
    }
    
    func fetchBookmarksNeedingSync() -> [CDBookmark] {
        let request: NSFetchRequest<CDBookmark> = CDBookmark.fetchRequest()
        request.predicate = NSPredicate(format: "needsSync == YES")
        
        do {
            return try container.viewContext.fetch(request)
        } catch {
            print("Error fetching bookmarks needing sync: \(error)")
            return []
        }
    }
}

// MARK: - Core Data Extensions

extension CDBookmark {
    var bookmarkData: BookmarkData {
        BookmarkData(
            id: Int(id),
            title: title ?? "",
            url: url ?? "",
            description: bookmarkDescription,
            favicon: favicon,
            tags: tagsArray.map { $0.tagData },
            createdAt: (createdAt ?? Date()).ISO8601String(),
            updatedAt: (updatedAt ?? Date()).ISO8601String(),
            isArchived: isArchived,
            visitCount: Int(visitCount),
            lastVisited: lastVisited?.ISO8601String()
        )
    }
    
    var tagsArray: [CDTag] {
        guard let tagSet = tags as? Set<CDTag> else { return [] }
        return Array(tagSet).sorted { $0.name ?? "" < $1.name ?? "" }
    }
    
    var domain: String {
        guard let url = URL(string: url ?? "") else { return "" }
        return url.host ?? ""
    }
}

extension CDTag {
    var tagData: TagData {
        TagData(
            id: Int(id),
            name: name ?? "",
            color: color,
            bookmarkCount: Int(bookmarks?.count ?? 0)
        )
    }
    
    var bookmarksArray: [CDBookmark] {
        guard let bookmarkSet = bookmarks as? Set<CDBookmark> else { return [] }
        return Array(bookmarkSet).sorted { ($0.createdAt ?? Date()) > ($1.createdAt ?? Date()) }
    }
}

// MARK: - Date Extensions

extension Date {
    func ISO8601String() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: self)
    }
}

extension String {
    func ISO8601Date() -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: self)
    }
}