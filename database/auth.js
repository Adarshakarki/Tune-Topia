import crypto from "crypto";
import { readDB, writeDB, setSession, getSession } from "./database.js";

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// First time setup — single user app
/**
 * Registers the primary user for the application.
 * @param {string} username 
 * @param {string} email 
 * @param {string} password 
 * @returns {Omit<Object, 'passwordHash'>} The user object without the hash.
 */
export function register(username, email, password) {
  const db = readDB();
  if (db.user) throw new Error("User already exists.");

  db.user = {
    id: "1",
    username,
    email,
    passwordHash: hashPassword(password),
    profile: {
      name: username,
      imageUrl: "",
      backgroundImageUrl: "",
      description: ""
    },
    createdAt: new Date().toISOString()
  };

  writeDB(db);
  
  // Auto-login after registration
  setSession(db.user.id);

  const { passwordHash, ...safeUser } = db.user;
  return safeUser;
}

// Login
export function login(email, password) {
  const db = readDB();
  if (!db.user) throw new Error("No user found. Please register first.");
  if (db.user.email !== email) throw new Error("Email not found.");
  if (db.user.passwordHash !== hashPassword(password)) throw new Error("Wrong password.");

  // Persist the login state
  setSession(db.user.id);

  const { passwordHash, ...safeUser } = db.user;
  return safeUser;
}

// Logout
export function logout() {
  setSession(null);
}

// Get profile
export function getProfile() {
  const db = readDB();
  const currentSessionId = getSession();

  if (!db.user || currentSessionId !== db.user.id) return null;

  const { passwordHash, ...safeUser } = db.user;
  return safeUser;
}

// Update profile fields (name, imageUrl, backgroundImageUrl, description)
export function updateProfile(updates) {
  const db = readDB();
  if (!db.user) throw new Error("No user found.");
  db.user.profile = { ...db.user.profile, ...updates };
  writeDB(db);
  return db.user.profile;
}