import SwiftUI

struct ContentView: View {
    @State private var selectedTab = 0
    @StateObject private var bookmarkStore = BookmarkStore()
    @StateObject private var syncService = SyncService()
    
    var body: some View {
        TabView(selection: $selectedTab) {
            BookmarksListView()
                .tabItem {
                    Image(systemName: "bookmark.fill")
                    Text("Bookmarks")
                }
                .tag(0)
            
            SearchView()
                .tabItem {
                    Image(systemName: "magnifyingglass")
                    Text("Search")
                }
                .tag(1)
            
            TagsView()
                .tabItem {
                    Image(systemName: "tag.fill")
                    Text("Tags")
                }
                .tag(2)
            
            SettingsView()
                .tabItem {
                    Image(systemName: "gear")
                    Text("Settings")
                }
                .tag(3)
        }
        .environmentObject(bookmarkStore)
        .environmentObject(syncService)
        .onAppear {
            // Initial sync when app loads
            Task {
                await syncService.performSync()
            }
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environment(\.managedObjectContext, PersistenceController.preview.container.viewContext)
    }
}