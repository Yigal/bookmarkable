import Foundation
import Network

// MARK: - API Configuration
struct APIConfiguration {
    static let shared = APIConfiguration()
    
    private init() {}
    
    // Default to localhost for development
    // In production, this would be configurable
    var baseURL: URL {
        guard let url = URL(string: UserDefaults.standard.string(forKey: "api_base_url") ?? "http://localhost:3000") else {
            fatalError("Invalid API base URL")
        }
        return url
    }
    
    var apiURL: URL {
        baseURL.appendingPathComponent("api")
    }
    
    var timeout: TimeInterval { 30.0 }
    
    func updateBaseURL(_ urlString: String) {
        UserDefaults.standard.set(urlString, forKey: "api_base_url")
    }
}

// MARK: - API Error Types
enum APIError: Error, LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case networkError(Error)
    case serverError(Int, String)
    case unauthorized
    case notFound
    case conflict(String)
    case unknownError
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .noData:
            return "No data received"
        case .decodingError(let error):
            return "Data parsing error: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message)"
        case .unauthorized:
            return "Unauthorized access"
        case .notFound:
            return "Resource not found"
        case .conflict(let message):
            return "Conflict: \(message)"
        case .unknownError:
            return "An unknown error occurred"
        }
    }
}

// MARK: - Network Monitor
@MainActor
class NetworkMonitor: ObservableObject {
    @Published var isConnected = true
    @Published var connectionType: NWInterface.InterfaceType?
    
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")
    
    init() {
        startMonitoring()
    }
    
    func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
                self?.connectionType = path.availableInterfaces.first?.type
            }
        }
        monitor.start(queue: queue)
    }
    
    func stopMonitoring() {
        monitor.cancel()
    }
    
    deinit {
        stopMonitoring()
    }
}

// MARK: - HTTP Client
class HTTPClient {
    static let shared = HTTPClient()
    
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    
    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = APIConfiguration.shared.timeout
        configuration.timeoutIntervalForResource = APIConfiguration.shared.timeout * 2
        
        self.session = URLSession(configuration: configuration)
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
        
        // Configure date formatting to match API
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
        dateFormatter.timeZone = TimeZone(abbreviation: "UTC")
        decoder.dateDecodingStrategy = .formatted(dateFormatter)
    }
    
    func request<T: Codable>(
        endpoint: String,
        method: HTTPMethod = .GET,
        parameters: [String: Any]? = nil,
        body: Codable? = nil,
        responseType: T.Type
    ) async throws -> T {
        
        var url = APIConfiguration.shared.apiURL.appendingPathComponent(endpoint)
        
        // Add query parameters for GET requests
        if method == .GET, let parameters = parameters {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            components?.queryItems = parameters.map { key, value in
                URLQueryItem(name: key, value: String(describing: value))
            }
            url = components?.url ?? url
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("BookmarkableApp/1.0", forHTTPHeaderField: "User-Agent")
        
        // Add request body for POST/PUT requests
        if let body = body {
            do {
                request.httpBody = try encoder.encode(body)
            } catch {
                throw APIError.networkError(error)
            }
        }
        
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.unknownError
            }
            
            // Handle HTTP status codes
            switch httpResponse.statusCode {
            case 200...299:
                break
            case 401:
                throw APIError.unauthorized
            case 404:
                throw APIError.notFound
            case 409:
                // Handle conflict for duplicate bookmarks
                if let errorData = try? decoder.decode(BookmarkResponse.self, from: data) {
                    throw APIError.conflict(errorData.data.title)
                }
                throw APIError.conflict("Resource conflict")
            case 400...499:
                let message = String(data: data, encoding: .utf8) ?? "Client error"
                throw APIError.serverError(httpResponse.statusCode, message)
            case 500...599:
                let message = String(data: data, encoding: .utf8) ?? "Server error"
                throw APIError.serverError(httpResponse.statusCode, message)
            default:
                throw APIError.unknownError
            }
            
            // Decode response
            do {
                return try decoder.decode(responseType, from: data)
            } catch {
                print("Decoding error: \(error)")
                print("Response data: \(String(data: data, encoding: .utf8) ?? "Invalid UTF-8")")
                throw APIError.decodingError(error)
            }
            
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }
}

// MARK: - HTTP Methods
enum HTTPMethod: String {
    case GET = "GET"
    case POST = "POST"
    case PUT = "PUT"
    case DELETE = "DELETE"
}

// MARK: - API Service
@MainActor
class APIService: ObservableObject {
    static let shared = APIService()
    
    @Published var isLoading = false
    @Published var lastError: APIError?
    
    private let httpClient = HTTPClient.shared
    private let networkMonitor = NetworkMonitor()
    
    private init() {}
    
    // MARK: - Bookmark Endpoints
    
    func fetchBookmarks(
        query: String? = nil,
        tags: [String]? = nil,
        limit: Int = 50,
        offset: Int = 0
    ) async throws -> BookmarkListResponse {
        
        var parameters: [String: Any] = [
            "limit": limit,
            "offset": offset
        ]
        
        if let query = query, !query.isEmpty {
            parameters["q"] = query
        }
        
        if let tags = tags, !tags.isEmpty {
            parameters["tags"] = tags.joined(separator: ",")
        }
        
        isLoading = true
        defer { isLoading = false }
        
        do {
            let response = try await httpClient.request(
                endpoint: "bookmarks",
                method: .GET,
                parameters: parameters,
                responseType: BookmarkListResponse.self
            )
            lastError = nil
            return response
        } catch let error as APIError {
            lastError = error
            throw error
        }
    }
    
    func fetchRecentBookmarks(limit: Int = 10) async throws -> BookmarkListResponse {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let response = try await httpClient.request(
                endpoint: "bookmarks/recent",
                method: .GET,
                parameters: ["limit": limit],
                responseType: BookmarkListResponse.self
            )
            lastError = nil
            return response
        } catch let error as APIError {
            lastError = error
            throw error
        }
    }
    
    func fetchBookmark(id: Int) async throws -> BookmarkResponse {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let response = try await httpClient.request(
                endpoint: "bookmarks/\(id)",
                method: .GET,
                responseType: BookmarkResponse.self
            )
            lastError = nil
            return response
        } catch let error as APIError {
            lastError = error
            throw error
        }
    }
    
    func createBookmark(_ request: CreateBookmarkRequest) async throws -> BookmarkResponse {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let response = try await httpClient.request(
                endpoint: "bookmarks",
                method: .POST,
                body: request,
                responseType: BookmarkResponse.self
            )
            lastError = nil
            return response
        } catch let error as APIError {
            lastError = error
            throw error
        }
    }
    
    func updateBookmark(id: Int, request: UpdateBookmarkRequest) async throws -> BookmarkResponse {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let response = try await httpClient.request(
                endpoint: "bookmarks/\(id)",
                method: .PUT,
                body: request,
                responseType: BookmarkResponse.self
            )
            lastError = nil
            return response
        } catch let error as APIError {
            lastError = error
            throw error
        }
    }
    
    func deleteBookmark(id: Int) async throws {
        isLoading = true
        defer { isLoading = false }
        
        struct DeleteResponse: Codable {
            let success: Bool
            let message: String
        }
        
        do {
            let _ = try await httpClient.request(
                endpoint: "bookmarks/\(id)",
                method: .DELETE,
                responseType: DeleteResponse.self
            )
            lastError = nil
        } catch let error as APIError {
            lastError = error
            throw error
        }
    }
    
    // MARK: - Tag Endpoints
    
    func fetchTags() async throws -> TagsResponse {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let response = try await httpClient.request(
                endpoint: "bookmarks/tags",
                method: .GET,
                responseType: TagsResponse.self
            )
            lastError = nil
            return response
        } catch let error as APIError {
            lastError = error
            throw error
        }
    }
    
    // MARK: - Health Check
    
    func checkHealth() async throws -> Bool {
        struct HealthResponse: Codable {
            let status: String
            let timestamp: String
        }
        
        do {
            let _ = try await httpClient.request(
                endpoint: "health",
                method: .GET,
                responseType: HealthResponse.self
            )
            return true
        } catch {
            return false
        }
    }
    
    // MARK: - Configuration
    
    func updateServerURL(_ urlString: String) {
        APIConfiguration.shared.updateBaseURL(urlString)
    }
    
    var currentServerURL: String {
        APIConfiguration.shared.baseURL.absoluteString
    }
    
    var isNetworkAvailable: Bool {
        networkMonitor.isConnected
    }
}