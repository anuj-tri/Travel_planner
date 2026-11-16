# Smart Travel Planner

An AI-powered travel planning application that helps users create, customize, and manage personalized travel itineraries with the help of Google Gemini and Google Maps.

## Overview

Smart Travel Planner is a full-stack web application designed to simplify the travel planning process. Users can create trips by providing their starting destination, ending destination, travel dates, number of travellers, budget, and travel preferences.

The application uses Google's Gemini API to generate personalized travel itineraries. Instead of providing just one itinerary, it generates three itinerary options for each day, allowing users to select the option that best matches their interests.

Users can save their selected itineraries, view their trips, and modify upcoming or ongoing trips while preserving their existing travel plans.

## Key Features

### 1. User Authentication and Security
- User registration and login.
- Secure password hashing using Argon2.
- RSA-based password encryption between the frontend and backend.
- JWT-based access token authentication.
- Refresh token rotation for maintaining user sessions.
- Refresh tokens stored as SHA-256 hashes in the database.
- Password reset through email verification.
- Change password and update profile functionality.
- Redis-based temporary reset-token storage with expiration and locking mechanisms.

### 2. AI-Powered Itinerary Generation
- Generate personalized itineraries using the Google Gemini API.
- Generate three itinerary options for each travel day.
- Customize itineraries based on user preferences, destinations, dates, and budget.
- Allow users to select one itinerary option per day.
- Save selected itinerary options to the database.

### 3. Google Maps Integration
- Google Places API integration for retrieving place coordinates.
- Google Maps integration for displaying itinerary locations.
- Store place information and coordinates in PostgreSQL.
- Reuse existing place records to avoid unnecessary Google Places API requests.

### 4. Trip Management
- Create and save trips.
- View saved trips and their itineraries.
- Categorize trips into All, Upcoming, Ongoing, and Missed.
- Modify trip details and travel preferences.
- Preview modified itineraries before saving changes.
- Update ongoing trips while preserving previously completed travel days.
- Extend or modify trip end dates and generate itineraries for additional days.

### 5. Database and Caching
- PostgreSQL for persistent application data.
- SQLAlchemy ORM for database operations.
- Alembic for database schema migrations.
- Redis for temporary data storage and caching.
- AWS ElastiCache Serverless Valkey for production caching.

## Technology Stack

 **Component**                                  **Technologies**
   Frontend                                 Angular 21, TypeScript, HTML, CSS
   Backend                                  Python 3.11, FastAPI
   Database                                 PostgreSQL
   ORM                                      SQLAlchemy
   Database Migrations                      Alembic
   AI Integration                           Google Gemini API
   Maps Integration                         Google Maps JavaScript API, Google Places API
   Authentication                           JWT, Argon2, RSA-OAEP
   Caching                                  Redis, AWS ElastiCache Valkey
   Email                                    Gmail SMTP
   Containerization                         Docker, Docker Compose
   Cloud Infrastructure                     AWS EC2, Amazon RDS, Amazon ECR, Amazon ElastiCache

## Application Architecture

The application follows a frontend-backend architecture.

1. **Angular Frontend:** Provides the user interface for authentication, trip creation, itinerary selection, and trip management.
2. **FastAPI Backend:** Handles business logic, authentication, trip operations, itinerary generation, and external API integrations.
3. **PostgreSQL:** Stores users, trips, preferences, itineraries, places, and refresh tokens.
4. **Redis / Valkey:** Handles temporary data such as password reset tokens and application caching.
5. **Google Gemini API:** Generates personalized travel itineraries.
6. **Google Places API:** Retrieves geographical information and coordinates for travel destinations.

## Project Structure

Travel_planner/
│
├── Backend/
│   ├── app/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── Schema/
│   │   ├── models.py
│   │   ├── database.py
│   │   ├── security.py
│   │   ├── redis_client.py
│   │   └── main.py
│   │
│   ├── alembic/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── generate_keys.py
│
├── FRONTEND/
│   └── smart-travel-planner/
│       ├── src/
│       ├── angular.json
│       ├── package.json
│       └── Dockerfile
│
├── docker-compose.yml
├── .gitignore
└── README.md

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Python 3.11
- Node.js and npm
- Angular CLI
- Docker Desktop
- Docker Compose
- PostgreSQL (optional when using Docker Compose)
- Google Gemini API key
- Google Maps API key

### 1. Clone the Repository

-> git clone <YOUR_GITHUB_REPOSITORY_URL>
-> cd Travel_planner

### 2. Configure Environment Variables

Create a `.env` file in the project root.

Configure the required environment variables for:

- PostgreSQL database credentials.
- JWT secret key.
- Gemini API key.
- Google Maps API key.
- Gmail SMTP credentials.
- RSA private and public key paths.
- Redis connection settings.
- Application environment configuration.

**Important:** Never commit `.env` files, API keys, passwords, private RSA keys, or other sensitive credentials.

### 3. Generate RSA Keys

Run the key-generation script from the Backend directory:

-->cd Backend
-->python generate_keys.py

Configure the RSA key paths through environment variables.

Keep private keys outside the Git repository.

### 4. Run Using Docker Compose

From the project root:

-> docker compose up --build -d


This starts the following services:
- PostgreSQL database.
- Redis server.
- FastAPI backend.
- Angular frontend served through Nginx.

### 5. Access the Application

  Service                                 Local URL
  Angular Frontend                        http://localhost:4200
  FastAPI Backend                         http://localhost:8000
  FastAPI Swagger Documentation           http://localhost:8000/docs
  PostgreSQL                              localhost:5433
  Redis                                   localhost:6379

To stop the application:

-> docker compose down

To stop the application and remove its Docker volumes:

-> docker compose down -v


**Warning:** The second command deletes the PostgreSQL Docker volume and its stored database data.

## Database Migrations

The project uses Alembic to manage PostgreSQL schema changes.

Check the current migration:

-> python -m alembic current

View migration history:

-> python -m alembic history


Apply pending migrations:

-> python -m alembic upgrade head

Run these commands from the Backend directory with the project's Python environment activated.

## Cloud Deployment

The application is deployed using AWS services.

 **AWS Service**                            **Purpose**
 Amazon EC2                                Hosts the containerized frontend and backend
 Amazon RDS for PostgreSQL                 Managed relational database
 Amazon ECR                                Stores Docker images
 Amazon ElastiCache Serverless Valkey      Managed Redis-compatible caching

Docker images are built and stored in Amazon ECR before being deployed on the EC2 instance.

The deployment workflow is designed to support automated builds and deployments through GitHub Actions.

## Security Considerations

- Passwords are hashed using Argon2 before database storage.
- RSA-OAEP with SHA-256 is used for application-level password encryption.
- JWT access tokens and rotating refresh tokens are used for session management.
- Refresh tokens are stored as hashes rather than plaintext.
- Password reset tokens are temporarily stored in Redis with expiration.
- Sensitive configuration and private keys are kept outside version control.

**Note:** Application-level RSA encryption does not replace HTTPS. HTTPS should be enabled in production to protect credentials and other data during network transmission.

## Future Enhancements

- Automated CI/CD pipeline using GitHub Actions.
- HTTPS and production-grade TLS configuration.
- Improved itinerary personalization.
- Additional travel and mapping integrations.
- Enhanced trip analytics and recommendations.

## Author

Developed as a full-stack project using Angular, FastAPI, PostgreSQL, Google Gemini, Google Maps, Redis, and AWS.

**Smart Travel Planner – Plan smarter. Travel better.**
