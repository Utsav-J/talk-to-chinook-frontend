# Chinook Data Speech Agent - Frontend

A modern React + TypeScript frontend application for the Chinook Data Speech Agent. This application provides a clean, intuitive interface for interacting with the SQL agent that can query the Chinook database.

## Features

- 🗨️ **Chat Interface**: Clean, modern chat UI with message history
- 📝 **Thread Management**: Create, list, and delete conversation threads
- 🔄 **Real-time Updates**: Automatic message loading and thread synchronization
- ⚠️ **Error Handling**: Comprehensive error handling with user-friendly notifications
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Clean, professional design with smooth animations

## Prerequisites

- Node.js 18+ and npm
- Backend API server running (see API_USAGE.md for backend setup)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API URL (optional):**
   
   Create a `.env` file in the root directory:
   ```env
   VITE_API_BASE_URL=http://localhost:8000
   ```
   
   If not set, defaults to `http://localhost:8000`

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   
   Navigate to `http://localhost:5173` (or the port shown in terminal)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/          # React components
│   ├── ChatInterface.tsx      # Main chat UI
│   ├── ThreadSidebar.tsx      # Thread list sidebar
│   └── ErrorNotification.tsx  # Error toast notifications
├── services/
│   └── api.ts          # API client service
├── types/
│   └── api.ts          # TypeScript type definitions
├── config.ts            # Configuration (API URL)
├── App.tsx              # Main app component
└── main.tsx             # Application entry point
```

## API Integration

This frontend integrates with all endpoints documented in `API_USAGE.md`:

- ✅ Health check
- ✅ Create thread
- ✅ List threads (with pagination)
- ✅ Get thread metadata
- ✅ Get thread messages
- ✅ Send chat message
- ✅ Delete thread

## Usage

1. **Start a Conversation:**
   - Click the "+ New" button in the sidebar to create a new thread
   - Or simply start typing - a thread will be created automatically

2. **Chat with the Agent:**
   - Type your message and press Enter (or Shift+Enter for new line)
   - The agent will respond based on your query
   - First, tell the agent your name (e.g., "im frank harris")

3. **Manage Threads:**
   - Click on any thread in the sidebar to view its messages
   - Click the 🗑️ icon to delete a thread
   - Threads are sorted by last activity (most recent first)

## Error Handling

The application includes comprehensive error handling:

- **Network Errors**: Displayed as toast notifications
- **API Errors**: Show specific error messages from the backend
- **Timeout Errors**: Handled gracefully with retry options
- **Loading States**: Visual indicators during API calls

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8000` |

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development

The project uses:
- **React 19** with TypeScript
- **Vite** for build tooling
- **CSS Modules** for styling
- **Modern ES6+** features

## License

MIT
