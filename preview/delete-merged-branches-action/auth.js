// Mocked authentication — no real backend, session stored in localStorage.
const MOCK_USERS = [
  { email: "admin@example.com", password: "password123", name: "Admin" },
  { email: "user@example.com", password: "user123", name: "Jane Doe" },
];

const SESSION_KEY = "mockSession";

function login(email, password) {
  // Simulate network latency
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const user = MOCK_USERS.find(
        (u) => u.email === email.trim().toLowerCase() && u.password === password
      );
      if (user) {
        const session = { email: user.email, name: user.name, loggedInAt: Date.now() };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        resolve(session);
      } else {
        reject(new Error("Invalid email or password."));
      }
    }, 600);
  });
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}
