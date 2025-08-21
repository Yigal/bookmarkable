import SwiftUI
import SafariServices

struct BookmarkDetailView: View {
    @ObservedObject var bookmark: BookmarkItem
    @EnvironmentObject var bookmarkStore: BookmarkStore
    @Environment(\.dismiss) private var dismiss
    
    @State private var isEditing = false
    @State private var editedTitle = ""
    @State private var editedDescription = ""
    @State private var editedTags: [String] = []
    @State private var showingSafari = false
    @State private var isDeleting = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Header with favicon and domain
                    headerView
                    
                    // Main content
                    if isEditing {
                        editingView
                    } else {
                        detailView
                    }
                    
                    // Action buttons
                    if !isEditing {
                        actionButtonsView
                    }
                }
                .padding()
            }
            .navigationTitle(isEditing ? "Edit Bookmark" : "Bookmark")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(isEditing ? "Cancel" : "Done") {
                        if isEditing {
                            cancelEditing()
                        } else {
                            dismiss()
                        }
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    if isEditing {
                        Button("Save") {
                            Task {
                                await saveChanges()
                            }
                        }
                        .disabled(editedTitle.isEmpty)
                    } else {
                        Button("Edit") {
                            startEditing()
                        }
                    }
                }
            }
            .onAppear {
                setupInitialValues()
            }
            .sheet(isPresented: $showingSafari) {
                SafariView(url: URL(string: bookmark.data.url)!)
            }
            .alert("Delete Bookmark", isPresented: $isDeleting) {
                Button("Delete", role: .destructive) {
                    Task {
                        await deleteBookmark()
                    }
                }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("Are you sure you want to delete this bookmark? This action cannot be undone.")
            }
        }
    }
    
    // MARK: - Subviews
    
    private var headerView: some View {
        HStack(spacing: 16) {
            // Favicon
            AsyncImage(url: URL(string: bookmark.data.favicon ?? "")) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fit)
            } placeholder: {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(.systemGray4))
                    .overlay(
                        Image(systemName: "globe")
                            .foregroundColor(.secondary)
                    )
            }
            .frame(width: 48, height: 48)
            .cornerRadius(8)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(bookmark.data.domain)
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text(bookmark.data.url)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            Spacer()
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
    
    private var detailView: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Title
            VStack(alignment: .leading, spacing: 8) {
                Text("Title")
                    .font(.headline)
                    .foregroundColor(.secondary)
                
                Text(bookmark.data.title)
                    .font(.title2)
                    .fontWeight(.semibold)
            }
            
            // Description
            if let description = bookmark.data.description, !description.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Description")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    
                    Text(description)
                        .font(.body)
                }
            }
            
            // Tags
            if !bookmark.data.tags.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Tags")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    
                    LazyVGrid(columns: [
                        GridItem(.adaptive(minimum: 80), spacing: 8)
                    ], spacing: 8) {
                        ForEach(bookmark.data.tags, id: \.id) { tag in
                            Text(tag.name)
                                .font(.caption)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color(hex: tag.displayColor)?.opacity(0.2) ?? Color.accentColor.opacity(0.2))
                                .foregroundColor(Color(hex: tag.displayColor) ?? .accentColor)
                                .cornerRadius(12)
                        }
                    }
                }
            }
            
            // Metadata
            VStack(alignment: .leading, spacing: 12) {
                Text("Information")
                    .font(.headline)
                    .foregroundColor(.secondary)
                
                VStack(spacing: 8) {
                    metadataRow(title: "Created", value: bookmark.data.formattedCreatedDate.formatted())
                    metadataRow(title: "Last Updated", value: bookmark.data.formattedUpdatedDate.formatted())
                    
                    if bookmark.data.visitCount > 0 {
                        metadataRow(title: "Visit Count", value: "\(bookmark.data.visitCount)")
                    }
                    
                    if let lastVisited = bookmark.data.lastVisitedDate {
                        metadataRow(title: "Last Visited", value: lastVisited.formatted())
                    }
                }
            }
        }
    }
    
    private var editingView: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Title editing
            VStack(alignment: .leading, spacing: 8) {
                Text("Title")
                    .font(.headline)
                    .foregroundColor(.secondary)
                
                TextField("Enter title", text: $editedTitle)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
            }
            
            // Description editing
            VStack(alignment: .leading, spacing: 8) {
                Text("Description")
                    .font(.headline)
                    .foregroundColor(.secondary)
                
                TextField("Enter description (optional)", text: $editedDescription, axis: .vertical)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .lineLimit(3...6)
            }
            
            // Tags editing
            VStack(alignment: .leading, spacing: 8) {
                Text("Tags")
                    .font(.headline)
                    .foregroundColor(.secondary)
                
                TagEditor(tags: $editedTags)
            }
        }
    }
    
    private var actionButtonsView: some View {
        VStack(spacing: 12) {
            // Primary actions
            HStack(spacing: 12) {
                Button(action: {
                    showingSafari = true
                }) {
                    HStack {
                        Image(systemName: "safari")
                        Text("Open in Safari")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.accentColor)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                
                Button(action: {
                    shareBookmark()
                }) {
                    HStack {
                        Image(systemName: "square.and.arrow.up")
                        Text("Share")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color(.systemGray5))
                    .foregroundColor(.primary)
                    .cornerRadius(12)
                }
            }
            
            // Destructive action
            Button(action: {
                isDeleting = true
            }) {
                HStack {
                    Image(systemName: "trash")
                    Text("Delete Bookmark")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.red.opacity(0.1))
                .foregroundColor(.red)
                .cornerRadius(12)
            }
        }
    }
    
    private func metadataRow(title: String, value: String) -> some View {
        HStack {
            Text(title)
                .font(.subheadline)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.subheadline)
        }
        .padding(.vertical, 2)
    }
    
    // MARK: - Actions
    
    private func setupInitialValues() {
        editedTitle = bookmark.data.title
        editedDescription = bookmark.data.description ?? ""
        editedTags = bookmark.data.tagNames
    }
    
    private func startEditing() {
        setupInitialValues()
        isEditing = true
    }
    
    private func cancelEditing() {
        setupInitialValues()
        isEditing = false
    }
    
    private func saveChanges() async {
        do {
            await bookmarkStore.updateBookmark(
                bookmark,
                title: editedTitle,
                description: editedDescription.isEmpty ? nil : editedDescription,
                tags: editedTags
            )
            isEditing = false
        } catch {
            // Handle error - could show an alert
            print("Error updating bookmark: \(error)")
        }
    }
    
    private func deleteBookmark() async {
        do {
            await bookmarkStore.deleteBookmark(bookmark)
            dismiss()
        } catch {
            // Handle error - could show an alert
            print("Error deleting bookmark: \(error)")
        }
    }
    
    private func shareBookmark() {
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

// MARK: - Tag Editor
struct TagEditor: View {
    @Binding var tags: [String]
    @State private var newTag = ""
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Current tags
            if !tags.isEmpty {
                LazyVGrid(columns: [
                    GridItem(.adaptive(minimum: 80), spacing: 8)
                ], spacing: 8) {
                    ForEach(tags, id: \.self) { tag in
                        HStack(spacing: 4) {
                            Text(tag)
                                .font(.caption)
                            
                            Button(action: {
                                tags.removeAll { $0 == tag }
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
            }
            
            // Add new tag
            HStack {
                TextField("Add tag", text: $newTag)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .onSubmit {
                        addTag()
                    }
                
                Button(action: addTag) {
                    Image(systemName: "plus")
                        .foregroundColor(.accentColor)
                }
                .disabled(newTag.isEmpty)
            }
        }
    }
    
    private func addTag() {
        let trimmedTag = newTag.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedTag.isEmpty && !tags.contains(trimmedTag) {
            tags.append(trimmedTag)
            newTag = ""
        }
    }
}

// MARK: - Safari View
struct SafariView: UIViewControllerRepresentable {
    let url: URL
    
    func makeUIViewController(context: Context) -> SFSafariViewController {
        return SFSafariViewController(url: url)
    }
    
    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {
        // No updates needed
    }
}

struct BookmarkDetailView_Previews: PreviewProvider {
    static var previews: some View {
        let sampleBookmark = BookmarkItem(data: BookmarkData(
            id: 1,
            title: "Apple Developer Documentation",
            url: "https://developer.apple.com",
            description: "Official Apple developer resources and documentation",
            favicon: "https://developer.apple.com/favicon.ico",
            tags: [
                TagData(id: 1, name: "development", color: "#3b82f6", bookmarkCount: 5),
                TagData(id: 2, name: "apple", color: "#ef4444", bookmarkCount: 3)
            ],
            createdAt: "2024-01-01T12:00:00.000Z",
            updatedAt: "2024-01-01T12:00:00.000Z",
            isArchived: false,
            visitCount: 5,
            lastVisited: "2024-01-01T12:00:00.000Z"
        ))
        
        BookmarkDetailView(bookmark: sampleBookmark)
            .environmentObject(BookmarkStore())
    }
}