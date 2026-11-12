// Website settings.
// After deploying server/worker.js to Cloudflare, paste its URL here, e.g.
//   window.CS_AI_ENDPOINT = "https://cs-coach-ai.<your-subdomain>.workers.dev";
// Leave empty to run without AI on the website (the claude.ai version has AI built in).
window.CS_AI_ENDPOINT = "";

// Donations (Settings → Support CS Coach). The section stays hidden until a number is set.
// These values are public: anyone can read them in the website's code.
window.CS_DONATE = {
  name: "KA**N M** I.",   // as shown by GCash on the QR
  gcash: "0967 610 9767",
  maya: "",     // Maya number (leave empty to hide)
  qr: "icons/gcash-qr.png"
};

// Accounts & cloud sync (Firebase). Paste the "firebaseConfig" values from
// Firebase console → Project settings → Your apps → Web app. These are public identifiers
// (not secrets); your data is protected by the Firestore rules in firestore.rules.
// Leave apiKey empty to run without accounts (no sign-in popup is shown).
window.CS_FIREBASE = {
  apiKey: "AIzaSyB9YGegcn10IUooekzkKk3RZg3aj1MZls8",
  authDomain: "cs-coach-56fa1.firebaseapp.com",
  projectId: "cs-coach-56fa1",
  appId: "1:660323295036:web:42c30db9c008c534e20839"
};
