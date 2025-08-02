# API Endpoints Documentation

This document outlines all the API endpoints available in the PrintToPoint backend. Endpoints are categorized by their primary user role and then by resource.

**Base URL:** `http://localhost:5000/api` (or your deployed API base URL)

---

## 1. Admin Endpoints (`/api/admin`)

These endpoints are accessible by administrators and typically require an `admin` role token for authentication.

### Authentication & Management

- **POST `/api/admin/create-admin`**

  - **Description:** Creates a new admin user.
  - **Authentication:** None (initial admin creation)
  - **Request Body:**

    ```json
    {
      "name": "string",
      "email": "string",
      "password": "string"
    }
    ```

- **POST `/api/admin/login`**

  - **Description:** Logs in an admin user and returns a JWT token.
  - **Authentication:** None
  - **Request Body:**

    ```json
    {
      "email": "string",
      "password": "string"
    }
    ```

### Customer Management

- **GET `/api/admin/customers`**
  - **Description:** Retrieves a list of all customers.
  - **Authentication:** Admin Token
- **GET `/api/admin/customers/:id`**
  - **Description:** Retrieves details of a specific customer by ID.
  - **Authentication:** Admin Token
  - **Path Parameters:** `id` (Customer ID)
- **DELETE `/api/admin/customers/:id`**
  - **Description:** Deletes a customer by ID.
  - **Authentication:** Admin Token
  - **Path Parameters:** `id` (Customer ID)
- **PUT `/api/admin/customers/:id`**

  - **Description:** Updates details of a specific customer by ID.
  - **Authentication:** Admin Token
  - **Path Parameters:** `id` (Customer ID)
  - **Request Body:** (Partial update, e.g.)

    ```json
    {
      "full_name": "string",
      "email": "string"
    }
    ```

### Print Agent Management

- **GET `/api/admin/print-agents`**
  - **Description:** Retrieves a list of all print agents.
  - **Authentication:** Admin Token
- **GET `/api/admin/print-agents/:id`**
  - **Description:** Retrieves details of a specific print agent by ID.
  - **Authentication:** Admin Token
  - **Path Parameters:** `id` (Print Agent ID)
- **DELETE `/api/admin/print-agents/:id`**
  - **Description:** Deletes a print agent by ID.
  - **Authentication:** Admin Token
  - **Path Parameters:** `id` (Print Agent ID)
- **PUT `/api/admin/print-agents/:id`**

  - **Description:** Updates details of a specific print agent by ID.
  - **Authentication:** Admin Token
  - **Path Parameters:** `id` (Print Agent ID)
  - **Request Body:** (Partial update, e.g.)

    ```json
    {
      "business_name": "string",
      "is_available": "boolean"
    }
    ```

### Location Management

- **POST `/api/admin/locations`**

  - **Description:** Creates a new supported location for print agents.
  - **Authentication:** Admin Token
  - **Request Body:**

    ```json
    {
      "city": "string",
      "state": "string",
      "zip_code": "string",
      "country": "string"
    }
    ```

- **GET `/api/admin/locations`**
  - **Description:** Retrieves a list of all supported locations.
  - **Authentication:** Admin Token
- **GET `/api/admin/locations/:id`**
  - **Description:** Retrieves details of a specific location by ID, populated with associated print agents.
  - **Authentication:** Admin Token
  - **Path Parameters:** `id` (Location ID)
- **DELETE `/api/admin/locations/:id`**
  - **Description:** Deletes a location by ID and deactivates associated print agents.
  - **Authentication:** Admin Token
  - **Path Parameters:** `id` (Location ID)
- **PUT `/api/admin/locations/:id`**

  - **Description:** Updates details of a specific location by ID and deactivates associated print agents.
  - **Authentication:** Admin Token
  - **Path Parameters:** `id` (Location ID)
  - **Request Body:** (Partial update, e.g.)

    ```json
    {
      "city": "string",
      "state": "string",
      "zip_code": "string",
      "country": "string"
    }
    ```

### Print Job Management

- **GET `/api/admin/print-jobs`**
  - **Description:** Retrieves a list of all print jobs, populated with customer and print agent details.
  - **Authentication:** Admin Token
- **POST `/api/admin/print-jobs/:id`**

  - **Description:** Updates the `agent_payment_status` of a specific print job.
  - **Authentication:** Admin Token
  - **Path Parameters:** `id` (Print Job ID)
  - **Request Body:**

    ```json
    {
        "agent_payment_status": "string" (e.g., "paid", "pending")
    }
    ```

### Ticket Management

- **GET `/api/admin/tickets`**
  - **Description:** Retrieves a list of all customer support tickets.
  - **Authentication:** Admin Token
- **POST `/api/admin/tickets/:id`**

  - **Description:** Updates the status of a specific ticket.
  - **Authentication:** Admin Token
  - **Path Parameters:** `id` (Ticket ID)
  - **Request Body:**

    ```json
    {
        "status": "string" (e.g., "resolved", "pending")
    }
    ```

---

## 2. Customer Endpoints (`/api/customer` and `/api/auth/customer`)

These endpoints are accessible by customers and typically require a `customer` role token for authentication, unless specified.

### Authentication

- **POST `/api/auth/customer/signup`**

  - **Description:** Registers a new customer and sends an OTP for email verification.
  - **Authentication:** None
  - **Request Body:**

    ```json
    {
      "email": "string",
      "password": "string",
      "full_name": "string"
    }
    ```

- **POST `/api/auth/customer/verify-otp`**

  - **Description:** Verifies the OTP sent to the customer's email.
  - **Authentication:** None
  - **Request Body:**

    ```json
    {
      "email": "string",
      "otp": "string"
    }
    ```

- **POST `/api/auth/customer/login`**

  - **Description:** Logs in a customer and returns a JWT token.
  - **Authentication:** None
  - **Request Body:**

    ```json
    {
      "email": "string",
      "password": "string"
    }
    ```

- **POST `/api/auth/customer/resend-otp`**

  - **Description:** Resends the OTP for email verification.
  - **Authentication:** None
  - **Request Body:**

    ```json
    {
      "email": "string"
    }
    ```

- **POST `/api/auth/customer/forgot-password`**

  - **Description:** Initiates the forgot password process by sending an OTP to the customer's email.
  - **Authentication:** None
  - **Request Body:**

    ```json
    {
      "email": "string"
    }
    ```

- **POST `/api/auth/customer/reset-password`**

  - **Description:** Resets the customer's password using the provided OTP.
  - **Authentication:** None
  - **Request Body:**

    ```json
    {
      "email": "string",
      "otp": "string",
      "password": "string"
    }
    ```

### Card Management

- **POST `/api/customer/create-card`**

  - **Description:** Adds a new payment card for the customer.
  - **Authentication:** Customer Token
  - **Request Body:**

    ```json
    {
      "card": {
        "bank_name": "string",
        "card_number": "string",
        "expiry_date": "string (MM/YY)",
        "phone_number": "string",
        "cvv": "string"
      }
    }
    ```

- **GET `/api/customer/get-cards`**
  - **Description:** Retrieves all saved payment cards for the customer.
  - **Authentication:** Customer Token
- **GET `/api/customer/get-card/:cardId`**
  - **Description:** Retrieves details of a specific payment card by ID.
  - **Authentication:** Customer Token
  - **Path Parameters:** `cardId` (Card ID)
- **DELETE `/api/customer/delete-card/:cardId`**
  - **Description:** Deletes a specific payment card by ID.
  - **Authentication:** Customer Token
  - **Path Parameters:** `cardId` (Card ID)
- **PUT `/api/customer/update-card/:cardId`**

  - **Description:** Updates details of a specific payment card by ID. Allows partial updates.
  - **Authentication:** Customer Token
  - **Path Parameters:** `cardId` (Card ID)
  - **Request Body:** (Partial update, e.g.)

    ```json
    {
      "bank_name": "string",
      "card_number": "string",
      "expiry_date": "string (MM/YY)",
      "phone_number": "string",
      "cvv": "string"
    }
    ```

### Location & Print Agent Discovery

- **POST `/api/customer/add-location`**

  - **Description:** Adds or updates the customer's location.
  - **Authentication:** Customer Token
  - **Request Body:**

    ```json
    {
      "location": {
        "city": "string",
        "state": "string",
        "zip_code": "string",
        "country": "string"
      }
    }
    ```

- **GET `/api/customer/available-print-agents`**
  - **Description:** Retrieves a list of available print agents.
  - **Authentication:** Customer Token

### Ticket Submission

- **POST `/api/customer/create-ticket`**

  - **Description:** Creates a new customer support ticket.
  - **Authentication:** Customer Token
  - **Request Body:**

    ```json
    {
      "full_name": "string",
      "email": "string",
      "order_number": "string (optional)",
      "message": "string",
      "bank": {
        "bank_name": "string",
        "bank_number": "string",
        "full_name_bank": "string"
      }
    }
    ```

---

## 3. Print Agent Endpoints (`/api/print-agent` and `/api/auth/print-agent`)

These endpoints are accessible by print agents and typically require a `printAgent` role token for authentication, unless specified.

### Authentication

- **POST `/api/auth/print-agent/signup`**

  - **Description:** Registers a new print agent and sends an OTP for email verification.
  - **Authentication:** None
  - **Request Body:**

    ```json
    {
      "email": "string",
      "password": "string",
      "full_name": "string",
      "business_name": "string",
      "business_type": "string",
      "zip_code": "string"
    }
    ```

- **POST `/api/auth/print-agent/verify-otp`**

  - **Description:** Verifies the OTP sent to the print agent's email.
  - **Authentication:** None
  - **Request Body:**

    ```json
    {
      "email": "string",
      "otp": "string"
    }
    ```

- **POST `/api/auth/print-agent/login`**

  - **Description:** Logs in a print agent and returns a JWT token.
  - **Authentication:** None
  - **Request Body:**

    ```json
    {
      "email": "string",
      "password": "string"
    }
    ```

- **POST `/api/auth/print-agent/resend-otp`**

  - **Description:** Resends the OTP for email verification.
  - **Authentication:** None
  - **Request Body:**

    ```json
    {
      "email": "string"
    }
    ```

- **POST `/api/auth/print-agent/forgot-password`**

  - **Description:** Initiates the forgot password process by sending an OTP to the print agent's email.
  - **Authentication:** None
  - **Request Body:**

    ```json
    {
      "email": "string"
    }
    ```

- **POST `/api/auth/print-agent/reset-password`**

  - **Description:** Resets the print agent's password using the provided OTP.
  - **Authentication:** None
  - **Request Body:**

    ```json
    {
      "email": "string",
      "otp": "string",
      "password": "string"
    }
    ```

### Profile & Financial Management

- **POST `/api/print-agent/additional-info`**

  - **Description:** Adds or updates additional personal and location information for the print agent, including an optional payment card.
  - **Authentication:** Print Agent Token
  - **Request Body:**

    ```json
    {
      "personal_info": {
        "dob": "string (YYYY-MM-DD)",
        "gender": "string"
      },
      "location": {
        "city": "string",
        "state": "string",
        "zip_code": "string",
        "country": "string"
      },
      "personal_phone_number": "string",
      "card": {
        "bank_name": "string",
        "card_number": "string",
        "expiry_date": "string (MM/YY)",
        "phone_number": "string",
        "cvv": "string"
      }
    }
    ```

- **GET `/api/print-agent/check-connect-account`**
  - **Description:** Checks if the print agent has a connected Stripe account and its status.
  - **Authentication:** Print Agent Token
- **GET `/api/print-agent/create-connect-account`**
  - **Description:** Creates a Stripe Connect account for the print agent and returns an onboarding URL.
  - **Authentication:** Print Agent Token
- **POST `/api/print-agent/create-card`**

  - **Description:** Adds a new payment card for the print agent.
  - **Authentication:** Print Agent Token
  - **Request Body:**

    ```json
    {
      "card": {
        "bank_name": "string",
        "card_number": "string",
        "expiry_date": "string (MM/YY)",
        "phone_number": "string",
        "cvv": "string"
      }
    }
    ```

- **GET `/api/print-agent/get-cards`**
  - **Description:** Retrieves all saved payment cards for the print agent.
  - **Authentication:** Print Agent Token
- **GET `/api/print-agent/get-card/:cardId`**
  - **Description:** Retrieves details of a specific payment card by ID.
  - **Authentication:** Print Agent Token
  - **Path Parameters:** `cardId` (Card ID)
- **DELETE `/api/print-agent/delete-card/:cardId`**
  - **Description:** Deletes a specific payment card by ID.
  - **Authentication:** Print Agent Token
  - **Path Parameters:** `cardId` (Card ID)
- **PUT `/api/print-agent/update-card/:cardId`**

  - **Description:** Updates details of a specific payment card by ID. Allows partial updates.
  - **Authentication:** Print Agent Token
  - **Path Parameters:** `cardId` (Card ID)
  - **Request Body:** (Partial update, e.g.)

    ```json
    {
      "bank_name": "string",
      "card_number": "string",
      "expiry_date": "string (MM/YY)",
      "phone_number": "string",
      "cvv": "string"
    }
    ```

- **POST `/api/print-agent/add-location`**

  - **Description:** Adds or updates the print agent's location, ensuring it's a supported location.
  - **Authentication:** Print Agent Token
  - **Request Body:**

    ```json
    {
      "location": {
        "city": "string",
        "state": "string",
        "zip_code": "string",
        "country": "string"
      }
    }
    ```

### Availability & Reporting

- **GET `/api/print-agent/online-status`**
  - **Description:** Sends an OTP to the print agent's email to toggle their online/offline status.
  - **Authentication:** Print Agent Token
- **GET `/api/print-agent/status-otp/:otp`**
  - **Description:** Verifies the OTP to toggle the print agent's online/offline status.
  - **Authentication:** Print Agent Token
  - **Path Parameters:** `otp` (OTP received via email)
  - **Response:** Returns the new availability status
    ```json
    {
      "message": "Availability updated successfully",
      "is_available": true,
      "status": "online"
    }
    ```
- **GET `/api/print-agent/all-customers`**
  - **Description:** Retrieves a list of all customers associated with the print agent's jobs.
  - **Authentication:** Print Agent Token
- **GET `/api/print-agent/summary`**
  - **Description:** Provides a summary of the print agent's performance (total orders, customers, revenue, etc.).
  - **Authentication:** Print Agent Token
- **GET `/api/print-agent/if-online`**
  - **Description:** Checks if the print agent is currently online or offline.
  - **Authentication:** Print Agent Token
  - **Response:**
    ```json
    {
      "message": "Status retrieved successfully",
      "is_available": true,
      "status": "online"
    }
    ```
- **GET `/api/print-agent/profile`**
  - **Description:** Retrieves the current print agent's profile information including online/offline status.
  - **Authentication:** Print Agent Token
  - **Response:** Returns complete profile with availability status
    ```json
    {
      "message": "Profile retrieved successfully",
      "printAgent": { /* full print agent object */ },
      "is_available": true,
      "status": "online"
    }
    ```
- **GET `/api/print-agent/print-jobs`**
  - **Description:** Retrieves a list of all print jobs assigned to the print agent.
  - **Authentication:** Print Agent Token

---

## 4. Print Job Endpoints (`/api/printjob`)

These endpoints are related to print job creation, management, and payment.

### Print Job Creation & Selection

- **POST `/api/printjob/create-print-job`**
  - **Description:** Creates a new print job. Requires file upload.
  - **Authentication:** Customer Token
  - **Request Body:** (multipart/form-data)
    - `print_job_title`: string
    - `print_job_description`: string
    - `is_color`: boolean (true/false)
    - `no_of_copies`: number
    - `file`: file (PDF, image)
- **POST `/api/printjob/select-print-agent/:jobId`**

  - **Description:** Assigns a print agent to a specific print job.
  - **Authentication:** Customer Token
  - **Path Parameters:** `jobId` (Print Job ID)
  - **Request Body:**

    ```json
    {
        "print_agent_id": "string" (Print Agent ID)
    }
    ```

### Payment & Coupons

- **GET `/api/printjob/get-saved-payment-methods`**
  - **Description:** Retrieves saved payment methods for the customer from Stripe.
  - **Authentication:** Customer Token
- **POST `/api/printjob/save-payment-method`**

  - **Description:** Saves a new payment method for the customer in Stripe.
  - **Authentication:** Customer Token
  - **Request Body:**

    ```json
    {
        "paymentMethodId": "string" (Stripe Payment Method ID)
    }
    ```

- **POST `/api/printjob/initiate-payment`**

  - **Description:** Initiates a payment for a print job and returns a client secret for Stripe's Payment Element.
  - **Authentication:** Customer Token
  - **Request Body:**

    ```json
    {
        "job_id": "string" (Print Job ID)
    }
    ```

- **POST `/api/printjob/apply-coupon`**

  - **Description:** Applies a coupon code to a print job, updating its total cost.
  - **Authentication:** Customer Token
  - **Request Body:**

    ```json
    {
        "job_id": "string" (Print Job ID),
        "coupon_code": "string"
    }
    ```

- **POST `/api/printjob/create-free-coupon`**

  - **Description:** Creates a 100% off coupon that can be used multiple times by different customers.
  - **Authentication:** Admin Token
  - **Request Body:** None
  - **Response:**

    ```json
    {
        "message": "100% off coupon created successfully",
        "coupon": {
            "id": "FREE100",
            "code": "FREE100",
            "percent_off": 100,
            "duration": "once",
            "name": "Free Print Job",
            "valid": true
        }
    }
    ```

- **GET `/api/printjob/check-payment-intent-status`**
  - **Description:** Checks the status of a Stripe Payment Intent using its client secret.
  - **Authentication:** Customer Token
  - **Query Parameters:** `clientSecret` (Stripe Payment Intent Client Secret)
- **GET `/api/printjob/customer-payment-methods`**
  - **Description:** Retrieves the customer's saved payment methods from Stripe.
  - **Authentication:** Customer Token

### Print Job Completion

- **POST `/api/printjob/complete-print-job`**

  - **Description:** Marks a print job as completed using a confirmation code.
  - **Authentication:** Print Agent Token
  - **Request Body:**

    ```json
    {
      "confirmation_code": "string"
    }
    ```

### Webhooks

- **POST `/api/printjob/stripe-webhook`**
  - **Description:** Stripe webhook endpoint for handling payment events (e.g., `payment_intent.succeeded`).
  - **Authentication:** Stripe Signature Verification
  - **Request Body:** Raw JSON from Stripe

---

## 5. General Endpoints

- **GET `/`**
  - **Description:** A simple health check endpoint. Returns "Hello World!".
  - **Authentication:** None
