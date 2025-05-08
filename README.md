# Super-Meta: SQLite Database Platform powered by Supabase

Super-Meta is a multi-tenant database platform that enables users to create, manage, and interact with SQLite databases through a modern web interface. Built on Supabase's infrastructure, it provides a seamless experience for database creation, querying, and real-time monitoring.

## Architecture

### Frontend (Next.js)
- **Admin Dashboard**: Real-time monitoring of platform metrics
  - Total egress tracking
  - Database size monitoring
  - API request analytics
  - Real-time updates for system changes

- **User Dashboard**: Database management interface
  - Database creation and management
  - SQL query interface
  - API key management
  - Connection string access
  - Usage statistics

### Backend (Supabase)
- **Edge Functions**: Serverless compute layer
  - Database operations via WebAssembly (sql.js)
  - Secure API key generation and management
  - Real-time updates processing
  - Ephemeral storage management for database operations

- **Storage**: SQLite file management
  - Secure storage of SQLite database files
  - Version control and backup management
  - Efficient file transfer for query operations

- **Real-time Updates**: Live system monitoring
  - API request tracking
  - Database change notifications
  - System metrics updates

## Features

### Database Management
- Create and manage SQLite databases
- Secure storage in Supabase
- Automated backup and versioning
- Usage monitoring and quotas

### API Access
- Unique connection strings per database
- Secure API key generation
- Rate limiting and access control
- Documentation and usage examples

### Query Interface
- Web-based SQL query editor
- Query history and saved queries
- Results visualization
- Performance metrics

### Admin Features
- Platform-wide monitoring
- User management
- Resource usage tracking
- System health metrics

## Demo Application: Chess Database

The platform includes a demonstration chess application that showcases the capabilities of Super-Meta:

- SQLite database populated with chess positions
- Real-time position lookup
- Move validation against database
- Usage tracking and analytics
- Web interface for interactive gameplay

### Chess Demo Features
- Position database integration
- Real-time database queries
- Move validation
- Usage statistics tracking
- Interactive web interface

## Getting Started

[Documentation for setup and deployment will be added]

## Technical Stack

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Supabase Edge Functions, WebAssembly (sql.js)
- **Storage**: Supabase Storage
- **Database**: SQLite (user databases), PostgreSQL (metadata)
- **Real-time**: Supabase Real-time

## License

[License information to be added]
