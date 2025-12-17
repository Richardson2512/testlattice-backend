# TestLattice Frontend

AI-powered frontend testing platform with comprehensive UI testing capabilities.

## Features

- 🎨 Modern Next.js 14+ application with App Router
- 🔐 Supabase authentication (login/signup)
- 📊 Real-time test run dashboard
- 🎥 Video recording and screenshot capture
- 📈 Comprehensive test reports with AI insights
- 🎯 Multi-page and exploratory testing modes
- 🎨 Beautiful beige and maroon design theme

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: CSS Modules + Global CSS
- **Authentication**: Supabase Auth
- **API Client**: Custom fetch-based client
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Richardson2512/testlattice.git
cd testlattice
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── components/         # React components
│   ├── dashboard/          # Dashboard page
│   ├── login/              # Login page
│   ├── signup/             # Signup page
│   ├── test/               # Test pages
│   │   ├── report/         # Test report viewer
│   │   └── run/            # Test run viewer
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   └── globals.css         # Global styles
├── lib/                    # Utility libraries
│   ├── api.ts              # API client
│   └── supabase/           # Supabase client setup
└── middleware.ts           # Next.js middleware
```

## Features Overview

### Dashboard
- View all test runs
- Create new projects
- Start new test runs
- Filter by project
- Real-time status updates

### Test Reports
- Comprehensive test results
- Screenshot gallery
- Video playback
- AI-generated insights
- Downloadable ZIP reports

### Authentication
- Secure login/signup with Supabase
- Protected routes
- Session management

## Development

### Build for Production

```bash
npm run build
npm start
```

### Environment Variables

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:3001)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is part of the TestLattice platform.
