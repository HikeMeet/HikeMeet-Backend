
# Hikemeet Backend Setup and Usage Guide

This guide explains how to set up and use the backend code for the Hikemeet project. It covers cloning the repository, installing dependencies, configuring MongoDB and Firebase for both production and staging environments, and managing environment variables.

# General Explanation

The Hikemeet backend is a robust application built with Node.js and Express, designed to support a social platform for hikers. It handles user authentication, trip management, group interactions, notifications, and image uploads. The architecture leverages a MongoDB database for data persistence and Firebase for authentication and other services. The application is containerized using Docker and deployed using Kubernetes, ensuring scalability and easy management across different environments.
## Features

- 🏎️ **Runtime & Framework:** Node.js, Express.js  
- 🛠️ **Language & Tooling:** TypeScript, ts-node, nodemon, ESLint, Prettier  
- 💾 **Database & ORM:** MongoDB Atlas, Mongoose  
- 🔒 **Authentication & Notifications:** Firebase Admin SDK, Expo Server SDK  
- 🖼️ **File & Media Handling:** Cloudinary, Multer  
- ⏰ **Background Jobs & Scheduling:** node-cron  
- 📊 **Logging & Monitoring:** Winston, Morgan  
- ✉️ **Email Service:** Nodemailer (Gmail SMTP)  
- 🔑 **Security & Configuration:** dotenv, JSON Web Tokens  
- 🐳 **Containerization & Orchestration:** Docker, Kubernetes (Deployments, Services, Ingress)  
- 🚀 **CI/CD Pipelines:** GitHub Actions (build, test, deploy)  

## Prerequisites

### Make sure you have the following installed on your system:

- Node.js (v16.x or higher)
- npm
- MongoDB (one for production, one for staging)
- Firebase project (one for production, one for staging)
- Git
## How to Run

### 1. Clone the Repository

```bash
git clone <repository_url>
cd <repository_name>
```
### 2.  Install Dependencies

```bash
npm install
```



### 3. Configure MongoDB

**Create two MongoDB databases:**

#### 1.  **Production Database**: This will hold production data.
#### 2.  **Staging Database**: This will hold staging data.

### For MongoDB Atlas:

#### 1.  Log in to MongoDB Atlas.
#### 2.  Create two clusters/databases, one for `production` and one for `staging`.
#### 3.  Obtain the connection strings for both databases.

Update the `.env` file with these connection strings.

### 4. Configure Firebase

**Set up two Firebase projects:**

#### 1.  **Production Firebase Project**
    * Go to the [Firebase Console](https://console.firebase.google.com).
    * Create a new project for production.
    * Add an app (Web/Android/iOS as required).
    * Obtain the service account key JSON file and download it.
#### 2.  **Staging Firebase Project**
    * Repeat the same steps to create a staging project.

Update the `.env` file to include Firebase configuration for both projects.

### 5. Environments
#### .env
```env
NODE_ENV=local  # Use 'local', 'stage', or 'prod'
```

#### .env.local / .env.prod 


```markdown
PORT=

# MongoDB
MONGO_URI=

# Firebase
FIREBASE_TYPE=
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_CLIENT_ID=
FIREBASE_AUTH_URI=
FIREBASE_TOKEN_URI=
FIREBASE_AUTH_PROVIDER_CERT_URL=
FIREBASE_CLIENT_CERT_URL=

# Cloudinary (Optional, if using image upload)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Mailer (Optional, if using email services)
MAILER_EMAIL=
MAILER_PASSWORD=
```

#### Switching Environments
Update the NODE_ENV value in .env to either local, stage, or prod.
```bash
NODE_ENV=prod
```

### 6. Start the Server

To run the server in different environments:

- **Local Environment:**
  ```bash
  npm run dev
  ```
- **Production  Environment:**
  ```bash
  npm start
  ```
## How it Works on Servers (Deployment)

The Hikemeet backend is designed for deployment in containerized environments, primarily using Docker and Kubernetes.

- **Docker**  
  Uses a `Dockerfile` (Node.js 20) to:
  1. Install dependencies  
  2. Build the TypeScript code  
  3. Expose port `3000`  
  4. Run the app with `npm start`

- **Kubernetes**  
  Includes the following manifests:
  - **`hikemeet.yaml`**  
    - Deployment: 3 replicas of `wooozai/hikemeet:latest`  
    - Env via Secret `hikemeet-secrets`  
    - ClusterIP Service on port 80 → 3000  
  - **`hikemeet-ingress.yaml`**  
    - NGINX Ingress routing HTTP/HTTPS to `hikemeet-service`  
    - SSL redirect, host `hikemeet.com`, TLS secret  
  - **`hikemeet-secrets.example.yaml`**  
    - Example Secret for sensitive env vars (MongoDB URI, Firebase keys, Cloudinary, mailer)  
  - **`mongo-service.yaml`**  
    - ExternalName Service pointing to your MongoDB Atlas cluster

- **Deployment Steps**  
  1. Create/update your Kubernetes Secrets (or `.env.*` files).  
  2. Apply manifests:
     ```bash
     kubectl apply -f kubernetes/hikemeet-secrets.example.yaml
     kubectl apply -f kubernetes/hikemeet.yaml
     kubectl apply -f kubernetes/mongo-service.yaml
     kubectl apply -f kubernetes/hikemeet-ingress.yaml
     
     ```
  3. Ensure you’re using the correct environment (`.env.prod` for production, `.env.stage` for staging).
## Troubleshooting

* **MongoDB Connection Issues:**
    * Ensure the correct connection string is provided.
    * Verify network access rules in MongoDB Atlas.
* **Firebase Authentication Issues:**
    * Ensure the Firebase service account key is correctly configured.
    * Verify project permissions in the Firebase Console.
## Badges

Add badges from somewhere like: [shields.io](https://shields.io/)

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![GPLv3 License](https://img.shields.io/badge/License-GPL%20v3-yellow.svg)](https://opensource.org/licenses/)
[![AGPL License](https://img.shields.io/badge/license-AGPL-blue.svg)](http://www.gnu.org/licenses/agpl-3.0)

