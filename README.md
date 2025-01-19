<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Backend Setup and Usage Guide</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0 20px;
            background-color: #f9f9f9;
            color: #333;
        }
        h1, h2, h3 {
            color: #555;
        }
        pre, code {
            background: #eee;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
        }
        pre {
            margin: 20px 0;
        }
        a {
            color: #007BFF;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        ul {
            padding-left: 20px;
        }
        .section {
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <h1>Backend Setup and Usage Guide</h1>

  <p>This guide explains how to set up and use the backend code for your project.It covers cloning the repository, installing dependencies, configuring MongoDBand Firebase for both production and staging environments, and managingenvironment variables.</p>
  <hr>
  <div class="section">
      <h2>Prerequisites</h2>
      <p>Make sure you have the following installed on your system:</p>
      <ul>
          <li>Node.js (v16.x or higher)</li>
          <li>npm or yarn</li>
          <li>MongoDB (self-hosted or cloud-based like MongoDB Atlas)</li>
          <li>Firebase project (one for production, one for staging)</li>
          <li>Git</li>
      </ul>
  </div>
  <hr>
  <div class="section">
      <h2>Steps to Set Up the Backend</h2>
      <h3>1. Clone the Repository</h3>
      <pre><code>git clone &lt;repository_url&gt;
c &lt;repository_name&gt;</code></pre>
      <h3>2. Install Dependencies</h3>
      <pre><code>npm install</code></pre>
      <h3>3. Configure MongoDB</h3>
      <p><strong>Create two MongoDB databases:</strong></p>
      <ol>
          <li><strong>Production Database</strong>: This will hold production data</li>
          <li><strong>Staging Database</strong>: This will hold staging data.</li>
      </ol>
      <p>For MongoDB Atlas:</p>
      <ol>
          <li>Log in to MongoDB Atlas.</li>
          <li>Create two clusters/databases, one for <code>production</code> andone for <code>staging</code>.</li>
          <li>Obtain the connection strings for both databases.</li>
      </ol>
      <p>Update the <code>.env</code> file with these connection strings.</p>
      <h3>4. Configure Firebase</h3>
      <p><strong>Set up two Firebase projects:</strong></p>
      <ol>
          <li><strong>Production Firebase Project</strong>
              <ul>
                  <li>Go to the <a href="https://console.firebase.googlecom">Firebase Console</a>.</li>
                  <li>Create a new project for production.</li>
                  <li>Add an app (Web/Android/iOS as required).</li>
                  <li>Obtain the service account key JSON file and download it.</li>
              </ul>
          </li>
          <li><strong>Staging Firebase Project</strong>
              <ul>
                  <li>Repeat the same steps to create a staging project.</li>
              </ul>
          </li>
      </ol>
      <p>Update the <code>.env</code> file to include Firebase configuration forboth projects.</p>
      <h3>5. Set Up Environment Variables</h3>
      <p>This project uses <code>.env</code> files to manage environment variables</p>
      <ul>
          <li><strong>.env.local</strong>: For local development</li>
          <li><strong>.env.prod</strong>: For production environment</li>
      </ul>
      <h4>Sample <code>.env</code> File Structure:</h4>
      <pre><code># General

PORT=5000
NODE_ENV=local # Use 'local' or 'prod'

# MongoDB

MONGO_URI_LOCAL=mongodb://localhost:27017/local_db
MONGO_URI_PROD=&lt;production_mongo_uri&gt;
MONGO_URI_STAGE=&lt;staging_mongo_uri&gt;

# Firebase

FIREBASE_PROJECT_ID=&lt;firebase_project_id&gt;
FIREBASE_PRIVATE_KEY=&lt;firebase_private_key&gt;
FIREBASE_CLIENT_EMAIL=&lt;firebase_client_email&gt;</code></pre>

<h4>Switching Environments</h4> <p>Update the <code>NODE_ENV</code> value in <code>.env</code> to either <code>local</code>, <code>stage</code>, or <code>prod</code>. For example:</p> <pre><code>NODE_ENV=prod</code></pre
<h3>6. Start the Server</h3> <p>To run the server in different environments:</p> <ul> <li><strong>Local Environment:</strong> <pre><code>npm run dev</code></pre> </li> <li><strong>Production Environment:</strong> <pre><code>npm start</code></pre> </li> <li><strong>Staging Environment:</strong> Switch the <code>.env</code> file to staging values and run: <pre><code>npm start</code></pre> </li> </ul
<h3>7. Directory Structure</h3> <pre><code>src/ models/ # MongoDB schemas routes/ # API endpoints controllers/ # Business logic config/ # Configuration files (e.g., Firebase, MongoDB) middlewares/ # Middleware functions utils/ # Utility functions</code></pre> </div
<hr
<div class="section"> <h2>Deployment</h2> <p>To deploy the application:</p> <ol> <li>Ensure all environment variables are correctly configured.</li> <li>Deploy to your hosting service (e.g., AWS, Heroku, Vercel).</li> <li>For production, use the <code>.env.prod</code> file. For staging, use a <code>.env.stage</code> file.</li> </ol> </div
<hr
<div class="section"> <h2>Troubleshooting</h2> <ul> <li><strong>MongoDB Connection Issues:</strong> <ul> <li>Ensure the correct connection string is provided.</li> <li>Verify network access rules in MongoDB Atlas.</li> </ul> </li> <li><strong>Firebase Authentication Issues:</strong> <ul> <li>Ensure the Firebase service account key is correctly configured.</li> <li>Verify project permissions in the Firebase Console.</li> </ul> </li> </ul> </div>

  <hr>

  <p>Happy coding!</p>
</body>
</html>
