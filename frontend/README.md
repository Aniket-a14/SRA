# SRA Frontend

The frontend interface for the Software Requirements Analyst (SRA) system. Built with Next.js 15, it provides a modern, interactive dashboard for generating and viewing software requirements.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Components**: [Shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- **State/Forms**: React Hook Form, Zod
- **Visuals**: Framer Motion (Animations), Lucide React (Icons), Mermaid.js (Diagrams)

## ✨ Features

- **Dashboard**: Central hub for managing analyses.
- **New Analysis**: Interactive chat-like input for generating requirements.
- **Detailed Results**: Tabbed view for Requirements, User Stories, Diagrams, and APIs.
- **History**: View past analyses.
- **Authentication**: User login and registration pages.
- **Responsive Design**: Fully optimized for desktop and mobile.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Backend running on port 3000 (default)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file:

    | Variable | Description | Required |
    | :--- | :--- | :--- |
    | `NEXT_PUBLIC_BACKEND_URL` | URL of the backend API (e.g., `http://localhost:3000`). | Yes |

3. Start the development server:
   ```bash
   npm run dev
   ```

   The app will be available at [http://localhost:3001](http://localhost:3001).

## 📂 Project Structure

```
SRA/
├── app/              # Next.js App Router pages
│   ├── (auth)/       # Authentication routes (login, register)
│   ├── (dashboard)/  # Protected dashboard routes
│   └── page.tsx      # Landing page
├── components/       # React components
│   ├── ui/           # Reusable UI primitives (buttons, inputs)
│   └── ...           # Feature-specific components
├── lib/              # Utilities and helper functions
├── hooks/            # Custom React hooks
└── package.json
```
