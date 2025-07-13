const readline = require('readline');
const bcrypt = require('bcryptjs');

const colors = {
  header: '\x1b[36m',      // Cyan
  prompt: '\x1b[33m',      // Yellow
  check: '\x1b[35m',       // Magenta
  hash: '\x1b[32m',        // Green
  reset: '\x1b[0m',        // Reset
  error: '\x1b[31m',       // Red
};

console.log(`${colors.header}
==============================================
   🟦✔️  Whiz Hashed Password Generator
==============================================
${colors.reset}`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function isStrongPassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return password.length >= minLength && hasUpperCase && hasLowerCase && hasDigit && hasSpecialChar;
}

function hashPassword(password) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

function promptPassword() {
  rl.question(`${colors.prompt}Please enter your password:${colors.reset}\n> `, (password) => {
    console.log(`${colors.check}\nChecking password strength...${colors.reset}`);

    if (!isStrongPassword(password)) {
      console.log(`${colors.error}
❌ Password is not strong enough!
It must be at least 8 characters long and include:
- Uppercase letter
- Lowercase letter
- Digit
- Special character
${colors.reset}`);

      promptRetryOrExit(promptPassword);
      return;
    }

    const hashedPassword = hashPassword(password);
    console.log(`${colors.hash}
✅ Success! Here is your strong, hashed password:
${hashedPassword}
${colors.reset}`);

    promptGenerateNewOrExit();
  });
}

function promptRetryOrExit(callback) {
  rl.question(`${colors.prompt}Press 'R' to retry entering password or any other key to exit.${colors.reset}\n> `, (input) => {
    const choice = input.trim().toUpperCase();
    if (choice === 'R') {
      callback();
    } else {
      rl.close();
    }
  });
}

function promptGenerateNewOrExit() {
  rl.question(`${colors.prompt}Press 'P' to generate a new hashed password or any other key to exit.${colors.reset}\n> `, (input) => {
    const choice = input.trim().toUpperCase();
    if (choice === 'P') {
      promptPassword();
    } else {
      rl.close();
    }
  });
}

// Start the program
promptPassword();
