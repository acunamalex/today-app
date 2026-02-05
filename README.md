# Today - Route Planner App

A modern route planning application for field workers to plan daily visits, collect data at each stop, and generate comprehensive reports.

## Features

- **Route Planning**: Add addresses, optimize routes, and visualize on a map
- **Customizable Questions**: Create custom questions for each visit
- **Data Collection**: Multiple input types (text, multiple choice, photos, signatures, ratings)
- **Offline Support**: Full offline capability with automatic sync
- **Reports**: AI-powered executive summaries with PDF/CSV export
- **Manager Dashboard**: Team oversight with real-time tracking

## Tech Stack

### Web App
- React 18 + TypeScript + Vite
- Tailwind CSS
- Zustand (state management)
- Dexie.js (IndexedDB)
- Leaflet + OpenRouteService (mapping)
- jsPDF (PDF export)

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd today-app
```

2. Install dependencies:
```bash
cd web
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Get a free API key from [OpenRouteService](https://openrouteservice.org/dev/#/signup) and add it to `.env`:
```
VITE_ORS_API_KEY=your_api_key_here
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
today-app/
├── web/                      # React Web App
│   ├── src/
│   │   ├── components/       # UI Components
│   │   │   ├── common/       # Shared components
│   │   │   ├── auth/         # Authentication
│   │   │   ├── route/        # Route planning
│   │   │   ├── questions/    # Question builder
│   │   │   └── ...
│   │   ├── hooks/            # Custom hooks
│   │   ├── stores/           # Zustand stores
│   │   ├── services/         # API services
│   │   ├── pages/            # Page components
│   │   ├── db/               # IndexedDB setup
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # Utility functions
│   └── ...
└── ios/                      # iOS App (Phase 2)
```

## Usage

### For Field Workers

1. **Create Account**: Set up a 4-digit passcode
2. **Plan Your Day**: Add addresses for the day's visits
3. **Optimize Route**: Let the app optimize your route order
4. **Configure Questions**: Set up questions to answer at each stop
5. **Start Route**: Navigate between stops
6. **Complete Visits**: Fill out forms at each location
7. **View Reports**: See AI-generated summaries and export

### For Managers

1. **Access Dashboard**: View team routes and progress
2. **Monitor Live**: See active workers and their locations
3. **Review Reports**: Access completed daily reports

## Offline Support

The app works fully offline:
- All data is stored locally in IndexedDB
- Changes are queued for sync when back online
- Map tiles are cached for offline viewing

## API Keys

The app uses free APIs:
- **OpenRouteService**: Route optimization (2,000 free requests/day)
- **Nominatim**: Address geocoding (1 request/second)

## License

MIT

## Support

For questions or issues, please open a GitHub issue.
