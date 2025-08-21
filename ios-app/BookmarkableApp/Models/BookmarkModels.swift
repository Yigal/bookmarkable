import Foundation

// MARK: - API Response Models
struct BookmarkResponse: Codable {
    let success: Bool
    let data: BookmarkData
    let pagination: Pagination?
}

struct BookmarkListResponse: Codable {
    let success: Bool
    let data: [BookmarkData]
    let pagination: Pagination?
}

struct TagsResponse: Codable {
    let success: Bool
    let data: [TagData]
}

struct Pagination: Codable {
    let limit: Int
    let offset: Int
    let total: Int
}

// MARK: - Data Models
struct BookmarkData: Codable, Identifiable, Equatable {
    let id: Int
    let title: String
    let url: String
    let description: String?
    let favicon: String?
    let tags: [TagData]
    let createdAt: String
    let updatedAt: String
    let isArchived: Bool
    let visitCount: Int
    let lastVisited: String?
    
    enum CodingKeys: String, CodingKey {
        case id, title, url, description, favicon, tags
        case createdAt, updatedAt, isArchived, visitCount, lastVisited
    }
    
    // Computed properties for UI
    var formattedCreatedDate: Date {
        ISO8601DateFormatter().date(from: createdAt) ?? Date()
    }
    
    var formattedUpdatedDate: Date {
        ISO8601DateFormatter().date(from: updatedAt) ?? Date()
    }
    
    var lastVisitedDate: Date? {
        guard let lastVisited = lastVisited else { return nil }
        return ISO8601DateFormatter().date(from: lastVisited)
    }
    
    var domain: String {
        guard let url = URL(string: url) else { return "" }
        return url.host ?? ""
    }
    
    var tagNames: [String] {
        tags.map { $0.name }
    }
    
    static func == (lhs: BookmarkData, rhs: BookmarkData) -> Bool {
        return lhs.id == rhs.id
    }
}

struct TagData: Codable, Identifiable, Equatable {
    let id: Int
    let name: String
    let color: String?
    let bookmarkCount: Int?
    
    enum CodingKeys: String, CodingKey {
        case id, name, color
        case bookmarkCount = "bookmark_count"
    }
    
    var displayColor: String {
        color ?? "#6b7280"
    }
    
    static func == (lhs: TagData, rhs: TagData) -> Bool {
        return lhs.id == rhs.id && lhs.name == rhs.name
    }
}

// MARK: - Request Models
struct CreateBookmarkRequest: Codable {
    let title: String
    let url: String
    let description: String?
    let favicon: String?
    let tags: [String]
    
    init(title: String, url: String, description: String? = nil, favicon: String? = nil, tags: [String] = []) {
        self.title = title
        self.url = url
        self.description = description
        self.favicon = favicon
        self.tags = tags
    }
}

struct UpdateBookmarkRequest: Codable {
    let title: String
    let description: String?
    let tags: [String]
    
    init(title: String, description: String? = nil, tags: [String] = []) {
        self.title = title
        self.description = description
        self.tags = tags
    }
}

// MARK: - Local UI Models
class BookmarkItem: ObservableObject, Identifiable {
    @Published var data: BookmarkData
    @Published var isSelected: Bool = false
    @Published var isSyncing: Bool = false
    
    var id: Int { data.id }
    
    init(data: BookmarkData) {
        self.data = data
    }
    
    func updateData(_ newData: BookmarkData) {
        self.data = newData
    }
}

// MARK: - Search and Filter Models
struct SearchParameters {
    var query: String = ""
    var selectedTags: [String] = []
    var limit: Int = 50
    var offset: Int = 0
    var sortBy: SortOption = .newest
    
    var hasFilters: Bool {
        !query.isEmpty || !selectedTags.isEmpty
    }
}

enum SortOption: String, CaseIterable {
    case newest = "newest"
    case oldest = "oldest"
    case alphabetical = "alphabetical"
    case mostVisited = "most_visited"
    
    var displayName: String {
        switch self {
        case .newest: return "Newest First"
        case .oldest: return "Oldest First"
        case .alphabetical: return "Alphabetical"
        case .mostVisited: return "Most Visited"
        }
    }
}

// MARK: - Sync Status
enum SyncStatus: Equatable {
    case idle
    case syncing
    case success
    case failure(String)
    
    var isLoading: Bool {
        if case .syncing = self {
            return true
        }
        return false
    }
    
    var errorMessage: String? {
        if case .failure(let message) = self {
            return message
        }
        return nil
    }
}