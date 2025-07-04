# Celebrity Dashboard API

A high-performance NestJS API system for celebrity analytics with real-time metrics, trending analysis, and comprehensive dashboard capabilities.

## Features

### 🚀 Core Capabilities
- **Real-time Metrics**: Live data streaming with WebSocket connections
- **Advanced Analytics**: Trending analysis with forecasting algorithms
- **Time-series Storage**: Optimized PostgreSQL with TimescaleDB support
- **Multi-format Export**: Excel, PDF, and CSV export capabilities
- **Custom Dashboards**: Configurable layouts and widgets
- **Caching Strategy**: Redis-based multi-layer caching
- **Background Processing**: Bull queue for heavy operations

### 📊 Dashboard Features
- Aggregated metrics across multiple platforms
- Real-time data visualization
- Comparative analysis with industry benchmarks
- Anomaly detection for unusual patterns
- Custom widget configurations
- Responsive design support

### 🔧 Technical Highlights
- **Database**: PostgreSQL with optimized indexing
- **Caching**: Redis for high-performance data retrieval
- **Real-time**: Socket.IO for live updates
- **Queue System**: Bull for background job processing
- **Documentation**: Swagger/OpenAPI integration
- **Monitoring**: Comprehensive logging and metrics

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Docker (optional)

### Installation

1. **Clone the repository**
\`\`\`bash
git clone <repository-url>
cd celebrity-dashboard-api
\`\`\`

2. **Install dependencies**
\`\`\`bash
npm install
\`\`\`

3. **Environment setup**
\`\`\`bash
cp .env.example .env
# Edit .env with your configuration
\`\`\`

4. **Database setup**
\`\`\`bash
# Run PostgreSQL and Redis
docker-compose up -d postgres redis

# Run database migrations
npm run migration:run
\`\`\`

5. **Start the application**
\`\`\`bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
\`\`\`

### Docker Deployment

\`\`\`bash
# Build and run all services
docker-compose up -d

# View logs
docker-compose logs -f app
\`\`\`

## API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/health

## Key Endpoints

### Dashboard
- `GET /dashboard` - Get aggregated dashboard data
- `GET /dashboard/custom/:configId` - Get custom dashboard
- `POST /dashboard/export` - Request data export
- `POST /dashboard/config` - Create dashboard configuration

### Real-time
- WebSocket connection: `ws://localhost:3000`
- Subscribe to celebrity updates
- Receive live metric streams

## Performance Optimizations

### Database
- **Indexing Strategy**: Multi-column indexes on frequently queried fields
- **Time-series Optimization**: Partitioning by timestamp
- **Query Optimization**: Efficient aggregation queries
- **Connection Pooling**: Optimized connection management

### Caching
- **Multi-layer Caching**: Application and database level
- **Cache Invalidation**: Smart invalidation strategies
- **TTL Management**: Configurable time-to-live settings

### Real-time Processing
- **WebSocket Optimization**: Efficient connection management
- **Data Streaming**: Optimized real-time data flow
- **Background Jobs**: Async processing for heavy operations

## Architecture

\`\`\`
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   Load Balancer │    │      CDN        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                        NestJS API                               │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Dashboard     │    Metrics      │       Trending              │
│   Service       │    Service      │       Service               │
├─────────────────┼─────────────────┼─────────────────────────────┤
│   Export        │   Time-series   │       Cache                 │
│   Service       │   Service       │       Service               │
└─────────────────┴─────────────────┴─────────────────────────────┘
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │      Redis      │    │   Bull Queue    │
│   (TimescaleDB) │    │    (Cache)      │    │  (Background)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
\`\`\`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379 |
| `PORT` | Application port | 3000 |
| `NODE_ENV` | Environment | development |

### Dashboard Configuration

\`\`\`typescript
{
  "layout": {
    "columns": 3,
    "rows": 4,
    "responsive": true
  },
  "widgets": [
    {
      "type": "metric_card",
      "position": {"x": 0, "y": 0},
      "config": {"metric": "followers"}
    }
  ],
  "filters": {
    "timeRange": "30d",
    "platforms": ["instagram", "twitter"]
  }
}
\`\`\`

## Monitoring & Observability

### Logging
- Structured logging with Winston
- Request/response logging
- Error tracking and alerting
- Performance metrics

### Health Checks
- Database connectivity
- Redis availability
- External API status
- Queue system health

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
