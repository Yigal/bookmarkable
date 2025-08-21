import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    
    // MARK: - Properties
    private var titleTextField: UITextField!
    private var descriptionTextView: UITextView!
    private var tagsTextField: UITextField!
    private var urlLabel: UILabel!
    private var saveButton: UIButton!
    private var cancelButton: UIButton!
    
    private var extractedURL: String = ""
    private var extractedTitle: String = ""
    private var extractedDescription: String = ""
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        extractSharedContent()
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        view.backgroundColor = UIColor.systemBackground
        
        // Navigation setup
        navigationItem.title = "Save Bookmark"
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: "Cancel",
            style: .plain,
            target: self,
            action: #selector(cancelTapped)
        )
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            title: "Save",
            style: .done,
            target: self,
            action: #selector(saveTapped)
        )
        
        setupContentView()
    }
    
    private func setupContentView() {
        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        
        let contentView = UIView()
        contentView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentView)
        
        // URL section
        let urlHeaderLabel = createHeaderLabel(text: "URL")
        urlLabel = createValueLabel()
        urlLabel.numberOfLines = 0
        urlLabel.font = UIFont.systemFont(ofSize: 14)
        urlLabel.textColor = UIColor.secondaryLabel
        
        // Title section
        let titleHeaderLabel = createHeaderLabel(text: "Title")
        titleTextField = createTextField(placeholder: "Enter bookmark title")
        
        // Description section
        let descriptionHeaderLabel = createHeaderLabel(text: "Description")
        descriptionTextView = createTextView(placeholder: "Enter description (optional)")
        
        // Tags section
        let tagsHeaderLabel = createHeaderLabel(text: "Tags")
        tagsTextField = createTextField(placeholder: "Enter tags separated by commas")
        
        // Stack view
        let stackView = UIStackView(arrangedSubviews: [
            urlHeaderLabel,
            urlLabel,
            createSpacer(height: 20),
            titleHeaderLabel,
            titleTextField,
            createSpacer(height: 20),
            descriptionHeaderLabel,
            descriptionTextView,
            createSpacer(height: 20),
            tagsHeaderLabel,
            tagsTextField
        ])
        
        stackView.axis = .vertical
        stackView.spacing = 8
        stackView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(stackView)
        
        // Constraints
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            contentView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.widthAnchor),
            
            stackView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 20),
            stackView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            stackView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            stackView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -20),
            
            descriptionTextView.heightAnchor.constraint(equalToConstant: 100)
        ])
    }
    
    // MARK: - UI Helpers
    
    private func createHeaderLabel(text: String) -> UILabel {
        let label = UILabel()
        label.text = text
        label.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
        label.textColor = UIColor.label
        return label
    }
    
    private func createValueLabel() -> UILabel {
        let label = UILabel()
        label.font = UIFont.systemFont(ofSize: 14)
        label.textColor = UIColor.secondaryLabel
        label.numberOfLines = 0
        return label
    }
    
    private func createTextField(placeholder: String) -> UITextField {
        let textField = UITextField()
        textField.placeholder = placeholder
        textField.borderStyle = .roundedRect
        textField.font = UIFont.systemFont(ofSize: 16)
        return textField
    }
    
    private func createTextView(placeholder: String) -> UITextView {
        let textView = UITextView()
        textView.font = UIFont.systemFont(ofSize: 16)
        textView.layer.borderColor = UIColor.systemGray4.cgColor
        textView.layer.borderWidth = 1
        textView.layer.cornerRadius = 8
        textView.textContainerInset = UIEdgeInsets(top: 8, left: 8, bottom: 8, right: 8)
        
        // Add placeholder
        textView.text = placeholder
        textView.textColor = UIColor.placeholderText
        textView.delegate = self
        
        return textView
    }
    
    private func createSpacer(height: CGFloat) -> UIView {
        let spacer = UIView()
        spacer.translatesAutoresizingMaskIntoConstraints = false
        spacer.heightAnchor.constraint(equalToConstant: height).isActive = true
        return spacer
    }
    
    // MARK: - Content Extraction
    
    private func extractSharedContent() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let itemProvider = extensionItem.attachments?.first else {
            return
        }
        
        // Try to get URL first
        if itemProvider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            itemProvider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (item, error) in
                if let url = item as? URL {
                    DispatchQueue.main.async {
                        self?.extractedURL = url.absoluteString
                        self?.urlLabel.text = url.absoluteString
                        self?.extractMetadataFromURL(url)
                    }
                }
            }
        }
        // Fallback to plain text
        else if itemProvider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            itemProvider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (item, error) in
                if let text = item as? String {
                    DispatchQueue.main.async {
                        self?.extractedURL = text
                        self?.urlLabel.text = text
                        if let url = URL(string: text) {
                            self?.extractMetadataFromURL(url)
                        }
                    }
                }
            }
        }
        // Try property list for web page
        else if itemProvider.hasItemConformingToTypeIdentifier("public.url") {
            itemProvider.loadItem(forTypeIdentifier: "public.url", options: nil) { [weak self] (item, error) in
                if let data = item as? Data,
                   let plist = try? PropertyListSerialization.propertyList(from: data, options: [], format: nil) as? [String: Any] {
                    
                    DispatchQueue.main.async {
                        if let urlString = plist["URL"] as? String {
                            self?.extractedURL = urlString
                            self?.urlLabel.text = urlString
                            if let url = URL(string: urlString) {
                                self?.extractMetadataFromURL(url)
                            }
                        }
                        
                        if let title = plist["Title"] as? String {
                            self?.extractedTitle = title
                            self?.titleTextField.text = title
                        }
                    }
                }
            }
        }
    }
    
    private func extractMetadataFromURL(_ url: URL) {
        // Extract basic info from URL
        if extractedTitle.isEmpty {
            extractedTitle = url.host ?? "Untitled"
            titleTextField.text = extractedTitle
        }
        
        // Try to fetch page metadata
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let data = data,
                  let html = String(data: data, encoding: .utf8) else {
                return
            }
            
            let title = self?.extractTitle(from: html) ?? self?.extractedTitle ?? ""
            let description = self?.extractDescription(from: html) ?? ""
            
            DispatchQueue.main.async {
                if !title.isEmpty && self?.titleTextField.text?.isEmpty == true {
                    self?.titleTextField.text = title
                    self?.extractedTitle = title
                }
                
                if !description.isEmpty {
                    self?.extractedDescription = description
                    if self?.descriptionTextView.textColor == UIColor.placeholderText {
                        self?.descriptionTextView.text = description
                        self?.descriptionTextView.textColor = UIColor.label
                    }
                }
            }
        }.resume()
    }
    
    private func extractTitle(from html: String) -> String? {
        let titlePattern = "<title[^>]*>([^<]+)</title>"
        guard let regex = try? NSRegularExpression(pattern: titlePattern, options: [.caseInsensitive]) else {
            return nil
        }
        
        let range = NSRange(location: 0, length: html.utf16.count)
        if let match = regex.firstMatch(in: html, options: [], range: range),
           let titleRange = Range(match.range(at: 1), in: html) {
            return String(html[titleRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        
        return nil
    }
    
    private func extractDescription(from html: String) -> String? {
        let patterns = [
            "<meta[^>]*name=['\"]?description['\"]?[^>]*content=['\"]?([^'\"]+)['\"]?[^>]*>",
            "<meta[^>]*property=['\"]?og:description['\"]?[^>]*content=['\"]?([^'\"]+)['\"]?[^>]*>"
        ]
        
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
                continue
            }
            
            let range = NSRange(location: 0, length: html.utf16.count)
            if let match = regex.firstMatch(in: html, options: [], range: range),
               let descRange = Range(match.range(at: 1), in: html) {
                return String(html[descRange]).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        
        return nil
    }
    
    // MARK: - Actions
    
    @objc private func cancelTapped() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
    
    @objc private func saveTapped() {
        guard !extractedURL.isEmpty,
              let title = titleTextField.text, !title.isEmpty else {
            showAlert(title: "Error", message: "Please enter a title for the bookmark.")
            return
        }
        
        let description = descriptionTextView.textColor == UIColor.placeholderText ? "" : descriptionTextView.text ?? ""
        let tagsString = tagsTextField.text ?? ""
        let tags = tagsString.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        
        saveBookmark(url: extractedURL, title: title, description: description, tags: tags)
    }
    
    private func saveBookmark(url: String, title: String, description: String, tags: [String]) {
        // Create bookmark data
        let bookmarkData: [String: Any] = [
            "title": title,
            "url": url,
            "description": description,
            "tags": tags,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        // Save to shared container for main app to process
        if let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.bookmarkable.shared") {
            let bookmarksURL = containerURL.appendingPathComponent("pending_bookmarks.json")
            
            var pendingBookmarks: [[String: Any]] = []
            
            // Load existing pending bookmarks
            if let existingData = try? Data(contentsOf: bookmarksURL),
               let existingBookmarks = try? JSONSerialization.jsonObject(with: existingData) as? [[String: Any]] {
                pendingBookmarks = existingBookmarks
            }
            
            // Add new bookmark
            pendingBookmarks.append(bookmarkData)
            
            // Save back to file
            do {
                let data = try JSONSerialization.data(withJSONObject: pendingBookmarks)
                try data.write(to: bookmarksURL)
                
                showSuccessAndClose()
            } catch {
                showAlert(title: "Error", message: "Failed to save bookmark. Please try again.")
            }
        } else {
            showAlert(title: "Error", message: "Failed to save bookmark. Please try again.")
        }
    }
    
    private func showSuccessAndClose() {
        let alert = UIAlertController(title: "Success", message: "Bookmark saved successfully!", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in
            self?.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        })
        present(alert, animated: true)
    }
    
    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

// MARK: - UITextViewDelegate

extension ShareViewController: UITextViewDelegate {
    func textViewDidBeginEditing(_ textView: UITextView) {
        if textView.textColor == UIColor.placeholderText {
            textView.text = ""
            textView.textColor = UIColor.label
        }
    }
    
    func textViewDidEndEditing(_ textView: UITextView) {
        if textView.text.isEmpty {
            textView.text = "Enter description (optional)"
            textView.textColor = UIColor.placeholderText
        }
    }
}