# Backend Setup

## Prerequisites

- Node.js and npm
- Python 3
- MongoDB

## Installation

1.  Install Node.js dependencies:
    ```bash
    npm install
    ```

2.  Create a `.env` file in the `backend` directory with the following variables:
    ```
    MONGODB_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret
    ```

3.  Install Python dependencies. It is recommended to use a virtual environment.
    ```bash
    cd backend
    python3 -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    pip install -r requirements.txt
    ```

## Running the server

```bash
npm run dev
``` 