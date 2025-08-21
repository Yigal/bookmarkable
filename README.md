# 📚 Bookmarkable - Advanced Bookmark Management System

> A powerful Chrome extension and web application for centralizing, organizing, and managing your bookmarks across all devices.

[![CI/CD Pipeline](https://github.com/Yigal/bookmarkable/workflows/CI/CD%20Pipeline/badge.svg)](https://github.com/Yigal/bookmarkable/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

## 🌟 Features

### Chrome Extension
- **🔖 One-click bookmark saving** with automatic metadata extraction
- **🏷️ Smart tagging system** for effortless organization
- **⌨️ Keyboard shortcuts** for power users (Ctrl+Shift+D, Ctrl+Shift+T)
- **📱 Context menu integration** for quick access
- **🔄 Real-time sync** with the web application
- **📊 Usage analytics** and bookmark insights
- **🌙 Dark mode support**

### Web Application
- **🌐 Beautiful web interface** for comprehensive bookmark management
- **🔍 Full-text search** across titles, URLs, and descriptions
- **🏷️ Tag-based filtering** and organization
- **📊 Statistics and analytics** dashboard
- **📥 Import/Export** functionality
- **📱 Responsive design** for all devices
- **⚡ Real-time performance monitoring**

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Chrome browser
- Git

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/Yigal/bookmarkable.git
cd bookmarkable
```

2. **Set up the web application:**
```bash
cd webapp
npm install
cp .env.example .env
npm run migrate:up
npm run dev
```

3. **Install the Chrome extension:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `extension` folder
   - The extension icon will appear in your Chrome toolbar

4. **Start using:**
   - Visit any webpage and click the Bookmarkable extension icon
   - Access your bookmarks at `http://localhost:3000`

## 🏗️ Architecture

### Technology Stack
- **Frontend:** HTML5, CSS3, JavaScript ES6+
- **Backend:** Node.js, Express.js
- **Database:** SQLite with migration system
- **Caching:** Redis with memory fallback
- **Testing:** Jest, Supertest
- **Security:** Helmet.js, Rate limiting, Input validation
- **Monitoring:** Winston logging, Performance metrics
- **Deployment:** Docker, GitHub Actions

### Project Structure
```
bookmarkable/
├── extension/              # Chrome Extension
│   ├── manifest.json      # Extension configuration
│   ├── background.js      # Service worker
│   ├── popup.js          # Extension UI
│   └── content.js        # Page interaction
├── webapp/               # Web Application
│   ├── server.js        # Express server
│   ├── routes/          # API endpoints
│   ├── config/          # Configuration files
│   ├── middleware/      # Express middleware
│   ├── migrations/      # Database migrations
│   ├── public/          # Frontend assets
│   └── __tests__/       # Test suites
├── .github/             # CI/CD workflows
└── docs/               # Documentation
```

## 🔧 Development

### Available Scripts

**Web Application:**
```bash
npm run dev              # Start development server
npm run start           # Start production server
npm run test            # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report
npm run lint            # Check code quality
npm run lint:fix        # Fix linting issues
npm run format          # Format code with Prettier
npm run migrate:up      # Run database migrations
npm run migrate:down    # Rollback migrations
npm run migrate:status  # Check migration status
```

**Quality Assurance:**
```bash
npm run quality         # Check code quality
npm run quality:fix     # Fix quality issues
```

### Environment Configuration

Create a `.env` file in the `webapp` directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DB_PATH=./data/bookmarks.db

# Security
SESSION_SECRET=your-secure-session-secret-here
CORS_ORIGINS=chrome-extension://,http://localhost:3000

# Cache (optional)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
LOG_FORMAT=dev

# Features
ENABLE_AUTH=false
ENABLE_ANALYTICS=false
ENABLE_EXPORT=true
```

## 📊 Monitoring & Health Checks

### Built-in Monitoring
- **Health Dashboard:** `http://localhost:3000/monitor.html`
- **API Health:** `GET /api/health`
- **Detailed Metrics:** `GET /api/health/detailed`
- **Performance Metrics:** `GET /api/metrics`
- **Cache Status:** `GET /api/cache/status`

### Performance Features
- **Response time monitoring** with P95/P99 tracking
- **Memory and CPU usage** monitoring
- **Database query optimization**
- **Redis caching** with intelligent fallback
- **Request correlation IDs** for debugging

## 🔒 Security Features

- **Rate limiting** (1000 requests per 15 minutes)
- **Input validation** and sanitization
- **SQL injection prevention** with parameterized queries
- **CORS configuration** for Chrome extension origins
- **Content Security Policy** headers
- **Helmet.js** security middleware
- **Brute force protection** with account lockout

## 🧪 Testing

The project includes comprehensive testing infrastructure:

- **Unit Tests:** Core functionality testing
- **Integration Tests:** API endpoint testing
- **Security Tests:** Vulnerability scanning
- **Performance Tests:** Load and stress testing

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:coverage
```

## 🚀 Deployment

### Docker Deployment (Recommended)

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Scale the application
docker-compose up -d --scale app=3
```

### Manual Deployment

See our comprehensive [Deployment Guide](DEPLOYMENT.md) for detailed instructions on:
- Local deployment
- Cloud deployment (Heroku, DigitalOcean, AWS)
- Docker containerization
- CI/CD pipeline setup
- Monitoring and maintenance

## 📈 Performance Benchmarks

- **Average Response Time:** < 100ms
- **P95 Response Time:** < 200ms
- **Memory Usage:** < 256MB
- **Cache Hit Rate:** > 90%
- **Database Query Time:** < 50ms

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following our coding standards
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Quality Standards

- **ESLint** for code linting
- **Prettier** for code formatting
- **Jest** for testing
- **Conventional Commits** for commit messages
- **Functional programming** principles

## 📚 API Documentation

### Bookmark Endpoints

```http
GET    /api/bookmarks              # Get all bookmarks
POST   /api/bookmarks              # Create bookmark
GET    /api/bookmarks/recent       # Get recent bookmarks
GET    /api/bookmarks/:id          # Get specific bookmark
PUT    /api/bookmarks/:id          # Update bookmark
DELETE /api/bookmarks/:id          # Delete bookmark
GET    /api/bookmarks/tags         # Get all tags
```

### Query Parameters

```http
GET /api/bookmarks?q=search&tags=javascript&limit=20&offset=0
```

## 🐛 Troubleshooting

### Common Issues

1. **Extension not working:**
   - Ensure web app is running on `http://localhost:3000`
   - Check Chrome extension permissions
   - Reload the extension in Chrome

2. **Database issues:**
   - Run `npm run migrate:up` to apply migrations
   - Check database file permissions
   - Verify SQLite installation

3. **API connection issues:**
   - Verify CORS configuration
   - Check firewall settings
   - Ensure correct port configuration

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Chrome Extension APIs
- Express.js framework
- SQLite database
- All our contributors and users

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/Yigal/bookmarkable/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Yigal/bookmarkable/discussions)
- **Security:** security@bookmarkable.com

---

**Made with ❤️ by the Bookmarkable Team**

**Star ⭐ this repository if you find it helpful!**