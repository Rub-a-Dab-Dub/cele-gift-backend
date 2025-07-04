# NestJS Entity Lifecycle Management System

A comprehensive entity lifecycle management system built with NestJS that provides advanced features for handling entity creation, updates, soft deletion, versioning, archiving, and audit trails.

## Features

### Core Lifecycle Management
- **Entity Creation**: Automated lifecycle event handling with validation
- **Entity Updates**: Version-controlled updates with change tracking
- **Soft Deletion**: Mark entities as deleted without permanent removal
- **Entity Restoration**: Restore soft-deleted entities
- **Entity Archiving**: Archive old entities with retention policies
- **Entity Locking**: Prevent modifications to critical entities

### Advanced Features
- **Audit Logging**: Complete audit trail for all entity operations
- **Versioning System**: Track all changes with version history
- **Event-Driven Architecture**: Subscriber-based lifecycle event handling
- **Bulk Operations**: Efficient bulk create, update, and delete operations
- **Data Consistency**: Transaction-based operations with validation
- **Performance Optimization**: Batched operations and indexed queries

### Technical Highlights
- **TypeORM Integration**: Advanced ORM features with custom subscribers
- **Event Emitter**: Decoupled event handling system
- **Transaction Management**: ACID compliance for complex operations
- **Validation Framework**: Entity-level and operation-level validation
- **Metadata Support**: Flexible metadata storage for entities
- **Cascading Operations**: Handle related entity operations

## Architecture

### Base Entity
All entities extend `BaseLifecycleEntity` which provides:
- Automatic timestamps (created, updated, deleted)
- Version tracking
- User tracking (who created/updated/deleted)
- Archive support
- Locking mechanism
- Metadata storage
- Lifecycle validation hooks

### Services Layer
- **LifecycleService**: Core lifecycle operations
- **AuditService**: Audit logging and trail management
- **VersioningService**: Entity versioning and history
- **ArchivingService**: Entity archiving and retention

### Event System
- **Lifecycle Events**: Entity created, updated, deleted, restored, archived
- **Event Subscribers**: TypeORM-based database event handling
- **Event Listeners**: Application-level event processing

## Installation

\`\`\`bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npm run migration:run

# Start the application
npm run start:dev
\`\`\`

## Environment Variables

\`\`\`env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=lifecycle_db
NODE_ENV=development
\`\`\`

## Usage Examples

### Creating an Entity
\`\`\`typescript
const user = await lifecycleService.create(User, {
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe'
}, {
  userId: 'admin-id',
  reason: 'User registration',
  isMajorVersion: true
});
\`\`\`

### Updating with Version Control
\`\`\`typescript
const updatedUser = await lifecycleService.update(User, userId, {
  firstName: 'Jane'
}, {
  userId: 'admin-id',
  reason: 'Profile update',
  isMajorVersion: false
});
\`\`\`

### Bulk Operations
\`\`\`typescript
const result = await lifecycleService.bulkCreate(User, [
  { email: 'user1@example.com', firstName: 'User', lastName: 'One' },
  { email: 'user2@example.com', firstName: 'User', lastName: 'Two' }
], {
  userId: 'admin-id',
  reason: 'Bulk import'
});
\`\`\`

### Audit Trail
\`\`\`typescript
const auditTrail = await auditService.getAuditTrail('User', userId);
\`\`\`

### Version History
\`\`\`typescript
const versions = await versioningService.getVersionHistory('User', userId);
const comparison = await versioningService.compareVersions('User', userId, 1, 2);
\`\`\`

## API Endpoints

### Users
- `POST /users` - Create user
- `GET /users` - List active users
- `GET /users/:id` - Get user by ID
- `PATCH /users/:id` - Update user
- `DELETE /users/:id` - Soft delete user
- `POST /users/:id/restore` - Restore deleted user
- `POST /users/:id/archive` - Archive user
- `POST /users/:id/lock` - Lock user
- `POST /users/:id/unlock` - Unlock user
- `GET /users/:id/audit-trail` - Get audit trail
- `GET /users/:id/versions` - Get version history
- `POST /users/bulk` - Bulk create users

### Products
- `POST /products` - Create product
- `GET /products` - List active products
- `GET /products/:id` - Get product by ID
- `PATCH /products/:id` - Update product
- `PATCH /products/:id/stock` - Update stock
- `DELETE /products/:id` - Soft delete product
- `POST /products/:id/restore` - Restore deleted product
- `POST /products/:id/archive` - Archive product
- `GET /products/category/:category` - Get products by category
- `GET /products/low-stock` - Get low stock products
- `POST /products/bulk/prices` - Bulk update prices

## Database Schema

The system uses PostgreSQL with the following key tables:
- `users` - User entities with lifecycle fields
- `products` - Product entities with lifecycle fields
- `audit_logs` - Complete audit trail
- `entity_versions` - Version history
- `entity_archives` - Archived entity data

## Performance Considerations

### Indexing Strategy
- Composite indexes on entity type and ID
- Time-based indexes for audit queries
- User-based indexes for activity tracking

### Batch Processing
- Configurable batch sizes for bulk operations
- Parallel processing with error handling
- Memory-efficient streaming for large datasets

### Transaction Management
- Nested transactions for complex operations
- Rollback support for failed operations
- Connection pooling optimization

## Testing

\`\`\`bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
\`\`\`

## Monitoring and Observability

The system provides comprehensive logging and monitoring:
- Entity operation metrics
- Performance tracking
- Error rate monitoring
- Audit trail analytics

## Security Features

- User-based operation tracking
- IP address and user agent logging
- Entity locking for critical operations
- Validation at multiple levels
- Secure soft deletion

## Scalability

The system is designed for high-scale operations:
- Efficient bulk operations
- Optimized database queries
- Event-driven architecture
- Horizontal scaling support
- Caching integration ready

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License.
