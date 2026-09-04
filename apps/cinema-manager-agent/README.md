# Cinema Manager Agent

A Windows service that monitors video files and synchronizes them with the Cinema Manager cloud backend.

## Features

- **File Monitoring**: Watches specified directories for new video files
- **Smart Detection**: Identifies video files (MP4, MKV, AVI, MOV, etc.) and processes metadata
- **Cloud Sync**: Automatically syncs discovered movies to DynamoDB
- **Windows Service**: Runs as a background service for continuous monitoring
- **MSI Installer**: Easy deployment via Windows installer package

## Installation

### Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the application:
   ```bash
   npm run build
   ```

3. Run in development mode:
   ```bash
   npm run dev
   ```

### Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Install as Windows service:
   ```bash
   npm run install-service
   ```

3. Start the service:
   ```bash
   npm run start-service
   ```

## Configuration

The agent requires AWS credentials to connect to DynamoDB:

### Environment Variables

Set the following environment variables:

- `AWS_REGION`: AWS region (default: us-east-1)
- `AWS_ACCESS_KEY_ID`: Your AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key

### Watch Directories

By default, the agent monitors:
- `C:\Users\Public\Videos`
- `C:\Users\{username}\Downloads`
- `C:\Users\{username}\Videos`

Additional directories can be configured via the DynamoDB configuration table.

## Service Management

### Install Service
```bash
npm run install-service
```

### Uninstall Service
```bash
npm run uninstall-service
```

### Start Service
```bash
npm run start-service
```

### Stop Service
```bash
npm run stop-service
```

## Building MSI Installer

To create an MSI installer for distribution:

```bash
npm run build-installer
```

The installer will be created in the `dist-installer` directory.

## Architecture

- **FileWatcher**: Monitors directories using chokidar
- **MovieProcessor**: Extracts metadata from video files
- **DynamoDbClient**: Handles cloud database operations
- **WindowsService**: Manages service lifecycle

## Troubleshooting

### Service Won't Start
1. Check AWS credentials are configured
2. Verify DynamoDB table exists
3. Check Windows Event Viewer for detailed error logs

### Files Not Being Detected
1. Ensure watch directories exist and are accessible
2. Check file permissions
3. Verify file size is above 100MB threshold

## Logs

- Service logs: Windows Event Viewer → Applications and Services Logs
- Console logs: When running in development mode
