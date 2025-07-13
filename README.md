# Twoem Website

This is the official repository for the Twoem website.

## Getting Started

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file by copying the example:
    ```bash
    cp .env.example .env
    ```
4.  Update the `.env` file with your configuration.

## Admin Password

The admin password must be a bcrypt hash. To generate a hash, you can use the following Node.js script:

```javascript
const bcrypt = require('bcryptjs');
const password = 'your_password_here';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);
console.log(hash);
```

Save this script as `hash.js` and run it with `node hash.js`. Copy the output to the `ADMIN1_PASSWORD_HASH` variable in your `.env` file.
