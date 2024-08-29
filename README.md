# Claude Desktop App

A desktop application that provides faster access to Claude. A customizable key combination opens Claude from any screen on your desktop.

## Features

- Quick access to Claude via global shortcut
- Customizable global hotkey
- Adjustable window sizes
- Auto-updates

## Installation

Download the latest release for your macOS from the [releases](https://github.com/patrick-pc/castgpt/releases) page.

## Usage

1. Launch the application
2. Set your preferred global hotkey
3. Use the hotkey to quickly access Claude from anywhere on your system

## Development

### Prerequisites

- Node.js (v14 or later recommended)
- npm or yarn

### Setup

1. Clone the repository:
   ```
   git clone https://github.com/patrick-pc/castgpt.git
   cd castgpt
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

### Building

To build the application for production:

```
npm run build
```

### Publishing

To publish a new release:

```
npm run publish
```

## Configuration

The application uses `electron-store` for persistent configuration. You can modify the default settings in the `schema` object within `index.js`.

## Auto-Updates

The application supports auto-updates using `electron-updater`. Updates are checked every 10 minutes when the app is running in production mode.

## Notarization

For macOS builds, the application is notarized using `@electron/notarize`. Make sure to set up the following environment variables:

- `APPLE_ID`
- `APPLE_ID_PASSWORD`
- `APPLE_TEAM_ID`

## Contributing

Contributions are welcome! Please feel free to submit a PR.

## License

This project is licensed under the MIT License.